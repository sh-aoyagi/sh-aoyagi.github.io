import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const THEME = {
  '競馬':    { bg: '#0d1f0d', accent: '#4CAF50', emoji: '🐎' },
  '競輪':    { bg: '#0d1a2e', accent: '#2196F3', emoji: '🚴' },
  'ボート':  { bg: '#071929', accent: '#03A9F4', emoji: '🚤' },
  'ダイエット': { bg: '#1a0d2e', accent: '#CE93D8', emoji: '💪' },
};

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapLines(text, maxLen = 16) {
  const lines = [];
  let s = text;
  while (s.length > 0) { lines.push(s.slice(0, maxLen)); s = s.slice(maxLen); }
  return lines;
}

async function svgToPng(svgStr) {
  return sharp(Buffer.from(svgStr)).png().toBuffer();
}

function contentSlide(text, category, slideNo, total) {
  const { bg, accent, emoji } = THEME[category] ?? THEME['競馬'];
  const lines = wrapLines(escapeXml(text));
  const lh = 72;
  const startY = 540 - (lines.length * lh) / 2;
  const textSvg = lines.map((l, i) =>
    `<text x="540" y="${startY + i * lh}" text-anchor="middle" fill="white"
      font-size="54" font-family="Yu Gothic UI,Meiryo,sans-serif" font-weight="bold">${l}</text>`
  ).join('');

  return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1080" fill="${bg}"/>
  <rect x="0" y="0" width="1080" height="10" fill="${accent}"/>
  <rect x="0" y="1070" width="1080" height="10" fill="${accent}"/>
  <text x="540" y="130" text-anchor="middle" font-size="80">${emoji}</text>
  <text x="540" y="195" text-anchor="middle" fill="${accent}"
    font-size="34" font-family="Yu Gothic UI,Meiryo,sans-serif">${escapeXml(category)}</text>
  ${textSvg}
  <text x="1050" y="1055" text-anchor="end" fill="rgba(255,255,255,0.35)"
    font-size="26" font-family="sans-serif">${slideNo}/${total}</text>
</svg>`;
}

function ctaSlide(category) {
  const { bg, accent } = THEME[category] ?? THEME['競馬'];
  return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1080" fill="${bg}"/>
  <rect x="0" y="0" width="1080" height="10" fill="${accent}"/>
  <rect x="0" y="1070" width="1080" height="10" fill="${accent}"/>
  <text x="540" y="420" text-anchor="middle" font-size="100">📝</text>
  <text x="540" y="530" text-anchor="middle" fill="white"
    font-size="58" font-family="Yu Gothic UI,Meiryo,sans-serif" font-weight="bold">詳しい解説は</text>
  <text x="540" y="620" text-anchor="middle" fill="${accent}"
    font-size="58" font-family="Yu Gothic UI,Meiryo,sans-serif" font-weight="bold">noteで公開中 →</text>
  <text x="540" y="730" text-anchor="middle" fill="rgba(255,255,255,0.7)"
    font-size="36" font-family="Yu Gothic UI,Meiryo,sans-serif">フォローして最新情報をGET</text>
</svg>`;
}

async function buildCarousels() {
  const { data: posts, error } = await supabase
    .from('platform_posts')
    .select('*')
    .eq('platform', 'instagram')
    .eq('status', 'pending')
    .filter('image_urls', 'eq', '{}');

  if (error) throw error;
  if (!posts?.length) { console.log('No carousels to build.'); return; }

  console.log(`Building ${posts.length} carousels...`);

  for (const post of posts) {
    const slides = post.slide_texts?.length ? post.slide_texts : [post.body];
    const total = slides.length + 1;
    const imageUrls = [];

    for (let i = 0; i < slides.length; i++) {
      const buf = await svgToPng(contentSlide(slides[i], post.category, i + 1, total));
      const filePath = `${post.id}/slide-${i + 1}.png`;
      await supabase.storage.from('carousel-images').upload(filePath, buf, { contentType: 'image/png', upsert: true });
      const { data: u } = supabase.storage.from('carousel-images').getPublicUrl(filePath);
      imageUrls.push(u.publicUrl);
    }

    const ctaBuf = await svgToPng(ctaSlide(post.category));
    const ctaPath = `${post.id}/slide-cta.png`;
    await supabase.storage.from('carousel-images').upload(ctaPath, ctaBuf, { contentType: 'image/png', upsert: true });
    const { data: ctaU } = supabase.storage.from('carousel-images').getPublicUrl(ctaPath);
    imageUrls.push(ctaU.publicUrl);

    await supabase.from('platform_posts').update({ image_urls: imageUrls }).eq('id', post.id);
    console.log(`✅ ${post.category} carousel built (${imageUrls.length} slides)`);
  }

  console.log('✅ All carousels done.');
}

buildCarousels().catch(err => { console.error(err); process.exit(1); });
