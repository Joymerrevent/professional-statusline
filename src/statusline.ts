// Entry point of the status line. Claude Code runs it with the session JSON on stdin
// and shows what it prints. Installed by `/professional-statusline:setup` into the plugin's data folder,
// next to its config.json and cache files.

import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  enterpriseSpendSegment,
  isTeamOrEnterprise,
  readConfig,
  refreshUsage,
  scheduleRefresh,
} from "./enterprise.ts";
import { readGitInfo } from "./git.ts";
import { parseInput } from "./input.ts";
import { render, workingDirectory } from "./render.ts";

const scriptPath = fileURLToPath(import.meta.url);
const dataDir = dirname(scriptPath);

async function main(): Promise<void> {
  if (process.argv.includes("--refresh-usage")) {
    await refreshUsage(dataDir).catch(() => {});
    return;
  }

  let stdin = "";
  try {
    stdin = readFileSync(0, "utf8");
  } catch {
    // No stdin: render the empty frame.
  }
  const input = parseInput(stdin);
  const nowSec = Math.floor(Date.now() / 1000);

  let enterpriseSpend: string | undefined;
  if (
    input.rate_limits?.spend_limit === undefined &&
    readConfig(dataDir).enterpriseSpend === true &&
    isTeamOrEnterprise()
  ) {
    scheduleRefresh(dataDir, scriptPath, nowSec);
    enterpriseSpend = enterpriseSpendSegment(dataDir, nowSec);
  }

  process.stdout.write(
    render(input, {
      nowSec,
      git: readGitInfo(workingDirectory(input)),
      enterpriseSpend,
    }),
  );
}

void main();
