import { defineConfig, defaultExclude } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    // .claude/worktrees 配下に残る旧ワークツリーのテストを二重収集しないための除外。
    // 未指定だと同一テストが複製分だけ重複計上され、テスト数が実数の約3倍に見える。
    exclude: [...defaultExclude, "**/.claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
