#!/usr/bin/env python3
"""
uma_note_pipeline.py
ウマ娘×競馬 note記事自動生成パイプライン

実行:
  $env:ANTHROPIC_API_KEY = "sk-ant-..."
  python uma_note_pipeline.py
"""

import os
import json
import datetime
import traceback
import sys
from pathlib import Path

import anthropic
from supabase import create_client, Client

# ─────────────────────────────────────────────
# 設定
# ─────────────────────────────────────────────
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL",
    "https://dfnhkljlohlmuoidajla.supabase.co",
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbmhrbGpsb2hsbXVvaWRhamxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjA3NzAsImV4cCI6MjA5MTI5Njc3MH0.o3Pt0FjKA0KOkNOCd22cqQfB91WjPb-1EASlZWW3VHE",
)

MODEL_PRIMARY  = "claude-opus-4-7"
MODEL_FALLBACK = "claude-sonnet-4-6"
MAX_TOKENS = 4096
ERROR_LOG = Path(r"C:\denno\output\error_log.txt")

TODAY = datetime.date.today()
IS_FIRST_WEEK = TODAY.day <= 7

# 今週末の土日を計算（月〜金なら次の土日、土なら当日+翌日、日なら昨日+当日）
_wd = TODAY.weekday()  # 0=月 … 5=土 6=日
if _wd == 6:           # 日曜
    SATURDAY = TODAY - datetime.timedelta(days=1)
elif _wd == 5:         # 土曜
    SATURDAY = TODAY
else:                  # 平日
    SATURDAY = TODAY + datetime.timedelta(days=(5 - _wd))
SUNDAY = SATURDAY + datetime.timedelta(days=1)

# ─────────────────────────────────────────────
# ウマ娘マップ
# ─────────────────────────────────────────────
UMA_MUSUME_MAP = {
    "ゴールドシップ": {
        "keywords": ["ゴールドシップ", "ステイゴールド"],
        "style": "末脚・大逆転・気性難・人気薄での激走",
    },
    "スペシャルウィーク": {
        "keywords": ["スペシャルウィーク", "サンデーサイレンス"],
        "style": "スタミナ・長距離・差し切り",
    },
    "テイエムオペラオー": {
        "keywords": ["テイエムオペラオー", "オペラハウス"],
        "style": "長距離・G1連勝・鉄砲巧者",
    },
    "エアグルーヴ": {
        "keywords": ["エアグルーヴ", "トニービン", "ダンシングブレーヴ"],
        "style": "牝馬の女王・安定した末脚",
    },
    "ウオッカ": {
        "keywords": ["ウオッカ", "タニノギムレット", "ロベルト系"],
        "style": "スピード・直線勝負・牝馬の意地",
    },
    "ダイワスカーレット": {
        "keywords": ["ダイワスカーレット", "アグネスタキオン"],
        "style": "先行・粘り・接戦に強い",
    },
    "メジロマックイーン": {
        "keywords": ["メジロマックイーン", "リアルシャダイ", "メジロ系"],
        "style": "長距離・菊花賞・天皇賞",
    },
    "トウカイテイオー": {
        "keywords": ["トウカイテイオー", "シンボリルドルフ"],
        "style": "復活劇・ドラマチック・奇跡の有馬",
    },
    "シンボリルドルフ": {
        "keywords": ["シンボリルドルフ", "パーソロン"],
        "style": "七冠・圧勝・知性派",
    },
    "タマモクロス": {
        "keywords": ["タマモクロス", "シービークロス"],
        "style": "逃げ・芦毛・叩き上げ",
    },
    "マルゼンスキー": {
        "keywords": ["マルゼンスキー", "Nijinsky"],
        "style": "無敗・圧倒的・スプリント〜マイル",
    },
    "ミスターシービー": {
        "keywords": ["ミスターシービー", "トウルビヨン系"],
        "style": "三冠・追い込み・豪快",
    },
}

