import { describe, it, expect, beforeEach } from "vitest"
import { importFromJsonFile, type ExportPayload } from "./exportImport"

const QUESTION_BANK = "uscpa-question-bank"
const MOCK_EXAMS = "uscpa-mock-exams"

// jsdom の File には text() が実装されていないため、
// importFromJsonFile が実際に使う口だけを備えた最小の代用を渡す
const jsonFile = (content: string): File =>
  ({ text: () => Promise.resolve(content) }) as unknown as File

const payload = (data: ExportPayload["data"]): string =>
  JSON.stringify({
    schema: "uscpa-backup",
    schemaVersion: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    data,
  })

beforeEach(() => {
  localStorage.clear()
})

describe("importFromJsonFile", () => {
  it("payload の内容を localStorage に書き戻す", async () => {
    const result = await importFromJsonFile(jsonFile(payload({ [QUESTION_BANK]: "{\"state\":{}}" })))

    expect(result.ok).toBe(true)
    expect(result.importedKeys).toEqual([QUESTION_BANK])
    expect(localStorage.getItem(QUESTION_BANK)).toBe("{\"state\":{}}")
  })

  it("payload に含まれないキーには触れない", async () => {
    localStorage.setItem(MOCK_EXAMS, "既存の値")

    await importFromJsonFile(jsonFile(payload({ [QUESTION_BANK]: "新しい値" })))

    expect(localStorage.getItem(MOCK_EXAMS)).toBe("既存の値")
  })

  it("schema が異なるファイルを取り込まない", async () => {
    localStorage.setItem(QUESTION_BANK, "既存の値")

    const result = await importFromJsonFile(
      jsonFile(JSON.stringify({ schema: "別のアプリ", schemaVersion: 1, data: { [QUESTION_BANK]: "汚染" } })),
    )

    expect(result.ok).toBe(false)
    expect(result.error).toBe("JSON 形式が不正です")
    expect(localStorage.getItem(QUESTION_BANK)).toBe("既存の値")
  })

  it("data を持たないファイルを取り込まない", async () => {
    const result = await importFromJsonFile(
      jsonFile(JSON.stringify({ schema: "uscpa-backup", schemaVersion: 1 })),
    )

    expect(result.ok).toBe(false)
    expect(result.importedKeys).toEqual([])
  })

  it("壊れた JSON では既存データを保持したまま失敗を返す", async () => {
    localStorage.setItem(QUESTION_BANK, "既存の値")

    const result = await importFromJsonFile(jsonFile("これはJSONではない"))

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(localStorage.getItem(QUESTION_BANK)).toBe("既存の値")
  })

  it("値が文字列でないキーは取り込まない", async () => {
    const result = await importFromJsonFile(
      jsonFile(payload({ [QUESTION_BANK]: 123 } as unknown as ExportPayload["data"])),
    )

    expect(result.ok).toBe(true)
    expect(result.importedKeys).toEqual([])
    expect(localStorage.getItem(QUESTION_BANK)).toBeNull()
  })

  it("複数キーをまとめて取り込む", async () => {
    const result = await importFromJsonFile(
      jsonFile(payload({ [QUESTION_BANK]: "A", [MOCK_EXAMS]: "B" })),
    )

    expect(result.importedKeys).toEqual([QUESTION_BANK, MOCK_EXAMS])
    expect(localStorage.getItem(MOCK_EXAMS)).toBe("B")
  })
})
