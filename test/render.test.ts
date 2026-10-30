import assert from "node:assert/strict";
import { test } from "node:test";
import { rgb } from "../plugin/src/ansi.mts";
import type { GitInfo } from "../plugin/src/git.mts";
import type { StatusInput } from "../plugin/src/input.mts";
import { effortLabel, render } from "../plugin/src/render.mts";
import { stripAnsi } from "./helpers.ts";

const NOW = 1_800_000_000;
const plain = (input: StatusInput, git?: GitInfo, enterpriseSpend?: string) =>
  stripAnsi(render(input, { nowSec: NOW, git, enterpriseSpend })).split("\n");

const repo: GitInfo = {
  repoName: "app",
  prefix: "src/lib",
  branch: "main",
  dirty: false,
  ahead: 0,
  behind: 0,
};

test("line 1 shows the model, effort, cost, and changed lines", () => {
  const [line1] = plain({
    model: { display_name: "Opus 5.5", id: "claude-opus-5-5" },
    effort: { level: "high" },
    cost: {
      total_cost_usd: 1.234,
      total_lines_added: 10,
      total_lines_removed: 2,
    },
  });
  assert.equal(line1, "🧠 Opus 5.5 high · 💰$1.23 · +10 -2");
});

test("line 1 falls back to the model id and zeros, and leaves out a missing effort", () => {
  assert.equal(
    plain({ model: { id: "claude-x" } })[0],
    "🧠 claude-x · 💰$0.00 · +0 -0",
  );
  assert.equal(plain({})[0], "🧠 ? · 💰$0.00 · +0 -0");
});

test("effort uses the colors of Claude Code's /effort screen", () => {
  assert.equal(effortLabel("low"), `${rgb(255, 193, 7)}low\x1b[0m`);
  assert.equal(effortLabel("medium"), `${rgb(78, 186, 101)}medium\x1b[0m`);
  assert.equal(effortLabel("high"), `${rgb(177, 185, 249)}high\x1b[0m`);
  assert.equal(effortLabel("xhigh"), `${rgb(175, 135, 255)}xhigh\x1b[0m`);
  assert.equal(stripAnsi(effortLabel("max")), "max");
  assert.equal(effortLabel("max").split(";").length > 6, true);
  assert.equal(effortLabel("turbo"), "turbo");
});

test("line 2 shows a placeholder before the first response", () => {
  assert.equal(plain({})[1], "💭 ctx --");
});

test("line 2 shows context and both rate windows with countdowns; the hourglass goes first", () => {
  const [, line2] = plain({
    context_window: { remaining_percentage: 64.4 },
    rate_limits: {
      five_hour: { used_percentage: 14, resets_at: NOW + 4860 },
      seven_day: { used_percentage: 85, resets_at: NOW + 90_000 },
    },
  });
  assert.equal(
    line2,
    "💭 ctx 64% left · ⏳ 5h 86% left ↻1h21m · 7d 15% left ↻1d1h",
  );
});

test("the hourglass moves to the 7-day window when the 5-hour window is absent", () => {
  const [, line2] = plain({
    rate_limits: { seven_day: { used_percentage: 40 } },
  });
  assert.equal(line2, "💭 ctx -- · ⏳ 7d 60% left");
});

test("a rate window whose reset has passed drops the countdown", () => {
  const [, line2] = plain({
    rate_limits: { five_hour: { used_percentage: 50, resets_at: NOW - 1 } },
  });
  assert.equal(line2, "💭 ctx -- · ⏳ 5h 50% left");
});

test("the gateway spend limit shows dollars when present, otherwise the percentage", () => {
  const resetsAt = NOW + 200_000;
  const day = `${new Date(resetsAt * 1000).getMonth() + 1}/${new Date(resetsAt * 1000).getDate()}`;
  const withUsd = plain({
    rate_limits: {
      spend_limit: {
        used_percentage: 63,
        resets_at: resetsAt,
        used_usd: 314.12,
        limit_usd: 500,
      },
    },
  });
  assert.equal(withUsd[1], `💭 ctx -- · 💳 $314.12 / $500.00 ↻2d7h (${day})`);
  const percentOnly = plain({
    rate_limits: { spend_limit: { used_percentage: 63, resets_at: resetsAt } },
  });
  assert.equal(percentOnly[1], `💭 ctx -- · 💳 37% left ↻2d7h (${day})`);
});

test("the opt-in enterprise spend appears only when Claude Code sends no spend limit", () => {
  assert.equal(
    plain({}, undefined, "💳 $1.00 / $2.00")[1],
    "💭 ctx -- · 💳 $1.00 / $2.00",
  );
  const official = plain(
    { rate_limits: { spend_limit: { used_percentage: 10 } } },
    undefined,
    "💳 $1.00 / $2.00",
  );
  assert.equal(official[1], "💭 ctx -- · 💳 90% left");
});

test("line 3 shows the folder name outside a repository", () => {
  assert.equal(
    plain({ workspace: { current_dir: "/home/me/notes" } })[2],
    "📁 notes",
  );
  assert.equal(plain({ cwd: "C:\\Users\\me\\notes" })[2], "📁 notes");
});

test("line 3 shows repository, path, branch, and marks inside a repository", () => {
  assert.equal(plain({}, repo)[2], "📁 [app]/src/lib (main)");
  assert.equal(plain({}, { ...repo, prefix: "" })[2], "📁 [app]/ (main)");
  assert.equal(
    plain({}, { ...repo, dirty: true, ahead: 2, behind: 1 })[2],
    "📁 [app]/src/lib (main) * ↑2 ↓1",
  );
  assert.equal(
    plain({}, { ...repo, ahead: 3 })[2],
    "📁 [app]/src/lib (main) ↑3",
  );
});

test("line 3 starts with the vim mode when vim mode is on", () => {
  assert.equal(
    plain({ vim: { mode: "NORMAL" } }, repo)[2],
    "[N] · 📁 [app]/src/lib (main)",
  );
  assert.equal(
    plain({ vim: { mode: "INSERT" } }, repo)[2],
    "[I] · 📁 [app]/src/lib (main)",
  );
  assert.equal(
    plain({ vim: { mode: "VISUAL LINE" } }, repo)[2],
    "[V] · 📁 [app]/src/lib (main)",
  );
});