GOROSHI_CRITERIA = [
    {"label": "荒れやすいコース（中山・阪神内回り・小倉）", "point": 2},
    {"label": "気性難・一発屋・穴馬が出走",                 "point": 2},
    {"label": "大逃げ馬がいて展開が壊れる可能性",           "point": 2},
    {"label": "人気馬が前走で5着以下の大敗",                 "point": 1},
    {"label": "ウマ娘モデル馬の血統を持つ馬が出走",         "point": 1},
    {"label": "最終直線が長い・差し有利馬場",               "point": 1},
    {"label": "荒天・重馬場の可能性",                       "point": 1},
]

CHAOTIC_VENUES = ["中山", "阪神", "小倉"]


# ─────────────────────────────────────────────
# ユーティリティ
# ─────────────────────────────────────────────
def log_error(msg: str) -> None:
    ERROR_LOG.parent.mkdir(parents=True, exist_ok=True)
    with ERROR_LOG.open("a", encoding="utf-8") as f:
        f.write(f"\n[{datetime.datetime.now()}]\n{msg}\n{'─'*40}\n")


def extract_text(response) -> str:
    return "\n".join(b.text for b in response.content if hasattr(b, "text"))


def clean_json(raw: str) -> str:
    """コードブロックを除去してJSONだけ返す"""
    s = raw.strip()
    if s.startswith("```"):
        lines = s.splitlines()
        s = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return s.strip()


# ─────────────────────────────────────────────
# Claude 呼び出し（web_search ループ対応）
# ─────────────────────────────────────────────
def call_claude(
    client: anthropic.Anthropic,
    model: str,
    messages: list,
    system: str | None = None,
    use_search: bool = False,
) -> str:
    """Claude API を呼び出してテキストを返す。web_search は tool_use ループで処理。"""
    kwargs: dict = {"model": model, "max_tokens": MAX_TOKENS, "messages": list(messages)}
    if system:
        kwargs["system"] = system
    if use_search:
        kwargs["tools"] = [{"type": "web_search_20250305", "name": "web_search"}]

    response = client.messages.create(**kwargs)

    for _ in range(8):
        if response.stop_reason != "tool_use":
            break

        # アシスタント応答を会話に追加
        kwargs["messages"].append({"role": "assistant", "content": response.content})

        # tool_result を構築（web_search は server-side なので result は既に content に含まれる場合がある）
        tool_results = []
        for block in response.content:
            btype = getattr(block, "type", None)
            if btype == "tool_use":
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": "検索完了",
                })

        if tool_results:
            kwargs["messages"].append({"role": "user", "content": tool_results})

        response = client.messages.create(**kwargs)

    return extract_text(response)


# ─────────────────────────────────────────────
# STEP 1: レース情報取得
# ─────────────────────────────────────────────
def fetch_race_info(client: anthropic.Anthropic, model: str) -> dict:
    print(f"  [STEP 1] レース情報取得（{SATURDAY}〜{SUNDAY}）...")

    query = (
        f"今日は{TODAY}です。今週末（{SATURDAY}土曜・{SUNDAY}日曜）の"
        "中央競馬・重賞レース（G1・G2・G3）を調べて、以下のJSON形式のみで出力してください。"
        "コードブロック・前置き・後置き一切不要。\n\n"
        '{"races":[{"race_name":"","race_date":"YYYY-MM-DD","venue":"","distance":"",'
        '"grade":"G1/G2/G3","horses":[{"name":"","father":"","mother_father":""}]}],'
        '"venue_notes":"メインレース競馬場の馬場・天候メモ"}'
    )
    messages = [{"role": "user", "content": query}]

    # パターンA: web_search 使用
    try:
        raw = call_claude(client, model, messages, use_search=True)
        data = json.loads(clean_json(raw))
        races = data.get("races", [])
        print(f"    → {len(races)}レース取得（web_search）")
        return data
    except Exception as e:
        print(f"    → web_search 失敗: {e} → knowledge で再試行...")

    # パターンB: web_search なし（知識ベース）
    try:
        raw = call_claude(client, model, messages, use_search=False)
        data = json.loads(clean_json(raw))
        races = data.get("races", [])
        print(f"    → {len(races)}レース取得（knowledge）")
        return data
    except Exception as e:
        # パターンC: fallback モデルで再試行
        print(f"    → {model} 失敗。フォールバックモデルで再試行...")
        raw = call_claude(client, MODEL_FALLBACK, messages, use_search=False)
        data = json.loads(clean_json(raw))
        races = data.get("races", [])
        print(f"    → {len(races)}レース取得（fallback model）")
        return data


