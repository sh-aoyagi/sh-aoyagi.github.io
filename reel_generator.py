#!/usr/bin/env python3
"""
reel_generator.py
Pexelsから競馬動画を取得し、テキストオーバーレイ付き縦型リール動画（9:16）を生成する。

使い方（インタラクティブ）:
  python reel_generator.py

使い方（引数）:
  python reel_generator.py --hook "競馬の予想\n根拠ありますか？" --cta "noteで公開中"
"""

import os
import sys
import datetime
import argparse
import requests
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

# ─────────────────────────────────────────────
# 設定
# ─────────────────────────────────────────────
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")
OUTPUT_DIR = Path(r"C:\denno\output\reels")
CACHE_DIR  = Path(r"C:\denno\output\reel_cache")

W, H = 1080, 1920  # 9:16

FONT_BOLD   = r"C:\Windows\Fonts\YuGothB.ttc"
FONT_NORMAL = r"C:\Windows\Fonts\NotoSansJP-VF.ttf"
FONT_BRAND  = r"C:\Windows\Fonts\YuGothB.ttc"

SLIDE_DURATION = {
    "hook":  4.0,
    "point": 3.0,
    "cta":   3.0,
}

BRAND_NAME = "競馬FIRE予想"
NOTE_URL   = "note.com/yagiwooo"


# ─────────────────────────────────────────────
# Pexels 動画取得
# ─────────────────────────────────────────────
def fetch_pexels_video(query: str) -> Path:
    if not PEXELS_API_KEY or "ここに" in PEXELS_API_KEY:
        raise ValueError(
            "PEXELS_API_KEYが.envに未設定です。\n"
            "https://www.pexels.com/api/ で無料取得 → .envに PEXELS_API_KEY=xxx を追加してください。"
        )

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / f"{query.replace(' ', '_')}.mp4"
    if cache_file.exists():
        print(f"  キャッシュ使用: {cache_file.name}")
        return cache_file

    print(f"  Pexels検索: {query}")
    headers = {"Authorization": PEXELS_API_KEY}
    r = requests.get(
        "https://api.pexels.com/videos/search",
        headers=headers,
        params={"query": query, "orientation": "portrait", "per_page": 10, "size": "medium"},
        timeout=15,
    )
    r.raise_for_status()
    videos = r.json().get("videos", [])
    if not videos:
        raise RuntimeError(f"'{query}' の動画がPexelsで見つかりませんでした")

    # ポートレート優先で動画ファイルを選択
    for video in videos:
        files = sorted(video["video_files"], key=lambda f: f.get("width", 0) * f.get("height", 0), reverse=True)
        portrait = [f for f in files if f.get("height", 0) > f.get("width", 0)]
        chosen = portrait[0] if portrait else files[0]

        print(f"  ダウンロード: {chosen['width']}x{chosen['height']}")
        r2 = requests.get(chosen["link"], stream=True, timeout=60)
        if r2.status_code == 200:
            with cache_file.open("wb") as f:
                for chunk in r2.iter_content(8192):
                    f.write(chunk)
            print(f"  保存: {cache_file.name}")
            return cache_file

    raise RuntimeError("動画のダウンロードに失敗しました")


# ─────────────────────────────────────────────
# テキストカードを PIL で生成（RGB）
# ─────────────────────────────────────────────
def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def draw_centered_text(draw: ImageDraw.Draw, text: str, font, y: int, color, shadow=True):
    """中央揃えでテキストを描画（影付き）"""
    lines = text.split("\n")
    line_h = font.size + 16
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        x = (W - tw) // 2
        ly = y + i * line_h
        if shadow:
            draw.text((x + 4, ly + 4), line, font=font, fill=(0, 0, 0, 220))
        draw.text((x, ly), line, font=font, fill=color)


