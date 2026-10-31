// SessionStart hook: keeps the installed status line in step with the plugin after an update.
// Does nothing until the status line is set up: either `/professional-statusline:setup` has installed it on
// this computer, or the user's settings.json already points at this plugin's data folder (settings.json shared
// from another computer), in which case the hook installs the copy that is missing here.
// Prints nothing, because a SessionStart hook's output becomes context for Claude, and always exits 0.
//
// Node.js runs this file only when it can run TypeScript (22.18 or later). On an older Node.js the hook
// fails before reaching this code, and a 0.1.0 install keeps running its own bundled copy unchanged.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  copySource,
  installedDir,
  isInstalled,
  pluginRootFrom,
  relinkLegacyEntry,
  sameSource,
  sourceDir,
  statusLineTarget,
} from "./install.mts";
import { configDir } from "./paths.mts";

// The statusLine in the user's settings.json, or undefined when the file is missing or isn't valid JSON.
function userStatusLine(): unknown {
  try {
    const settings = JSON.parse(
      readFileSync(join(configDir(), "settings.json"), "utf8"),
    ) as { statusLine?: unknown };
    return settings.statusLine;
  } catch {
    return undefined;
  }
}

try {
  // The hook passes no argument: Claude Code sets CLAUDE_PLUGIN_DATA for hook processes. Tests pass the folder.
  const dataDir = process.argv[2] || process.env["CLAUDE_PLUGIN_DATA"];
  const pluginRoot = pluginRootFrom(import.meta.url);
  if (dataDir && isInstalled(dataDir)) {
    if (!sameSource(sourceDir(pluginRoot), installedDir(dataDir))) {
      copySource(pluginRoot, dataDir);
    }
    relinkLegacyEntry(dataDir);
  } else if (dataDir) {
    const target = statusLineTarget(userStatusLine(), dataDir);
    if (target) {
      copySource(pluginRoot, dataDir);
      if (target === "legacy") relinkLegacyEntry(dataDir, true);
    }
  }
} catch {
  // Keep the copy that is already installed. The next session tries again.
}
