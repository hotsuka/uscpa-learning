import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    // Node 25 以降はグローバルに localStorage が定義され、--localstorage-file が無いと undefined になる。
    // これが jsdom の localStorage を上書きしてテストが壊れるため、ワーカーでは Node 側の Web Storage を無効にする
    poolOptions: {
      forks: { execArgv: ["--no-experimental-webstorage"] },
      threads: { execArgv: ["--no-experimental-webstorage"] },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
