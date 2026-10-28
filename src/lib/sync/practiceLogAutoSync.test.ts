import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { AUTO_SYNC_INTERVAL_MS, isAutoSyncDue, type AutoSyncStatus } from "./practiceLogAutoSync"

const statusAt = (lastRunAt: string): AutoSyncStatus => ({ lastRunAt, ok: true, added: 0, sent: 0 })

describe("isAutoSyncDue", () => {
  const now = new Date("2026-10-28T12:00:00.000Z").getTime()

  it("一度も同期していなければ同期する", () => {
    expect(isAutoSyncDue(null, now)).toBe(true)
  })

  it("前回から間隔が空いていなければ同期しない", () => {
    expect(isAutoSyncDue(statusAt(new Date(now - AUTO_SYNC_INTERVAL_MS + 1000).toISOString()), now)).toBe(false)
  })

  it("前回から間隔が空いていれば同期する", () => {
    expect(isAutoSyncDue(statusAt(new Date(now - AUTO_SYNC_INTERVAL_MS).toISOString()), now)).toBe(true)
  })

  it("記録が壊れていれば同期する", () => {
    expect(isAutoSyncDue(statusAt("broken"), now)).toBe(true)
  })
})

// navigator.locks の無い環境（jsdom）で、このタブの中だけのロックが働くことを確かめる
describe("withPracticeLogLock", () => {
  beforeEach(() => vi.resetModules())

  it("実行中に ifAvailable で呼ぶと待たずに null を返す", async () => {
    const { withPracticeLogLock } = await import("./practiceLogAutoSync")
    let release!: () => void
    const first = withPracticeLogLock(() => new Promise<string>((resolve) => (release = () => resolve("first"))))
    await Promise.resolve()

    expect(await withPracticeLogLock(async () => "second", { ifAvailable: true })).toBeNull()
    release()
    expect(await first).toBe("first")
  })

  it("待つ指定なら、前の実行が終わってから順に実行する", async () => {
    const { withPracticeLogLock } = await import("./practiceLogAutoSync")
    const order: string[] = []
    let release!: () => void
    const first = withPracticeLogLock(async () => {
      await new Promise<void>((resolve) => (release = resolve))
      order.push("first")
    })
    const second = withPracticeLogLock(async () => {
      order.push("second")
    })
    await Promise.resolve()
    release()
    await Promise.all([first, second])

    expect(order).toEqual(["first", "second"])
  })

  it("前の実行が失敗しても次は実行する", async () => {
    const { withPracticeLogLock } = await import("./practiceLogAutoSync")
    await expect(withPracticeLogLock(async () => { throw new Error("失敗") })).rejects.toThrow("失敗")

    expect(await withPracticeLogLock(async () => "ok")).toBe("ok")
  })
})

describe("runPracticeLogAutoSync", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("一度も同期できていないうちは、回答後の送信をしない", async () => {
    const { runPracticeLogAutoSync } = await import("./practiceLogAutoSync")

    expect(await runPracticeLogAutoSync({ pull: false })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("Notion側が未設定なら失敗を記録し、以後は試さない", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Practice log is not configured" }), { status: 503 }))
    const { runPracticeLogAutoSync, readAutoSyncStatus } = await import("./practiceLogAutoSync")

    const status = await runPracticeLogAutoSync({ pull: true })
    expect(status).toMatchObject({ ok: false, error: "Practice log is not configured" })
    expect(readAutoSyncStatus()).toMatchObject({ ok: false })

    expect(await runPracticeLogAutoSync({ pull: true })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("取り込むものも送るものも無ければ、Notionを読むだけで終わる", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ chunks: [] }), { status: 200 }))
    const { runPracticeLogAutoSync } = await import("./practiceLogAutoSync")

    expect(await runPracticeLogAutoSync({ pull: true })).toMatchObject({ ok: true, added: 0, sent: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain("excludeDeviceId=")
  })
})
