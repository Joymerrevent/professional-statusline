// src/setup.ts
import {
  existsSync,
  mkdirSync as mkdirSync2,
  readFileSync as readFileSync3,
  renameSync as renameSync3,
  rmSync,
  writeFileSync as writeFileSync2
} from "node:fs";
import { dirname as dirname2, join as join4, resolve } from "node:path";

// src/enterprise.ts
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join as join2 } from "node:path";

// src/paths.ts
import { homedir } from "node:os";
import { join } from "node:path";
function homeDir(env = process.env) {
  return (process.platform === "win32" ? env["USERPROFILE"] : env["HOME"]) || homedir();
}
function configDir(env = process.env) {
  return env["CLAUDE_CONFIG_DIR"] || join(homeDir(env), ".claude");
}
function claudeJsonCandidates(env = process.env) {
  const candidates = [join(homeDir(env), ".claude.json")];
  const custom = env["CLAUDE_CONFIG_DIR"];
  if (custom) candidates.unshift(join(custom, ".claude.json"));
  return candidates;
}
function toForwardSlashes(path) {
  return path.replaceAll("\\", "/");
}

// src/enterprise.ts
var files = (dataDir) => ({
  config: join2(dataDir, "config.json"),
  cache: join2(dataDir, "usage-cache.json"),
  stamp: join2(dataDir, "usage-stamp")
});
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return void 0;
  }
}
function readConfig(dataDir) {
  return readJson(files(dataDir).config) ?? {};
}
function isTeamOrEnterprise(env = process.env) {
  for (const path of claudeJsonCandidates(env)) {
    const state = readJson(
      path
    );
    if (!state) continue;
    const type = state.oauthAccount?.organizationType;
    return type === "claude_enterprise" || type === "claude_team";
  }
  return false;
}

// src/install.ts
import { copyFileSync, mkdirSync, readFileSync as readFileSync2, renameSync as renameSync2 } from "node:fs";
import { dirname, join as join3 } from "node:path";
import { fileURLToPath } from "node:url";
var SCRIPT_NAME = "statusline.mjs";
function pluginRootFrom(moduleUrl) {
  return dirname(dirname(fileURLToPath(moduleUrl)));
}
function bundledScript(pluginRoot) {
  return join3(pluginRoot, "dist", SCRIPT_NAME);
}
function installedScript(dataDir) {
  return join3(dataDir, SCRIPT_NAME);
}
function sameContent(a, b) {
  try {
    return readFileSync2(a).equals(readFileSync2(b));
  } catch {
    return false;
  }
}
function copyScript(pluginRoot, dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const target = installedScript(dataDir);
  const temporary = `${target}.tmp`;
  copyFileSync(bundledScript(pluginRoot), temporary);
  renameSync2(temporary, target);
}

