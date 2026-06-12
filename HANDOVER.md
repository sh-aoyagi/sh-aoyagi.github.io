# HANDOVER.md — 電脳会社 引き継ぎ索引

作成日：2026-06-12
作成者：庵野（Claude Code 最終タスク）
目的：青柳さん(CEO/真平さん)がClaude Codeから別のAIツールへ完全移行するための引き継ぎ資料。
このファイル単体（＋CREDENTIALS.md）を読めば、新ツールがC:\denno\とSupabase・GitHubの現状を把握し、作業を継続できる状態にする。

---

## 0. 最初に読むべきファイル（この順番で）

1. **C:\denno\HANDOVER.md**（このファイル）— 全体像・索引
2. **C:\denno\CREDENTIALS.md** — 接続情報（Supabase・GitHub・各API）
3. **C:\denno\CLAUDE.md** — 全チーム運用ルール・体制・KPI・絶対ルール（最も重要な運用ドキュメント）
4. **C:\denno\current_task.txt** — 直前の作業状態（タスク名・進捗・再開情報）
5. **C:\denno\skills\aoyagi-style-fiction\SKILL.md** — 自キュン制作の核心ロジック
6. **C:\denno\skills\horse-racing-article\SKILL.md** — 競馬記事制作の核心ロジック（FIREスコア）
7. 本ファイル末尾の「最終チェックリストTOP5」

> 🆕 **OpenAI Codex CLIへ移植する場合**：`C:\denno\MIGRATION_TO_CODEX.md`（ステップバイステップ手順書、Desktop\電脳会社\05_宿題にも同内容のtxtあり）を参照。

---

## 1. 最終チェックリスト（これだけは引き継がないと詰むTOP5）

1. **Supabase接続情報（CREDENTIALS.md参照）**
   project_id: `dfnhkljlohlmuoidajla`。SUPABASE_URL・SUPABASE_KEY（anon）がないと全テーブル（35個）にアクセス不能＝全自動化が止まる。
   ⚠️ **RLSが35テーブル全てで無効**。anonキー＝実質マスターキー。新ツールに渡す際は取り扱い注意（公開リポジトリにこのキーをそのまま貼らない）。

2. **CLAUDE.md（C:\denno\CLAUDE.md）の3大絶対ルール**
   - ①価格・相場はWebSearchなしに口にしない
   - ②自律稼働（気づいたら自分から報告）
   - ③根拠のない提案は提案として成立しない（出典必須）
   これを新ツールのシステムプロンプト/カスタム指示に必ず引き継ぐこと。

3. **「更新して」コマンドの実行フロー**（CLAUDE.md内）
   毎朝/呼ばれた時に実行する6タスク＋GitHub Pagesへのpush。これが事業の心臓部の自動化。

4. **進行中タスクの状態（本ファイル §3）**
   - 自キュンSeries19：本文完成済みだが note装飾・タグ・TOP画像プロンプト・Supabase INSERT・CEO通知（⑩〜⑫）が未着手
   - 競馬：宝塚記念2026の記事①〜③は作成済み、article-format-uma/jari/history.mdの3テンプレートが未作成
   - 決算城：100社中1社分のHTML化のみ完了（記事メモは100/100完成）

5. **GitHubリポジトリの構成（本ファイル§6・CREDENTIALS.md）**
   今回の引っ越し作業で、C:\denno本体を初めてGitHub化した（`sh-aoyagi/sh-aoyagi.github.io` の `denno-source` ブランチ）。新ツールはまずこのブランチをcloneすれば全SKILL・台本・進行中ファイルを取得できる。

---

## 2. C:\denno\ ディレクトリ構成と各フォルダの役割

