#!/bin/sh
# 問題JSONが変更された場合にコミット前整合性チェックを実行する

CHANGED_MCQ=$(git diff --cached --name-only | grep 'src/data/questions/.*\.json' | grep -v '\.bak')
CHANGED_TBS=$(git diff --cached --name-only | grep 'src/data/tbs/.*\.json' | grep -v '\.bak')

if [ -z "$CHANGED_MCQ" ] && [ -z "$CHANGED_TBS" ]; then
  exit 0
fi

if [ -n "$CHANGED_MCQ" ]; then
  echo "[pre-commit] MCQ問題データの変更を検知 — 整合性チェックを実行..."
  echo "$CHANGED_MCQ" | sed 's/^/  - /'
  echo ""

  node scripts/check-questions.mjs
  if [ $? -ne 0 ]; then
    echo ""
    echo "[pre-commit] ❌ MCQ整合性チェック失敗。コミットを中止します。"
    echo "  上記の問題を修正してから再度 git commit してください。"
    exit 1
  fi
fi

if [ -n "$CHANGED_TBS" ]; then
  echo "[pre-commit] TBS問題データの変更を検知 — 整合性チェックを実行..."
  echo "$CHANGED_TBS" | sed 's/^/  - /'
  echo ""

  node scripts/check-tbs.mjs
  if [ $? -ne 0 ]; then
    echo ""
    echo "[pre-commit] ❌ TBS整合性チェック失敗。コミットを中止します。"
    echo "  上記の問題を修正してから再度 git commit してください。"
    exit 1
  fi
fi

echo "[pre-commit] ✓ 整合性チェック通過。"
exit 0
