// Installs, removes, and reports the status line. `/professional-statusline:setup` runs this file.
//
//   node dist/setup.mjs install            --data-dir <plugin data folder>
//   node dist/setup.mjs remove             --data-dir <plugin data folder>
//   node dist/setup.mjs status             --data-dir <plugin data folder>
//   node dist/setup.mjs enterprise-spend on|off --data-dir <plugin data folder>
//
// settings.json is changed only when it parses as a JSON object. Otherwise nothing is written.

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
} from "./enterprise.ts";
import {
  bundledScript,
  copyScript,
  installedScript,
  pluginRootFrom,
  sameContent,
  SCRIPT_NAME,
} from "./install.ts";
import { configDir, toForwardSlashes } from "./paths.ts";

const MIN_NODE_MAJOR = 20;
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

function isOurStatusLine(value: unknown): boolean {
  const text = JSON.stringify(value ?? null);
  return text.includes("professional-statusline") && text.includes(SCRIPT_NAME);
}

function statusLineCommand(dataDir: string): string {
  return `node "${toForwardSlashes(join(dataDir, SCRIPT_NAME))}"`;
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
  const major = Number(process.versions.node.split(".")[0]);
  if (major < MIN_NODE_MAJOR) {
    throw new SetupError(
      `Node.js ${MIN_NODE_MAJOR} or later is required. This is Node.js ${process.versions.node}.`,
    );
  }
  const settings = readSettings(settingsPath);
  copyScript(pluginRoot, dataDir);

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
    installedScript(dataDir),
    backupPath(dataDir),
    files(dataDir).cache,
    files(dataDir).stamp,
  ]) {
    rmSync(path, { force: true });
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
  const installed = existsSync(installedScript(dataDir));
  log(`settings.json: ${settingsPath}`);
  log(
    `statusLine: ${current === undefined ? "(not set)" : JSON.stringify(current)}`,
  );
  log(
    `This plugin's status line is ${isOurStatusLine(current) ? "active" : "not active"}.`,
  );
  log(
    `Installed script: ${installed ? installedScript(dataDir) : "(not installed)"}`,
  );
  if (installed)
    log(
      `Up to date with the plugin: ${sameContent(bundledScript(pluginRoot), installedScript(dataDir)) ? "yes" : "no"}`,
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
