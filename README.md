# Professional Statusline

A three-line status line for [Claude Code][claude-code], for people who use it all day.

![The three lines of the status line: model and effort, context and usage limits, vim mode and git location][screenshot]

[日本語の説明][readme-ja] · [Changelog][changelog]

## What each line shows

| Line       | Shows                                                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Session | Model, and the effort level in the same colors as Claude Code's `/effort` screen. Session cost and lines added / removed.                                                                                             |
| 2. Meters  | Context left. The 5-hour and 7-day usage limits with the time until each resets (Pro and Max). The spend limit with its reset day, when your organization sets one through a Claude apps gateway.                     |
| 3. Place   | Vim mode, when vim mode is on. Repository name, path inside the repository, and branch. `*` for uncommitted changes, `↑n` / `↓n` for commits ahead of and behind the upstream. Outside a repository, the folder name. |

Colors follow how much is left: green at 50% or more, yellow at 20% or more, red below 20%.

The status line shows only the values that Claude Code sends to status lines ([available data][statusline-data]), plus what `git` reports. It makes no network requests, unless you turn on the optional [enterprise spend display][enterprise-spend].

## Requirements

- Claude Code with plugin support
- [Node.js][nodejs] 22.18 or later, with `node` on your `PATH`. The status line is written in TypeScript, and Node.js 22.18 and later run it as is (type stripping), with no build step
- `git`, for line 3 inside repositories

macOS, Linux, and Windows are supported. On Windows, the status line works whether Claude Code uses Git Bash or PowerShell.

## Install

Run these in Claude Code:

```text
/plugin marketplace add Joymerrevent/professional-statusline
/plugin install professional-statusline@professional-statusline
/professional-statusline:setup
```

`/professional-statusline:setup` sets `statusLine` in your user settings (`~/.claude/settings.json`). If you already had a status line, setup saves it and `remove` puts it back.

## Commands

| Command                                               | What it does                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/professional-statusline:setup`                      | Installs the status line. Same as `setup install`.                                                         |
| `/professional-statusline:setup status`               | Shows the current `statusLine`, whether this plugin's status line is active, and whether it is up to date. |
| `/professional-statusline:setup remove`               | Removes the status line and puts back the one you had before.                                              |
| `/professional-statusline:setup enterprise-spend on`  | Turns on the optional spend display for Team and Enterprise. See below.                                    |
| `/professional-statusline:setup enterprise-spend off` | Turns it off and deletes its cache.                                                                        |

## Optional: spend limit for Team and Enterprise

Claude Code does not send the monthly spend limit of claude.ai Team and Enterprise accounts to status lines. With `enterprise-spend on`, line 2 shows it:

```text
💭 ctx 64% left · 💳 $1,059.85 / $2,000.00 ↻1d21h (11/1)
```

The display is **off by default**. Read this before you turn it on:

- To get the values, the status line reads your Claude Code sign-in token on your computer and sends it to an Anthropic endpoint that is not public (`https://api.anthropic.com/api/oauth/usage`), at most once every 5 minutes. The token goes only to Anthropic and is not stored anywhere else.
- Anthropic's [legal and compliance page][legal] says that the sign-in (OAuth) is meant for ordinary use of Claude Code and Anthropic's own apps, and that Anthropic can enforce its restrictions without notice. Decide for yourself whether this use is acceptable, and check your organization's rules.
- The endpoint can change at any time. When it stops working, the spend disappears from the status line and the rest keeps working.
- The reset day assumes the limit resets at 00:00 UTC on the first day of each month, because the endpoint does not return the reset time.

## Uninstall

Run `/professional-statusline:setup remove` first, then uninstall the plugin:

```text
/professional-statusline:setup remove
/plugin uninstall professional-statusline@professional-statusline
```

If you uninstall first, `settings.json` keeps pointing at a file that no longer exists and the status line stays blank. Delete the `statusLine` key from `~/.claude/settings.json` to fix it.

## How it works

- Setup copies the plugin's TypeScript source (`plugin/src/`) into the plugin's data folder (`~/.claude/plugins/data/professional-statusline-professional-statusline/src/`) and points `statusLine` at the copy. The plugin's own folder changes with every update, and the data folder does not.
- When the data folder is under your home folder, the `statusLine` command starts with `$HOME` instead of the full path, so the same `settings.json` works on computers with different user names. bash, zsh, and PowerShell all expand `$HOME`.
- A `SessionStart` hook refreshes the copy after the plugin updates. On a computer that shares your `settings.json` but has no copy yet, the hook makes the copy at the next start, once the plugin is installed there. Otherwise the hook does nothing until you run setup. It prints nothing.
- Setup changes only the `statusLine` key. It refuses to write when `settings.json` is not valid JSON.

## Troubleshooting

- **The status line is blank:** accept the workspace trust dialog, and check that `node --version` shows 22.18 or later in the terminal where you start Claude Code.
- **Another status line shows in one project:** the project's `.claude/settings.json` or `.claude/settings.local.json` sets its own `statusLine`, which takes precedence over your user settings.
- **The status line did not change after setup:** restart Claude Code.
- **The effort colors look slightly different in tmux:** inside tmux, Claude Code draws the status line with 256 colors, so the colors are close to, but not the same as, the `/effort` screen. Outside tmux they match.

## Development

```sh
pnpm install
pnpm check   # format, lint, typecheck, and tests
```

Everything that Claude Code installs is in `plugin/`, including the TypeScript source in `plugin/src/`. There is no build step: Node.js runs the `.mts` files directly. The rest of the repository holds the tests and the development tools.

To try a local copy, start Claude Code with `claude --plugin-dir <path to this repository>/plugin`.

To ship a change to users, raise `version` in `plugin/.claude-plugin/plugin.json` (and in `package.json`) and add an entry to the [changelog][changelog]. Installed copies stay on their version until it changes. After the change is on `main`, tag it with `claude plugin tag plugin --push`, which creates the `professional-statusline--vX.Y.Z` tag that Claude Code uses for plugin versions, and publish a GitHub release from that tag.

## License

[MIT][license]

[claude-code]: https://code.claude.com/docs
[readme-ja]: README.ja.md
[changelog]: CHANGELOG.md
[screenshot]: docs/images/statusline.png
[statusline-data]: https://code.claude.com/docs/en/statusline#available-data
[nodejs]: https://nodejs.org/
[legal]: https://code.claude.com/docs/en/legal-and-compliance
[enterprise-spend]: #optional-spend-limit-for-team-and-enterprise
[license]: LICENSE