# ─────────────────────────────────────────────
# STEP 2: ウマ娘×血統の接続
# ─────────────────────────────────────────────
def find_uma_connection(horses: list) -> tuple[str, str, str, bool]:
    """(character, reason, style, exact_match) を返す"""
    for horse in horses:
        father = horse.get("father", "")
        mf     = horse.get("mother_father", "")
        for char, data in UMA_MUSUME_MAP.items():
            for kw in data["keywords"]:
                if kw in father or kw in mf:
                    return (
                        char,
                        f"{horse['name']}の{'父' if kw in father else '母父'}に{kw}の血統",
                        data["style"],
                        True,
                    )
    return (
        "ゴールドシップ",
        "強豪馬が集うレースに、逆転劇の可能性が潜む血統的な共通点",
        UMA_MUSUME_MAP["ゴールドシップ"]["style"],
        False,
    )


# ─────────────────────────────────────────────
# STEP 3: ゴルシスコア
# ─────────────────────────────────────────────
def calc_goroshi_score(race: dict, exact_uma_match: bool) -> tuple[int, list[str]]:
    score, reasons = 0, []

    venue = race.get("venue", "")
    notes = race.get("venue_notes", "")

    if any(v in venue for v in CHAOTIC_VENUES):
        score += 2
        reasons.append(f"荒れやすいコース（{venue}）")

    if any(w in notes for w in ["重馬場", "不良", "雨", "稍重"]):
        score += 1
        reasons.append("荒天・重馬場の可能性")

    if exact_uma_match:
        score += 1
        reasons.append("ウマ娘モデル馬の血統を持つ馬が出走")

    return score, reasons


# ─────────────────────────────────────────────
# STEP 4: 記事生成
# ─────────────────────────────────────────────
BRANCH_SYSTEM = """\
あなたは競馬とウマ娘の両方に詳しい予想コンテンツライターです。
以下の情報をもとにnote記事を書いてください。
出力は必ずJSONのみ。マークダウンのコードブロックも不要。前置き・後置き一切不要。

{context}

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

出力JSON形式（キーの順序・型を守ること）：
{{"title":"","free_content":"","paid_content":"","sales_description":"","tags":[],"cover_image_prompt":"","evaluator_score":0,"legal_check_passed":true}}
"""

TRUNK_SYSTEM = """\
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

出力JSON形式（キーの順序・型を守ること）：
{{"title":"","free_content":"","paid_content":"","sales_description":"","tags":[],"cover_image_prompt":"","evaluator_score":0,"legal_check_passed":true}}
"""


def _build_context(race: dict, uma_char: str, connection: str, style: str, score: int, reasons: list[str]) -> str:
    horse_lines = "\n".join(
        f"  ・{h['name']}（父:{h.get('father','不明')} / 母父:{h.get('mother_father','不明')}）"
        for h in race.get("horses", [])
    ) or "  （出走馬情報なし）"

    reasons_text = "\n".join(f"  ・{r}" for r in reasons) or "  （該当なし）"

    return (
        f"【今週のレース】\n"
        f"レース名: {race['race_name']}\n"
        f"開催日・場所: {race['race_date']} {race['venue']} {race['distance']}\n"
        f"出走馬と血統:\n{horse_lines}\n\n"
        f"【ウマ娘との接続】\n"
        f"キャラ名: {uma_char}\n"
        f"接続根拠: {connection}\n"
        f"レーススタイル: {style}\n\n"
        f"【ゴルシスコア】\n"
        f"{score}点 / 10点\n"
        f"採点理由:\n{reasons_text}"
    )


def _enforce_title(title: str, flag_only: bool = False) -> str:
    if len(title) <= 40:
        return title
    truncated = title[:37] + "…"
    return truncated if len(truncated) <= 40 else title[:40]


