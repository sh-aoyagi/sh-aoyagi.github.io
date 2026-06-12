import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const DAYS = ['日','月','火','水','木','金','土'];
const ICONS = { x: '🐦 X', threads: '🧵 Threads', instagram: '📸 Instagram' };
const TIMING = { x: '8:00 or 19:00', threads: '9:00 or 20:00', instagram: '12:00 or 18:00' };

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getMonday(d = new Date()) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d); m.setDate(diff); m.setHours(0,0,0,0);
  return m;
}

async function run(weekArg) {
  const monday = getMonday(weekArg ? new Date(weekArg) : new Date());
  const weekOf = toLocalDateStr(monday);

  const { data: posts } = await supabase
    .from('platform_posts').select('*')
    .eq('week_of', weekOf)
    .order('scheduled_for', { ascending: true });

  if (!posts?.length) { console.error('投稿データなし:', weekOf); return; }

  // group by date
  const byDate = {};
  for (const p of posts) {
    const dk = new Date(p.scheduled_for).toISOString().split('T')[0];
    if (!byDate[dk]) byDate[dk] = { x:[], threads:[], instagram:[] };
    byDate[dk][p.platform].push(p);
  }

  const L = [];
  L.push(`# 📅 ${weekOf}週 SNS投稿カレンダー`);
  L.push('');
  L.push('> **使い方**: 各ブロックをコピペして投稿するだけ。画像URLはブラウザで開いて保存してください。');
  L.push(`> X×10本 / Threads×10本 / Instagram×10本 = 合計30本`);
  L.push('');

  for (const [dk, plats] of Object.entries(byDate).sort()) {
    const d = new Date(dk + 'T00:00:00');
    L.push(`---`);
    L.push(`## ${d.getMonth()+1}/${d.getDate()}（${DAYS[d.getDay()]}）`);
    L.push('');

    for (const [platform, list] of Object.entries(plats)) {
      if (!list.length) continue;
      L.push(`### ${ICONS[platform]}　※推奨時間 JST ${TIMING[platform]}`);
      L.push('');

      for (const p of list) {
        const jstTime = new Date(p.scheduled_for).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tokyo'});
        L.push(`**[${jstTime}] ${p.category}**`);
        L.push('');
        L.push('```');
        L.push(p.body);
        if (p.hashtags?.length) L.push(p.hashtags.map(h=>`#${h}`).join(' '));
        L.push('```');
        L.push('');

        if (platform === 'instagram') {
          if (p.image_urls?.length) {
            L.push('**📎 カルーセル画像（クリックしてDL→投稿）**');
            p.image_urls.forEach((url, i) => L.push(`- [スライド${i+1}](${url})`));
            L.push('');
          }
          if (p.slide_texts?.length) {
            L.push('<details><summary>スライド内テキスト（参考）</summary>');
            L.push('');
            p.slide_texts.forEach((t,i) => L.push(`${i+1}. ${t}`));
            L.push('</details>');
            L.push('');
          }
        }
      }
    }
  }

  L.push('---');
  L.push('');
  L.push('## 📊 週末KPI記録欄');
  L.push('');
  L.push('> 週末に数字を見てClaudeに「KPI報告します」と伝えてください。PDCAレポートを出します。');
  L.push('');
  L.push('| プラットフォーム | フォロワー数 | いいね合計 | リーチ/閲覧 | 売上 |');
  L.push('|---|---|---|---|---|');
  L.push('| note | | | | ¥ |');
  L.push('| Instagram | | | | - |');
  L.push('| Threads | | | | - |');
  L.push('| X | | | | - |');
  L.push('| メルカリ | - | - | - | ¥ |');

  const outDir = path.join(__dirname, '..', 'weekly-posts');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${weekOf}.md`);
  writeFileSync(outPath, L.join('\n'), 'utf8');
  console.log(`✅ 保存: ${outPath}`);
  return outPath;
}

run(process.argv[2]).catch(err => { console.error(err); process.exit(1); });
