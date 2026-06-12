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
    `【タスク #${task.id} / update_listing】`,
    ``,
    `以下の出品情報を更新してください。`,
    ``,
    `■ 対象商品`,
    `  商品名    : ${item.name}`,
    `  item_no   : ${item.item_no}`,
    `  mercari_id: ${item.mercari_id ?? '未設定'}`,
    `  現在の価格: ¥${(item.price ?? 0).toLocaleString()}`,
    `  現在の説明文:`,
    item.draft_description ? item.draft_description : `  （未設定）`,
    ``,
    `■ 指示`,
    task.instruction,
    ``,
    `■ 依頼内容`,
    `指示に従って以下を更新してください：`,
    `  - 説明文（現在の内容を改善・追記）`,
    `  - 価格（指示に価格変更が含まれる場合）`,
    ``,
    `■ 手順`,
    `1. メルカリで該当商品（${item.name}）を開く`,
    `2. 「編集する」から上記の変更を適用して保存する`,
    `3. mercari_items テーブルの該当レコードも更新する`,
    `4. 完了したらタスク #${task.id} を done に更新する`,
  ].join('\n');

  const filePath = join(OUTPUT_DIR, `task_${task.id}.txt`);
  await writeFile(filePath, lines, 'utf8');
  return `output/task_${task.id}.txt を生成しました`;
}
