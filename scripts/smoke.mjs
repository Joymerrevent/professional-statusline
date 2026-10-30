// Runs the committed plugin/dist/ files on the oldest supported Node.js, in a throwaway home folder:
// setup install -> the installed statusLine command -> the SessionStart sync -> setup remove.
// CI runs it on Node.js 20 (the runtime job). Exits 1 on the first failure.
import { spawnSync } from "node:child_process";
import console from "node:console";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const dist = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  "plugin",
  "dist",
);
const home = mkdtempSync(join(tmpdir(), "pro-statusline-smoke-"));
const config = join(home, ".claude");
const data = join(config, "plugins", "data", "professional-statusline-smoke");
const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  CLAUDE_CONFIG_DIR: config,
};

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) {
    if (detail) console.log(detail);
    rmSync(home, { recursive: true, force: true });
    process.exit(1);
  }
}

function node(script, args) {
  return spawnSync(process.execPath, [join(dist, script), ...args], {
    env,
    cwd: home,
    encoding: "utf8",
  });
}

console.log(`Node.js ${process.versions.node} on ${process.platform}`);

const install = node("setup.mjs", ["install", "--data-dir", data]);
check("setup install", install.status === 0, install.stderr);

const settings = JSON.parse(
  readFileSync(join(config, "settings.json"), "utf8"),
);
const command = settings.statusLine?.command ?? "";
check(
  "statusLine points at the installed copy",
  /^node ".*\/statusline\.mjs"$/.test(command),
  command,
);

const rendered = spawnSync(command, {
  shell: true,
  env,
  encoding: "utf8",
  input: JSON.stringify({
    model: { display_name: "CI" },
    effort: { level: "high" },
    workspace: { current_dir: home },
    context_window: { remaining_percentage: 72.5 },
    rate_limits: {
      five_hour: { used_percentage: 23.5, resets_at: 9999999999 },
    },
  }),
});
// eslint-disable-next-line no-control-regex -- ANSI color codes start with the ESC control character.
const plain = rendered.stdout.replace(/\x1b\[[0-9;]*m/g, "");
check(
  "the statusLine command renders three lines",
  rendered.status === 0 && plain.split("\n").length === 3,
  plain + rendered.stderr,
);
check(
  "line 1 has the model and effort",
  plain.startsWith("🧠 CI high · 💰$0.00 · +0 -0"),
  plain,
);
check(
  "line 2 has context and the 5-hour window",
  plain.includes("💭 ctx 73% left · ⏳ 5h 76% left ↻"),
  plain,
);
console.log(plain);

const sync = node("sync.mjs", [data]);
check(
  "sync exits 0 and prints nothing",
  sync.status === 0 && sync.stdout === "",
  sync.stdout + sync.stderr,
);

const remove = node("setup.mjs", ["remove", "--data-dir", data]);
check("setup remove", remove.status === 0, remove.stderr);
const after = JSON.parse(readFileSync(join(config, "settings.json"), "utf8"));
check(
  "remove leaves no statusLine behind",
  !("statusLine" in after),
  JSON.stringify(after),
);

rmSync(home, { recursive: true, force: true });
