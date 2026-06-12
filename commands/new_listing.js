import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'output');

export async function run(task, supabase) {
  const lines = [
    `【タスク #${task.id} / new_listing】`,
    ``,
    `以下の商品の新規出品下書きを作成してください。`,
    ``,
    `■ 指示`,
    task.instruction,
    ``,
    `■ 依頼内容`,
    `メルカリに出品するための以下の情報を考えてください：`,
    `  - 商品タイトル（検索されやすいキーワードを含む、32文字以内）`,
    `  - 商品説明文（状態・サイズ・特徴・注意事項を含む）`,
    `  - カテゴリ`,
    `  - 推奨価格（相場を踏まえて）`,
    `  - 配送方法`,
    ``,
    `■ 手順`,
    `1. 上記の情報をもとにメルカリ出品用テキストを作成する`,
    `2. メルカリアプリまたはWebで「出品する」を開き下書き保存する`,
    `3. mercari_items テーブルに新規レコードを追加する`,
    `4. 完了したらタスク #${task.id} を done に更新する`,
  ].join('\n');

  const filePath = join(OUTPUT_DIR, `task_${task.id}.txt`);
  await writeFile(filePath, lines, 'utf8');
  return `output/task_${task.id}.txt を生成しました`;
}
