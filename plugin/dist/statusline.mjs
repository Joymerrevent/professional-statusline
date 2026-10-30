// src/statusline.ts
import { readFileSync as readFileSync2 } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// src/enterprise.ts
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join as join2 } from "node:path";

// src/ansi.ts
var RESET = "\x1B[0m";
var DIM = "\x1B[2m";
var RED = "\x1B[31m";
var GREEN = "\x1B[32m";
var YELLOW = "\x1B[33m";
var MAGENTA = "\x1B[35m";
var CYAN = "\x1B[36m";
var WHITE = "\x1B[37m";
function rgb(r, g, b) {
  return `\x1B[38;2;${r};${g};${b}m`;
}
function paint(color, text) {
  return `${color}${text}${RESET}`;
}

// src/format.ts
function colorForRemaining(percent) {
  if (percent >= 50) return GREEN;
  if (percent >= 20) return YELLOW;
  return RED;
}
function remainingFromUsed(usedPercent) {
  return clampPercent(100 - Math.round(usedPercent));
}
function clampPercent(percent) {
  return Math.min(100, Math.max(0, Math.round(percent)));
}
function formatUntil(resetAtSec, nowSec) {
  const left = Math.floor(resetAtSec - nowSec);
  if (left <= 0) return "";
  if (left >= 86400)
    return `${Math.floor(left / 86400)}d${Math.floor(left % 86400 / 3600)}h`;
  if (left >= 3600)
    return `${Math.floor(left / 3600)}h${Math.floor(left % 3600 / 60)}m`;
  return `${Math.ceil(left / 60)}m`;
}
function formatMonthDay(epochSec) {
  const d = new Date(epochSec * 1e3);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function formatMoney(amount, currency = "USD", decimals = 2) {
  const digits = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount);
  return currency === "USD" ? `$${digits}` : `${currency} ${digits}`;
}

// src/input.ts
function parseInput(text) {
  try {
    const value = JSON.parse(text);
    return typeof value === "object" && value !== null ? value : {};
  } catch {
    return {};
  }
}
function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function str(value) {
  return typeof value === "string" && value !== "" ? value : void 0;
}

// src/paths.ts
import { homedir } from "node:os";
import { join } from "node:path";
function homeDir(env = process.env) {
  return (process.platform === "win32" ? env["USERPROFILE"] : env["HOME"]) || homedir();
}
function configDir(env = process.env) {
  return env["CLAUDE_CONFIG_DIR"] || join(homeDir(env), ".claude");
}
function claudeJsonCandidates(env = process.env) {
  const candidates = [join(homeDir(env), ".claude.json")];
  const custom = env["CLAUDE_CONFIG_DIR"];
  if (custom) candidates.unshift(join(custom, ".claude.json"));
  return candidates;
}

