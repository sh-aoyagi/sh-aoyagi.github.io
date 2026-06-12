import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function loadHandler(taskType) {
  const filePath = join(__dirname, 'commands', `${taskType}.js`);
  try {
    const mod = await import(pathToFileURL(filePath).href);
    return mod.run;
  } catch {
    return null;
  }
}

async function fetchPendingTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(`タスク取得エラー: ${error.message}`);
  return data;
}

async function markRunning(taskId) {
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'running' })
    .eq('id', taskId);
  if (error) throw new Error(`running更新エラー: ${error.message}`);
}

async function markDone(taskId, result) {
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'done', result, executed_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) throw new Error(`done更新エラー: ${error.message}`);
}

async function markFailed(taskId, errMsg) {
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'failed', result: errMsg, executed_at: new Date().toISOString() })
    .eq('id', taskId);
  if (error) console.error(`failed更新エラー: ${error.message}`);
}

async function main() {
  console.log('エージェント起動');

  const tasks = await fetchPendingTasks();
  console.log(`pendingタスク: ${tasks.length}件\n`);

  if (tasks.length === 0) {
    console.log('実行するタスクはありません');
    return;
  }

  for (const task of tasks) {
    console.log(`▶ タスク #${task.id} [${task.task_type}] priority=${task.priority}`);
    console.log(`  instruction: ${task.instruction}`);

    const handler = await loadHandler(task.task_type);
    if (!handler) {
      const msg = `未知のtask_type: ${task.task_type}`;
      console.error(`  ✗ ${msg}`);
      await markFailed(task.id, msg);
      continue;
    }

    await markRunning(task.id);
    try {
      const result = await handler(task, supabase);
      await markDone(task.id, result);
      console.log(`  ✓ ${result}`);
    } catch (err) {
      await markFailed(task.id, err.message);
      console.error(`  ✗ 失敗: ${err.message}`);
    }
  }

  console.log('\n全タスク処理完了');
}

main().catch((err) => {
  console.error('致命的エラー:', err.message);
  process.exit(1);
});
