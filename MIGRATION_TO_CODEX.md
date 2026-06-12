# MIGRATION_TO_CODEX.md — OpenAI Codex CLIへの移植手順書

作成日：2026-06-12
対象：青柳さん（CEO）または引っ越し作業を行う方
前提知識：HANDOVER.md・CREDENTIALS.mdを先に読んでいること

この手順書は、Claude Code（クロコ）で運用していた C:\denno\ の環境を、
**OpenAI Codex CLI**（Claude Codeに最も近いCLI型AIエージェント）に移植するための
ステップバイステップガイドです。

---

## 全体像（今回やること）

```
① Node.jsの確認
② Codex CLIのインストール
③ ログイン（ChatGPTアカウント or APIキー）
④ C:\denno をそのまま作業フォルダとして使う
⑤ CLAUDE.md → AGENTS.md として読み込ませる
⑥ Supabase MCPサーバーを設定する
⑦ .envの環境変数をCodexに渡す
⑧ Claude Code専用フック（自動処理）の代替を設定する
⑨ 動作確認
⑩ 完了チェックリスト
```

---

## ① Node.jsの確認

Codex CLIはnpmで配布されています。Node.jsが入っているか確認します。

```powershell
node -v
```

- バージョンが表示されればOK（v18以上推奨）。
- 何も表示されない・エラーの場合は https://nodejs.org/ja からLTS版をインストールしてください。

---

## ② Codex CLIのインストール

PowerShellで以下を実行します。

```powershell
npm install -g @openai/codex
```

インストール後、確認：

```powershell
codex --version
```

バージョン番号が表示されればOKです。

---

## ③ ログイン（ChatGPTアカウント or APIキー）

以下のいずれかでログインします。

### 方法A：ChatGPTアカウントでログイン（おすすめ・追加料金なし）
```powershell
codex login
```
ブラウザが開くので、ChatGPT Plus/Pro/Businessのアカウントでログインしてください。

### 方法B：OpenAI APIキーで使う（従量課金）
1. https://platform.openai.com/api-keys でAPIキーを発行
2. 環境変数に設定：
```powershell
setx OPENAI_API_KEY "sk-xxxxxxxxxxxxxxxx"
```
3. PowerShellを再起動してから `codex` を実行

**どちらを選ぶか迷ったら方法A（ChatGPTログイン）。** 既存のChatGPT契約があれば追加費用なしで使えます。

---

## ④ C:\denno をそのまま作業フォルダとして使う

C:\denno はすでにgit管理されており（`denno-source`ブランチ）、ファイルもそのまま残っています。
**新しくダウンロードし直す必要はありません。** Codex CLIをこのフォルダで起動するだけです。

```powershell
cd C:\denno
codex
```

初回起動時に「このフォルダを信頼しますか？(Trust this folder?)」のような確認が出たら **Yes** を選択してください。
これによりCodexがC:\denno内のファイル読み書き・コマンド実行ができるようになります。

---

## ⑤ CLAUDE.md → AGENTS.md として読み込ませる

Claude Codeは `CLAUDE.md` を自動で読みますが、Codex CLIは **`AGENTS.md`** という名前のファイルを同じ役割として自動で読み込みます。

### 手順
1. `C:\denno\CLAUDE.md` をコピーして `C:\denno\AGENTS.md` を作る

PowerShellで実行：
```powershell
cd C:\denno
Copy-Item CLAUDE.md AGENTS.md
```

2. 内容はそのままでOKです（中身は同じ運用ルール）。
3. 今後CLAUDE.mdを更新する場合は、AGENTS.mdにも同じ内容を反映してください（または両方同期するスクリプトを後で作る）。

> 💡 補足：Codexは「リポジトリのルート → 今いるフォルダ」の順でAGENTS.mdを連結して読み込みます。
> kyun/CLAUDE.md のようなサブフォルダの指示書も、同様に `kyun/AGENTS.md` として複製しておくと、
> kyun フォルダで作業する時に自動で読み込まれます（keiba/, kessanjo/ なども同様）。

---

## ⑥ Supabase MCPサーバーを設定する

Claude Codeでは「claude.ai Supabase」MCPが自動接続されていましたが、Codex CLIでは設定ファイルに手動で追加します。

### 手順

1. 設定ファイルを開く（存在しなければ新規作成）：
   `C:\Users\user\.codex\config.toml`

2. 以下を追記する（CREDENTIALS.mdの値を使用）：

```toml
[mcp_servers.supabase]
command = "npx"
args = [
  "-y",
  "@supabase/mcp-server-supabase@latest",
  "--project-ref=dfnhkljlohlmuoidajla"
]

[mcp_servers.supabase.env]
SUPABASE_ACCESS_TOKEN = "（CREDENTIALS.mdのanon keyまたはservice_role keyを貼る）"
```

> ⚠️ 注意：`SUPABASE_ACCESS_TOKEN` には本来「Personal Access Token」（Supabaseダッシュボード > Account > Access Tokens で発行するトークン）を使うのが公式の推奨です。
> CREDENTIALS.md記載のanonキーで読み書きできるか試してみて、エラーが出る場合はSupabaseダッシュボードから新規にPersonal Access Tokenを発行してこちらに設定してください。
> （RLS無効問題があるため、anonキーでも読み書きは通る可能性が高いです）

