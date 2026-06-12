import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function jstSlot(monday, dayOffset, jstHour) {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(jstHour - 9, 0, 0, 0); // JST→UTC
  return d.toISOString();
}

const SCHEDULE = {
  x:         [[0,19],[1,8],[1,19],[2,8],[2,19],[3,8],[3,19],[4,8],[5,8],[6,8]],
  threads:   [[0,20],[1,9],[1,20],[2,9],[2,20],[3,9],[3,20],[4,9],[5,9],[6,9]],
  instagram: [[0,12],[1,12],[2,12],[3,12],[4,12],[5,12],[6,12],[1,18],[3,18],[5,18]],
};

async function generateWeeklyContent() {
  const monday = getMonday(new Date());
  const weekOf = monday.toISOString().split('T')[0];

  // 同週分がすでに存在する場合はスキップ
  const { count } = await supabase
    .from('platform_posts')
    .select('*', { count: 'exact', head: true })
    .eq('week_of', weekOf);
  if (count > 0) {
    console.log(`Week ${weekOf} already generated (${count} posts). Skipping.`);
    return;
  }

  console.log(`Generating content for week of ${weekOf}...`);

  const prompt = `あなたは競馬・競輪・ボートレース・ダイエットの情報発信SNSアカウントの投稿生成AIです。

${weekOf}週分のSNS投稿を30本生成してください。
- X (Twitter): 10本（本文+ハッシュタグ合計280文字以内）
- Threads: 10本（最大500文字、会話調、絵文字多め）
- Instagram: 10本（カルーセル用 slide_texts を3〜5枚分含める、各スライド50文字以内）

カテゴリ配分（各プラットフォーム）:
- 競馬: 3本、競輪: 2本、ボート: 3本、ダイエット: 2本

以下のJSON配列のみを返してください（コードブロック記号なし）:
[
  {
    "platform": "x",
    "category": "競馬",
    "post_no": 1,
    "body": "本文",
    "hashtags": ["競馬予想", "G1"]
  },
  {
    "platform": "instagram",
    "category": "ボート",
    "post_no": 1,
    "body": "キャプション本文",
    "hashtags": ["ボートレース", "競艇予想"],
    "slide_texts": ["スライド1", "スライド2", "スライド3"]
  }
]

ルール:
- 具体的・実践的な内容（宣伝だけはNG）
- note記事への誘導を自然に含める
- 予想は「注目」「チェック」レベル（断定しない）
- 絵文字を適切に使用`;

  const res = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const posts = JSON.parse(res.content[0].text);

  const byPlatform = { x: [], threads: [], instagram: [] };
  for (const p of posts) byPlatform[p.platform]?.push(p);

  const rows = [];
  for (const [platform, list] of Object.entries(byPlatform)) {
    list.forEach((post, i) => {
      const [dayOffset, jstHour] = SCHEDULE[platform][i] ?? SCHEDULE[platform].at(-1);
      rows.push({
        platform,
        category: post.category,
        week_of: weekOf,
        post_no: post.post_no ?? i + 1,
        scheduled_for: jstSlot(monday, dayOffset, jstHour),
        body: post.body,
        hashtags: post.hashtags ?? [],
        slide_texts: post.slide_texts ?? [],
        image_urls: [],
        status: 'pending',
      });
    });
  }

  const { error } = await supabase.from('platform_posts').insert(rows);
  if (error) throw error;

  console.log(`✅ ${rows.length} posts saved for week of ${weekOf}`);
}

generateWeeklyContent().catch(err => { console.error(err); process.exit(1); });
