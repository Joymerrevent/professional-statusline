import {
  CYAN,
  DIM,
  GREEN,
  MAGENTA,
  RED,
  WHITE,
  YELLOW,
  paint,
  rgb,
} from "./ansi.mts";
import { contextRemaining } from "./context.mts";
import {
  clampPercent,
  colorForRemaining,
  formatMoney,
  formatMonthDay,
  formatUntil,
  remainingFromUsed,
} from "./format.mts";
import type { GitInfo } from "./git.mts";
import { num, str, type RateWindow, type StatusInput } from "./input.mts";

export interface RenderContext {
  nowSec: number;
  // Repository state of the working directory, or undefined outside a repository.
  git: GitInfo | undefined;
  // Spend segment from the opt-in Team / Enterprise display. Used only when Claude Code sends no spend limit.
  enterpriseSpend?: string | undefined;
}

const SEPARATOR = ` ${paint(DIM, "·")} `;

function join(segments: Array<string | undefined>): string {
  return segments.filter((s): s is string => Boolean(s)).join(SEPARATOR);
}

// Effort in the colors of Claude Code's /effort screen (dark theme):
// low = warning, medium = success, high = permission, xhigh = autoAccept, max = rainbow.
// Claude Code also animates xhigh and max. The status line keeps the colors only.
export function effortLabel(level: string): string {
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

function modelSegment(input: StatusInput): string {
  const model = str(input.model?.display_name) ?? str(input.model?.id) ?? "?";
  const effort = str(input.effort?.level);
  return `🧠 ${paint(CYAN, model)}${effort ? ` ${effortLabel(effort)}` : ""}`;
}

function costSegment(input: StatusInput): string {
  return paint(DIM, `💰$${(num(input.cost?.total_cost_usd) ?? 0).toFixed(2)}`);
}

function diffSegment(input: StatusInput): string {
  const added = num(input.cost?.total_lines_added) ?? 0;
  const removed = num(input.cost?.total_lines_removed) ?? 0;
  return `${paint(GREEN, `+${added}`)} ${paint(RED, `-${removed}`)}`;
}

function contextSegment(input: StatusInput): string {
  const left = contextRemaining(input);
  if (left === undefined) return paint(DIM, "💭 ctx --");
  return paint(colorForRemaining(left), `💭 ctx ${left}% left`);
}

// "5h 86% left ↻1h21m"
function rateSegment(
  label: string,
  window: RateWindow | undefined,
  nowSec: number,
): string | undefined {
  const used = num(window?.used_percentage);
  if (used === undefined) return undefined;
  const left = remainingFromUsed(used);
  let segment = paint(colorForRemaining(left), `${label} ${left}% left`);
  const resetAt = num(window?.resets_at);
  const until = resetAt === undefined ? "" : formatUntil(resetAt, nowSec);
  if (until) segment += ` ${paint(DIM, `↻${until}`)}`;
  return segment;
}

// Spend limit that Claude Code sends behind a Claude apps gateway:
// "💳 $314.12 / $500.00 ↻1d21h (11/1)", or "💳 37% left ↻…" until the dollar amounts arrive.
function spendLimitSegment(
  input: StatusInput,
  nowSec: number,
): string | undefined {
  const spend = input.rate_limits?.spend_limit;
  const usedPercent = num(spend?.used_percentage);
  if (usedPercent === undefined) return undefined;
  const left = remainingFromUsed(usedPercent);
  const usedUsd = num(spend?.used_usd);
  const limitUsd = num(spend?.limit_usd);
  const amount =
    usedUsd !== undefined && limitUsd !== undefined
      ? `💳 ${formatMoney(usedUsd)} / ${formatMoney(limitUsd)}`
      : `💳 ${clampPercent(left)}% left`;
  let segment = paint(colorForRemaining(left), amount);
  const resetAt = num(spend?.resets_at);
  if (resetAt !== undefined) {
    const until = formatUntil(resetAt, nowSec);
    const day = formatMonthDay(resetAt);
    segment += ` ${paint(DIM, until ? `↻${until} (${day})` : `↻${day}`)}`;
  }
  return segment;
}

function vimSegment(input: StatusInput): string | undefined {
  switch (input.vim?.mode) {
    case "NORMAL":
      return paint(CYAN, "[N]");
    case "INSERT":
      return paint(GREEN, "[I]");
    case "VISUAL":
    case "VISUAL LINE":
      return paint(MAGENTA, "[V]");
    default:
      return undefined;
  }
}

// Inside a repository: "📁 [repo]/path/in/repo (branch) * ↑1 ↓2". Outside: "📁 folder".
function locationSegment(cwd: string, git: GitInfo | undefined): string {
  if (!git) {
    const folder = cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd;
    return paint(GREEN, `📁 ${folder}`);
  }
  // Same colors as a typical shell prompt: the root slash in white, the rest of the path in yellow.
  let segment = `${paint(GREEN, `📁 [${git.repoName}]`)}${paint(WHITE, "/")}`;
  if (git.prefix) segment += paint(YELLOW, git.prefix);
  segment += ` ${paint(CYAN, `(${git.branch})`)}`;
  const marks = [
    git.dirty ? "*" : "",
    git.ahead > 0 ? `↑${git.ahead}` : "",
    git.behind > 0 ? `↓${git.behind}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (marks) segment += ` ${paint(YELLOW, marks)}`;
  return segment;
}

export function workingDirectory(input: StatusInput): string {
  return str(input.workspace?.current_dir) ?? str(input.cwd) ?? process.cwd();
}

// Three lines: session / meters / environment. Empty lines are left out.
export function render(input: StatusInput, ctx: RenderContext): string {
  const rate5 = rateSegment("5h", input.rate_limits?.five_hour, ctx.nowSec);
  const rate7 = rateSegment("7d", input.rate_limits?.seven_day, ctx.nowSec);
  // The hourglass goes on the first rate segment only.
  const hourglass = `${paint(DIM, "⏳")} `;
  const rates = rate5
    ? [hourglass + rate5, rate7]
    : [rate7 ? hourglass + rate7 : undefined];

  const line1 = join([
    modelSegment(input),
    costSegment(input),
    diffSegment(input),
  ]);
  const line2 = join([
    contextSegment(input),
    ...rates,
    spendLimitSegment(input, ctx.nowSec) ?? ctx.enterpriseSpend,
  ]);
  const line3 = join([
    vimSegment(input),
    locationSegment(workingDirectory(input), ctx.git),
  ]);
  return [line1, line2, line3].filter(Boolean).join("\n");
}
