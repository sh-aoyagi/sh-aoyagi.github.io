import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';
import convert from 'heic-convert';
import sharp from 'sharp';

// ─── 初期設定 ───────────────────────────────────────────────
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_KEY;
const REMOVEBG_KEY   = process.env.REMOVEBG_API_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const INBOX_DIR  = 'C:\\denno\\images\\inbox';
const OUTPUT_DIR = 'C:\\denno\\images\\output';

// ─── ユーティリティ ──────────────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── HEIC → JPEG 変換 ──────────────────────────────────────
async function toJpegBuffer(filePath) {
  if (/\.(heic|heif)$/i.test(filePath)) {
    const heicBuf = fs.readFileSync(filePath);
    return Buffer.from(await convert({ buffer: heicBuf, format: 'JPEG', quality: 0.95 }));
  }
  return fs.readFileSync(filePath);
}

// ─── remove.bg で背景除去 ────────────────────────────────────
async function removeBackground(jpegBuffer) {
  if (!REMOVEBG_KEY) throw new Error('REMOVEBG_API_KEY が未設定です');

  const formData = new FormData();
  formData.append('image_file', new Blob([jpegBuffer], { type: 'image/jpeg' }), 'image.jpg');
  formData.append('size', 'auto');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': REMOVEBG_KEY },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`remove.bg エラー (${res.status}): ${text}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// ─── 白背景合成 → 正方形 → 品質仕上げ ─────────────────────
async function composeOnWhite(pngBuffer) {
  const meta = await sharp(pngBuffer).metadata();
  const size = Math.max(meta.width, meta.height);
  const padding = Math.round(size * 0.06);
  const total = size + padding * 2;

  return await sharp({
    create: {
      width: total,
      height: total,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: pngBuffer, gravity: 'center' }])
    .modulate({ brightness: 1.05 })
    .sharpen()
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ─── 1枚のクリーニング処理 ─────────────────────────────────
async function cleanImage(filePath) {
  process.stdout.write('  変換中...');
  const jpegBuf = await toJpegBuffer(filePath);

  process.stdout.write(' 背景除去中...');
  // レート制限対策：リトライ付きで呼び出す
  let transparentPng;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      transparentPng = await removeBackground(jpegBuf);
      break;
    } catch (err) {
      if (attempt < 3 && err.message.includes('429')) {
        process.stdout.write(` (待機中${attempt})...`);
        await new Promise(r => setTimeout(r, 5000 * attempt));
      } else {
        throw err;
      }
    }
  }

  process.stdout.write(' 仕上げ中...\n');
  return await composeOnWhite(transparentPng);
}

// ─── メイン処理 ─────────────────────────────────────────────
async function run() {
  if (!REMOVEBG_KEY) {
    console.log('\n❌ REMOVEBG_API_KEY が .env に設定されていません');
    console.log('   https://www.remove.bg/dashboard#api-key で無料取得してください\n');
    process.exit(1);
  }

  ensureDir(OUTPUT_DIR);

  const nameArg = process.argv.find(a => a.startsWith('--name='))?.slice(7);

  const files = fs.readdirSync(INBOX_DIR)
    .filter(f => /\.(jpg|jpeg|png|heic|heif)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log(`\n📭 inbox に画像がありません: ${INBOX_DIR}\n`);
    return;
  }

  console.log(`\n📦 ${files.length} 枚をクリーニングします`);

  const itemName = nameArg ?? await prompt('出力フォルダ名（商品名）を入力: ');
  const itemOutputDir = path.join(OUTPUT_DIR, itemName);
  ensureDir(itemOutputDir);
  console.log('');

  let ok = 0, ng = 0;
  for (let i = 0; i < files.length; i++) {
    const filePath = path.join(INBOX_DIR, files[i]);
    const seq = String(i + 1).padStart(2, '0');
    const outputPath = path.join(itemOutputDir, `${seq}.jpg`);

    console.log(`🔄 [${seq}/${String(files.length).padStart(2, '0')}] ${files[i]}`);
    try {
      const cleaned = await cleanImage(filePath);
      fs.writeFileSync(outputPath, cleaned);
      console.log(`  ✅ → ${outputPath}`);
      ok++;
      // レート制限対策：次の枚に進む前に3秒待機
      if (i < files.length - 1) await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`  ❌ 失敗: ${err.message}`);
      ng++;
    }
  }

  console.log(`\n✅ 完了: ${ok}枚成功 / ${ng ? ng + '枚失敗' : '失敗なし'}`);
  console.log(`   出力先: ${itemOutputDir}\n`);

  const clear = await prompt('inbox の処理済み画像を削除しますか？ [y/n]: ');
  if (clear.toLowerCase() === 'y') {
    files.forEach(f => fs.unlinkSync(path.join(INBOX_DIR, f)));
    console.log('  🗑 inbox をクリアしました\n');
  }
}

run().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