// src/enterprise.ts
var REFRESH_EVERY_SEC = 300;
var STALE_AFTER_SEC = 1800;
var USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
var files = (dataDir2) => ({
  config: join2(dataDir2, "config.json"),
  cache: join2(dataDir2, "usage-cache.json"),
  stamp: join2(dataDir2, "usage-stamp")
});
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return void 0;
  }
}
function readConfig(dataDir2) {
  return readJson(files(dataDir2).config) ?? {};
}
function isTeamOrEnterprise(env = process.env) {
  for (const path of claudeJsonCandidates(env)) {
    const state = readJson(
      path
    );
    if (!state) continue;
    const type = state.oauthAccount?.organizationType;
    return type === "claude_enterprise" || type === "claude_team";
  }
  return false;
}
function scheduleRefresh(dataDir2, scriptPath2, nowSec) {
  const { stamp } = files(dataDir2);
  const last = Number(readFileOrEmpty(stamp));
  if (Number.isFinite(last) && nowSec - last < REFRESH_EVERY_SEC) return;
  try {
    writeFileSync(stamp, String(nowSec));
    const child = spawn(process.execPath, [scriptPath2, "--refresh-usage"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.on("error", () => {
    });
    child.unref();
  } catch {
  }
}
function readFileOrEmpty(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}
function readAccessToken(env, platform = process.platform) {
  const sources = [];
  if (platform === "darwin") {
    sources.push(
      () => execFileSync(
        "security",
        ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 5e3
        }
      )
    );
  }
  sources.push(
    () => readFileSync(join2(configDir(env), ".credentials.json"), "utf8")
  );
  for (const source of sources) {
    try {
      const token = str(
        JSON.parse(source()).claudeAiOauth?.accessToken
      );
      if (token) return token;
    } catch {
    }
  }
  return void 0;
}
var defaultDeps = {
  readToken: () => readAccessToken(process.env),
  fetch: (...args) => fetch(...args),
  nowSec: () => Math.floor(Date.now() / 1e3)
};
async function refreshUsage(dataDir2, deps = defaultDeps) {
  if (readConfig(dataDir2).enterpriseSpend !== true) return;
  const token = deps.readToken();
  if (!token) return;
  const response = await deps.fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20"
    },
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) return;
  const body = await response.json();
  const cache = {
    fetched_at: deps.nowSec(),
    extra_usage: body.extra_usage ?? null
  };
  const { cache: cachePath } = files(dataDir2);
  writeFileSync(`${cachePath}.tmp`, JSON.stringify(cache));
  renameSync(`${cachePath}.tmp`, cachePath);
}
function nextMonthlyReset(nowSec) {
  const now = new Date(nowSec * 1e3);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1e3;
}
function enterpriseSpendSegment(dataDir2, nowSec) {
  const cache = readJson(files(dataDir2).cache);
  const fetchedAt = num(cache?.fetched_at);
  if (fetchedAt === void 0 || nowSec - fetchedAt >= STALE_AFTER_SEC)
    return void 0;
  const usage = cache?.extra_usage;
  const used = num(usage?.used_credits);
  const limit = num(usage?.monthly_limit);
  if (usage?.is_enabled !== true || used === void 0 || limit === void 0)
    return void 0;
  const decimals = num(usage.decimal_places) ?? 2;
  const currency = str(usage.currency) ?? "USD";
  const money = (minor) => formatMoney(minor / 10 ** decimals, currency, decimals);
  const left = remainingFromUsed(
    num(usage.utilization) ?? used * 100 / limit
  );
  let segment = paint(
    colorForRemaining(left),
    `\u{1F4B3} ${money(used)} / ${money(limit)}`
  );
  const resetAt = nextMonthlyReset(nowSec);
  const until = formatUntil(resetAt, nowSec);
  const day = formatMonthDay(resetAt);
  segment += ` ${paint(DIM, until ? `\u21BB${until} (${day})` : `\u21BB${day}`)}`;
  return segment;
}

// src/git.ts
import { execFileSync as execFileSync2 } from "node:child_process";
function git(cwd, args) {
  try {
    return execFileSync2("git", ["--no-optional-locks", "-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2e3,
      windowsHide: true
    });
  } catch {
    return void 0;
  }
}
function readGitInfo(cwd) {
  const status = git(cwd, ["status", "--porcelain=v2", "--branch"]);
  if (status === void 0) return void 0;
  const where = git(cwd, ["rev-parse", "--show-toplevel", "--show-prefix"]);
  if (where === void 0) return void 0;
  const [top = "", prefix = ""] = where.split(/\r?\n/);
  if (top === "") return void 0;
  let oid = "";
  let head = "";
  let ahead = 0;
  let behind = 0;
  let dirty = false;
  for (const line of status.split(/\r?\n/)) {
    if (line.startsWith("# branch.oid "))
      oid = line.slice("# branch.oid ".length);
    else if (line.startsWith("# branch.head "))
      head = line.slice("# branch.head ".length);
    else if (line.startsWith("# branch.ab ")) {
      const m = /^# branch\.ab \+(\d+) -(\d+)/.exec(line);
      if (m) {
        ahead = Number(m[1]);
        behind = Number(m[2]);
      }
    } else if (line !== "" && !line.startsWith("#")) dirty = true;
  }
  const branch = head === "(detached)" ? oid.slice(0, 7) : head;
  return {
    repoName: top.split(/[\\/]/).filter(Boolean).pop() ?? top,
    prefix: prefix.replace(/\/$/, ""),
    branch,
    dirty,
    ahead,
    behind
  };
}