def make_card(text: str, slide_type: str, bg_frame: np.ndarray) -> np.ndarray:
    """
    動画フレーム（numpy RGB）にテキストを合成したフレームを返す。
    """
    base = Image.fromarray(bg_frame).convert("RGBA").resize((W, H))

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    if slide_type == "hook":
        # 上下をグラデーション風に暗く
        draw.rectangle([(0, 0),    (W, H // 4)],  fill=(0, 0, 0, 140))
        draw.rectangle([(0, H // 2), (W, H)],      fill=(0, 0, 0, 200))
    elif slide_type == "cta":
        draw.rectangle([(0, 0), (W, H)], fill=(0, 0, 0, 210))
    else:  # point
        draw.rectangle([(0, H // 3), (W, H * 2 // 3)], fill=(0, 0, 0, 180))

    combined = Image.alpha_composite(base, overlay).convert("RGB")
    draw2 = ImageDraw.Draw(combined)

    if slide_type == "hook":
        font_main = load_font(FONT_BOLD, 100)
        draw_centered_text(draw2, text, font_main, H * 7 // 12, color=(255, 220, 50))

    elif slide_type == "cta":
        font_main = load_font(FONT_BOLD, 76)
        font_url  = load_font(FONT_NORMAL, 46)
        lines = text.split("\n")
        total_h = len(lines) * (76 + 16)
        start_y = H // 2 - total_h // 2 - 60
        draw_centered_text(draw2, text, font_main, start_y, color=(255, 255, 255))
        # URL
        draw_centered_text(draw2, f"→ {NOTE_URL}", font_url, start_y + total_h + 40, color=(255, 220, 50))

    else:  # point
        font_main = load_font(FONT_BOLD, 88)
        draw_centered_text(draw2, text, font_main, H // 2 - 60, color=(255, 255, 255))

    # ブランドロゴ（右下）
    font_brand = load_font(FONT_BRAND, 38)
    bbox = draw2.textbbox((0, 0), BRAND_NAME, font=font_brand)
    bw = bbox[2] - bbox[0]
    draw2.text((W - bw - 40, H - 80), BRAND_NAME, font=font_brand, fill=(255, 220, 50, 200))

    return np.array(combined)


# ─────────────────────────────────────────────
# 動画生成
# ─────────────────────────────────────────────
def crop_to_vertical(frame: np.ndarray) -> np.ndarray:
    """フレームを9:16にクロップ・リサイズ"""
    fh, fw = frame.shape[:2]
    target_ratio = W / H
    frame_ratio  = fw / fh

    if frame_ratio > target_ratio:
        new_w = int(fh * target_ratio)
        x1 = (fw - new_w) // 2
        frame = frame[:, x1:x1 + new_w]
    else:
        new_h = int(fw / target_ratio)
        y1 = (fh - new_h) // 2
        frame = frame[y1:y1 + new_h, :]

    img = Image.fromarray(frame).resize((W, H), Image.LANCZOS)
    return np.array(img)


def generate_reel(slides: list[dict], video_path: Path) -> Path:
    from moviepy import VideoFileClip

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = OUTPUT_DIR / f"reel_{ts}.mp4"

    total_duration = sum(SLIDE_DURATION[s["type"]] for s in slides)
    fps = 30

    print(f"\n[動画読み込み] {video_path.name}")
    clip = VideoFileClip(str(video_path))
    clip_duration = clip.duration

    # フレームを生成
    all_frames = []
    current_t = 0.0

    for slide in slides:
        duration = SLIDE_DURATION[slide["type"]]
        n_frames = int(duration * fps)

        for i in range(n_frames):
            t = current_t + i / fps
            t_loop = t % clip_duration
            raw_frame = clip.get_frame(t_loop)
            vert_frame = crop_to_vertical(raw_frame)
            card = make_card(slide["text"], slide["type"], vert_frame)
            all_frames.append(card)

        current_t += duration

    clip.close()

    # フレームをMP4に書き出し
    print(f"[書き出し] {output_path.name} ({total_duration:.0f}秒・{len(all_frames)}フレーム)...")
    import imageio
    writer = imageio.get_writer(
        str(output_path),
        fps=fps,
        codec="libx264",
        quality=8,
        macro_block_size=None,
    )
    for frame in all_frames:
        writer.append_data(frame)
    writer.close()

    print(f"[完了] {output_path}")
    return output_path


# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="競馬リール動画ジェネレーター")
    parser.add_argument("--hook",   default=None, help="フックテキスト（\\nで改行）")
    parser.add_argument("--points", nargs="*",   default=None, help="ポイント（スペース区切り）")
    parser.add_argument("--cta",    default=None, help="CTAテキスト（\\nで改行）")
    parser.add_argument("--query",  default="horse racing jockey", help="Pexels検索クエリ（英語）")
    args = parser.parse_args()

    if args.hook is None:
        print("\n=== 競馬リール動画ジェネレーター ===\n")
        hook  = input("① フック（大きく表示・\\nで改行）: ").replace("\\n", "\n").strip()
        p1    = input("② ポイント1: ").strip()
        p2    = input("③ ポイント2: ").strip()
        p3    = input("④ ポイント3: ").strip()
        cta   = input("⑤ CTA（\\nで改行）: ").replace("\\n", "\n").strip()
        query = input("Pexels検索ワード（空欄でhorse racing）: ").strip() or "horse racing jockey"
    else:
        hook   = args.hook.replace("\\n", "\n")
        points = args.points or ["血統を調べる", "追い切りを見る", "展開を読む"]
        p1, p2, p3 = (points + ["", "", ""])[:3]
        cta    = (args.cta or "FIREスコアで\n全部数値化した\nnoteで公開中").replace("\\n", "\n")
        query  = args.query

    slides = [
        {"type": "hook",  "text": hook},
        {"type": "point", "text": f"① {p1}"},
        {"type": "point", "text": f"② {p2}"},
        {"type": "point", "text": f"③ {p3}"},
        {"type": "cta",   "text": cta},
    ]

    print(f"\n[STEP 1] Pexelsから動画取得中...")
    video_path = fetch_pexels_video(query)

    print(f"[STEP 2] リール動画を生成中...")
    output = generate_reel(slides, video_path)

    print(f"\n完成: {output}")
    print(f"→ C:\\denno\\output\\reels\\ に保存されました")


if __name__ == "__main__":
    main()
