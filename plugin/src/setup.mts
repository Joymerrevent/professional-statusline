// Installs, removes, and reports the status line. `/professional-statusline:setup` runs this file.
//
//   node src/setup.mts install            --data-dir <plugin data folder>
//   node src/setup.mts remove             --data-dir <plugin data folder>
//   node src/setup.mts status             --data-dir <plugin data folder>
//   node src/setup.mts enterprise-spend on|off --data-dir <plugin data folder>
//
// settings.json is changed only when it parses as a JSON object. Otherwise nothing is written.
// Node.js runs this file only when it can run TypeScript (22.18 or later), so no version check is needed here.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  files,
  isTeamOrEnterprise,
  readConfig,
  type PluginConfig,
} from "./enterprise.mts";
import {
  copySource,
  ENTRY_NAME,
  installedDir,
  installedEntry,
  LEGACY_ENTRY_NAME,
  legacyEntry,
  pluginRootFrom,
  sameSource,
  sourceDir,
} from "./install.mts";
import { configDir, toForwardSlashes } from "./paths.mts";

const REFRESH_INTERVAL_SEC = 10;

type Settings = Record<string, unknown>;

class SetupError extends Error {}

interface SettingsFile {
  path: string;
  data: Settings;
  indent: string;
}

function readSettings(path: string): SettingsFile {
  if (!existsSync(path)) return { path, data: {}, indent: "  " };
  const text = readFileSync(path, "utf8");
  let data: unknown;
  try {
    data = text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    throw new SetupError(
      `${path} is not valid JSON. Nothing was changed. Fix the file and run setup again.`,
    );
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new SetupError(
      `${path} does not hold a JSON object. Nothing was changed.`,
    );
  }
  const indent = /^[ \t]+/m.exec(text)?.[0] ?? "  ";
  return { path, data: data as Settings, indent };
}

function writeSettings(file: SettingsFile): void {
  mkdirSync(dirname(file.path), { recursive: true });
  const temporary = `${file.path}.professional-statusline.tmp`;
  writeFileSync(temporary, `${JSON.stringify(file.data, null, file.indent)}\n`);
  renameSync(temporary, file.path);
}

// This version's command, or the one 0.1.0 wrote (<data>/statusline.mjs).
function isOurStatusLine(value: unknown): boolean {
  const text = JSON.stringify(value ?? null);
  return (
    text.includes("professional-statusline") &&
    (text.includes(ENTRY_NAME) || text.includes(LEGACY_ENTRY_NAME))
  );
}

function statusLineCommand(dataDir: string): string {
  return `node "${toForwardSlashes(installedEntry(dataDir))}"`;
}

function backupPath(dataDir: string): string {
  return join(dataDir, "previous-statusline.json");
}

function writeConfig(dataDir: string, config: PluginConfig): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(files(dataDir).config, `${JSON.stringify(config, null, 2)}\n`);
}

// Project settings take precedence over user settings, so a statusLine there hides this one.
// When Claude Code starts in the home folder, ~/.claude/settings.json is both, so skip the user settings file.
function projectOverrides(cwd: string, settingsPath: string): string[] {
  return [".claude/settings.json", ".claude/settings.local.json"]
    .map((name) => join(cwd, name))
    .filter((path) => {
      if (resolve(path) === resolve(settingsPath)) return false;
      try {
        const settings = JSON.parse(readFileSync(path, "utf8")) as Settings;
        return (
          "statusLine" in settings && !isOurStatusLine(settings["statusLine"])
        );
      } catch {
        return false;
      }
    });
}

function install(
  pluginRoot: string,
  dataDir: string,
  settingsPath: string,
  log: (line: string) => void,
): void {
  const settings = readSettings(settingsPath);
  copySource(pluginRoot, dataDir);

  const previous = settings.data["statusLine"];
  if (!isOurStatusLine(previous)) {
    writeFileSync(
      backupPath(dataDir),
      `${JSON.stringify({ statusLine: previous ?? null }, null, 2)}\n`,
    );
  }
  settings.data["statusLine"] = {
    type: "command",
    command: statusLineCommand(dataDir),
    refreshInterval: REFRESH_INTERVAL_SEC,
  };
  writeSettings(settings);
  // settings.json no longer points at the 0.1.0 entry, so remove it.
  rmSync(legacyEntry(dataDir), { force: true });

  log(`Installed the status line in ${settingsPath}.`);
  if (previous !== undefined && !isOurStatusLine(previous)) {
    log(
      `Saved the previous statusLine. "remove" puts it back: ${JSON.stringify(previous)}`,
    );
  }
  for (const path of projectOverrides(process.cwd(), settingsPath)) {
    log(
      `Note: ${path} sets its own statusLine, which takes precedence in this project.`,
    );
  }
}

