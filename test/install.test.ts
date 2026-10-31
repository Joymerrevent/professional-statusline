import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import {
  isOurStatusLine,
  statusLineCommand,
  statusLineTarget,
} from "../plugin/src/install.mts";
import { tempDir } from "./helpers.ts";

const home = tempDir();
const env = { HOME: home, USERPROFILE: home };
const dataDir = join(
  home,
  ".claude",
  "plugins",
  "data",
  "professional-statusline-professional-statusline",
);

test("under the home folder, the command starts with $HOME and uses forward slashes", () => {
  assert.equal(
    statusLineCommand(dataDir, env),
    'node "$HOME/.claude/plugins/data/professional-statusline-professional-statusline/src/statusline.mts"',
  );
});

test("outside the home folder, the command keeps the absolute path", () => {
  const elsewhere = join(tempDir(), "config", "plugins", "data", "x");
  const command = statusLineCommand(elsewhere, env);
  assert.equal(command.includes("$HOME"), false);
  assert.equal(command.includes("\\"), false);
  assert.match(
    command,
    /^node ".*\/config\/plugins\/data\/x\/src\/statusline\.mts"$/,
  );
});

test("a data folder whose name only starts like the home folder is not treated as inside it", () => {
  const sibling = join(`${home}-other`, ".claude", "plugins", "data", "x");
  assert.equal(statusLineCommand(sibling, env).includes("$HOME"), false);
});

test("isOurStatusLine recognizes this version's command and the 0.1.0 one", () => {
  assert.equal(
    isOurStatusLine({
      type: "command",
      command: statusLineCommand(dataDir, env),
    }),
    true,
  );
  assert.equal(
    isOurStatusLine({
      command:
        'node "/Users/a/.claude/plugins/data/professional-statusline-professional-statusline/statusline.mjs"',
    }),
    true,
  );
  assert.equal(
    isOurStatusLine({ command: "bash ~/.claude/statusline.sh" }),
    false,
  );
  assert.equal(isOurStatusLine(undefined), false);
});

test("statusLineTarget tells which entry of this data folder a statusLine runs", () => {
  const id = "professional-statusline-professional-statusline";
  assert.equal(
    statusLineTarget(
      { command: `node "$HOME/.claude/plugins/data/${id}/src/statusline.mts"` },
      dataDir,
    ),
    "current",
  );
  assert.equal(
    statusLineTarget(
      `node "C:\\Users\\a\\.claude\\plugins\\data\\${id}\\src\\statusline.mts"`,
      dataDir,
    ),
    "current",
  );
  assert.equal(
    statusLineTarget(
      { command: `node "/Users/a/.claude/plugins/data/${id}/statusline.mjs"` },
      dataDir,
    ),
    "legacy",
  );
  assert.equal(
    statusLineTarget(
      {
        command:
          'node "$HOME/.claude/plugins/data/other-plugin/src/statusline.mts"',
      },
      dataDir,
    ),
    undefined,
  );
  assert.equal(
    statusLineTarget({ command: "bash ~/.claude/statusline.sh" }, dataDir),
    undefined,
  );
  assert.equal(statusLineTarget(null, dataDir), undefined);
});