// src/context.ts
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
var DEFAULT_WINDOW = 2e5;
var TAIL_BYTES = 256 * 1024;
function lastUsageTokens(transcriptPath) {
  let text;
  try {
    const fd = openSync(transcriptPath, "r");
    try {
      const size = fstatSync(fd).size;
      const length = Math.min(size, TAIL_BYTES);
      const buffer = Buffer.alloc(length);
      readSync(fd, buffer, 0, length, size - length);
      text = buffer.toString("utf8");
    } finally {
      closeSync(fd);
    }
  } catch {
    return 0;
  }
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || !line.includes('"usage"')) continue;
    try {
      const usage = JSON.parse(line).message?.usage;
      if (!usage) continue;
      return (num(usage.input_tokens) ?? 0) + (num(usage.cache_read_input_tokens) ?? 0) + (num(usage.cache_creation_input_tokens) ?? 0) + (num(usage.output_tokens) ?? 0);
    } catch {
    }
  }
  return 0;
}
function contextRemaining(input) {
  const cw = input.context_window;
  const remaining = num(cw?.remaining_percentage);
  if (remaining !== void 0) return clampPercent(remaining);
  const used = num(cw?.used_percentage);
  if (used !== void 0) return remainingFromUsed(used);
  const transcript = input.transcript_path;
  if (!transcript) return void 0;
  const tokens = lastUsageTokens(transcript);
  if (tokens <= 0) return void 0;
  const window = num(cw?.context_window_size) ?? DEFAULT_WINDOW;
  return clampPercent(100 - tokens * 100 / window);
}

