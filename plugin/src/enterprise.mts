// Opt-in display of the monthly spend limit for claude.ai Team and Enterprise logins.
//
// Claude Code does not send these values to status lines for Team and Enterprise logins, so this module
// reads them from the same endpoint that /usage uses. The endpoint is not public and can change.
// The display is off unless the user turns it on with `/professional-statusline:setup enterprise-spend on`.
// Whenever anything is missing or fails, nothing is shown (fail-safe).

import { execFileSync, spawn } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DIM, paint } from "./ansi.mts";
import {
  colorForRemaining,
  formatMoney,
  formatMonthDay,
  formatUntil,
  remainingFromUsed,
} from "./format.mts";
import { num, str } from "./input.mts";
import { claudeJsonCandidates, configDir } from "./paths.mts";

const REFRESH_EVERY_SEC = 300;
const STALE_AFTER_SEC = 1800;
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";

export interface PluginConfig {
  enterpriseSpend?: boolean;
}

interface ExtraUsage {
  is_enabled?: boolean;
  monthly_limit?: number | null;
  used_credits?: number | null;
  utilization?: number | null;
  decimal_places?: number | null;
  currency?: string | null;
}

interface UsageCache {
  fetched_at?: number;
  extra_usage?: ExtraUsage | null;
}

export const files = (dataDir: string) => ({
  config: join(dataDir, "config.json"),
  cache: join(dataDir, "usage-cache.json"),
  stamp: join(dataDir, "usage-stamp"),
});

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

export function readConfig(dataDir: string): PluginConfig {
  return readJson<PluginConfig>(files(dataDir).config) ?? {};
}

export function isTeamOrEnterprise(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  for (const path of claudeJsonCandidates(env)) {
    const state = readJson<{ oauthAccount?: { organizationType?: string } }>(
      path,
    );
    if (!state) continue;
    const type = state.oauthAccount?.organizationType;
    return type === "claude_enterprise" || type === "claude_team";
  }
  return false;
}

// Starts a background refresh at most every 5 minutes. The status line never waits for the network.
export function scheduleRefresh(
  dataDir: string,
  scriptPath: string,
  nowSec: number,
): void {
  const { stamp } = files(dataDir);
  const last = Number(readFileOrEmpty(stamp));
  if (Number.isFinite(last) && nowSec - last < REFRESH_EVERY_SEC) return;
  try {
    writeFileSync(stamp, String(nowSec));
    const child = spawn(process.execPath, [scriptPath, "--refresh-usage"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Can't write the stamp or start the process: show nothing and try again on the next render.
  }
}

function readFileOrEmpty(path: string): string {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

// The access token of the signed-in Claude Code. It stays inside this process and is sent only to Anthropic.
export function readAccessToken(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const sources: Array<() => string> = [];
  if (platform === "darwin") {
    sources.push(() =>
      execFileSync(
        "security",
        ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 5000,
        },
      ),
    );
  }
  sources.push(() =>
    readFileSync(join(configDir(env), ".credentials.json"), "utf8"),
  );
  for (const source of sources) {
    try {
      const token = str(
        (JSON.parse(source()) as { claudeAiOauth?: { accessToken?: unknown } })
          .claudeAiOauth?.accessToken,
      );
      if (token) return token;
    } catch {
      // Try the next source.
    }
  }
  return undefined;
}

export interface RefreshDeps {
  readToken: () => string | undefined;
  fetch: typeof fetch;
  nowSec: () => number;
}

const defaultDeps: RefreshDeps = {
  readToken: () => readAccessToken(process.env),
  fetch: (...args) => fetch(...args),
  nowSec: () => Math.floor(Date.now() / 1000),
};

export async function refreshUsage(
  dataDir: string,
  deps: RefreshDeps = defaultDeps,
): Promise<void> {
  if (readConfig(dataDir).enterpriseSpend !== true) return;
  const token = deps.readToken();
  if (!token) return;
  const response = await deps.fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return;
  const body = (await response.json()) as { extra_usage?: ExtraUsage | null };
  const cache: UsageCache = {
    fetched_at: deps.nowSec(),
    extra_usage: body.extra_usage ?? null,
  };
  const { cache: cachePath } = files(dataDir);
  writeFileSync(`${cachePath}.tmp`, JSON.stringify(cache));
  renameSync(`${cachePath}.tmp`, cachePath);
}

// The first moment of next month in UTC. The endpoint does not return the reset time,
// and the monthly limit resets at 00:00 UTC on the first day of each month.
export function nextMonthlyReset(nowSec: number): number {
  const now = new Date(nowSec * 1000);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000;
}

// "💳 $1,059.85 / $2,000.00 ↻1d21h (11/1)", or undefined when there is nothing fresh to show.
export function enterpriseSpendSegment(
  dataDir: string,
  nowSec: number,
): string | undefined {
  const cache = readJson<UsageCache>(files(dataDir).cache);
  const fetchedAt = num(cache?.fetched_at);
  if (fetchedAt === undefined || nowSec - fetchedAt >= STALE_AFTER_SEC)
    return undefined;
  const usage = cache?.extra_usage;
  const used = num(usage?.used_credits);
  const limit = num(usage?.monthly_limit);
  if (usage?.is_enabled !== true || used === undefined || limit === undefined)
    return undefined;

  const decimals = num(usage.decimal_places) ?? 2;
  const currency = str(usage.currency) ?? "USD";
  const money = (minor: number) =>
    formatMoney(minor / 10 ** decimals, currency, decimals);
  const left = remainingFromUsed(
    num(usage.utilization) ?? (used * 100) / limit,
  );
  let segment = paint(
    colorForRemaining(left),
    `💳 ${money(used)} / ${money(limit)}`,
  );

  const resetAt = nextMonthlyReset(nowSec);
  const until = formatUntil(resetAt, nowSec);
  const day = formatMonthDay(resetAt);
  segment += ` ${paint(DIM, until ? `↻${until} (${day})` : `↻${day}`)}`;
  return segment;
}
