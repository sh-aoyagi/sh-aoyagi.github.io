#!/usr/bin/env python3
"""
x_poster.py
Supabaseのplatform_postsからpending投稿を取得してXに自動投稿するスクリプト。
Windowsタスクスケジューラで毎朝8時に実行する。
"""

import os
import sys
import datetime
import traceback
import smtplib
from email.mime.text import MIMEText
from pathlib import Path
from dotenv import load_dotenv
import tweepy
from supabase import create_client

# Windows のコンソールを UTF-8 に統一
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# .env を読み込む（スクリプトと同じフォルダにある .env）
load_dotenv(Path(__file__).parent / ".env")

# ─────────────────────────────────────────────
# 設定
# ─────────────────────────────────────────────
SUPABASE_URL      = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY      = os.environ.get("SUPABASE_KEY", "")
CONSUMER_KEY      = os.environ.get("CONSUMER_KEY", "")
CONSUMER_SECRET   = os.environ.get("CONSUMER_SECRET", "")
ACCESS_TOKEN      = os.environ.get("ACCESS_TOKEN", "")
ACCESS_TOKEN_SECRET = os.environ.get("ACCESS_TOKEN_SECRET", "")
GMAIL_ADDRESS       = os.environ.get("GMAIL_ADDRESS", "")
GMAIL_APP_PASSWORD  = os.environ.get("GMAIL_APP_PASSWORD", "")

NOTIFY_TO = "shim20180305@gmail.com"
X_CHAR_LIMIT = 280
LOG_PATH = Path(__file__).parent / "output" / "x_poster_log.txt"


# ─────────────────────────────────────────────
# ログ
# ─────────────────────────────────────────────
def log(msg: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with LOG_PATH.open("a", encoding="utf-8", errors="replace") as f:
        f.write(line + "\n")


# ─────────────────────────────────────────────
# ツイートテキスト組み立て
# ─────────────────────────────────────────────
def build_tweet(body: str, hashtags: list[str]) -> str:
    """本文＋ハッシュタグを結合。280文字超の場合は本文を削る。"""
    tags = " ".join(hashtags) if hashtags else ""
    full = f"{body}\n\n{tags}" if tags else body

    if len(full) <= X_CHAR_LIMIT:
        return full

    # 超過した場合：本文を切り詰める
    if tags:
        # "\n\n" (2) + "…" (1) + タグ
        available = X_CHAR_LIMIT - len(tags) - 3
        return f"{body[:available]}…\n\n{tags}"
    else:
        return body[: X_CHAR_LIMIT - 1] + "…"


# ─────────────────────────────────────────────
# メール通知
# ─────────────────────────────────────────────
def send_notify(posted_items: list[dict]) -> None:
    """投稿成功した内容をGmailで通知する。設定がなければスキップ。"""
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        log("  メール設定なし（GMAIL_ADDRESS/GMAIL_APP_PASSWORD未設定）→ スキップ")
        return

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [f"【競馬FIRE】X自動投稿が完了しました（{now_str}）\n"]
    for i, item in enumerate(posted_items, 1):
        lines.append(f"─── 投稿 {i} ───")
        lines.append(f"投稿時刻: {item['posted_at']}")
        lines.append(f"tweet_id: {item['tweet_id']}")
        lines.append(f"本文:\n{item['text']}")
        lines.append("")

    body = "\n".join(lines)
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = "【競馬FIRE】X投稿完了"
    msg["From"]    = GMAIL_ADDRESS
    msg["To"]      = NOTIFY_TO

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            smtp.send_message(msg)
        log(f"  メール送信完了 → {NOTIFY_TO}")
    except Exception as e:
        log(f"  メール送信失敗（投稿自体は成功）: {e}")


# ─────────────────────────────────────────────
# 環境変数チェック
# ─────────────────────────────────────────────
def check_env() -> bool:
    required = {
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_KEY": SUPABASE_KEY,
        "CONSUMER_KEY": CONSUMER_KEY,
        "CONSUMER_SECRET": CONSUMER_SECRET,
        "ACCESS_TOKEN": ACCESS_TOKEN,
        "ACCESS_TOKEN_SECRET": ACCESS_TOKEN_SECRET,
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        log(f"ERROR: .envに未設定のキーがあります: {', '.join(missing)}")
        return False
    return True


# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────
def main() -> None:
    log("=" * 50)
    log("X自動投稿スクリプト 開始")

    if not check_env():
        return

    # クライアント初期化
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    x = tweepy.Client(
        consumer_key=CONSUMER_KEY,
        consumer_secret=CONSUMER_SECRET,
        access_token=ACCESS_TOKEN,
        access_token_secret=ACCESS_TOKEN_SECRET,
    )

    # pending かつ scheduled_for が現在以前の投稿を取得
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result = (
        sb.table("platform_posts")
        .select("*")
        .eq("platform", "x")
        .eq("status", "pending")
        .lte("scheduled_for", now_iso)
        .order("scheduled_for")
        .execute()
    )
    posts = result.data
    log(f"投稿対象: {len(posts)}件")

    if not posts:
        log("投稿対象なし。終了。")
        log("=" * 50)
        return

    success_count = 0
    failed_count  = 0
    success_items: list[dict] = []  # メール通知用

    for post in posts:
        post_id  = post["id"]
        body     = post.get("body", "")
        hashtags = post.get("hashtags") or []
        label    = f"post_no={post.get('post_no')} week_of={post.get('week_of')}"

        # 処理中フラグ（二重投稿防止）
        sb.table("platform_posts").update({"status": "posting"}).eq("id", post_id).execute()

        try:
            tweet_text = build_tweet(body, hashtags)
            log(f"投稿中 [{label}]: {tweet_text[:60].replace(chr(10),' ')}...")

            response = x.create_tweet(text=tweet_text)
            tweet_id = str(response.data["id"])

            sb.table("platform_posts").update({
                "status":           "posted",
                "posted_at":        datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "platform_post_id": tweet_id,
                "error_log":        None,
            }).eq("id", post_id).execute()

            posted_at_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            log(f"  → 成功 tweet_id={tweet_id}")
            success_count += 1
            success_items.append({
                "text":      tweet_text,
                "tweet_id":  tweet_id,
                "posted_at": posted_at_str,
            })

        except tweepy.TweepyException as e:
            # X API エラー（レートリミット・認証失敗など）
            error_msg = str(e)
            sb.table("platform_posts").update({
                "status":    "failed",
                "error_log": error_msg[:1000],
            }).eq("id", post_id).execute()
            log(f"  → X APIエラー: {error_msg[:200]}")
            failed_count += 1

        except Exception:
            error_msg = traceback.format_exc()
            sb.table("platform_posts").update({
                "status":    "failed",
                "error_log": error_msg[-1000:],
            }).eq("id", post_id).execute()
            log(f"  → 予期しないエラー: {error_msg.splitlines()[-1]}")
            failed_count += 1

    log(f"完了: 成功{success_count}件 / 失敗{failed_count}件")

    if success_items:
        send_notify(success_items)

    log("=" * 50)


if __name__ == "__main__":
    main()
