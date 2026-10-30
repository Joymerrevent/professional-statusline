---
name: setup
description: Install, remove, or check the Professional Statusline, and turn the optional enterprise spend display on or off.
argument-hint: "[install | remove | status | enterprise-spend on | enterprise-spend off]"
disable-model-invocation: true
---

# Professional Statusline setup

Run the setup script for the action the user asked for. The action is `$ARGUMENTS`. When it is empty, use `install`.

## 1. Check Node.js

Run `node --version`. If the command is not found, or the major version is below 20, stop. Tell the user that the status line runs on Node.js 20 or later, and that they need to install it from <https://nodejs.org/> and make sure `node` is on their PATH. Do not try to install Node.js yourself.

## 2. Run the action

| Action                 | Command                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `install`              | `node "${CLAUDE_PLUGIN_ROOT}/dist/setup.mjs" install --data-dir "${CLAUDE_PLUGIN_DATA}"`                                              |
| `remove`               | `node "${CLAUDE_PLUGIN_ROOT}/dist/setup.mjs" remove --data-dir "${CLAUDE_PLUGIN_DATA}"`                                               |
| `status`               | `node "${CLAUDE_PLUGIN_ROOT}/dist/setup.mjs" status --data-dir "${CLAUDE_PLUGIN_DATA}"`                                               |
| `enterprise-spend off` | `node "${CLAUDE_PLUGIN_ROOT}/dist/setup.mjs" enterprise-spend off --data-dir "${CLAUDE_PLUGIN_DATA}"`                                 |
| `enterprise-spend on`  | Follow section 3 first, then run `node "${CLAUDE_PLUGIN_ROOT}/dist/setup.mjs" enterprise-spend on --data-dir "${CLAUDE_PLUGIN_DATA}"` |

Run the command exactly as written. Do not edit `settings.json` yourself: the script changes only the `statusLine` key and refuses to write when the file is not valid JSON.

For any other action, show the list of actions above and stop.

## 3. Before `enterprise-spend on`

Show the user this explanation in their language, and ask whether to turn the display on. Run the command only after the user clearly says yes in their reply. Asking is required even when the user typed `enterprise-spend on` themselves.

> Claude Code does not send the spend limit of claude.ai Team and Enterprise accounts to status lines. To show it, the status line reads your Claude Code sign-in token on this computer and sends it to an Anthropic endpoint that is not public (`https://api.anthropic.com/api/oauth/usage`), at most once every 5 minutes. The token goes only to Anthropic and is not stored anywhere else.
>
> Anthropic's terms say that the sign-in (OAuth) is meant for ordinary use of Claude Code and Anthropic's own apps, and that Anthropic can enforce its restrictions without notice: <https://code.claude.com/docs/en/legal-and-compliance>. Decide for yourself whether this use is acceptable, and check your organization's rules. The endpoint can also change at any time. When it stops working, the spend simply disappears from the status line.
>
> You can turn it off again with `/professional-statusline:setup enterprise-spend off`.

## 4. Report

Relay the script's output to the user in their language. After `install`, add:

- The status line updates within a few seconds. If it doesn't, restart Claude Code.
- To uninstall the plugin later, run `/professional-statusline:setup remove` first. It puts back the status line that was there before.

If the script fails, show its error message and do not retry with a different command.
