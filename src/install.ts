import { copyFileSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SCRIPT_NAME = "statusline.mjs";

// The plugin's root folder. Every bundled entry point lives in <root>/dist/.
export function pluginRootFrom(moduleUrl: string): string {
  return dirname(dirname(fileURLToPath(moduleUrl)));
}

export function bundledScript(pluginRoot: string): string {
  return join(pluginRoot, "dist", SCRIPT_NAME);
}

export function installedScript(dataDir: string): string {
  return join(dataDir, SCRIPT_NAME);
}

export function sameContent(a: string, b: string): boolean {
  try {
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

// Copies the bundled status line into the data folder. The plugin folder changes with every update,
// and the data folder does not, so settings.json points at the copy.
// Writes a temporary file first and renames it, so a status line that runs meanwhile never reads half a file.
export function copyScript(pluginRoot: string, dataDir: string): void {
  mkdirSync(dataDir, { recursive: true });
  const target = installedScript(dataDir);
  const temporary = `${target}.tmp`;
  copyFileSync(bundledScript(pluginRoot), temporary);
  renameSync(temporary, target);
}
