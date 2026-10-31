import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";

export const ROOT = join(import.meta.dirname, "..");
export const SRC = join(ROOT, "plugin", "src");

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex -- ANSI color codes start with the ESC control character.
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

// A temporary folder that is removed when the test file finishes.
export function tempDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "pro-statusline-")));
  after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// An environment whose home folder and Claude Code config folder point into `home`,
// so a test never reads or writes the real ones.
export function isolatedEnv(
  home: string,
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  return {
    PATH: process.env["PATH"],
    SystemRoot: process.env["SystemRoot"],
    HOME: home,
    USERPROFILE: home,
    CLAUDE_CONFIG_DIR: join(home, ".claude"),
    ...extra,
  };
}

// The shells Claude Code runs a statusLine command with: bash on macOS and Linux, and on Windows
// Git Bash when it is installed, otherwise PowerShell. On Windows, both are returned.
export function statusLineShells(): Array<{ name: string; argv: string[] }> {
  if (process.platform !== "win32")
    return [{ name: "bash", argv: ["bash", "-c"] }];
  const gitBash = join(
    process.env["ProgramFiles"] ?? "C:\\Program Files",
    "Git",
    "bin",
    "bash.exe",
  );
  return [
    { name: "git-bash", argv: [existsSync(gitBash) ? gitBash : "bash", "-c"] },
    { name: "powershell", argv: ["powershell", "-NoProfile", "-Command"] },
  ];
}

export function runInShell(
  argv: string[],
  command: string,
  options: { input?: string; env: NodeJS.ProcessEnv },
) {
  const [program = "", ...args] = argv;
  const result = spawnSync(program, [...args, command], {
    input: options.input ?? "",
    env: options.env,
    encoding: "utf8",
    timeout: 20_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function runNode(
  script: string,
  args: string[],
  options: { input?: string; env: NodeJS.ProcessEnv; cwd?: string },
) {
  const result = spawnSync(process.execPath, [script, ...args], {
    input: options.input ?? "",
    env: options.env,
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    timeout: 20_000,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