| パス | 役割（1行） |
|---|---|
| `.claude/` | Claude Code設定。agents/（10エージェント定義）・settings.json（4フック：価格チェック・終了ログ・CEOクイズ取得・圧縮ログ）・settings.local.json |
| `.env` | 全APIキー（Supabase・X/Twitter・Gmail・Gemini・RemoveBG等）。**.gitignoreで除外、push対象外** |
| `.gitignore` | 今回新規作成。node_modules・.env・__pycache__・lp_staging（別repo）を除外 |
| `CLAUDE.md` | **全チーム運用ルールの本体**（強制ルール・体制・各チームKPI・コンテンツ設計・アルゴリズム） |
| `CLAUDE_old.md` / `old/CLAUDE.md` | CLAUDE.mdの旧版アーカイブ |
| `current_task.txt` | タスク再開用の状態ファイル（TASK/STATUS/LAST_STEP/DETAIL） |
| `aoyagi-style.md` | 青柳さんの文体ガイド（kyun/keiba参照） |
| `agent.js` | メインタスクオーケストレーター。Supabase.tasksをpoll→commands/配下のハンドラを実行 |
| `commands/` | agent.jsから呼ばれるタスクハンドラ：`new_listing.js`（メルカリ新規出品文生成）・`draft_listing.js`・`price_change.js`（価格変更）・`update_listing.js` |
| `scripts/` | 週次/SNS自動化スクリプト群（詳細は§5） |
| `skills/` | カスタムSKILL定義（詳細は§4） |
| `kyun/` | **自キュン**（官能ショートストーリー）制作プロジェクト。episodes/（話ごとの台本）・output/（マージ済み完成稿）・辞書3種・00〜07の工程ファイル |
| `keiba/` | **競馬**（FIREスコア予想）制作プロジェクト。references/・00〜04工程ファイル |
| `kessanjo/` | **風雲！決算城**サイトのソース（index.html/css/js/articles）。Desktop\電脳会社\01_決算城とは別のdev領域 |
| `novel_team/` | 複数ライター人格による連載小説プロジェクト。agents/（erika・nomura）・output/approved（3本公開済み） |
| `poccharing/` | 「ぽっちゃりんぐ」マッチングアプリ（別事業）。Supabaseスキーマ定義済み(schema.sql)、フロント実装途中 |
| `lp_staging/` | 楽天競馬アフィリLPのステージング。**独立git repo**（fire-keiba-lp） |
| `website/` | GitHub Pages公開用静的ファイル（index.html, .nojekyll） |
| `team/` | CEO/CFO/セラー等のロールペルソナ定義（意思決定フレーム） |
| `weekly-posts/` | 週次投稿アーカイブ（現状ほぼ未使用、Supabase platform_postsに移行済み） |
| `output/` | agent.js/commands実行結果ログ（task_*.txt）、x_poster_log.txt |
| `images/` | 画像アセット置き場（現状空） |
| `node_modules/` | npm依存（package.jsonから`npm install`で復元可。**push対象外**） |
| `__pycache__/` | Pythonキャッシュ（**push対象外**） |

### トップレベルの実行スクリプト
- `x_poster.py` — Supabase.platform_postsの予約投稿をX(Twitter)へポスト。Gmail通知付き。**現在Xアカウント凍結中のため停止中**（CLAUDE.md参照）
- `uma_note_pipeline.py` — 競馬×note記事生成パイプライン（claude-opus-4-7想定、フォールバックsonnet-4-6）
- `reel_generator.py` — 縦型リール動画生成（Pexels API使用）
- `photo_pipeline.js` — HEIC→JPEG変換・背景除去（RemoveBG）・Supabase Storageアップロード
- `run_x_poster.bat` — x_poster.py起動用バッチ（Task Scheduler用、現状未登録）
- `list_models.mjs` / `list_all_models.mjs` / `test_model*.mjs` — Claude/Geminiモデル一覧・動作テスト用スクリプト

---

## 3. 進行中タスクと進捗（2026-06-12時点）

### 3-1. 自キュン（kyun/）— Series19
- STATUS: 完了（本文）/ 未完了（後工程）
- タイトル：Series19「短冊に、続きを。」（昭和61年夏／商店街レコード店、宮坂×蓮見）
- 完成物：
  - `kyun/episodes/19話/block01-05.txt` + `story_state.md`
  - `kyun/output/19話.md`（マージ済み）
  - `C:\Users\user\Desktop\電脳会社\04_自キュン\20260611_自キュンSeries19_短冊に続きを.txt`
