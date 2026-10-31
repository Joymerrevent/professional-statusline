// Runs the shipped files in plugin/src/ the way Claude Code and the setup skill run them.
// Every run uses an isolated home folder, so the real settings.json and credentials are never touched.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  SRC,
  isolatedEnv,
  runInShell,
  runNode,
  statusLineShells,
  stripAnsi,
  tempDir,
} from "./helpers.ts";

const SETUP = join(SRC, "setup.mts");
const SYNC = join(SRC, "sync.mts");
const STATUSLINE = join(SRC, "statusline.mts");

function sandbox() {
  const home = tempDir();
  const data = join(
    home,
    ".claude",
    "plugins",
    "data",
    "professional-statusline-professional-statusline",
  );
  const settings = join(home, ".claude", "settings.json");
  const env = isolatedEnv(home);
  const setup = (...args: string[]) =>
    runNode(SETUP, [...args, "--data-dir", data], { env, cwd: home });
  const readSettings = () =>
    JSON.parse(readFileSync(settings, "utf8")) as Record<string, unknown>;
  return { home, data, settings, env, setup, readSettings };
}

test("install writes a $HOME-based statusLine, copies plugin/src, and the command renders in each shell", () => {
  const s = sandbox();
  const result = s.setup("install");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    readdirSync(join(s.data, "src")).sort(),
    readdirSync(SRC).sort(),
  );
  const statusLine = s.readSettings()["statusLine"] as {
    type: string;
    command: string;
    refreshInterval: number;
  };
  assert.equal(statusLine.type, "command");
  assert.equal(statusLine.refreshInterval, 10);
  assert.equal(
    statusLine.command,
    'node "$HOME/.claude/plugins/data/professional-statusline-professional-statusline/src/statusline.mts"',
  );

  // Run the command through the shells Claude Code uses, so that $HOME is expanded as it is for real.
  const input = JSON.stringify({
    model: { display_name: "Opus 5.5" },
    effort: { level: "high" },
    workspace: { current_dir: s.home },
  });
  for (const shell of statusLineShells()) {
    const rendered = runInShell(shell.argv, statusLine.command, {
      input,
      env: s.env,
    });
    assert.equal(rendered.status, 0, `${shell.name}: ${rendered.stderr}`);
    // Node.js must run the TypeScript without warnings (22.18 and later print none).
    assert.equal(rendered.stderr, "", shell.name);
    // PowerShell may re-encode the emoji of a native command, so check the ASCII part in every shell.
    assert.match(stripAnsi(rendered.stdout), /Opus 5\.5 high/, shell.name);
    if (shell.name !== "powershell") {
      assert.match(
        stripAnsi(rendered.stdout),
        /^🧠 Opus 5\.5 high · 💰\$0\.00 · \+0 -0\n💭 ctx --\n📁 /,
        shell.name,
      );
    }
  }
});

test("sync installs the missing copy when settings.json already points at this data folder", () => {
  const s = sandbox();
  assert.equal(s.setup("install").status, 0);
  const command = (s.readSettings()["statusLine"] as { command: string })
    .command;
  // Another computer that shares settings.json has the plugin but not the copy.
  rmSync(s.data, { recursive: true, force: true });

  const healed = runNode(SYNC, [s.data], { env: s.env });
  assert.equal(healed.status, 0);
  assert.equal(healed.stdout, "");
  assert.deepEqual(
    readdirSync(join(s.data, "src")).sort(),
    readdirSync(SRC).sort(),
  );
  assert.equal(existsSync(join(s.data, "statusline.mjs")), false);

  const [shell] = statusLineShells();
  const rendered = runInShell(shell?.argv ?? [], command, {
    input: JSON.stringify({ model: { display_name: "Opus 5.5" } }),
    env: s.env,
  });
  assert.equal(rendered.status, 0, rendered.stderr);
  assert.match(stripAnsi(rendered.stdout), /Opus 5\.5/);
});

test("sync installs nothing when settings.json runs another status line", () => {
  const s = sandbox();
  mkdirSync(join(s.home, ".claude"), { recursive: true });
  writeFileSync(
    s.settings,
    JSON.stringify({
      statusLine: { type: "command", command: "bash ~/.claude/statusline.sh" },
    }),
  );
  const result = runNode(SYNC, [s.data], { env: s.env });
  assert.equal(result.status, 0);
  assert.equal(existsSync(s.data), false);
});

