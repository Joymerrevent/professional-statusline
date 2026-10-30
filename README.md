# Professional Statusline

A three-line status line for [Claude Code][claude-code], for people who use it all day.

```text
🧠 Opus 5.5 high · 💰$1.23 · +120 -14
💭 ctx 64% left · ⏳ 5h 86% left ↻1h21m · 7d 60% left ↻1d1h
[I] · 📁 [my-app]/src/lib (feature/login) * ↑1
```

[日本語の説明][readme-ja]

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
- [Node.js][nodejs] 20 or later, with `node` on your `PATH`
- `git`, for line 3 inside repositories

macOS, Linux, and Windows are supported. On Windows, the status line works whether Claude Code uses Git Bash or PowerShell.

## Install

Run these in Claude Code:

```text
/plugin marketplace add shiromoto-jun/professional-statusline
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

- Setup copies the status line script into the plugin's data folder (`~/.claude/plugins/data/professional-statusline-professional-statusline/`) and points `statusLine` at the copy. The plugin's own folder changes with every update, and the data folder does not.
- A `SessionStart` hook refreshes the copy after the plugin updates. The hook does nothing until you run setup, and it prints nothing.
- Setup changes only the `statusLine` key. It refuses to write when `settings.json` is not valid JSON.

## Troubleshooting

- **The status line is blank:** accept the workspace trust dialog, and check that `node --version` works in the terminal where you start Claude Code.
- **Another status line shows in one project:** the project's `.claude/settings.json` or `.claude/settings.local.json` sets its own `statusLine`, which takes precedence over your user settings.
- **The status line did not change after setup:** restart Claude Code.

## Development

```sh
pnpm install
pnpm check   # format, lint, typecheck, and tests
pnpm build   # bundles src/ into dist/
```

`dist/` is committed, because Claude Code installs the plugin straight from this repository. Run `pnpm build` and commit `dist/` together with the source changes. CI fails when they differ.

To try a local copy, start Claude Code with `claude --plugin-dir <path to this repository>`.

## License

[MIT][license]

[claude-code]: https://code.claude.com/docs
[readme-ja]: README.ja.md
[statusline-data]: https://code.claude.com/docs/en/statusline#available-data
[nodejs]: https://nodejs.org/
[legal]: https://code.claude.com/docs/en/legal-and-compliance
[enterprise-spend]: #optional-spend-limit-for-team-and-enterprise
[license]: LICENSE
