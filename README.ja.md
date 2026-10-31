# Professional Statusline

[Claude Code][claude-code] を一日中使う人のための、3 行のステータスラインです。

![ステータスラインの 3 行。モデルと effort、コンテキストと利用上限の残り、vim モードと git の場所][screenshot]

[English][readme-en] · [変更の履歴（英語）][changelog]

## 各行に出るもの

| 行            | 出るもの                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. セッション | モデル名と、Claude Code の `/effort` の画面と同じ色の effort。セッションのコストと、追加・削除した行数。                                                                             |
| 2. 残量       | コンテキストの残り。5 時間と 7 日の利用上限の残りと、それぞれがリセットされるまでの時間（Pro と Max）。組織が Claude apps gateway で利用上限を決めている場合は、利用額とリセット日。 |
| 3. 場所       | vim モードのときはモード。リポジトリ名、リポジトリ内のパス、ブランチ。未コミットの変更があれば `*`、upstream との差は `↑n` / `↓n`。リポジトリの外ではフォルダ名。                    |

色は残りの量で変わります。50% 以上は緑、20% 以上は黄、20% 未満は赤です。

ステータスラインに出すのは、Claude Code がステータスラインに渡す値（[渡される値の一覧][statusline-data]）と、`git` の結果だけです。任意の[エンタープライズの利用額の表示][enterprise-spend]を有効にしない限り、ネットワークには接続しません。

## 必要なもの

- プラグインに対応した Claude Code
- [Node.js][nodejs] 22.18 以上（`node` コマンドが `PATH` から使えること）。ステータスラインは TypeScript で書いてあり、Node.js 22.18 以上はビルドせずにそのまま動かせます（型を取り除いて実行します）
- `git`（3 行目でリポジトリの情報を出すため）

macOS・Linux・Windows で動きます。Windows では、Claude Code が Git Bash と PowerShell のどちらを使っていても動きます。

## インストール

Claude Code で次を実行します。

```text
/plugin marketplace add Joymerrevent/professional-statusline
/plugin install professional-statusline@professional-statusline
/professional-statusline:setup
```

`/professional-statusline:setup` は、ユーザー設定（`~/.claude/settings.json`）の `statusLine` を書き換えます。元のステータスラインは保存され、`remove` で元に戻ります。

## コマンド

| コマンド                                              | 動き                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/professional-statusline:setup`                      | ステータスラインを入れます。`setup install` と同じです。                                   |
| `/professional-statusline:setup status`               | 今の `statusLine`、このプラグインのステータスラインが有効か、最新か、を表示します。        |
| `/professional-statusline:setup remove`               | ステータスラインを外し、元のステータスラインに戻します。                                   |
| `/professional-statusline:setup enterprise-spend on`  | チーム・エンタープライズの利用額の表示を有効にします。下の説明を読んでから使ってください。 |
| `/professional-statusline:setup enterprise-spend off` | 利用額の表示を無効にし、キャッシュを消します。                                             |

## 任意：チーム・エンタープライズの利用額

Claude Code は、claude.ai のチーム・エンタープライズのアカウントの月ごとの利用上限を、ステータスラインに渡しません。`enterprise-spend on` にすると、2 行目に利用額を出します。

```text
💭 ctx 64% left · 💳 $1,059.85 / $2,000.00 ↻1d21h (11/1)
```

利用額の表示は**既定では無効**です。有効にする前に、次を読んでください。

- 利用額を取るため、ステータスラインはお使いのパソコンにある Claude Code のログインのトークンを読み、公開されていない Anthropic の API（`https://api.anthropic.com/api/oauth/usage`）へ送ります。送るのは多くても 5 分に 1 回です。トークンの送り先は Anthropic だけで、ほかの場所には保存しません。
- Anthropic の[法務とコンプライアンスのページ][legal]には、ログイン（OAuth）は Claude Code と Anthropic のアプリの通常の利用のためのもので、Anthropic は予告なく制限を実施できる、と書かれています。この使い方を受け入れられるかはご自身で判断し、組織の決まりも確かめてください。
- API の形式は予告なく変わることがあります。取れなくなった場合は利用額が表示から消えるだけで、ほかの表示はそのまま動きます。
- API はリセットの日時を返さないため、リセット日は「毎月 1 日 0:00 UTC にリセットされる」前提で計算しています。

## アンインストール

先に `/professional-statusline:setup remove` を実行してから、プラグインをアンインストールします。

```text
/professional-statusline:setup remove
/plugin uninstall professional-statusline@professional-statusline
```

先にアンインストールすると、`settings.json` が消えたファイルを指したままになり、ステータスラインが空になります。その場合は `~/.claude/settings.json` から `statusLine` の項目を消してください。

## 仕組み

- setup は、プラグインの TypeScript のソース（`plugin/src/`）をプラグインのデータのフォルダ（`~/.claude/plugins/data/professional-statusline-professional-statusline/src/`）に写し、`statusLine` から写した方を指します。プラグイン本体のフォルダは更新のたびに変わりますが、データのフォルダは変わりません。
- プラグインの更新の後は、`SessionStart` のフックが写しを新しくします。setup を実行するまでフックは何もせず、何も出力しません。
- setup が書き換えるのは `statusLine` の項目だけです。`settings.json` が正しい JSON でないときは書き込みません。

## うまく動かないとき

- **ステータスラインが空になる：** フォルダの信頼の確認を承認してください。Claude Code を起動するターミナルで、`node --version` が 22.18 以上を示すかも確かめてください。
- **特定のプロジェクトでだけ別のステータスラインが出る：** プロジェクトの `.claude/settings.json` か `.claude/settings.local.json` が `statusLine` を決めています。プロジェクトの設定はユーザー設定より優先されます。
- **setup の後も表示が変わらない：** Claude Code を再起動してください。
- **tmux の中だと effort の色が少し違って見える：** tmux の中では、Claude Code がステータスラインを 256 色で描くため、`/effort` の画面と近い色にはなりますが、同じ色にはなりません。tmux の外では同じ色です。

## 開発

```sh
pnpm install
pnpm check   # 整形の確認・lint・型検査・テスト
```

Claude Code がインストールするものは、`plugin/src/` の TypeScript のソースも含めて、すべて `plugin/` に入っています。ビルドはしません。Node.js が `.mts` のファイルをそのまま動かします。それ以外は、テストと開発用の道具です。

手元の版を試すときは、`claude --plugin-dir <このリポジトリのパス>/plugin` で Claude Code を起動します。

変更を利用者に届けるときは、`plugin/.claude-plugin/plugin.json`（と `package.json`）の `version` を上げ、[変更の履歴][changelog]に書き足します。インストール済みの写しは、`version` が変わるまで同じ版のままです。変更が `main` に入ったら、`claude plugin tag plugin --push` でタグを付けます。Claude Code がプラグインの版に使う `professional-statusline--vX.Y.Z` の形のタグができるので、そのタグから GitHub の Release を作って公開します。

## ライセンス

[MIT][license]

[claude-code]: https://code.claude.com/docs
[readme-en]: README.md
[changelog]: CHANGELOG.md
[screenshot]: docs/images/statusline.png
[statusline-data]: https://code.claude.com/docs/en/statusline#available-data
[nodejs]: https://nodejs.org/
[legal]: https://code.claude.com/docs/en/legal-and-compliance
[enterprise-spend]: #任意チームエンタープライズの利用額
[license]: LICENSE
