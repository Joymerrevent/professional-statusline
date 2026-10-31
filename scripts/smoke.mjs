// Runs the shipped plugin/src/ files on the oldest supported Node.js, in a throwaway home folder:
// setup install -> the installed statusLine command -> the SessionStart sync -> setup remove.
// CI runs it on Node.js 22.18.0 (the runtime job). Exits 1 on the first failure.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  "plugin",
  "src",
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
  return spawnSync(process.execPath, [join(src, script), ...args], {
    env,
    cwd: home,
    encoding: "utf8",
  });
}

console.log(`Node.js ${process.versions.node} on ${process.platform}`);

const install = node("setup.mts", ["install", "--data-dir", data]);
check("setup install", install.status === 0, install.stderr);

const settings = JSON.parse(
  readFileSync(join(config, "settings.json"), "utf8"),
);
const command = settings.statusLine?.command ?? "";
check(
  "statusLine points at the installed copy through $HOME",
  /^node "\$HOME\/\.claude\/plugins\/data\/professional-statusline-smoke\/src\/statusline\.mts"$/.test(
    command,
  ),
  command,
);

// The shells Claude Code runs a statusLine command with: bash on macOS and Linux, and on Windows
// Git Bash when it is installed, otherwise PowerShell. Both are checked on Windows.
const gitBash = join(
  process.env.ProgramFiles ?? "C:\\Program Files",
  "Git",
  "bin",
  "bash.exe",
);
const shells =
  process.platform === "win32"
    ? [
        ["git-bash", [existsSync(gitBash) ? gitBash : "bash", "-c"]],
        ["powershell", ["powershell", "-NoProfile", "-Command"]],
      ]
    : [["bash", ["bash", "-c"]]];
const input = JSON.stringify({
  model: { display_name: "CI" },
  effort: { level: "high" },
  workspace: { current_dir: home },
  context_window: { remaining_percentage: 72.5 },
  rate_limits: {
    five_hour: { used_percentage: 23.5, resets_at: 9999999999 },
  },
});
const quotedPath = /^node "(.+)"$/.exec(command)?.[1] ?? "";
for (const [name, [program, ...args]] of shells) {
  if (name === "powershell") {
    // PowerShell expands $HOME (USERPROFILE on Windows) to the installed copy. Whether PowerShell hands its
    // standard input to node under -Command is not established, so the whole status line isn't run here.
    const found = spawnSync(
      program,
      [...args, `Test-Path -LiteralPath "${quotedPath}"`],
      { env, encoding: "utf8" },
    );
    check(
      "powershell: $HOME leads to the installed copy",
      (found.stdout ?? "").trim() === "True",
      (found.stdout ?? "") + (found.stderr ?? ""),
    );
    continue;
  }
  const rendered = spawnSync(program, [...args, command], {
    env,
    encoding: "utf8",
    input,
  });
  // eslint-disable-next-line no-control-regex -- ANSI color codes start with the ESC control character.
  const plain = (rendered.stdout ?? "").replace(/\x1b\[[0-9;]*m/g, "");
  check(
    `${name}: the statusLine command renders three lines`,
    rendered.status === 0 && plain.trimEnd().split(/\r?\n/).length === 3,
    plain + rendered.stderr,
  );
  check(
    `${name}: Node.js prints no warning while running the TypeScript`,
    rendered.stderr === "",
    rendered.stderr,
  );
  check(
    `${name}: line 1 has the model and effort`,
    plain.includes("CI high") && plain.includes("$0.00"),
    plain,
  );
  check(
    `${name}: line 2 has context and the 5-hour window`,
    plain.includes("ctx 73% left") && plain.includes("5h 76% left"),
    plain,
  );
  console.log(plain);
}

const sync = node("sync.mts", [data]);
check(
  "sync exits 0 and prints nothing",
  sync.status === 0 && sync.stdout === "",
  sync.stdout + sync.stderr,
);

const remove = node("setup.mts", ["remove", "--data-dir", data]);
check("setup remove", remove.status === 0, remove.stderr);
const after = JSON.parse(readFileSync(join(config, "settings.json"), "utf8"));
check(
  "remove leaves no statusLine behind",
  !("statusLine" in after),
  JSON.stringify(after),
);

rmSync(home, { recursive: true, force: true });
