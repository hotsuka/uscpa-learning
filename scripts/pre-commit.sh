#!/bin/sh
# 問題JSONが変更された場合にコミット前整合性チェックを実行する

CHANGED=$(git diff --cached --name-only | grep 'src/data/questions/.*\.json' | grep -v '\.bak')

if [ -z "$CHANGED" ]; then
  exit 0
fi

echo "[pre-commit] 問題データの変更を検知 — 整合性チェックを実行..."
echo "$CHANGED" | sed 's/^/  - /'
echo ""

node scripts/check-questions.mjs
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo ""
  echo "[pre-commit] ❌ 整合性チェック失敗。コミットを中止します。"
  echo "  上記の問題を修正してから再度 git commit してください。"
  exit 1
fi

echo "[pre-commit] ✓ 整合性チェック通過。"
exit 0
