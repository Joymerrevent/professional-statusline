# Changelog

All notable changes to this plugin are documented in this file.

The format is based on [Keep a Changelog][keep-a-changelog], and this project adheres to [Semantic Versioning][semver].

## [0.2.1] - 2026-10-31

### Fixed

- Setup now writes the `statusLine` command with `$HOME` instead of the full path when the plugin's data folder is under your home folder. The same `settings.json` works on computers with different user names. Run `/professional-statusline:setup` again to switch an existing install to the new command.
- On a computer whose `settings.json` already points at this plugin but has no copy of the status line yet, for example because `settings.json` is shared between computers, the `SessionStart` hook now makes the copy at the next start.

## [0.2.0] - 2026-10-30

### Changed

- **Breaking:** The status line now needs Node.js 22.18 or later (0.1.0 needed 20 or later). The plugin ships its TypeScript source, and Node.js runs it directly, with no build step.
- The status line now runs from `src/statusline.mts` in the plugin's data folder. An existing 0.1.0 install keeps working: at the next Claude Code start, the plugin's `SessionStart` hook points it at the new files. Running `/professional-statusline:setup` again moves `settings.json` to the new command.

## [0.1.0] - 2026-10-30

### Added

- Three-line status line:
  - Model and effort level, in the same colors as Claude Code's `/effort` screen. Session cost and lines added / removed.
  - Context left. The 5-hour and 7-day usage limits with the time until each resets. The spend limit with its reset day, behind a Claude apps gateway.
  - Vim mode. Repository name, path inside the repository, and branch, with marks for uncommitted changes and commits ahead of / behind the upstream.
- `/professional-statusline:setup` with `install`, `remove`, `status`, and `enterprise-spend on|off`. Setup changes only the `statusLine` key in `settings.json`, saves the previous one, and puts it back on `remove`.
- Optional spend display for claude.ai Team and Enterprise accounts, off by default. It sends your Claude Code sign-in token to an Anthropic endpoint that is not public; read the README before you turn it on.
- A `SessionStart` hook that refreshes the installed status line after the plugin updates.

[keep-a-changelog]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/spec/v2.0.0.html
[0.2.1]: https://github.com/Joymerrevent/professional-statusline/compare/professional-statusline--v0.2.0...professional-statusline--v0.2.1
[0.2.0]: https://github.com/Joymerrevent/professional-statusline/compare/professional-statusline--v0.1.0...professional-statusline--v0.2.0
[0.1.0]: https://github.com/Joymerrevent/professional-statusline/tree/professional-statusline--v0.1.0