function remove(
  dataDir: string,
  settingsPath: string,
  log: (line: string) => void,
): void {
  const settings = readSettings(settingsPath);
  if (!isOurStatusLine(settings.data["statusLine"])) {
    log(
      `The statusLine in ${settingsPath} is not this plugin's. Nothing was changed.`,
    );
    return;
  }
  let previous: unknown = null;
  try {
    previous =
      (
        JSON.parse(readFileSync(backupPath(dataDir), "utf8")) as {
          statusLine?: unknown;
        }
      ).statusLine ?? null;
  } catch {
    // No backup: the setting had no statusLine before.
  }
  if (previous === null) delete settings.data["statusLine"];
  else settings.data["statusLine"] = previous;
  writeSettings(settings);

  for (const path of [
    installedDir(dataDir),
    legacyEntry(dataDir),
    backupPath(dataDir),
    files(dataDir).cache,
    files(dataDir).stamp,
  ]) {
    rmSync(path, { recursive: true, force: true });
  }
  log(
    previous === null
      ? `Removed the statusLine from ${settingsPath}.`
      : `Restored the previous statusLine in ${settingsPath}.`,
  );
}

function status(
  pluginRoot: string,
  dataDir: string,
  settingsPath: string,
  log: (line: string) => void,
): void {
  const current = readSettings(settingsPath).data["statusLine"];
  const installed = existsSync(installedEntry(dataDir));
  log(`settings.json: ${settingsPath}`);
  log(
    `statusLine: ${current === undefined ? "(not set)" : JSON.stringify(current)}`,
  );
  log(
    `This plugin's status line is ${isOurStatusLine(current) ? "active" : "not active"}.`,
  );
  log(
    `Installed script: ${installed ? installedEntry(dataDir) : "(not installed)"}`,
  );
  if (installed)
    log(
      `Up to date with the plugin: ${sameSource(sourceDir(pluginRoot), installedDir(dataDir)) ? "yes" : "no"}`,
    );
  log(
    `Enterprise spend display: ${readConfig(dataDir).enterpriseSpend === true ? "on" : "off"}`,
  );
  log(
    `Signed in with a Team or Enterprise account: ${isTeamOrEnterprise() ? "yes" : "no"}`,
  );
}

function enterpriseSpend(
  dataDir: string,
  value: string | undefined,
  log: (line: string) => void,
): void {
  if (value !== "on" && value !== "off")
    throw new SetupError(
      'Use "enterprise-spend on" or "enterprise-spend off".',
    );
  const config = { ...readConfig(dataDir), enterpriseSpend: value === "on" };
  writeConfig(dataDir, config);
  if (value === "off") {
    rmSync(files(dataDir).cache, { force: true });
    rmSync(files(dataDir).stamp, { force: true });
    log("Turned the enterprise spend display off and deleted its cache.");
    return;
  }
  log("Turned the enterprise spend display on.");
  log(
    isTeamOrEnterprise()
      ? "It appears within a few minutes."
      : "It appears only while you are signed in with a Team or Enterprise account.",
  );
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function runSetup(
  args: string[],
  env: NodeJS.ProcessEnv,
  log: (line: string) => void,
): void {
  const command = args[0] ?? "install";
  const dataDir = option(args, "--data-dir") || env["CLAUDE_PLUGIN_DATA"];
  if (!dataDir)
    throw new SetupError(
      "The plugin data folder is unknown. Run this through /professional-statusline:setup.",
    );
  const pluginRoot = pluginRootFrom(import.meta.url);
  const settingsPath = join(configDir(env), "settings.json");

  switch (command) {
    case "install":
      install(pluginRoot, dataDir, settingsPath, log);
      return;
    case "remove":
      remove(dataDir, settingsPath, log);
      return;
    case "status":
      status(pluginRoot, dataDir, settingsPath, log);
      return;
    case "enterprise-spend":
      enterpriseSpend(dataDir, args[1], log);
      return;
    default:
      throw new SetupError(
        `Unknown command "${command}". Use install, remove, status, or enterprise-spend on|off.`,
      );
  }
}

try {
  runSetup(process.argv.slice(2), process.env, (line) => console.log(line));
} catch (error) {
  console.error(error instanceof SetupError ? error.message : String(error));
  process.exitCode = 1;
}
