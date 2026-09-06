import { describe, it, expect } from "vitest"
import {
  getTitleText,
  getRichText,
  getDateString,
  getSelectValue,
  getMultiSelectValues,
} from "./types"

// Notion API は長いテキストを複数チャンクに分割して返すため、結合の挙動を固定する
const chunk = (content: string): { text: { content: string } } => ({ text: { content } })

describe("getTitleText", () => {
  it("複数チャンクを順序どおり結合する", () => {
    expect(getTitleText([chunk("USCPA "), chunk("学習"), chunk("ノート")])).toBe("USCPA 学習ノート")
  })

  it("空配列では空文字を返す", () => {
    expect(getTitleText([])).toBe("")
  })
})

describe("getRichText", () => {
  it("複数チャンクを順序どおり結合する", () => {
    expect(getRichText([chunk("前半"), chunk("後半")])).toBe("前半後半")
  })

  it("空配列では空文字を返す", () => {
    expect(getRichText([])).toBe("")
  })
})

describe("getDateString", () => {
  it("start の日付文字列を取り出す", () => {
    expect(getDateString({ start: "2026-05-11" })).toBe("2026-05-11")
  })

  it("null をそのまま null として返す", () => {
    expect(getDateString(null)).toBeNull()
  })

  it("start が空文字なら null に落とす", () => {
    expect(getDateString({ start: "" })).toBeNull()
  })
})

describe("getSelectValue", () => {
  it("name を取り出す", () => {
    expect(getSelectValue({ name: "FAR" })).toBe("FAR")
  })

  it("null をそのまま null として返す", () => {
    expect(getSelectValue(null)).toBeNull()
  })

  it("name が空文字なら null に落とす", () => {
    expect(getSelectValue({ name: "" })).toBeNull()
  })
})

describe("getMultiSelectValues", () => {
  it("name の配列を取り出す", () => {
    expect(getMultiSelectValues([{ name: "重要" }, { name: "復習" }])).toEqual(["重要", "復習"])
  })

  it("空配列では空配列を返す", () => {
    expect(getMultiSelectValues([])).toEqual([])
  })
})