- **未着手（次の作業者がやること）**：
  - ⑩ note用装飾（太字/改行）＋タグ制作＋TOP画像プロンプト（Season9以降の番号を使用）
  - ⑪ Supabase INSERT（novel_stories or 専用テーブル要確認）
  - ⑫ CEOへ通知
- 制作手順は `CLAUDE.md` の「自キュン 制作手順（2026-06-03確定版）」セクション、または `skills/aoyagi-style-fiction/SKILL.md` を参照。

### 3-2. 競馬（keiba/）— 宝塚記念2026
- 記事①②③（メイショウタバル/マイネルエンペラー、クロワデュノール/ミュージアムマイル系）はDesktop\電脳会社\02_競馬\に保存済み（20260611付）
- **未作成（明日作成予定とされていたテンプレート）**：
  - `skills/horse-racing-article/references/article-format-uma.md`（2頭深掘り記事フォーマット）
  - `skills/horse-racing-article/references/article-format-jari.md`（7〜10R予想フォーマット）
  - `skills/horse-racing-article/references/article-format-history.md`（歴史記事フォーマット）
- FIREスコアv2の計算ロジックは `skills/horse-racing-article/FIREスコアv2指示書.md` に確定済み。

### 3-3. 決算城（kessanjo/ + Desktop\01_決算城）
- 企業×城主リスト100社：完成済み（`Desktop\電脳会社\決算城_企業×城主対応リスト.txt` 等を要確認）
- 記事メモ（テキスト）：100/100完成（castle_articlesテーブルにも100件INSERT済み）
- HTML化：`kessanjo/articles/fastretailing-shirasagijo.html` の1本のみ（ユニクロ×白鷺城×家康）
- 4コマ画像・アフィリリンク・GA4設定：未着手（DAY2/DAY3扱い）

### 3-4. その他
- `poccharing/`：Supabaseスキーマ(schema.sql)定義済み、フロントは app.html/index.html が存在するが動作確認未実施
- `novel_team/`：approved 3本（001〜003）公開済み、4本目以降は要確認
- X投稿：`@FIRE1173Go` 凍結中。**自動投稿は全停止**。Claudeは原稿テキストのみ生成し、CEOが手動投稿（CLAUDE.md「X投稿ルール」参照）

---

## 4. SKILL構成（C:\denno\skills\）

### 4-1. aoyagi-style-fiction/（自キュン用・成熟済み）
- `SKILL.md`：9ステップ生成プロセス（設計→ブロック生成→20項目セルフチェック→10ペルソナ校閲→装飾）
- `references/`：
  - `青柳真平_文体XML仕様書.xml`（文体ルール200項目のXML版）
  - `青柳真平_文体ルール200項目.md`
  - `青柳真平_文体完全分析レポート.md`
  - `自キュン売機_100話設計マトリクス.md`（全100話の設計表）
  - `自キュン売機_創作哲学書.md`
  - `自キュン売機_最終文体ハーネス.md` / `青柳文体ハーネス-自キュン版-.md` / `青柳真平らしさハーネス-自キュン版-.md`
  - `AI臭パターン100種_青柳文体校正リスト.md`
  - `自キュン_話設計ランダムジェネレーター.md`

### 4-2. horse-racing-article/（競馬用・コア完成・テンプレ一部未完成）
- `SKILL.md`：週5本構成のワークフロー（記事①メイン予想、②7-10R、③④2頭深掘り、⑤歴史記事）
- `FIREスコアv2指示書.md`：100点満点スコアロジック（確定要素68点＋可変要素±32点）
- `references/`：
  - `triple-crown-baseline.md`（三冠馬ベンチマーク）✅
  - `search-rules.md`（日付/開催地の検証ルール）✅
  - `article-format-main.md`（記事①テンプレ）✅
  - `article-format-uma.md` 🔲未作成
  - `article-format-jari.md` 🔲未作成
  - `article-format-history.md` 🔲未作成

---

## 5. 週次自動化スクリプト・タスクスケジューラ設定

