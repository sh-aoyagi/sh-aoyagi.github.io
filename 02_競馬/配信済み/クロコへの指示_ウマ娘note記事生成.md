# ウマ娘×競馬 note記事自動生成 実装指示

## ⚠️ 最初にやること（承認なしに実装を始めるな）

以下3点を箇条書きで出して、真平さんの「OK」を待つこと。

1. 実装方針（最大3パターン）とリスク
2. 失敗した場合の次の手
3. 利用規約リスク（JRAデータ著作権・ウマ娘知的財産・競馬予想の広告規制）

---

## このスクリプトがやること

`python uma_note_pipeline.py` の1コマンドで以下を全自動実行する。

```
① Webで今週末のG1・重賞レースを調べる
② 出走馬の血統からウマ娘キャラとの接続を見つける
③ ゴルシスコアで「今週再現する馬」を特定
④ 2種類の記事をAnthropicAPIで生成
   ├─ 枝記事（¥100）：ウマ娘×レース展開予想
   └─ 幹記事（¥980）：なぜこの予想をするのかの考え方（月初第1週のみ）
⑤ Supabaseのnote_articlesにINSERT（status='draft'）
⑥ note_pipeline_runsに実行ログをINSERT
⑦ tasksに結果を書き戻す
```

---

## ファイル構成

```
C:\denno\
  └── uma_note_pipeline.py   ← これだけ作ればいい
```

---

## Supabase接続

```
project_id = "dfnhkljlohlmuoidajla"
環境変数 SUPABASE_URL / SUPABASE_KEY を使うこと
```

---

## STEP 1：今週末のレースをWebで調べる

以下のキーワードでWeb検索して今週末（直近土日）のG1・重賞レースを取得する。

```
検索クエリ例: "今週末 中央競馬 重賞 {今日の日付}"
```

取得する情報：
- レース名・開催日・競馬場・距離・馬場
- 出走予定馬リスト（馬名・父・母父）

---

## STEP 2：ウマ娘×血統の接続を見つける

以下のウマ娘マップで、出走馬の血統（父・母父・母母父）に接続できるキャラを照合する。

```python
UMA_MUSUME_MAP = {
    "ゴールドシップ":    {"keywords": ["ゴールドシップ", "ステイゴールド"],
                          "style": "末脚・大逆転・気性難・人気薄での激走"},
    "スペシャルウィーク": {"keywords": ["スペシャルウィーク", "サンデーサイレンス"],
                          "style": "スタミナ・長距離・差し切り"},
    "テイエムオペラオー": {"keywords": ["テイエムオペラオー", "オペラハウス"],
                          "style": "長距離・G1連勝・鉄砲巧者"},
    "エアグルーヴ":      {"keywords": ["エアグルーヴ", "トニービン", "ダンシングブレーヴ"],
                          "style": "牝馬の女王・安定した末脚"},
    "ウオッカ":          {"keywords": ["ウオッカ", "タニノギムレット", "ロベルト系"],
                          "style": "スピード・直線勝負・牝馬の意地"},
    "ダイワスカーレット": {"keywords": ["ダイワスカーレット", "アグネスタキオン"],
                          "style": "先行・粘り・接戦に強い"},
    "メジロマックイーン": {"keywords": ["メジロマックイーン", "リアルシャダイ", "メジロ系"],
                          "style": "長距離・菊花賞・天皇賞"},
    "トウカイテイオー":  {"keywords": ["トウカイテイオー", "シンボリルドルフ"],
                          "style": "復活劇・ドラマチック・奇跡の有馬"},
    "シンボリルドルフ":  {"keywords": ["シンボリルドルフ", "パーソロン"],
                          "style": "七冠・圧勝・知性派"},
    "タマモクロス":      {"keywords": ["タマモクロス", "シービークロス"],
                          "style": "逃げ・芦毛・叩き上げ"},
    "マルゼンスキー":    {"keywords": ["マルゼンスキー", "Nijinsky"],
                          "style": "無敗・圧倒的・スプリント〜マイル"},
    "ミスターシービー":  {"keywords": ["ミスターシービー", "トウルビヨン系"],
                          "style": "三冠・追い込み・豪快"},
}
# 接続なし → "血統的な共通点"として抽象的に接続（必ず何かしら書ける）
```

