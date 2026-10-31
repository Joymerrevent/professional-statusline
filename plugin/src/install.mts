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
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { homeDir, toForwardSlashes } from "./paths.mts";

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
// With `create`, writes the launcher even when <data>/statusline.mjs is missing.
export function relinkLegacyEntry(dataDir: string, create = false): void {
  const legacy = legacyEntry(dataDir);
  if (!create && !existsSync(legacy)) return;
  if (existsSync(legacy) && readFileSync(legacy, "utf8") === LEGACY_LAUNCHER)
    return;
  writeFileSync(`${legacy}.tmp`, LEGACY_LAUNCHER);
  renameSync(`${legacy}.tmp`, legacy);
}

// The statusLine command. When the data folder is under the home folder, the path starts with $HOME.
// bash, zsh, and PowerShell all expand $HOME inside double quotes (in PowerShell on Windows, $HOME is
// USERPROFILE), so one settings.json works on every computer that shares it, whatever the user name.
// Outside the home folder (CLAUDE_CONFIG_DIR elsewhere), the absolute path is written.
export function statusLineCommand(
  dataDir: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const entry = installedEntry(dataDir);
  const fromHome = relative(homeDir(env), entry);
  const underHome =
    fromHome !== "" && !isAbsolute(fromHome) && fromHome.split(sep)[0] !== "..";
  const path = underHome
    ? `$HOME/${toForwardSlashes(fromHome)}`
    : toForwardSlashes(entry);
  return `node "${path}"`;
}

// This plugin's statusLine: the current command, or the one 0.1.0 wrote (<data>/statusline.mjs).
export function isOurStatusLine(value: unknown): boolean {
  const text = JSON.stringify(value ?? null);
  return (
    text.includes("professional-statusline") &&
    (text.includes(ENTRY_NAME) || text.includes(LEGACY_ENTRY_NAME))
  );
}

// Which entry of this data folder a statusLine runs: "current" (<data>/src/statusline.mts),
// "legacy" (<data>/statusline.mjs from 0.1.0), or undefined when it runs something else.
// Compares the data folder's own name, so the $HOME form and the absolute form both match.
export function statusLineTarget(
  value: unknown,
  dataDir: string,
): "current" | "legacy" | undefined {
  // statusLine is either an object with a command, or the command string itself.
  const command =
    typeof value === "string"
      ? value
      : typeof value === "object" && value !== null && "command" in value
        ? String(value.command)
        : "";
  const text = toForwardSlashes(command);
  const id = basename(dataDir);
  if (text.includes(`/${id}/src/${ENTRY_NAME}`)) return "current";
  if (text.includes(`/${id}/${LEGACY_ENTRY_NAME}`)) return "legacy";
  return undefined;
}