### 5-1. Windowsタスクスケジューラ（確認済み・稼働中）
**タスク名：「電脳会社ダッシュボード自動push」**
- 実行内容：`powershell.exe -NonInteractive -ExecutionPolicy Bypass -File "C:\Users\user\Desktop\電脳会社\auto_push_dashboard.ps1"`
- トリガー：2026-06-03T09:00:00開始、毎日1回（DaysInterval=1）
- 状態：Ready（有効）
- スクリプト内容：
  - `C:\Users\user\Desktop\電脳会社` で `git status --short` を確認
  - 変更なし→`push_log.txt`に「変更なし。スキップ。」を記録
  - 変更あり→`dashboard.html` `kyun-workspace/index.html` `keiba-workspace/index.html` をadd→commit→`git push origin master`
  - 結果を `push_log.txt` に記録

### 5-2. Claude Code hooks（C:\denno\.claude\settings.json）
- **UserPromptSubmit**：プロンプトに価格・相場・メルカリ等のキーワードを検知→WebSearch強制の追加コンテキストを注入
- **Stop**（セッション終了時）：
  1. `C:\Users\user\Desktop\クロコ_置き書き.txt` にセッション終了ログを追記
  2. 同ファイルに価格ルールのリマインダーを追記
  3. `C:\Users\user\Desktop\電脳会社\auto_sort.ps1` を非同期実行（フォルダ整理＝Desktop\電脳会社内のファイルを各サブフォルダに振り分け）
- **SessionStart**：Supabase `ceo_insights` の最新行を取得→`C:\Users\user\.claude\projects\C--denno\memory\ceo_quiz_insights.md` に書き込み（CEOクイズ分析の自動反映）
- **PostCompact**：コンテキスト圧縮発生時に置き書きファイルへ記録

⚠️ 新ツールへの移行時、上記のうち「Claude Code hooks」は**Claude Code固有機能のため引き継げない**。同等の処理（セッション終了ログ・フォルダ自動整理・CEOクイズ分析の自動反映）を新ツールの仕組みで再実装する必要がある。`auto_sort.ps1`自体はPowerShellスクリプトなので、新ツールからも呼び出し可能。

### 5-3. C:\denno\scripts\ の各スクリプト
- `agent.js`：Supabase.tasksをpending→running→done/failedで処理するメインループ（`npm start`で起動）
- `post-pending.js`：Supabase.platform_postsのpending投稿をX/Threads/Instagramへ投稿
- `generate-content.js`：週次SNS投稿30本（X10/Threads10/Instagram10）を生成し`platform_posts`にINSERT（既存週はスキップ）
- `generate-weekly-md.js`：週次計画Markdown生成
- `run-weekly.js`：週次処理のトリガースクリプト
- `pdca-report.js`：週次PDCAレポート生成
- `carousel-builder.js`：SNS用カルーセル画像生成

これらはタスクスケジューラには未登録（手動/agent.js経由での実行が前提と思われる）。新ツールが定期実行を担う場合は、これらをトリガーするタスクスケジューラ設定の追加を検討。

---

## 6. GitHubリポジトリ構成

| リポジトリ | 用途 | ローカルパス | ブランチ |
|---|---|---|---|
| `sh-aoyagi/sh-aoyagi.github.io` | メインダッシュボード・各チームの完成コンテンツ公開（GitHub Pages） | `C:\Users\user\Desktop\電脳会社` | master |
| `sh-aoyagi/sh-aoyagi.github.io` | **C:\denno本体のソース（今回初push）**：SKILL・進行中台本・自動化スクリプト一式 | `C:\denno` | **denno-source**（新規） |
| `sh-aoyagi/fire-keiba-lp` | 楽天競馬アフィリLPステージング | `C:\denno\lp_staging` | master |

公開URL：
- https://sh-aoyagi.github.io/dashboard.html
- https://sh-aoyagi.github.io/mercari.html
- https://sh-aoyagi.github.io/note.html
- https://sh-aoyagi.github.io/kassenjo.html

**今回の作業内容（2026-06-12実施済み）**：
1. `C:\denno` を新たに `git init` し、`.gitignore`（node_modules/.env/__pycache__/lp_staging除外）を作成
2. `sh-aoyagi.github.io` リポジトリに `denno-source` ブランチとして初回push（145ファイル）
3. `Desktop\電脳会社`：競馬記事整理（過去制作物フォルダへの移動）・宝塚記念新規記事3本をcommit&push（master）
4. `lp_staging`：新規画像4点をcommit&push（master）

