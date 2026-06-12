import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');

export async function run(task, supabase) {
  const { data: item, error } = await supabase
    .from('mercari_items')
    .select('*')
    .eq('item_no', task.target_item_no)
    .single();

  if (error) throw new Error(`商品取得エラー: ${error.message}`);

  const lines = [
    `【タスク #${task.id} / draft_listing】`,
    ``,
    `以下の商品をメルカリに下書き投入してください。`,
    ``,
    `■ 商品情報`,
    `  商品名    : ${item.name}`,
    `  item_no   : ${item.item_no}`,
    `  価格      : ¥${(item.price ?? 0).toLocaleString()}`,
    `  原価      : ¥${(item.cost ?? 0).toLocaleString()}`,
    `  送料      : ¥${(item.shipping ?? 0).toLocaleString()}`,
    `  配送方法  : らくらくメルカリ便`,
    item.draft_title       ? `  下書きタイトル:\n${item.draft_title}` : null,
    item.draft_description ? `  下書き説明文:\n${item.draft_description}` : null,
    item.memo              ? `  メモ: ${item.memo}` : null,
    ``,
    `■ 指示`,
    task.instruction,
    ``,
    `■ 手順`,
    `1. メルカリアプリまたはWebで「出品する」を開く`,
    `2. 上記の情報を入力し、「下書き保存」する`,
    `3. 完了したらタスク #${task.id} を done に更新する`,
  ].filter(l => l !== null).join('\n');

  const filePath = join(OUTPUT_DIR, `task_${task.id}.txt`);
  await writeFile(filePath, lines, 'utf8');
  return `output/task_${task.id}.txt を生成しました`;
}
