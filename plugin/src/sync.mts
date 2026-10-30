// SessionStart hook: keeps the installed status line in step with the plugin after an update.
// Does nothing until `/professional-statusline:setup` has installed the status line.
// Prints nothing, because a SessionStart hook's output becomes context for Claude, and always exits 0.
//
// Node.js runs this file only when it can run TypeScript (22.18 or later). On an older Node.js the hook
// fails before reaching this code, and a 0.1.0 install keeps running its own bundled copy unchanged.

import {
  copySource,
  installedDir,
  isInstalled,
  pluginRootFrom,
  relinkLegacyEntry,
  sameSource,
  sourceDir,
} from "./install.mts";

try {
  const dataDir = process.argv[2] || process.env["CLAUDE_PLUGIN_DATA"];
  const pluginRoot = pluginRootFrom(import.meta.url);
  if (dataDir && isInstalled(dataDir)) {
    if (!sameSource(sourceDir(pluginRoot), installedDir(dataDir))) {
      copySource(pluginRoot, dataDir);
    }
    relinkLegacyEntry(dataDir);
  }
} catch {
  // Keep the copy that is already installed. The next session tries again.
}