def generate_article(
    client: anthropic.Anthropic,
    model: str,
    article_type: str,  # "branch" | "trunk"
    race: dict,
    uma_char: str,
    connection: str,
    style: str,
    score: int,
    reasons: list[str],
) -> dict:
    context = _build_context(race, uma_char, connection, style, score, reasons)

    if article_type == "branch":
        system = BRANCH_SYSTEM.format(context=context, race_name=race["race_name"])
    else:
        system = TRUNK_SYSTEM

    messages = [{"role": "user", "content": "記事を生成してください。"}]

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            raw = call_claude(client, model, messages, system=system)
            data = json.loads(clean_json(raw))

            title = data.get("title", "（タイトルなし）")
            if len(title) > 40:
                print(f"    → タイトル{len(title)}文字超 → 再生成({attempt+1}/2)...")
                if attempt < 2:
                    messages = list(messages) + [
                        {"role": "assistant", "content": raw},
                        {"role": "user", "content": (
                            f"タイトルが{len(title)}文字で40文字を超えています。"
                            "タイトルのみ40文字以内に短縮したJSONを出力してください。"
                        )},
                    ]
                    continue
                else:
                    data["title"] = _enforce_title(title)
                    data["title_needs_fix"] = True

            return data

        except (json.JSONDecodeError, KeyError) as e:
            last_error = e
            if attempt == 2:
                raise RuntimeError(f"JSON解析失敗（{attempt+1}回目）: {e}")

    raise RuntimeError(f"記事生成失敗: {last_error}")


# ─────────────────────────────────────────────
# STEP 5: Supabase 書き込み
# ─────────────────────────────────────────────
def insert_article(sb: Client, pipeline_run_id: int, article: dict, price: int) -> int:
    title = article.get("title", "（タイトルなし）")
    if len(title) > 40:
        title = title[:40]

    record = {
        "pipeline_run_id": pipeline_run_id,
        "category": "競馬",
        "title": title,
        "status": "draft",
        "free_content": article.get("free_content", ""),
        "paid_content": article.get("paid_content", ""),
        "price": price,
        "subscription_monthly_price": 1500,
        "sales_description": article.get("sales_description", ""),
        "tags": article.get("tags", []),
        "cover_image_prompt": article.get("cover_image_prompt", ""),
        "evaluator_score": int(article.get("evaluator_score", 0)),
        "founder_approved": False,
        "legal_check_passed": bool(article.get("legal_check_passed", True)),
    }

    result = sb.table("note_articles").insert(record).execute()
    return result.data[0].get("article_no", 0)


# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────
def main() -> None:
    print(f"\n{'='*52}")
    print(f"  ウマ娘×競馬 note記事パイプライン")
    print(f"  実行日  : {TODAY}")
    print(f"  今週末  : {SATURDAY}（土）〜 {SUNDAY}（日）")
    print(f"  月初第1週: {'YES → 幹記事も生成' if IS_FIRST_WEEK else 'NO → 枝記事のみ'}")
    print(f"{'='*52}\n")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY が設定されていません。")
        print("  ターミナルで実行してください:")
        print('  $env:ANTHROPIC_API_KEY = "sk-ant-..."')
        sys.exit(1)

    claude = anthropic.Anthropic()
    sb     = create_client(SUPABASE_URL, SUPABASE_KEY)
    model  = MODEL_PRIMARY
    print(f"モデル: {model}\n")

    # ── STEP 5①: pipeline_run 開始 ──────────────
    print("[DB] pipeline_run を開始...")
    run_res = sb.table("note_pipeline_runs").insert({
        "status": "running",
        "articles_generated": 0,
        "articles_approved": 0,
    }).execute()
    pipeline_run_id: int = run_res.data[0]["id"]
    print(f"  → pipeline_run_id: {pipeline_run_id}\n")

    articles_generated = 0
    branch_count = 0
    trunk_count  = 0
    best_score   = 0
    best_race    = ""

    try:
        # ── STEP 1: レース情報 ───────────────────
        race_data = fetch_race_info(claude, model)
        races = race_data.get("races", [])
        if not races:
            raise RuntimeError("重賞レースが見つかりませんでした（races が空）")

        # G1 > G2 > G3 の順で最初の1レースを対象
        grade_order = {"G1": 0, "G2": 1, "G3": 2}
        target = sorted(races, key=lambda r: grade_order.get(r.get("grade", "G3"), 9))[0]
        print(f"  対象: {target['race_name']} ({target.get('grade','?')}) @ {target.get('venue','?')}\n")

        # ── STEP 2: ウマ娘接続 ───────────────────
        print("[STEP 2] ウマ娘×血統の接続...")
        uma_char, connection, style, exact_match = find_uma_connection(target.get("horses", []))
        print(f"  → {uma_char}（{connection}）\n")

        # ── STEP 3: ゴルシスコア ─────────────────
        print("[STEP 3] ゴルシスコア計算...")
        score, reasons = calc_goroshi_score(target, exact_match)
        print(f"  → {score}点 / 閾値5点 / 理由: {reasons}\n")

        # ── STEP 4①: 枝記事（¥100）───────────────
        if score >= 5:
            print("[STEP 4①] 枝記事を生成中（¥100）...")
            branch = generate_article(claude, model, "branch", target, uma_char, connection, style, score, reasons)
            t = branch.get("title", "")
            print(f"  → タイトル: 「{t}」（{len(t)}文字）")
            print(f"  → evaluator_score: {branch.get('evaluator_score', 0)}/20")

            no = insert_article(sb, pipeline_run_id, branch, 100)
            articles_generated += 1
            branch_count += 1
            best_score = branch.get("evaluator_score", 0)
            best_race  = target["race_name"]
            print(f"  → note_articles に保存（article_no: {no}）\n")
        else:
            print(f"  スコア{score}点（閾値5未満）→ 枝記事スキップ\n")

        # ── STEP 4②: 幹記事（¥980・月初第1週のみ）──
        if IS_FIRST_WEEK:
            print("[STEP 4②] 幹記事を生成中（¥980）...")
            trunk = generate_article(claude, model, "trunk", target, uma_char, connection, style, score, reasons)
            t = trunk.get("title", "")
            print(f"  → タイトル: 「{t}」（{len(t)}文字）")
            print(f"  → evaluator_score: {trunk.get('evaluator_score', 0)}/20")

            no = insert_article(sb, pipeline_run_id, trunk, 980)
            articles_generated += 1
            trunk_count += 1
            s = trunk.get("evaluator_score", 0)
            if s > best_score:
                best_score = s
                best_race  = target["race_name"]
            print(f"  → note_articles に保存（article_no: {no}）\n")

        # ── STEP 5③: pipeline_run 完了 ───────────
        sb.table("note_pipeline_runs").update({
            "status": "completed",
            "articles_generated": articles_generated,
        }).eq("id", pipeline_run_id).execute()

        # ── STEP 5④: tasks に完了報告 ─────────────
        sb.table("tasks").insert({
            "task_type": "note_pipeline",
            "instruction": "ウマ娘×競馬 note記事自動生成",
            "status": "done",
            "result": (
                f"枝記事{branch_count}本・幹記事{trunk_count}本生成。"
                f"最高スコア={best_score}点（{best_race}）"
            ),
            "created_by": "claude_code",
        }).execute()

        print(f"{'='*52}")
        print(f"  パイプライン完了！")
        print(f"  生成本数: {articles_generated}本")
        print()
        print(f"  次のステップ（真平さんのタスク・週15分）:")
        print(f"  1. Supabase > note_articles を開く")
        print(f"  2. status='draft' の記事を読む")
        print(f"  3. 良ければ founder_approved = true に変更")
        print(f"  4. noteに手動投稿")
        print(f"{'='*52}\n")

    except Exception:
        tb = traceback.format_exc()
        log_error(tb)

        try:
            sb.table("note_pipeline_runs").update({
                "status": "failed",
                "error_log": tb[-2000:],
            }).eq("id", pipeline_run_id).execute()
        except Exception:
            pass

        print(f"\n{'='*52}")
        print(f"  ERROR: パイプラインが失敗しました")
        print(f"  ログ: {ERROR_LOG}")
        print(f"{'='*52}\n")
        print(tb)
        sys.exit(1)


if __name__ == "__main__":
    main()