---

## 7. Supabaseテーブル構成（project_id: dfnhkljlohlmuoidajla）

全35テーブル（public schema、RLS全無効 — §1参照）：

| テーブル名 | 行数 | 役割 |
|---|---|---|
| `tasks` | 14 | agent.jsが処理するタスクキュー（pending→running→done/failed） |
| `schedules` | 4 | 実行スケジュール管理（today_schedulesビューの元データ） |
| `actions` | 21 | 実行済みアクションの記録（action_type別） |
| `operation_logs` | 5 | 運用ログ全般 |
| `meeting_notes` | 20 | 会議メモ・デイリーインテリジェンスブリーフ（category=daily_intelligence_brief） |
| `claude_constraints` | 15 | **AIの制約・ノウハウ記録**（本ファイル§8に全文転記） |
| `style_rules` | 4 | 文体ルール |
| `marketing_guidelines` | 14 | マーケティングガイドライン |
| `weekly_kpi` | 3 | 週次KPI |
| **メルカリ系** | | |
| `mercari_items` | 68 | 出品商品管理（cost・last_relisted_at・relist_count等含む） |
| `mercari_watches` | 0 | ウォッチ数の時系列記録（SEO指標、要収集） |
| `mercari_tips` | 16 | メルカリ運用Tips・ノウハウ |
| `sold_logs` | 64 | 売却記録 |
| `price_change_logs` | 0 | 価格変更履歴 |
| `buyer_research` | 0 | バイヤー調査（4件調査→最大2件仕入れの実績記録、認知バイアス分析） |
| `cash_ledger` | 1 | CFO管理キャッシュ台帳（安全仕入額計算ロジック含む） |
| `gacha_records` | 1 | ガチャ関連記録 |
| **note/競馬系** | | |
| `note_articles` | 22 | note記事全件（title_length自動計算、40文字超は要修正） |
| `note_research_cache` | 10 | market_researchエージェントの調査キャッシュ（追記式） |
| `note_kpi_snapshots` | 16 | 記事ごとの週次KPI（like_rate自動計算） |
| `note_sales` | 0 | note記事販売記録（platform_fee=15%、net_revenue自動計算） |
| `note_pipeline_runs` | 2 | noteパイプラインの実行ログ |
| `note_ab_logs` | 0 | note ABテストログ |
| `market_snapshots` | 96 | 市場スナップショット |
| **決算城系** | | |
| `castle_articles` | 100 | 決算城記事管理（100社分・記事メモ完成済み） |
| `affiliate_links` | 1 | アフィリエイトリンク管理 |
| **SNS/X系** | | |
| `platform_posts` | 15 | SNS投稿管理（team・scheduled_at列） |
| `x_posts` | 19 | X投稿のPDCA管理 |
| `x_drafts` | 12 | X投稿下書き（毎週月曜自動生成、posted=trueで投稿済み） |
| **小説/自キュン系** | | |
| `novel_stories` | 8 | novel_teamのストーリー管理 |
| `novel_logs` | 4 | novel_teamの実行ログ |
| `novel_emotion_matrix` | 10 | 感情マトリクス |
| `novel_affiliate_items` | 0 | アフィリ商品 |
| **CEO分析系** | | |
| `ceo_quiz_logs` | 0 | CEO毎日10問クイズの回答履歴 |
| `ceo_insights` | 7 | CEOクイズの週次分析結果（CLAUDE.mdメモリに自動反映） |

新設ビュー：`today_schedules`（今日実行するスケジュール一覧）、`relist_candidates`（再出品候補：2日以上経過）

---

## 8. claude_constraints テーブル全文転記（2026-06-12時点・全14件）

新ツールがこのテーブルにアクセスしなくても判断できるよう、全件をここに転記する。

