import { describe, it, expect } from "vitest"
import { formatTime, formatMinutes, formatDate, calculateAccuracy, generateUUID } from "../utils"

describe("formatTime", () => {
  it("秒数を MM:SS 形式にフォーマットする", () => {
    expect(formatTime(0)).toBe("00:00")
    expect(formatTime(59)).toBe("00:59")
    expect(formatTime(60)).toBe("01:00")
    expect(formatTime(125)).toBe("02:05")
  })

  it("1時間以上の場合は HH:MM:SS 形式になる", () => {
    expect(formatTime(3600)).toBe("01:00:00")
    expect(formatTime(3661)).toBe("01:01:01")
    expect(formatTime(7200)).toBe("02:00:00")
    expect(formatTime(36000)).toBe("10:00:00")
  })
})

describe("formatMinutes", () => {
  it("分数を適切なフォーマットに変換する", () => {
    expect(formatMinutes(0)).toBe("0m")
    expect(formatMinutes(30)).toBe("30m")
    expect(formatMinutes(59)).toBe("59m")
  })

  it("60分以上は時間と分で表示する", () => {
    expect(formatMinutes(60)).toBe("1h")
    expect(formatMinutes(90)).toBe("1h 30m")
    expect(formatMinutes(120)).toBe("2h")
    expect(formatMinutes(150)).toBe("2h 30m")
  })
})

describe("formatDate", () => {
  it("Date オブジェクトを YYYY/MM/DD に変換する", () => {
    expect(formatDate(new Date(2026, 0, 31))).toBe("2026/01/31")
    expect(formatDate(new Date(2026, 11, 1))).toBe("2026/12/01")
  })

  it("文字列の日付も処理できる", () => {
    expect(formatDate("2026-01-15T00:00:00.000Z")).toBe("2026/01/15")
  })
})

describe("calculateAccuracy", () => {
  it("正答率を正しく計算する", () => {
    expect(calculateAccuracy(8, 10)).toBe(80)
    expect(calculateAccuracy(3, 10)).toBe(30)
    expect(calculateAccuracy(10, 10)).toBe(100)
    expect(calculateAccuracy(0, 10)).toBe(0)
  })

  it("問題数0の場合は0を返す", () => {
    expect(calculateAccuracy(0, 0)).toBe(0)
  })

  it("端数を四捨五入する", () => {
    expect(calculateAccuracy(1, 3)).toBe(33)
    expect(calculateAccuracy(2, 3)).toBe(67)
  })
})

describe("generateUUID", () => {
  it("UUID形式の文字列を返す", () => {
    const uuid = generateUUID()
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it("毎回異なる値を返す", () => {
    const uuid1 = generateUUID()
    const uuid2 = generateUUID()
    expect(uuid1).not.toBe(uuid2)
  })
})
