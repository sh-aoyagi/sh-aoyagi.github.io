import { createClient } from '@supabase/supabase-js';
import { TwitterApi } from 'twitter-api-v2';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function buildText(post, maxLen) {
  const tags = post.hashtags?.map(h => `#${h}`).join(' ') ?? '';
  return `${post.body}\n\n${tags}`.trim().slice(0, maxLen);
}

async function postToX(post) {
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  });
  const { data } = await client.v2.tweet(buildText(post, 280));
  return data.id;
}

async function postToThreads(post) {
  const uid = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  const text = buildText(post, 500);

  const r1 = await fetch(`https://graph.threads.net/v1.0/${uid}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'TEXT', text, access_token: token }),
  });
  const { id: creationId, error: e1 } = await r1.json();
  if (e1) throw new Error(JSON.stringify(e1));

  await new Promise(r => setTimeout(r, 5000));

  const r2 = await fetch(`https://graph.threads.net/v1.0/${uid}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  const { id, error: e2 } = await r2.json();
  if (e2) throw new Error(JSON.stringify(e2));
  return id;
}

async function postToInstagram(post) {
  const igId = process.env.IG_USER_ID;
  const token = process.env.META_ACCESS_TOKEN;
  const caption = buildText(post, 2200);

  if (!post.image_urls?.length) throw new Error('image_urls empty');

  const containerIds = [];
  for (const imageUrl of post.image_urls) {
    const r = await fetch(`https://graph.facebook.com/v20.0/${igId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, is_carousel_item: true, access_token: token }),
    });
    const { id, error } = await r.json();
    if (error) throw new Error(JSON.stringify(error));
    containerIds.push(id);
    await new Promise(r => setTimeout(r, 1000));
  }

  const r2 = await fetch(`https://graph.facebook.com/v20.0/${igId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'CAROUSEL', children: containerIds.join(','), caption, access_token: token }),
  });
  const { id: carouselId, error: e2 } = await r2.json();
  if (e2) throw new Error(JSON.stringify(e2));

  await new Promise(r => setTimeout(r, 3000));

  const r3 = await fetch(`https://graph.facebook.com/v20.0/${igId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: carouselId, access_token: token }),
  });
  const { id, error: e3 } = await r3.json();
  if (e3) throw new Error(JSON.stringify(e3));
  return id;
}

async function postPending() {
  const now = new Date().toISOString();
  const { data: posts, error } = await supabase
    .from('platform_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(20);

  if (error) throw error;
  if (!posts?.length) { console.log(`[${new Date().toLocaleString('ja-JP')}] 投稿待ちなし`); return; }

  console.log(`[${new Date().toLocaleString('ja-JP')}] ${posts.length}件投稿開始...`);

  for (const post of posts) {
    await supabase.from('platform_posts').update({ status: 'posting' }).eq('id', post.id);
    try {
      let pid;
      if (post.platform === 'x')         pid = await postToX(post);
      else if (post.platform === 'threads')   pid = await postToThreads(post);
      else if (post.platform === 'instagram') pid = await postToInstagram(post);

      await supabase.from('platform_posts').update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        platform_post_id: String(pid),
      }).eq('id', post.id);

      console.log(`  ✅ [${post.platform}] ${post.category} #${post.post_no}`);
    } catch (err) {
      await supabase.from('platform_posts').update({
        status: 'failed',
        error_log: err.message,
      }).eq('id', post.id);
      console.error(`  ❌ [${post.platform}] ${post.category} #${post.post_no}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

postPending().catch(err => { console.error(err); process.exit(1); });
