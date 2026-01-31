import { describe, it, expect } from "vitest"
import { isHoliday, getHolidayName, isWeekend, isWeekdayWithHoliday, countWeekDays } from "../holidays"

describe("isHoliday", () => {
  it("祝日を正しく判定する", () => {
    expect(isHoliday(new Date(2026, 0, 1))).toBe(true) // 元日
    expect(isHoliday(new Date(2026, 0, 12))).toBe(true) // 成人の日
    expect(isHoliday(new Date(2026, 1, 11))).toBe(true) // 建国記念の日
  })

  it("祝日でない日はfalseを返す", () => {
    expect(isHoliday(new Date(2026, 0, 2))).toBe(false)
    expect(isHoliday(new Date(2026, 0, 5))).toBe(false)
  })
})

describe("getHolidayName", () => {
  it("祝日名を返す", () => {
    expect(getHolidayName(new Date(2026, 0, 1))).toBe("元日")
    expect(getHolidayName(new Date(2026, 0, 12))).toBe("成人の日")
  })

  it("祝日でない場合はnullを返す", () => {
    expect(getHolidayName(new Date(2026, 0, 2))).toBeNull()
  })
})

describe("isWeekend", () => {
  it("土曜日をtrueと判定する", () => {
    expect(isWeekend(new Date(2026, 0, 31))).toBe(true) // 2026/1/31 土曜
  })

  it("日曜日をtrueと判定する", () => {
    expect(isWeekend(new Date(2026, 1, 1))).toBe(true) // 2026/2/1 日曜
  })

  it("平日をfalseと判定する", () => {
    expect(isWeekend(new Date(2026, 0, 26))).toBe(false) // 2026/1/26 月曜
    expect(isWeekend(new Date(2026, 0, 28))).toBe(false) // 2026/1/28 水曜
  })
})

describe("isWeekdayWithHoliday", () => {
  it("平日の祝日を休日として扱う", () => {
    // 2026/2/11 は水曜日で建国記念の日
    expect(isWeekdayWithHoliday(new Date(2026, 1, 11), true)).toBe(false)
  })

  it("treatHolidayAsWeekend=falseなら祝日でも平日", () => {
    expect(isWeekdayWithHoliday(new Date(2026, 1, 11), false)).toBe(true)
  })

  it("通常の平日はtrue", () => {
    expect(isWeekdayWithHoliday(new Date(2026, 0, 26))).toBe(true) // 月曜
  })

  it("週末はfalse", () => {
    expect(isWeekdayWithHoliday(new Date(2026, 0, 31))).toBe(false) // 土曜
  })
})

describe("countWeekDays", () => {
  it("祝日のない週を正しくカウントする", () => {
    // 2026/1/26（月曜）〜 2/1（日曜）: 祝日なし
    const result = countWeekDays(new Date(2026, 0, 26))
    expect(result.weekdays).toBe(5)
    expect(result.weekends).toBe(2)
    expect(result.holidays).toBe(0)
    expect(result.totalWorkDays).toBe(5)
    expect(result.totalRestDays).toBe(2)
  })

  it("祝日のある週を正しくカウントする", () => {
    // 2026/2/9（月曜）〜 2/15（日曜）: 2/11 建国記念の日
    const result = countWeekDays(new Date(2026, 1, 9))
    expect(result.weekdays).toBe(5)
    expect(result.weekends).toBe(2)
    expect(result.holidays).toBe(1)
    expect(result.totalWorkDays).toBe(4)
    expect(result.totalRestDays).toBe(3)
  })
})