test("sync restores a 0.1.0 statusLine on a computer that has neither the copy nor the launcher", () => {
  const s = sandbox();
  mkdirSync(join(s.home, ".claude"), { recursive: true });
  const legacy = join(s.data, "statusline.mjs");
  const legacyCommand = `node "${legacy.replaceAll("\\", "/")}"`;
  writeFileSync(
    s.settings,
    JSON.stringify({ statusLine: { type: "command", command: legacyCommand } }),
  );
  assert.equal(runNode(SYNC, [s.data], { env: s.env }).status, 0);
  assert.equal(
    readFileSync(legacy, "utf8"),
    'import "./src/statusline.mts";\n',
  );
  assert.equal(existsSync(join(s.data, "src", "statusline.mts")), true);
});

test("a second install swaps the copy and leaves no temporary folder", () => {
  const s = sandbox();
  assert.equal(s.setup("install").status, 0);
  writeFileSync(join(s.data, "src", "render.mts"), "// changed\n");
  assert.equal(s.setup("install").status, 0);
  assert.equal(
    readFileSync(join(s.data, "src", "render.mts"), "utf8"),
    readFileSync(join(SRC, "render.mts"), "utf8"),
  );
  assert.deepEqual(
    readdirSync(s.data).filter((name) => name.startsWith("src")),
    ["src"],
  );
});

test("install keeps other settings and the indentation, and remove restores the previous statusLine", () => {
  const s = sandbox();
  mkdirSync(join(s.home, ".claude"), { recursive: true });
  const previous = { type: "command", command: "~/my-line.sh" };
  writeFileSync(
    s.settings,
    `${JSON.stringify({ model: "opus", statusLine: previous }, null, 4)}\n`,
  );

  assert.equal(s.setup("install").status, 0);
  assert.equal(s.setup("install").status, 0); // A second install must not overwrite the saved previous value.
  const text = readFileSync(s.settings, "utf8");
  assert.match(text, /^\{\n {4}"model": "opus",/);
  assert.equal(s.readSettings()["model"], "opus");

  const removed = s.setup("remove");
  assert.equal(removed.status, 0, removed.stderr);
  assert.deepEqual(s.readSettings(), { model: "opus", statusLine: previous });
  assert.equal(existsSync(join(s.data, "src")), false);
});

test("remove deletes statusLine when there was none, and leaves a foreign statusLine alone", () => {
  const s = sandbox();
  assert.equal(s.setup("install").status, 0);
  assert.equal(s.setup("remove").status, 0);
  assert.deepEqual(s.readSettings(), {});

  writeFileSync(
    s.settings,
    JSON.stringify({ statusLine: { type: "command", command: "other" } }),
  );
  const result = s.setup("remove");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /not this plugin's/);
  assert.deepEqual(s.readSettings(), {
    statusLine: { type: "command", command: "other" },
  });
});

test("install refuses to touch a settings.json that is not valid JSON", () => {
  const s = sandbox();
  mkdirSync(join(s.home, ".claude"), { recursive: true });
  writeFileSync(s.settings, '{ "model": "opus", }');
  const result = s.setup("install");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not valid JSON/);
  assert.equal(readFileSync(s.settings, "utf8"), '{ "model": "opus", }');
});

test("install warns about a project statusLine that takes precedence", () => {
  const s = sandbox();
  mkdirSync(join(s.home, ".claude"), { recursive: true });
  writeFileSync(
    join(s.home, ".claude", "settings.local.json"),
    JSON.stringify({ statusLine: "x" }),
  );
  assert.match(s.setup("install").stdout, /takes precedence/);
});

test("enterprise-spend on/off writes config.json and off deletes the cache", () => {
  const s = sandbox();
  assert.equal(s.setup("enterprise-spend", "on").status, 0);
  assert.deepEqual(
    JSON.parse(readFileSync(join(s.data, "config.json"), "utf8")),
    { enterpriseSpend: true },
  );
  writeFileSync(join(s.data, "usage-cache.json"), "{}");
  assert.equal(s.setup("enterprise-spend", "off").status, 0);
  assert.deepEqual(
    JSON.parse(readFileSync(join(s.data, "config.json"), "utf8")),
    { enterpriseSpend: false },
  );
  assert.equal(existsSync(join(s.data, "usage-cache.json")), false);
  assert.equal(s.setup("enterprise-spend", "maybe").status, 1);
});

