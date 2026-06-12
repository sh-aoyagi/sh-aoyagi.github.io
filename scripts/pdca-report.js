import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function pct(cur, prev) {
  if (prev == null || prev === 0) return cur > 0 ? '🆕' : '-';
  const p = ((cur - prev) / prev * 100).toFixed(1);
  return `${p >= 0 ? '▲' : '▼'}${Math.abs(p)}%`;
}
function yen(n) { return `¥${(n??0).toLocaleString()}`; }
function bar(p, max=100) {
  const filled = Math.round(Math.min(p,100)/max*20);
  return '█'.repeat(filled) + '░'.repeat(20-filled) + ` ${p.toFixed(0)}%`;
}

async function run() {
  const { data } = await supabase.from('weekly_kpi')
    .select('*').order('week_of',{ascending:false}).limit(5);

  if (!data?.length) { console.log('KPIデータなし'); return; }
  const [cur, prev] = [data[0], data[1]];

  // Mercari from DB
  const { data: sold } = await supabase.from('mercari_items')
    .select('sold_price, updated_at')
    .eq('status','sold')
    .gte('updated_at', cur.week_of)
    .lt('updated_at', new Date(new Date(cur.week_of).getTime()+7*86400000).toISOString());
  const mercariRevWeek = sold?.reduce((s,r) => s+(r.sold_price??0), 0) ?? 0;
  const mercariCount = sold?.length ?? 0;

  const noteMonthly = (cur.note_revenue??0)*4;
  const mercariMonthly = mercariRevWeek*4;
  const noteTargetPct = noteMonthly/100000*100;
  const mercariTargetPct = mercariMonthly/100000*100;

  const L = [];
  L.push(`# 📊 PDCAレポート ${cur.week_of}週`);
  L.push(`> 生成: ${new Date().toLocaleString('ja-JP')}`);
  L.push('');
  L.push('## 月10万円達成率');
  L.push('');
  L.push(`**note副業**`);
  L.push(`${bar(noteTargetPct)} 月次換算 ${yen(noteMonthly)} / ¥100,000`);
  L.push('');
  L.push(`**メルカリ**`);
  L.push(`${bar(mercariTargetPct)} 月次換算 ${yen(mercariMonthly)} / ¥100,000`);
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 今週のKPI');
  L.push('');
  L.push('| 指標 | 今週 | 先週 | 増減 |');
  L.push('|---|---|---|---|');
  L.push(`| note売上 | ${yen(cur.note_revenue)} | ${prev?yen(prev.note_revenue):'-'} | ${prev?pct(cur.note_revenue,prev.note_revenue):'-'} |`);
  L.push(`| note閲覧 | ${cur.note_views??0}回 | ${prev?prev.note_views+`回`:'-'} | ${prev?pct(cur.note_views,prev.note_views):'-'} |`);
  L.push(`| noteフォロワー | ${cur.note_followers??0} | ${prev?prev.note_followers:'-'} | ${prev?pct(cur.note_followers,prev.note_followers):'-'} |`);
  L.push(`| Instagramフォロワー | ${cur.ig_followers??0} | ${prev?prev.ig_followers:'-'} | ${prev?pct(cur.ig_followers,prev.ig_followers):'-'} |`);
  L.push(`| Threadsフォロワー | ${cur.threads_followers??0} | ${prev?prev.threads_followers:'-'} | ${prev?pct(cur.threads_followers,prev.threads_followers):'-'} |`);
  L.push(`| メルカリ売上 | ${yen(mercariRevWeek)} (${mercariCount}件) | ${prev?yen(prev.mercari_revenue):'-'} | ${prev?pct(mercariRevWeek,prev.mercari_revenue):'-'} |`);
  L.push('');
  L.push('---');
  L.push('');
  L.push('## PDCA分析');
  L.push('');

  // Auto-analysis
  const actions = [];
  if ((cur.note_views??0) < 50)   actions.push('🔴 **note閲覧数が少ない** → SNS投稿でnoteへの誘導文言を追加する');
  if ((cur.ig_followers??0) < 100) actions.push('🟡 **Instagramフォロワー不足** → 保存されやすいカルーセルテーマ（初心者向け・攻略系）に寄せる');
  if ((cur.threads_followers??0) < 50) actions.push('🟡 **Threadsフォロワー不足** → 朝9時・夜8時に毎日投稿を継続、返信でエンゲージメントUP');
  if ((cur.note_sales??0) === 0)  actions.push('🔴 **note販売ゼロ** → 無料記事のCTAを強化、有料記事の冒頭に価値訴求を入れる');
  if (mercariCount === 0)         actions.push('🟡 **メルカリ今週売上なし** → 在庫チェックとPDCA対象を「在庫確認して」で実行');

  if (actions.length === 0) {
    L.push('✅ 全指標順調です。このペースを維持しましょう！');
  } else {
    L.push('### 改善アクション（優先順）');
    L.push('');
    actions.forEach(a => L.push(`- ${a}`));
  }

  L.push('');
  L.push('### 来週のコンテンツ戦略');
  L.push('');

  const bestPlatform = [
    { p:'Instagram', f: cur.ig_likes??0 },
    { p:'Threads',   f: cur.threads_likes??0 },
    { p:'X',         f: cur.x_impressions??0 },
  ].sort((a,b)=>b.f-a.f)[0];

  L.push(`- 最もエンゲージメント高い媒体: **${bestPlatform.p}** → 投稿頻度を維持`);
  L.push(`- note集客源として**${bestPlatform.p}**からの誘導を強化する`);
  L.push(`- 競馬G1シーズン継続中 → 競馬コンテンツの比率を上げる（G1は反応が取りやすい）`);
  L.push('');
  L.push('---');
  L.push('');
  L.push('## 次回アクション');
  L.push('');
  L.push('1. 「今週のコンテンツ出して」→ 来週分30本を生成');
  L.push('2. カレンダーMDを見ながらコピペ投稿');
  L.push('3. 来週末にKPIを報告');
  if (cur.memo) { L.push(''); L.push('**メモ:** '+cur.memo); }

  const outDir = path.join(__dirname,'..','weekly-posts');
  mkdirSync(outDir,{recursive:true});
  const outPath = path.join(outDir,`pdca-${cur.week_of}.md`);
  writeFileSync(outPath, L.join('\n'), 'utf8');
  console.log(`✅ PDCAレポート: ${outPath}`);
}

run().catch(err => { console.error(err); process.exit(1); });
