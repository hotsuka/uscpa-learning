/**
 * Git pre-commit hook をインストールする。
 * 新しいマシンでクローン後に `node scripts/install-hooks.mjs` を実行すること。
 */
import { copyFileSync, chmodSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const hooksDir = join('.git', 'hooks');
const src = join('scripts', 'pre-commit.sh');
const dest = join(hooksDir, 'pre-commit');

if (!existsSync(hooksDir)) {
  mkdirSync(hooksDir, { recursive: true });
}

copyFileSync(src, dest);

try {
  chmodSync(dest, '755');
} catch {
  // Windows では chmod が不要な場合がある（Git Bash が自動処理）
}

console.log(`✓ Git pre-commit hook をインストールしました: ${dest}`);
console.log('  問題JSONを変更するコミットの際に自動で整合性チェックが実行されます。');
