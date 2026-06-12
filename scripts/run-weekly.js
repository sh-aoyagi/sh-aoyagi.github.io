import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const run = (script) => execSync(`node "${path.join(dir, script)}"`, { stdio: 'inherit' });

console.log(`🚀 週次コンテンツ生成開始 ${new Date().toLocaleString('ja-JP')}`);
run('generate-content.js');
run('carousel-builder.js');
console.log('✅ 週次セットアップ完了');
