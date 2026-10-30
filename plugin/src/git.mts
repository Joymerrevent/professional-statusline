import { execFileSync } from "node:child_process";

export interface GitInfo {
  repoName: string;
  // Path inside the repository without the trailing slash. Empty at the repository root.
  prefix: string;
  // Branch name, or the short commit id when HEAD is detached.
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

function git(cwd: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", ["--no-optional-locks", "-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
      windowsHide: true,
    });
  } catch {
    return undefined;
  }
}

// Reads the repository state with two git commands. Returns undefined outside a repository or when git is missing.
export function readGitInfo(cwd: string): GitInfo | undefined {
  const status = git(cwd, ["status", "--porcelain=v2", "--branch"]);
  if (status === undefined) return undefined;
  const where = git(cwd, ["rev-parse", "--show-toplevel", "--show-prefix"]);
  if (where === undefined) return undefined;
  const [top = "", prefix = ""] = where.split(/\r?\n/);
  if (top === "") return undefined;

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
    behind,
  };
}