// src/setup.ts
var MIN_NODE_MAJOR = 20;
var REFRESH_INTERVAL_SEC = 10;
var SetupError = class extends Error {
};
function readSettings(path) {
  if (!existsSync(path)) return { path, data: {}, indent: "  " };
  const text = readFileSync3(path, "utf8");
  let data;
  try {
    data = text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    throw new SetupError(
      `${path} is not valid JSON. Nothing was changed. Fix the file and run setup again.`
    );
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new SetupError(
      `${path} does not hold a JSON object. Nothing was changed.`
    );
  }
  const indent = /^[ \t]+/m.exec(text)?.[0] ?? "  ";
  return { path, data, indent };
}
function writeSettings(file) {
  mkdirSync2(dirname2(file.path), { recursive: true });
  const temporary = `${file.path}.professional-statusline.tmp`;
  writeFileSync2(temporary, `${JSON.stringify(file.data, null, file.indent)}
`);
  renameSync3(temporary, file.path);
}
function isOurStatusLine(value) {
  const text = JSON.stringify(value ?? null);
  return text.includes("professional-statusline") && text.includes(SCRIPT_NAME);
}
function statusLineCommand(dataDir) {
  return `node "${toForwardSlashes(join4(dataDir, SCRIPT_NAME))}"`;
}
function backupPath(dataDir) {
  return join4(dataDir, "previous-statusline.json");
}
function writeConfig(dataDir, config) {
  mkdirSync2(dataDir, { recursive: true });
  writeFileSync2(files(dataDir).config, `${JSON.stringify(config, null, 2)}
`);
}
function projectOverrides(cwd, settingsPath) {
  return [".claude/settings.json", ".claude/settings.local.json"].map((name) => join4(cwd, name)).filter((path) => {
    if (resolve(path) === resolve(settingsPath)) return false;
    try {
      const settings = JSON.parse(readFileSync3(path, "utf8"));
      return "statusLine" in settings && !isOurStatusLine(settings["statusLine"]);
    } catch {
      return false;
    }
  });
}
function install(pluginRoot, dataDir, settingsPath, log) {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < MIN_NODE_MAJOR) {
    throw new SetupError(
      `Node.js ${MIN_NODE_MAJOR} or later is required. This is Node.js ${process.versions.node}.`
    );
  }
  const settings = readSettings(settingsPath);
  copyScript(pluginRoot, dataDir);
  const previous = settings.data["statusLine"];
  if (!isOurStatusLine(previous)) {
    writeFileSync2(
      backupPath(dataDir),
      `${JSON.stringify({ statusLine: previous ?? null }, null, 2)}
`
    );
  }
  settings.data["statusLine"] = {
    type: "command",
    command: statusLineCommand(dataDir),
    refreshInterval: REFRESH_INTERVAL_SEC
  };
  writeSettings(settings);
  log(`Installed the status line in ${settingsPath}.`);
  if (previous !== void 0 && !isOurStatusLine(previous)) {
    log(
      `Saved the previous statusLine. "remove" puts it back: ${JSON.stringify(previous)}`
    );
  }
  for (const path of projectOverrides(process.cwd(), settingsPath)) {
    log(
      `Note: ${path} sets its own statusLine, which takes precedence in this project.`
    );
  }
}
function remove(dataDir, settingsPath, log) {
  const settings = readSettings(settingsPath);
  if (!isOurStatusLine(settings.data["statusLine"])) {
    log(
      `The statusLine in ${settingsPath} is not this plugin's. Nothing was changed.`
    );
    return;
  }
  let previous = null;
  try {
    previous = JSON.parse(readFileSync3(backupPath(dataDir), "utf8")).statusLine ?? null;
  } catch {
  }
  if (previous === null) delete settings.data["statusLine"];
  else settings.data["statusLine"] = previous;
  writeSettings(settings);
  for (const path of [
    installedScript(dataDir),
    backupPath(dataDir),
    files(dataDir).cache,
    files(dataDir).stamp
  ]) {
    rmSync(path, { force: true });
  }
  log(
    previous === null ? `Removed the statusLine from ${settingsPath}.` : `Restored the previous statusLine in ${settingsPath}.`
  );
}
function status(pluginRoot, dataDir, settingsPath, log) {
  const current = readSettings(settingsPath).data["statusLine"];
  const installed = existsSync(installedScript(dataDir));
  log(`settings.json: ${settingsPath}`);
  log(
    `statusLine: ${current === void 0 ? "(not set)" : JSON.stringify(current)}`
  );
  log(
    `This plugin's status line is ${isOurStatusLine(current) ? "active" : "not active"}.`
  );
  log(
    `Installed script: ${installed ? installedScript(dataDir) : "(not installed)"}`
  );
  if (installed)
    log(
      `Up to date with the plugin: ${sameContent(bundledScript(pluginRoot), installedScript(dataDir)) ? "yes" : "no"}`
    );
  log(
    `Enterprise spend display: ${readConfig(dataDir).enterpriseSpend === true ? "on" : "off"}`
  );
  log(
    `Signed in with a Team or Enterprise account: ${isTeamOrEnterprise() ? "yes" : "no"}`
  );
}
function enterpriseSpend(dataDir, value, log) {
  if (value !== "on" && value !== "off")
    throw new SetupError(
      'Use "enterprise-spend on" or "enterprise-spend off".'
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
    isTeamOrEnterprise() ? "It appears within a few minutes." : "It appears only while you are signed in with a Team or Enterprise account."
  );
}
function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : void 0;
}
function runSetup(args, env, log) {
  const command = args[0] ?? "install";
  const dataDir = option(args, "--data-dir") || env["CLAUDE_PLUGIN_DATA"];
  if (!dataDir)
    throw new SetupError(
      "The plugin data folder is unknown. Run this through /professional-statusline:setup."
    );
  const pluginRoot = pluginRootFrom(import.meta.url);
  const settingsPath = join4(configDir(env), "settings.json");
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
        `Unknown command "${command}". Use install, remove, status, or enterprise-spend on|off.`
      );
  }
}
try {
  runSetup(process.argv.slice(2), process.env, (line) => console.log(line));
} catch (error) {
  console.error(error instanceof SetupError ? error.message : String(error));
  process.exitCode = 1;
}