---

## STEP 3：ゴルシスコアで「再現馬」を特定

```python
GOROSHI_CRITERIA = [
    {"label": "荒れやすいコース（中山・阪神内回り・小倉）",   "point": 2},
    {"label": "気性難・一発屋・穴馬が出走",                   "point": 2},
    {"label": "大逃げ馬がいて展開が壊れる可能性",             "point": 2},
    {"label": "人気馬が前走で5着以下の大敗",                   "point": 1},
    {"label": "ウマ娘モデル馬の血統を持つ馬が出走",           "point": 1},
    {"label": "最終直線が長い・差し有利馬場",                 "point": 1},
    {"label": "荒天・重馬場の可能性",                         "point": 1},
]
# スコア 5以上 → 枝記事を生成（¥100）
# スコア 4以下 → 生成しない（SNS投稿のみ）
```

---

## STEP 4：Anthropic APIで記事を生成する

```python
import anthropic
client = anthropic.Anthropic()  # ANTHROPIC_API_KEY は環境変数から
MODEL = "claude-opus-4-5"       # なければ claude-sonnet-4-5 を使う
MAX_TOKENS = 4096
```

---

### 枝記事プロンプト（¥100・毎週）

以下をシステムプロンプトとして使うこと。変数は実行時に埋め込む。

```
あなたは競馬とウマ娘の両方に詳しい予想コンテンツライターです。
以下の情報をもとにnote記事を書いてください。
出力は必ずJSONのみ。マークダウンのコードブロックも不要。前置き・後置き一切不要。

【今週のレース】
レース名: {race_name}
開催日・場所: {race_date} {venue} {distance}
出走馬と血統: {horse_list}

【ウマ娘との接続】
キャラ名: {uma_character}
接続根拠: {connection_reason}
レーススタイル: {style}

【ゴルシスコア】
{goroshi_score}点 / 10点
採点理由: {goroshi_reasons}

---

記事の構成ルール：

■ free_content（無料・800字程度）
1. 今週の{race_name}とウマ娘の接続（400字）
   - ウマ娘ファンが「おもしろい」と思える入口を作る
   - 競馬を知らない人にも伝わる言葉で
2. 今週の注目馬3頭（各100字・根拠はさわりだけ）
3. 「詳しい根拠と、今週ゴルシ的展開を再現しそうな馬は↓」で締める

■ paid_content（有料・800字程度）
1. 「今週ゴルシ的展開を再現するのはこの馬だ！」（馬名を明記・理由を全開示）
2. 展開予想（スタート〜直線〜ゴールの流れ）
3. 締め「伝説になるか、一緒に見届けよう」トーン

制約：
- 「絶対」「必勝」「確実に当たる」などの断定表現は禁止
- タイトルは40文字以内（レース名とウマ娘キャラを含める）
- evaluator_scoreは0〜20で自己採点

出力JSON形式：
{
  "title": "",
  "free_content": "",
  "paid_content": "",
  "sales_description": "",
  "tags": [],
  "cover_image_prompt": "",
  "evaluator_score": 0,
  "legal_check_passed": true
}
```

---

### 幹記事プロンプト（¥980・月初第1週のみ）

