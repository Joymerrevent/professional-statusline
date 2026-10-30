// src/sync.ts
import { existsSync } from "node:fs";

// src/install.ts
import { copyFileSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var SCRIPT_NAME = "statusline.mjs";
function pluginRootFrom(moduleUrl) {
  return dirname(dirname(fileURLToPath(moduleUrl)));
}
function bundledScript(pluginRoot) {
  return join(pluginRoot, "dist", SCRIPT_NAME);
}
function installedScript(dataDir) {
  return join(dataDir, SCRIPT_NAME);
}
function sameContent(a, b) {
  try {
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}
function copyScript(pluginRoot, dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const target = installedScript(dataDir);
  const temporary = `${target}.tmp`;
  copyFileSync(bundledScript(pluginRoot), temporary);
  renameSync(temporary, target);
}

// src/sync.ts
try {
  const dataDir = process.argv[2] || process.env["CLAUDE_PLUGIN_DATA"];
  const pluginRoot = pluginRootFrom(import.meta.url);
  if (dataDir && existsSync(installedScript(dataDir)) && !sameContent(bundledScript(pluginRoot), installedScript(dataDir))) {
    copyScript(pluginRoot, dataDir);
  }
} catch {
}
