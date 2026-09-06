import { describe, it, expect, beforeEach } from "vitest"
import {
  backupBeforeMigrate,
  createManualBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
} from "./utils"
import { PRE_MIGRATE_INFIX, MANUAL_INFIX } from "./constants"

const QUESTION_BANK = "uscpa-question-bank"
const MOCK_EXAMS = "uscpa-mock-exams"

// Zustand persist の保存形式を模した JSON を組み立てる
const persisted = (arrayKey: string, length: number): string =>
  JSON.stringify({
    state: { [arrayKey]: Array.from({ length }, (_, i) => ({ id: i })) },
    version: 1,
  })

beforeEach(() => {
  localStorage.clear()
})

describe("backupBeforeMigrate", () => {
  it("既存の値を pre-v キーに退避する", () => {
    localStorage.setItem(QUESTION_BANK, persisted("attempts", 3))

    backupBeforeMigrate(QUESTION_BANK, 2)

    const backups = listBackups()
    expect(backups).toHaveLength(1)
    expect(backups[0].type).toBe("pre-migrate")
    expect(backups[0].backupKey.startsWith(`${QUESTION_BANK}${PRE_MIGRATE_INFIX}2.`)).toBe(true)
  })

  it("元データを書き換えない", () => {
    const original = persisted("attempts", 3)
    localStorage.setItem(QUESTION_BANK, original)

    backupBeforeMigrate(QUESTION_BANK, 2)

    expect(localStorage.getItem(QUESTION_BANK)).toBe(original)
  })

  it("値が存在しないキーではバックアップを作らない", () => {
    backupBeforeMigrate(QUESTION_BANK, 2)

    expect(listBackups()).toHaveLength(0)
  })
})

describe("createManualBackup", () => {
  it("値を持つ対象キーのみを manual バックアップする", () => {
    localStorage.setItem(QUESTION_BANK, persisted("attempts", 1))
    localStorage.setItem(MOCK_EXAMS, persisted("results", 2))

    const { savedKeys } = createManualBackup()

    expect(savedKeys).toHaveLength(2)
    expect(savedKeys.every((k) => k.includes(MANUAL_INFIX))).toBe(true)
  })

  it("対象キーが空なら何も保存しない", () => {
    localStorage.setItem("無関係なキー", "値")

    const { savedKeys } = createManualBackup()

    expect(savedKeys).toEqual([])
  })
})

describe("listBackups", () => {
  it("対象外のキーを列挙しない", () => {
    localStorage.setItem("無関係なキー.manual.2026-01-01T00:00:00.000Z", "値")

    expect(listBackups()).toHaveLength(0)
  })

  it("createdAt の降順で返す", () => {
    localStorage.setItem(`${QUESTION_BANK}${MANUAL_INFIX}2026-01-01T00:00:00.000Z`, "{}")
    localStorage.setItem(`${QUESTION_BANK}${MANUAL_INFIX}2026-03-01T00:00:00.000Z`, "{}")
    localStorage.setItem(`${QUESTION_BANK}${MANUAL_INFIX}2026-02-01T00:00:00.000Z`, "{}")

    const createdAts = listBackups().map((b) => b.createdAt)

    expect(createdAts).toEqual([
      "2026-03-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ])
  })

  it("pre-migrate キーからバージョン部分を除いた日時を取り出す", () => {
    localStorage.setItem(`${QUESTION_BANK}${PRE_MIGRATE_INFIX}2.2026-05-11T09:00:00.000Z`, "{}")

    const [item] = listBackups()

    expect(item.type).toBe("pre-migrate")
    expect(item.createdAt).toBe("2026-05-11T09:00:00.000Z")
  })

  it("永続化された配列の長さを recordCount として読む", () => {
    localStorage.setItem(
      `${MOCK_EXAMS}${MANUAL_INFIX}2026-01-01T00:00:00.000Z`,
      persisted("results", 4),
    )

    expect(listBackups()[0].recordCount).toBe(4)
  })

  it("JSON として壊れている値では recordCount を null にする", () => {
    localStorage.setItem(`${QUESTION_BANK}${MANUAL_INFIX}2026-01-01T00:00:00.000Z`, "壊れたJSON")

    const [item] = listBackups()

    expect(item.recordCount).toBeNull()
    expect(item.byteSize).toBeGreaterThan(0)
  })
})

describe("restoreBackup", () => {
  it("バックアップの内容を元のキーに書き戻す", () => {
    const snapshot = persisted("attempts", 5)
    const backupKey = `${QUESTION_BANK}${MANUAL_INFIX}2026-01-01T00:00:00.000Z`
    localStorage.setItem(QUESTION_BANK, persisted("attempts", 1))
    localStorage.setItem(backupKey, snapshot)

    const restored = restoreBackup(backupKey)

    expect(restored).toBe(QUESTION_BANK)
    expect(localStorage.getItem(QUESTION_BANK)).toBe(snapshot)
  })

  it("書き戻した後もバックアップ自体は残す", () => {
    const backupKey = `${QUESTION_BANK}${MANUAL_INFIX}2026-01-01T00:00:00.000Z`
    localStorage.setItem(backupKey, persisted("attempts", 5))

    restoreBackup(backupKey)

    expect(localStorage.getItem(backupKey)).not.toBeNull()
  })

  it("対象キーに紐づかないバックアップキーには null を返す", () => {
    expect(restoreBackup("無関係なキー.manual.2026-01-01T00:00:00.000Z")).toBeNull()
  })

  it("実体のないバックアップキーには null を返す", () => {
    expect(restoreBackup(`${QUESTION_BANK}${MANUAL_INFIX}2026-01-01T00:00:00.000Z`)).toBeNull()
  })
})

describe("deleteBackup", () => {
  it("指定したバックアップだけを削除する", () => {
    const target = `${QUESTION_BANK}${MANUAL_INFIX}2026-01-01T00:00:00.000Z`
    const other = `${QUESTION_BANK}${MANUAL_INFIX}2026-02-01T00:00:00.000Z`
    localStorage.setItem(target, "{}")
    localStorage.setItem(other, "{}")

    deleteBackup(target)

    expect(listBackups().map((b) => b.backupKey)).toEqual([other])
  })

  it("元データは削除しない", () => {
    const backupKey = `${QUESTION_BANK}${MANUAL_INFIX}2026-01-01T00:00:00.000Z`
    localStorage.setItem(QUESTION_BANK, persisted("attempts", 1))
    localStorage.setItem(backupKey, "{}")

    deleteBackup(backupKey)

    expect(localStorage.getItem(QUESTION_BANK)).not.toBeNull()
  })
})