### category: claude_in_chrome（Claude in Chrome／ブラウザ操作の検証結果）
1. **商品の削除** → NG：永続的な削除は安全上の理由で実行不可。回避策：手動で削除してもらう。
2. **価格変更** → OK：商品編集ページから問題なく変更できる。
3. **再出品（削除→新規）** → NG：削除ステップができないため重複出品リスクあり。回避策：既存商品の編集で内容・価格を更新して再出品効果を出す。
4. **商品情報の読み取り** → OK：出品一覧・各商品ページのスクレイプ可能。
5. **下書き保存** → PARTIAL：削除なしの新規下書きは可能だが元商品が残る。回避策：編集モードで更新する方が安全。

### category: supabase_mcp
6. **SELECT（読み取り）** → OK：問題なく動作。
7. **UPDATE・INSERT** → OK：2026-05-15確認済み、書き込み可能。

### category: claude_in_chrome（追加検証）
8. **出品価格の自動入力** → NG：説明文中に複数の金額が含まれると誤った価格を入力することがある（定価・仕入れ値・送料と混同）。回避策：コマンド末尾に「★価格：XXXXX円（この金額だけを販売価格欄に入力）」と明示し、説明文中の金額には「※参考」と付記する。

### category: mercari_listing
9. **タイトル文字数** → NG：メルカリのタイトル上限40文字を毎回超過していた。今後は必ず40文字以内で作成する。回避策：生成後に必ず文字数をカウントし、超過時はブランド名・モデル名を優先して状態・コメントを削る。

### category: KPI_変更（2026-05-18 DAY3決定）
11. **コメント数トラッキング廃止** → OK：コメント数は集計・分析対象から除外（対応は継続）。回避策：ウォッチ数（mercari_watches）の時系列追跡をメインKPIに昇格。
12. **価格決定権の明確化** → OK：価格は青柳氏が市場調査の上で決定。AIは価格の妥当性に口出ししない。AIの役割はSEO・文章・分析のみ。

### category: 課題_高額商品
13. **高額系（¥15000以上）が動かない問題** → NG：DAY1〜3で¥15000超は1件も売れていない。低額品2件（デニムシャツ¥1199・AVIREX¥1800）は成約・回転良好。¥100,000目標には高額品成約が必須。仮説：①写真品質 ②タイトルSEO弱 ③ウォッチ数リーチ不十分。回避策：写真撮り直し（RPD・Jordan Bag・Denim Short）→タイトル改善→ウォッチ数推移で効果測定。

### category: SEO_戦略
14. **ウォッチ数をSEO指標として活用** → PARTIAL：ウォッチ数の時系列変化で①上位表示時間帯の把握 ②検索流入数推定 ③タイトル・価格変更のSEO効果測定が可能。mercari_watchesへの定期記録が前提。回避策：手動JSONで収集→集計時にmercari_watchesにINSERT。

### category: keiba_note_format（2026-06-05 CEO指示）
16. **競馬note記事の文章構成ルール確定** → OK：【無料パート】◎○△☆の印＋FIREスコアランキング（結果のみ）＋買い目を先出し。【有料パート（¥100）】各馬の評価根拠・解説を後出し。予想が無料で先、解説は有料で後。今後の競馬note記事全件に適用。参照：20260605_安田記念2026_枠順確定版.txt
17. **7〜10R予想記事の構成ルール確定** → OK：【7R〜9R：無料】◎○△☆＋買い目を先出し、その後にコースの見方を記載。【10R：有料¥300】無料部分に◎○△☆＋FIREスコアランキング（結果のみ）＋買い目を先出し、有料部分に評価根拠・解説。メインレースと同じ「予想先出し・解説後出し」を10Rにも適用。参照：20260604_7-10R予想.txt。回避策：出馬表確認（木曜16時〜）後に◎○△☆と買い目を追記するフロー。

（id=10, 15は欠番／削除済み）

---

## 9. 接続情報・自動化の詳細はCREDENTIALS.mdへ

C:\denno\CREDENTIALS.md に以下を記載：
- Supabase URL / anon key（2種類存在・要確認）
- GitHubリポジトリURL・PAT
- X(Twitter) API キー一式
- Gmail / Gemini / RemoveBG / Pexels 等のAPIキー保管場所
- Make.com / Buffer連携の現状（未設定）
