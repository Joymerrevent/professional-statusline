// node:test's test() returns a promise that the test runner itself awaits.
/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  enterpriseSpendSegment,
  files,
  isTeamOrEnterprise,
  readAccessToken,
  refreshUsage,
  scheduleRefresh,
  type RefreshDeps,
} from "../src/enterprise.ts";
import { stripAnsi, tempDir } from "./helpers.ts";

const NOW = Date.UTC(2026, 9, 30, 3, 0) / 1000;
const extraUsage = {
  is_enabled: true,
  monthly_limit: 200_000,
  used_credits: 105_985,
  utilization: 53,
  decimal_places: 2,
  currency: "USD",
};

function dataDir(config: object = { enterpriseSpend: true }): string {
  const dir = join(tempDir(), "data");
  mkdirSync(dir);
  writeFileSync(files(dir).config, JSON.stringify(config));
  return dir;
}

function writeCache(
  dir: string,
  fetchedAt: number,
  usage: object | null = extraUsage,
): void {
  writeFileSync(
    files(dir).cache,
    JSON.stringify({ fetched_at: fetchedAt, extra_usage: usage }),
  );
}

test("a fresh cache shows used / limit, the countdown, and the reset day", () => {
  const dir = dataDir();
  writeCache(dir, NOW - 60);
  const day = `${new Date(Date.UTC(2026, 10, 1)).getMonth() + 1}/${new Date(Date.UTC(2026, 10, 1)).getDate()}`;
  assert.equal(
    stripAnsi(enterpriseSpendSegment(dir, NOW) ?? ""),
    `💳 $1,059.85 / $2,000.00 ↻1d21h (${day})`,
  );
});

test("a cache older than 30 minutes, a disabled limit, or no cache shows nothing", () => {
  const stale = dataDir();
  writeCache(stale, NOW - 1800);
  assert.equal(enterpriseSpendSegment(stale, NOW), undefined);
  const disabled = dataDir();
  writeCache(disabled, NOW, {
    is_enabled: false,
    monthly_limit: null,
    used_credits: null,
  });
  assert.equal(enterpriseSpendSegment(disabled, NOW), undefined);
  assert.equal(enterpriseSpendSegment(dataDir(), NOW), undefined);
});

test("only claude_team and claude_enterprise logins count", () => {
  const home = tempDir();
  const env = {
    HOME: home,
    USERPROFILE: home,
    CLAUDE_CONFIG_DIR: join(home, "config"),
  };
  assert.equal(isTeamOrEnterprise(env), false);
  for (const [type, expected] of [
    ["claude_team", true],
    ["claude_enterprise", true],
    ["claude_max", false],
  ] as const) {
    writeFileSync(
      join(home, ".claude.json"),
      JSON.stringify({ oauthAccount: { organizationType: type } }),
    );
    assert.equal(isTeamOrEnterprise(env), expected, type);
  }
});

test("the token is read from .credentials.json outside macOS", () => {
  const config = tempDir();
  const env = { HOME: config, USERPROFILE: config, CLAUDE_CONFIG_DIR: config };
  assert.equal(readAccessToken(env, "linux"), undefined);
  writeFileSync(
    join(config, ".credentials.json"),
    JSON.stringify({ claudeAiOauth: { accessToken: "test-token" } }),
  );
  assert.equal(readAccessToken(env, "linux"), "test-token");
});

function fakeDeps(response: Response, token: string | undefined) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const deps: RefreshDeps = {
    readToken: () => token,
    fetch: (url, init) => {
      calls.push({
        url: url instanceof Request ? url.url : url.toString(),
        init,
      });
      return Promise.resolve(response);
    },
    nowSec: () => NOW,
  };
  return { deps, calls };
}

test("refreshUsage sends the token in a header and caches extra_usage", async () => {
  const dir = dataDir();
  const { deps, calls } = fakeDeps(
    new Response(JSON.stringify({ five_hour: null, extra_usage: extraUsage })),
    "test-token",
  );
  await refreshUsage(dir, deps);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://api.anthropic.com/api/oauth/usage");
  assert.equal(
    (calls[0]?.init?.headers as Record<string, string>)["Authorization"],
    "Bearer test-token",
  );
  assert.deepEqual(JSON.parse(readFileSync(files(dir).cache, "utf8")), {
    fetched_at: NOW,
    extra_usage: extraUsage,
  });
});

test("refreshUsage does nothing while the display is off or without a token", async () => {
  const off = dataDir({ enterpriseSpend: false });
  const offRun = fakeDeps(new Response("{}"), "test-token");
  await refreshUsage(off, offRun.deps);
  assert.equal(offRun.calls.length, 0);

  const noToken = dataDir();
  const noTokenRun = fakeDeps(new Response("{}"), undefined);
  await refreshUsage(noToken, noTokenRun.deps);
  assert.equal(noTokenRun.calls.length, 0);
  assert.equal(existsSync(files(noToken).cache), false);
});

test("refreshUsage keeps the old cache when the endpoint fails", async () => {
  const dir = dataDir();
  writeCache(dir, NOW - 100);
  const before = readFileSync(files(dir).cache, "utf8");
  await refreshUsage(
    dir,
    fakeDeps(new Response("nope", { status: 500 }), "test-token").deps,
  );
  assert.equal(readFileSync(files(dir).cache, "utf8"), before);
});

test("scheduleRefresh starts the refresh at most every 5 minutes", async () => {
  const dir = dataDir();
  const marker = join(dir, "ran");
  const script = join(dir, "fake-statusline.mjs");
  writeFileSync(
    script,
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, process.argv.slice(2).join(" "));`,
  );

  writeFileSync(files(dir).stamp, String(NOW - 299));
  scheduleRefresh(dir, script, NOW);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(existsSync(marker), false);

  writeFileSync(files(dir).stamp, String(NOW - 300));
  scheduleRefresh(dir, script, NOW);
  for (let i = 0; i < 50 && !existsSync(marker); i++)
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(readFileSync(marker, "utf8"), "--refresh-usage");
  assert.equal(readFileSync(files(dir).stamp, "utf8"), String(NOW));
});
