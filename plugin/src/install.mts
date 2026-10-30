import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The status line runs from a copy of plugin/src/ in the data folder: <data>/src/statusline.mts.
// The plugin folder changes with every update, and the data folder does not, so settings.json points at the copy.
export const ENTRY_NAME = "statusline.mts";
// Version 0.1.0 installed one bundled file at <data>/statusline.mjs, and its settings.json still points there.
export const LEGACY_ENTRY_NAME = "statusline.mjs";
const LEGACY_LAUNCHER = 'import "./src/statusline.mts";\n';

// The plugin's root folder. The source lives in <root>/src/.
export function pluginRootFrom(moduleUrl: string): string {
  return dirname(dirname(fileURLToPath(moduleUrl)));
}

export function sourceDir(pluginRoot: string): string {
  return join(pluginRoot, "src");
}

export function installedDir(dataDir: string): string {
  return join(dataDir, "src");
}

export function installedEntry(dataDir: string): string {
  return join(installedDir(dataDir), ENTRY_NAME);
}

export function legacyEntry(dataDir: string): string {
  return join(dataDir, LEGACY_ENTRY_NAME);
}

// True when setup has installed the status line, in this version's layout or in the 0.1.0 one.
export function isInstalled(dataDir: string): boolean {
  return existsSync(installedDir(dataDir)) || existsSync(legacyEntry(dataDir));
}

// True when both folders hold the same .mts files with the same content.
export function sameSource(a: string, b: string): boolean {
  try {
    const names = (dir: string) =>
      readdirSync(dir)
        .filter((name) => name.endsWith(".mts"))
        .sort();
    const left = names(a);
    const right = names(b);
    return (
      left.length === right.length &&
      left.every(
        (name, i) =>
          name === right[i] &&
          readFileSync(join(a, name)).equals(readFileSync(join(b, name))),
      )
    );
  } catch {
    return false;
  }
}

// Copies plugin/src/ to <data>/src/. Copies into a temporary folder first and swaps it in,
// so a status line that runs meanwhile reads either the old copy or the new one, not a mix.
// When the swap fails, the old copy is put back.
export function copySource(pluginRoot: string, dataDir: string): void {
  mkdirSync(dataDir, { recursive: true });
  const target = installedDir(dataDir);
  const temporary = `${target}.tmp`;
  const previous = `${target}.old`;
  rmSync(temporary, { recursive: true, force: true });
  rmSync(previous, { recursive: true, force: true });
  cpSync(sourceDir(pluginRoot), temporary, { recursive: true });
  const hadPrevious = existsSync(target);
  if (hadPrevious) renameSync(target, previous);
  try {
    renameSync(temporary, target);
  } catch (error) {
    if (hadPrevious) renameSync(previous, target);
    throw error;
  }
  rmSync(previous, { recursive: true, force: true });
}

// Points a 0.1.0 install at the new copy: <data>/statusline.mjs becomes a one-line launcher of
// <data>/src/statusline.mts, so its settings.json keeps working and picks up updates.
export function relinkLegacyEntry(dataDir: string): void {
  const legacy = legacyEntry(dataDir);
  if (!existsSync(legacy) || readFileSync(legacy, "utf8") === LEGACY_LAUNCHER)
    return;
  writeFileSync(`${legacy}.tmp`, LEGACY_LAUNCHER);
  renameSync(`${legacy}.tmp`, legacy);
}