3. 設定後、Codexを再起動して動作確認：
```powershell
cd C:\denno
codex
```
チャット内で「Supabaseのtasksテーブルを見て」のように聞いて、データが返ってくればOK。

---

## ⑦ .envの環境変数をCodexに渡す

`C:\denno\.env` には各種APIキー（X/Twitter、Gmail、Gemini等）が入っています。
Node.jsスクリプト（agent.js等）は `dotenv` で `.env` を自動読み込みするので、**.envファイルはそのまま残しておけばスクリプト実行時には問題ありません。**

Codex自身（AIエージェント）にこれらの値を直接渡す必要はありません（スクリプトが内部で読むため）。
ただしCodexに「Xに投稿して」のような作業をスクリプト経由でなく直接やらせる場合は、必要なキーをその都度CREDENTIALS.mdから渡してください。

---

## ⑧ Claude Code専用フック（自動処理）の代替

`C:\denno\.claude\settings.json` には4つの自動処理（フック）が設定されていましたが、
これらは**Claude Code専用機能のため、Codex CLIにはそのまま移植できません**。
代替案は以下の通りです。

| Claude Codeのフック | やっていたこと | Codex CLIでの代替 |
|---|---|---|
| UserPromptSubmit | 価格キーワード検知→WebSearch強制 | AGENTS.md（CLAUDE.mdコピー）の「絶対ルール①」に既に明記されているため、**Codexがルールを読めば自動的に守る想定**。追加設定は不要。 |
| Stop（セッション終了） | `クロコ_置き書き.txt`に終了ログ追記 | 引き継ぎ不要（クロコ専用の置き書き運用は終了。Codex用に置き書きが必要なら、AGENTS.mdに「作業終了時は◯◯ファイルに記録して」と一文追記すれば対応可） |
| Stop（auto_sort.ps1実行） | フォルダ自動整理 | **そのまま使える**。`auto_sort.ps1`はPowerShellスクリプトなので、Codexに「作業が終わったら `C:\Users\user\Desktop\電脳会社\auto_sort.ps1` を実行して」とAGENTS.mdに一文追記すればCodexが代わりに実行してくれる |
| SessionStart（CEOクイズ分析取得） | Supabaseから最新の `ceo_insights` を取得してメモリファイルに反映 | Codexにはメモリファイル自動読込の仕組みがないため、**AGENTS.mdに直接「作業開始時にSupabaseのceo_insightsテーブルの最新行を確認すること」という一文を追記**して代替する |

### 推奨アクション
AGENTS.md（CLAUDE.mdのコピー）の末尾に、以下のような節を追加してください：

```markdown
## Codex運用補足（2026-06-12追加）
- 作業終了時：C:\Users\user\Desktop\電脳会社\auto_sort.ps1 を実行してフォルダを整理する
- 作業開始時：Supabaseの ceo_insights テーブルの最新行を確認し、CEOクイズの分析結果を踏まえて対応する
```

---

## ⑨ 動作確認

以下を順に試して、エラーが出ないことを確認してください。

1. **基本起動**
   ```powershell
   cd C:\denno
   codex
   ```
   → プロンプトが表示されればOK

2. **ファイル読み込み確認**
   チャットで「CLAUDE.mdの絶対ルール①を要約して」と聞く
   → 内容が返ってくればAGENTS.md/CLAUDE.mdが読めている

3. **Supabase接続確認**
   チャットで「Supabaseのtasksテーブルの件数を教えて」と聞く
   → 14件などの数字が返ってくればMCP接続OK

4. **PowerShell実行確認**
   チャットで「現在の日時をPowerShellで取得して」と聞く
   → 日時が返ってくればコマンド実行OK

5. **git確認**
   チャットで「git statusの結果を教えて」と聞く
   → denno-sourceブランチの状態が返ってくればOK

---

## ⑩ 完了チェックリスト

- [ ] `codex --version` が表示される
- [ ] `codex login` または APIキー設定が完了している
- [ ] `C:\denno\AGENTS.md` が存在する（CLAUDE.mdのコピー＋Codex運用補足を追記済み）
- [ ] `C:\Users\user\.codex\config.toml` にSupabase MCPが設定されている
- [ ] Supabaseのテーブル参照ができる
- [ ] auto_sort.ps1の代替実行ルールをAGENTS.mdに追記した
- [ ] HANDOVER.md・CREDENTIALS.mdの内容を一度Codexに読ませて、現状把握できているか確認した

---

## 困ったときは

- Codex CLI公式ドキュメント：
  - 設定リファレンス：https://developers.openai.com/codex/config-reference
  - AGENTS.mdガイド：https://developers.openai.com/codex/guides/agents-md
  - MCP設定：https://developers.openai.com/codex/mcp
- それでも分からない場合は、エラーメッセージをそのままコピーしてChatGPTに貼り、
  「Codex CLIでこのエラーが出た。C:\denno\HANDOVER.mdの環境で作業したい」と伝えれば
  解決策を提示してもらえます。
