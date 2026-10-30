import { homedir } from "node:os";
import { join } from "node:path";

// The home folder as the given environment describes it, so tests can point it elsewhere.
export function homeDir(env: NodeJS.ProcessEnv = process.env): string {
  return (
    (process.platform === "win32" ? env["USERPROFILE"] : env["HOME"]) ||
    homedir()
  );
}

// Claude Code's configuration folder: CLAUDE_CONFIG_DIR when set, otherwise ~/.claude.
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  return env["CLAUDE_CONFIG_DIR"] || join(homeDir(env), ".claude");
}

// Candidate locations of the global state file (.claude.json), in the order to try.
export function claudeJsonCandidates(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const candidates = [join(homeDir(env), ".claude.json")];
  const custom = env["CLAUDE_CONFIG_DIR"];
  if (custom) candidates.unshift(join(custom, ".claude.json"));
  return candidates;
}

// A path written with forward slashes, which both Git Bash and PowerShell accept on Windows.
export function toForwardSlashes(path: string): string {
  return path.replaceAll("\\", "/");
}
