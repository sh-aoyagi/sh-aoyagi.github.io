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

  // 指示文から新価格を抽出（例: "¥5,499に値上げ"）
  const priceMatch = task.instruction.match(/[¥￥]?([\d,]+)/);
  const newPrice = priceMatch ? priceMatch[1] : '指示を確認してください';

  const lines = [
    `【タスク #${task.id} / price_change】`,
    ``,
    `以下の商品の価格を変更してください。`,
    ``,
    `■ 対象商品`,
    `  商品名    : ${item.name}`,
    `  item_no   : ${item.item_no}`,
    `  mercari_id: ${item.mercari_id ?? '未設定'}`,
    `  現在の価格: ¥${(item.price ?? 0).toLocaleString()}`,
    `  新しい価格: ¥${newPrice}`,
    ``,
    `■ 指示`,
    task.instruction,
    ``,
    `■ 手順`,
    `1. メルカリで該当商品（${item.name}）を開く`,
    `2. 「編集する」→ 価格を ¥${newPrice} に変更して保存する`,
    `3. mercari_items テーブルの price を ${newPrice.replace(',', '')} に更新する`,
    `4. 完了したらタスク #${task.id} を done に更新する`,
  ].join('\n');

  const filePath = join(OUTPUT_DIR, `task_${task.id}.txt`);
  await writeFile(filePath, lines, 'utf8');
  return `output/task_${task.id}.txt を生成しました`;
}
