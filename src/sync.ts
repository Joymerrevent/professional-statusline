// SessionStart hook: keeps the installed status line in step with the plugin after an update.
// Does nothing until `/professional-statusline:setup` has installed the status line.
// Prints nothing, because a SessionStart hook's output becomes context for Claude, and always exits 0.

import { existsSync } from "node:fs";
import {
  bundledScript,
  copyScript,
  installedScript,
  pluginRootFrom,
  sameContent,
} from "./install.ts";

try {
  const dataDir = process.argv[2] || process.env["CLAUDE_PLUGIN_DATA"];
  const pluginRoot = pluginRootFrom(import.meta.url);
  if (
    dataDir &&
    existsSync(installedScript(dataDir)) &&
    !sameContent(bundledScript(pluginRoot), installedScript(dataDir))
  ) {
    copyScript(pluginRoot, dataDir);
  }
} catch {
  // Keep the copy that is already installed. The next session tries again.
}
