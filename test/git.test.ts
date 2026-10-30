import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { readGitInfo } from "../plugin/src/git.mts";
import { tempDir } from "./helpers.ts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    [
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    {
      cwd,
      stdio: "ignore",
    },
  );

const base = tempDir();
const repo = join(base, "my-repo");
mkdirSync(join(repo, "src", "lib"), { recursive: true });
git(repo, "init", "-q", "-b", "main");
writeFileSync(join(repo, "a.txt"), "a\n");
git(repo, "add", ".");
git(repo, "commit", "-q", "-m", "first");

test("outside a repository there is no git info", () => {
  const outside = join(base, "plain");
  mkdirSync(outside);
  assert.equal(readGitInfo(outside), undefined);
});

test("at the root of a clean repository", () => {
  assert.deepEqual(readGitInfo(repo), {
    repoName: "my-repo",
    prefix: "",
    branch: "main",
    dirty: false,
    ahead: 0,
    behind: 0,
  });
});

test("in a subfolder, with an untracked file", () => {
  writeFileSync(join(repo, "src", "lib", "new.txt"), "x\n");
  const info = readGitInfo(join(repo, "src", "lib"));
  assert.equal(info?.prefix, "src/lib");
  assert.equal(info?.dirty, true);
});

test("ahead of and behind the upstream", () => {
  const clone = join(base, "clone");
  git(base, "clone", "-q", repo, clone);
  writeFileSync(join(clone, "b.txt"), "b\n");
  git(clone, "add", ".");
  git(clone, "commit", "-q", "-m", "local");
  writeFileSync(join(repo, "c.txt"), "c\n");
  git(repo, "add", "c.txt");
  git(repo, "commit", "-q", "-m", "remote");
  git(clone, "fetch", "-q");
  const info = readGitInfo(clone);
  assert.equal(info?.ahead, 1);
  assert.equal(info?.behind, 1);
  assert.equal(info?.repoName, "clone");
});

test("a detached HEAD shows the short commit id", () => {
  const detached = join(base, "detached");
  git(base, "clone", "-q", repo, detached);
  git(detached, "checkout", "-q", "--detach");
  const head = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
    cwd: detached,
    encoding: "utf8",
  }).trim();
  assert.equal(readGitInfo(detached)?.branch, head);
});