// src/render.ts
var SEPARATOR = ` ${paint(DIM, "\xB7")} `;
function join3(segments) {
  return segments.filter((s) => Boolean(s)).join(SEPARATOR);
}
function effortLabel(level) {
  switch (level) {
    case "low":
      return paint(rgb(255, 193, 7), level);
    case "medium":
      return paint(rgb(78, 186, 101), level);
    case "high":
      return paint(rgb(177, 185, 249), level);
    case "xhigh":
      return paint(rgb(175, 135, 255), level);
    case "max":
      return `${rgb(235, 95, 87)}m${rgb(245, 139, 87)}a${paint(rgb(250, 195, 95), "x")}`;
    default:
      return level;
  }
}
function modelSegment(input) {
  const model = str(input.model?.display_name) ?? str(input.model?.id) ?? "?";
  const effort = str(input.effort?.level);
  return `\u{1F9E0} ${paint(CYAN, model)}${effort ? ` ${effortLabel(effort)}` : ""}`;
}
function costSegment(input) {
  return paint(DIM, `\u{1F4B0}$${(num(input.cost?.total_cost_usd) ?? 0).toFixed(2)}`);
}
function diffSegment(input) {
  const added = num(input.cost?.total_lines_added) ?? 0;
  const removed = num(input.cost?.total_lines_removed) ?? 0;
  return `${paint(GREEN, `+${added}`)} ${paint(RED, `-${removed}`)}`;
}
function contextSegment(input) {
  const left = contextRemaining(input);
  if (left === void 0) return paint(DIM, "\u{1F4AD} ctx --");
  return paint(colorForRemaining(left), `\u{1F4AD} ctx ${left}% left`);
}
function rateSegment(label, window, nowSec) {
  const used = num(window?.used_percentage);
  if (used === void 0) return void 0;
  const left = remainingFromUsed(used);
  let segment = paint(colorForRemaining(left), `${label} ${left}% left`);
  const resetAt = num(window?.resets_at);
  const until = resetAt === void 0 ? "" : formatUntil(resetAt, nowSec);
  if (until) segment += ` ${paint(DIM, `\u21BB${until}`)}`;
  return segment;
}
function spendLimitSegment(input, nowSec) {
  const spend = input.rate_limits?.spend_limit;
  const usedPercent = num(spend?.used_percentage);
  if (usedPercent === void 0) return void 0;
  const left = remainingFromUsed(usedPercent);
  const usedUsd = num(spend?.used_usd);
  const limitUsd = num(spend?.limit_usd);
  const amount = usedUsd !== void 0 && limitUsd !== void 0 ? `\u{1F4B3} ${formatMoney(usedUsd)} / ${formatMoney(limitUsd)}` : `\u{1F4B3} ${clampPercent(left)}% left`;
  let segment = paint(colorForRemaining(left), amount);
  const resetAt = num(spend?.resets_at);
  if (resetAt !== void 0) {
    const until = formatUntil(resetAt, nowSec);
    const day = formatMonthDay(resetAt);
    segment += ` ${paint(DIM, until ? `\u21BB${until} (${day})` : `\u21BB${day}`)}`;
  }
  return segment;
}
function vimSegment(input) {
  switch (input.vim?.mode) {
    case "NORMAL":
      return paint(CYAN, "[N]");
    case "INSERT":
      return paint(GREEN, "[I]");
    case "VISUAL":
    case "VISUAL LINE":
      return paint(MAGENTA, "[V]");
    default:
      return void 0;
  }
}
function locationSegment(cwd, git2) {
  if (!git2) {
    const folder = cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd;
    return paint(GREEN, `\u{1F4C1} ${folder}`);
  }
  let segment = `${paint(GREEN, `\u{1F4C1} [${git2.repoName}]`)}${paint(WHITE, "/")}`;
  if (git2.prefix) segment += paint(YELLOW, git2.prefix);
  segment += ` ${paint(CYAN, `(${git2.branch})`)}`;
  const marks = [
    git2.dirty ? "*" : "",
    git2.ahead > 0 ? `\u2191${git2.ahead}` : "",
    git2.behind > 0 ? `\u2193${git2.behind}` : ""
  ].filter(Boolean).join(" ");
  if (marks) segment += ` ${paint(YELLOW, marks)}`;
  return segment;
}
function workingDirectory(input) {
  return str(input.workspace?.current_dir) ?? str(input.cwd) ?? process.cwd();
}
function render(input, ctx) {
  const rate5 = rateSegment("5h", input.rate_limits?.five_hour, ctx.nowSec);
  const rate7 = rateSegment("7d", input.rate_limits?.seven_day, ctx.nowSec);
  const hourglass = `${paint(DIM, "\u23F3")} `;
  const rates = rate5 ? [hourglass + rate5, rate7] : [rate7 ? hourglass + rate7 : void 0];
  const line1 = join3([
    modelSegment(input),
    costSegment(input),
    diffSegment(input)
  ]);
  const line2 = join3([
    contextSegment(input),
    ...rates,
    spendLimitSegment(input, ctx.nowSec) ?? ctx.enterpriseSpend
  ]);
  const line3 = join3([
    vimSegment(input),
    locationSegment(workingDirectory(input), ctx.git)
  ]);
  return [line1, line2, line3].filter(Boolean).join("\n");
}

// src/statusline.ts
var scriptPath = fileURLToPath(import.meta.url);
var dataDir = dirname(scriptPath);
async function main() {
  if (process.argv.includes("--refresh-usage")) {
    await refreshUsage(dataDir).catch(() => {
    });
    return;
  }
  let stdin = "";
  try {
    stdin = readFileSync2(0, "utf8");
  } catch {
  }
  const input = parseInput(stdin);
  const nowSec = Math.floor(Date.now() / 1e3);
  let enterpriseSpend;
  if (input.rate_limits?.spend_limit === void 0 && readConfig(dataDir).enterpriseSpend === true && isTeamOrEnterprise()) {
    scheduleRefresh(dataDir, scriptPath, nowSec);
    enterpriseSpend = enterpriseSpendSegment(dataDir, nowSec);
  }
  process.stdout.write(
    render(input, {
      nowSec,
      git: readGitInfo(workingDirectory(input)),
      enterpriseSpend
    })
  );
}
void main();
