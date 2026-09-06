import { describe, it, expect, beforeEach } from "vitest"
import { readBackupMeta, writeBackupMeta } from "./autoBackup"

// autoBackup.ts 内の非公開定数と同じ値。ここが変わればテストも落ちてよい
const META_KEY = "uscpa-backup-meta"

beforeEach(() => {
  localStorage.clear()
})

describe("readBackupMeta", () => {
  it("未保存なら空オブジェクトを返す", () => {
    expect(readBackupMeta()).toEqual({})
  })

  it("保存済みのメタ情報を読み出す", () => {
    localStorage.setItem(META_KEY, JSON.stringify({ lastAutoBackupAt: "2026-01-01T00:00:00.000Z" }))

    expect(readBackupMeta().lastAutoBackupAt).toBe("2026-01-01T00:00:00.000Z")
  })

  it("壊れた JSON でも例外を投げず空オブジェクトを返す", () => {
    localStorage.setItem(META_KEY, "壊れたJSON")

    expect(readBackupMeta()).toEqual({})
  })

  it("オブジェクトでない JSON を空オブジェクトとして扱う", () => {
    localStorage.setItem(META_KEY, JSON.stringify("文字列"))

    expect(readBackupMeta()).toEqual({})
  })

  it("null が保存されていても空オブジェクトを返す", () => {
    localStorage.setItem(META_KEY, JSON.stringify(null))

    expect(readBackupMeta()).toEqual({})
  })
})

describe("writeBackupMeta", () => {
  it("既存のフィールドを保ったまま部分更新する", () => {
    writeBackupMeta({ lastAutoBackupAt: "2026-01-01T00:00:00.000Z" })
    writeBackupMeta({ lastJsonDownloadAt: "2026-02-01T00:00:00.000Z" })

    const meta = readBackupMeta()

    expect(meta.lastAutoBackupAt).toBe("2026-01-01T00:00:00.000Z")
    expect(meta.lastJsonDownloadAt).toBe("2026-02-01T00:00:00.000Z")
  })

  it("同じフィールドへの再書き込みは上書きになる", () => {
    writeBackupMeta({ lastAutoBackupAt: "2026-01-01T00:00:00.000Z" })
    writeBackupMeta({ lastAutoBackupAt: "2026-03-01T00:00:00.000Z" })

    expect(readBackupMeta().lastAutoBackupAt).toBe("2026-03-01T00:00:00.000Z")
  })

  it("壊れた既存メタを上書きして復旧する", () => {
    localStorage.setItem(META_KEY, "壊れたJSON")

    writeBackupMeta({ reminderDismissedOn: "2026-01-01" })

    expect(readBackupMeta().reminderDismissedOn).toBe("2026-01-01")
  })
})