test("status reports the state, and an unknown command fails", () => {
  const s = sandbox();
  assert.match(s.setup("status").stdout, /not active/);
  assert.equal(s.setup("install").status, 0);
  const status = s.setup("status").stdout;
  assert.match(status, /is active/);
  assert.match(status, /Up to date with the plugin: yes/);
  assert.match(status, /Enterprise spend display: off/);
  assert.equal(s.setup("frobnicate").status, 1);
});

test("setup without a data folder explains how to run it", () => {
  const result = runNode(SETUP, ["install"], { env: isolatedEnv(tempDir()) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\/professional-statusline:setup/);
});

test("sync updates an installed copy, prints nothing, and does nothing before install", () => {
  const s = sandbox();
  const before = runNode(SYNC, [s.data], { env: s.env });
  assert.equal(before.status, 0);
  assert.equal(existsSync(s.data), false);

  assert.equal(s.setup("install").status, 0);
  writeFileSync(join(s.data, "src", "statusline.mts"), "// an older version\n");
  const after = runNode(SYNC, [s.data], { env: s.env });
  assert.equal(after.status, 0);
  assert.equal(after.stdout, "");
  assert.equal(
    readFileSync(join(s.data, "src", "statusline.mts"), "utf8"),
    readFileSync(STATUSLINE, "utf8"),
  );
});

test("sync relinks a 0.1.0 install, and install then moves it to the new command", () => {
  const s = sandbox();
  // 0.1.0 installed one bundled file at <data>/statusline.mjs and pointed settings.json at it.
  mkdirSync(s.data, { recursive: true });
  const legacy = join(s.data, "statusline.mjs");
  writeFileSync(legacy, 'process.stdout.write("0.1.0");\n');
  const legacyCommand = `node "${legacy.replaceAll("\\", "/")}"`;
  mkdirSync(join(s.home, ".claude"), { recursive: true });
  writeFileSync(
    s.settings,
    JSON.stringify({ statusLine: { type: "command", command: legacyCommand } }),
  );

  const synced = runNode(SYNC, [s.data], { env: s.env });
  assert.equal(synced.status, 0);
  assert.equal(synced.stdout, "");
  assert.equal(
    readFileSync(legacy, "utf8"),
    'import "./src/statusline.mts";\n',
  );
  const rendered = spawnSync(legacyCommand, {
    shell: true,
    input: JSON.stringify({ model: { display_name: "Opus 5.5" } }),
    env: s.env,
    encoding: "utf8",
  });
  assert.equal(rendered.status, 0, rendered.stderr);
  assert.match(stripAnsi(rendered.stdout), /^🧠 Opus 5\.5 · /);

  assert.match(s.setup("status").stdout, /is active/);
  assert.equal(s.setup("install").status, 0);
  const command = (s.readSettings()["statusLine"] as { command: string })
    .command;
  assert.match(command, /\/src\/statusline\.mts"$/);
  assert.equal(existsSync(legacy), false);
});

test("the installed status line shows the opt-in enterprise spend from its own data folder", () => {
  const s = sandbox();
  mkdirSync(s.data, { recursive: true });
  cpSync(SRC, join(s.data, "src"), { recursive: true });
  const script = join(s.data, "src", "statusline.mts");
  writeFileSync(
    join(s.home, ".claude.json"),
    JSON.stringify({ oauthAccount: { organizationType: "claude_enterprise" } }),
  );
  writeFileSync(
    join(s.data, "config.json"),
    JSON.stringify({ enterpriseSpend: true }),
  );
  const now = Math.floor(Date.now() / 1000);
  // A fresh stamp keeps the background refresh, and with it the network, out of the test.
  writeFileSync(join(s.data, "usage-stamp"), String(now));
  writeFileSync(
    join(s.data, "usage-cache.json"),
    JSON.stringify({
      fetched_at: now,
      extra_usage: {
        is_enabled: true,
        monthly_limit: 200_000,
        used_credits: 185_000,
        utilization: 92.5,
      },
    }),
  );
  const input = JSON.stringify({ workspace: { current_dir: s.home } });
  const shown = runNode(script, [], { input, env: s.env });
  assert.match(
    stripAnsi(shown.stdout).split("\n")[1] ?? "",
    /^💭 ctx -- · 💳 \$1,850\.00 \/ \$2,000\.00 ↻/,
  );

  writeFileSync(
    join(s.data, "config.json"),
    JSON.stringify({ enterpriseSpend: false }),
  );
  assert.equal(
    stripAnsi(runNode(script, [], { input, env: s.env }).stdout).split("\n")[1],
    "💭 ctx --",
  );
});
