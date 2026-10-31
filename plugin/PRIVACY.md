# Privacy policy

Effective date: 2026-10-31

This policy covers Professional Statusline, a plugin for Claude Code published by Joymerrevent. The plugin runs only on your computer. Joymerrevent runs no server for the plugin and receives no data from it.

## What the plugin reads

- **Session data that Claude Code passes to status lines:** the model and its effort level, the session cost, the lines added and removed, the context left, the usage limits, the Vim mode, and the working folder.
- **Git information for the working folder:** the repository name, the path inside the repository, the branch, uncommitted changes, and the number of commits ahead of or behind the upstream. The plugin gets this information by running `git` on your computer.
- **Only when you turn on the optional spend display:** the account type (`oauthAccount.organizationType` in your `.claude.json`), and your Claude Code sign-in token, from the macOS keychain or from `.credentials.json` in your Claude Code configuration folder.

The plugin doesn't read your conversations, your prompts, the contents of your files, your name, or your email address.

## What the plugin stores on your computer

Setup changes only the `statusLine` key in your user `settings.json`. The plugin keeps everything else in its data folder, `~/.claude/plugins/data/<plugin id>/`:

- A copy of the status line's TypeScript files, which `statusLine` runs.
- Your previous `statusLine` setting, so that `/professional-statusline:setup remove` can put it back.
- `config.json`, which records whether the spend display is on.
- **Only when the spend display is on:** `usage-cache.json`, which holds the time of the last fetch and the `extra_usage` part of Anthropic's response, your account's spend figures such as the monthly limit and the amount used, and `usage-stamp`, which holds the time of the last refresh.

The plugin never writes your sign-in token to disk.

## What the plugin sends

The spend display is off by default, and while it's off, the plugin makes no network requests.

When you turn on the spend display with `/professional-statusline:setup enterprise-spend on`, the status line sends your sign-in token to Anthropic's `https://api.anthropic.com/api/oauth/usage` at most once every 5 minutes, to get your account's spend figures. Anthropic handles the request under [Anthropic's privacy policy][anthropic-privacy]. The plugin sends the token nowhere else, and sends nothing to Joymerrevent.

## How long data is kept

Joymerrevent keeps no data, because the plugin sends Joymerrevent none.

On your computer:

- Each refresh replaces the spend figures in `usage-cache.json`.
- `/professional-statusline:setup enterprise-spend off` deletes `usage-cache.json` and `usage-stamp`.
- `/professional-statusline:setup remove` puts your previous `statusLine` back, and deletes the copied files, the saved `statusLine` setting, `usage-cache.json`, and `usage-stamp`.
- By default, Claude Code deletes the plugin's data folder when you uninstall the plugin from the last place it's installed. Claude Code's [uninstall options][uninstall] can keep the data folder.

## Changes to this policy

When this policy changes, the effective date above changes, and the [changelog][changelog] records the change.

## Contact

Ask questions about this policy in [GitHub Issues][issues].

[anthropic-privacy]: https://www.anthropic.com/legal/privacy
[changelog]: https://github.com/Joymerrevent/professional-statusline/blob/main/CHANGELOG.md
[issues]: https://github.com/Joymerrevent/professional-statusline/issues
[uninstall]: https://code.claude.com/docs/en/plugins/cli-reference#plugin-uninstall