```
あなたは競馬とウマ娘の両方に詳しい予想コンテンツライターです。
「なぜこの予想をするのか」という考え方を解説するメイン記事を書いてください。
出力は必ずJSONのみ。マークダウンのコードブロックも不要。前置き・後置き一切不要。

【コンセプト】
ゴールドシップ（ウマ娘のゴルシ）をモデルに、
「伝説的な逆転劇が起きやすいレースの条件」を体系化したスコアリングシステムの解説記事。

【想定読者】
- ウマ娘が好きで競馬にも興味が出てきた人
- 毎週の枝記事（¥100）を買う前に「信頼できるか」を確かめたい人

---

記事の構成ルール：

■ free_content（無料・1000字程度）
1. ゴールドシップという馬の話（500字）
   - ゲームのゴルシと実馬の共通点
   - 競馬を知らない人でも読めるように
2. 「ゴルシ的展開」とは何か（300字）
3. 「採点ロジックの全容は有料で」で締める

■ paid_content（有料・2000字程度）
1. ゴルシスコアリングシステム全公開（7つの基準を一つひとつ解説）
2. データの調べ方（netkeibaで何を見るか・スマホだけでできる手順）
3. 過去の検証事例（実際のレース3つ・当たった/外れた両方を正直に）
4. 枝記事の使い方と今後の予定

制約：
- 「絶対」「必勝」「確実に当たる」などの断定表現は禁止
- タイトルは40文字以内（「ゴルシ」「予想」「根拠」のどれかを含める）
- evaluator_scoreは0〜20で自己採点

出力JSON形式：
{
  "title": "",
  "free_content": "",
  "paid_content": "",
  "sales_description": "",
  "tags": [],
  "cover_image_prompt": "",
  "evaluator_score": 0,
  "legal_check_passed": true
}
```

---

## STEP 5：Supabaseに書き込む

### ① 実行開始時：note_pipeline_runsにINSERT

```sql
INSERT INTO note_pipeline_runs (status, articles_generated, articles_approved)
VALUES ('running', 0, 0)
RETURNING id;
-- 返ってきたidをpipeline_run_idとして以降のINSERTに使う
```

### ② 記事ごと：note_articlesにINSERT

```python
# タイトル文字数を必ずチェック（超えていたらAPIに再生成させる・最大2回）
assert len(title) <= 40

record = {
    "pipeline_run_id": pipeline_run_id,
    "category": "競馬",
    "title": title,
    "status": "draft",
    "free_content": free_content,
    "paid_content": paid_content,
    "price": 100,           # 幹記事は980
    "subscription_monthly_price": 1500,
    "sales_description": sales_description,
    "tags": tags,
    "cover_image_prompt": cover_image_prompt,
    "evaluator_score": evaluator_score,
    "founder_approved": False,
    "legal_check_passed": legal_check_passed,
}
```

### ③ 完了時：note_pipeline_runsを更新

```sql
UPDATE note_pipeline_runs
SET status = 'completed',
    completed_at = now(),
    articles_generated = {生成本数}
WHERE id = {pipeline_run_id};
```

### ④ tasksにINSERT（完了報告）

```sql
INSERT INTO tasks (task_type, instruction, status, result, created_by)
VALUES (
  'note_pipeline',
  'ウマ娘×競馬 note記事自動生成',
  'done',
  '枝記事{N}本・幹記事{M}本生成。最高スコア={X}点（{race_name}）',
  'claude_code'
);
```

---

## 失敗時のルール（必ず守ること）

1. 1パターン失敗 → 原因を変えて次のパターンへ
2. 3パターン全滅 → 止まって真平さんにエスカレーション（原因と選択肢を提示）
3. Supabase書き込み失敗 → `C:\denno\output\error_log.txt` にフォールバック
4. タイトル40文字超 → APIに再生成（最大2回）、それでもダメなら `[要修正]` フラグ付きでINSERT

---

## 実行コマンド（これだけで全部動く）

```bash
cd C:\denno
python uma_note_pipeline.py
```

---

## 最後に確認すること

実装前に以下を箇条書きで出すこと。出したら止まって「OK」を待つ。

**① 実装方針（3パターン）**
**② 各パターンのリスクと代替案**
**③ 利用規約リスク（JRA・ウマ娘著作権・景品表示法・競馬予想広告規制）**
