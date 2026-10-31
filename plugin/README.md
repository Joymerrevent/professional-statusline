# Professional Statusline

A three-line status line for [Claude Code][claude-code]:

1. The model and its effort level, in the same colors as Claude Code's `/effort` screen, with the session cost and the lines added and removed.
2. Context left, and the 5-hour and 7-day usage limits with the time until each resets. Behind a Claude apps gateway, the spend limit with its reset day.
3. Vim mode, and where you are in git: repository, path, branch, uncommitted changes, and commits ahead of or behind the upstream.

## Set up

The status line needs [Node.js][nodejs] 22.18 or later, with `node` on your `PATH`. After you install the plugin, run `/professional-statusline:setup` in Claude Code. To go back to your previous status line, run `/professional-statusline:setup remove`.

## What the plugin runs, changes, and sends

- **The status line** reads the session data that Claude Code passes to status lines and runs `git` in your working folder. It makes no network requests unless you turn on the optional spend display below.
- **Setup** changes only the `statusLine` key in your user `settings.json`. It saves the previous value and puts it back on `remove`. It copies the plugin's TypeScript files into the plugin's data folder, and `statusLine` runs that copy.
- **A `SessionStart` hook** refreshes the copy after the plugin updates. It prints nothing and makes no network requests.
- **The optional spend display for claude.ai Team and Enterprise accounts is off by default.** When you turn it on with `/professional-statusline:setup enterprise-spend on`, the status line reads your Claude Code sign-in token (from the macOS keychain, or from `.credentials.json` in your Claude Code configuration folder) and sends it to Anthropic's `https://api.anthropic.com/api/oauth/usage`, an endpoint that is not public, at most once every 5 minutes. The result is cached in the plugin's data folder. The token is not sent anywhere else and is not stored. Turn it off with `/professional-statusline:setup enterprise-spend off`.

The [privacy policy][privacy] lists what the plugin reads, stores, and sends, and how to delete what it stores.

The [full README][readme] has screenshots, troubleshooting, and the notes to read before you turn on the spend display. The plugin is released under the MIT license.

[claude-code]: https://code.claude.com/docs
[nodejs]: https://nodejs.org/
[readme]: https://github.com/Joymerrevent/professional-statusline#readme
[privacy]: https://github.com/Joymerrevent/professional-statusline/blob/main/plugin/PRIVACY.md
