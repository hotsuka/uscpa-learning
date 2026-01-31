import { describe, it, expect } from "vitest"
import { practiceRecordSchema } from "../validations/practice"
import { noteSchema } from "../validations/note"
import { pomodoroSchema, dailyTargetSchema } from "../validations/settings"

describe("practiceRecordSchema", () => {
  it("有効な過去問記録を受け入れる", () => {
    const input = {
      recordType: "practice" as const,
      subject: "FAR" as const,
      subtopic: "Revenue Recognition (ASC 606)",
      studyMinutes: 60,
      totalQuestions: 30,
      correctAnswers: 24,
      roundNumber: 1,
      chapter: null,
      pageRange: null,
      studiedAt: "2026-01-31",
      memo: null,
    }
    const result = practiceRecordSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it("正解数が問題数を超える場合はエラー", () => {
    const input = {
      recordType: "practice" as const,
      subject: "FAR" as const,
      subtopic: null,
      studyMinutes: 30,
      totalQuestions: 10,
      correctAnswers: 15,
      roundNumber: null,
      chapter: null,
      pageRange: null,
      studiedAt: "2026-01-31",
      memo: null,
    }
    const result = practiceRecordSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it("学習時間が0の場合はエラー", () => {
    const input = {
      recordType: "practice" as const,
      subject: "AUD" as const,
      subtopic: null,
      studyMinutes: 0,
      totalQuestions: 10,
      correctAnswers: 8,
      roundNumber: null,
      chapter: null,
      pageRange: null,
      studiedAt: "2026-01-31",
      memo: null,
    }
    const result = practiceRecordSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it("有効なテキスト復習記録を受け入れる", () => {
    const input = {
      recordType: "textbook" as const,
      subject: "REG" as const,
      subtopic: null,
      studyMinutes: 45,
      totalQuestions: null,
      correctAnswers: null,
      roundNumber: null,
      chapter: "Chapter 3",
      pageRange: "100-150",
      studiedAt: "2026-01-31",
      memo: "税法の基礎を復習",
    }
    const result = practiceRecordSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it("無効な科目はエラー", () => {
    const input = {
      recordType: "practice" as const,
      subject: "INVALID",
      subtopic: null,
      studyMinutes: 30,
      totalQuestions: 10,
      correctAnswers: 8,
      roundNumber: null,
      chapter: null,
      pageRange: null,
      studiedAt: "2026-01-31",
      memo: null,
    }
    const result = practiceRecordSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe("noteSchema", () => {
  it("有効なノートを受け入れる", () => {
    const result = noteSchema.safeParse({
      title: "テストノート",
      content: "ノートの内容",
      subject: "FAR",
      tags: ["tag1", "tag2"],
    })
    expect(result.success).toBe(true)
  })

  it("タイトルが空の場合はエラー", () => {
    const result = noteSchema.safeParse({
      title: "",
      content: "内容",
      subject: null,
      tags: [],
    })
    expect(result.success).toBe(false)
  })

  it("内容が空の場合はエラー", () => {
    const result = noteSchema.safeParse({
      title: "タイトル",
      content: "",
      subject: null,
      tags: [],
    })
    expect(result.success).toBe(false)
  })

  it("科目がnullでも受け入れる", () => {
    const result = noteSchema.safeParse({
      title: "タイトル",
      content: "内容",
      subject: null,
      tags: [],
    })
    expect(result.success).toBe(true)
  })
})

describe("pomodoroSchema", () => {
  it("有効な設定を受け入れる", () => {
    const result = pomodoroSchema.safeParse({
      pomodoroMinutes: 25,
      breakMinutes: 5,
    })
    expect(result.success).toBe(true)
  })

  it("作業時間が5分未満はエラー", () => {
    const result = pomodoroSchema.safeParse({
      pomodoroMinutes: 3,
      breakMinutes: 5,
    })
    expect(result.success).toBe(false)
  })

  it("休憩時間が30分超はエラー", () => {
    const result = pomodoroSchema.safeParse({
      pomodoroMinutes: 25,
      breakMinutes: 35,
    })
    expect(result.success).toBe(false)
  })
})

describe("dailyTargetSchema", () => {
  it("有効な目標時間を受け入れる", () => {
    const result = dailyTargetSchema.safeParse({
      weekdayTargetHours: 3,
      weekendTargetHours: 5,
    })
    expect(result.success).toBe(true)
  })

  it("24時間超はエラー", () => {
    const result = dailyTargetSchema.safeParse({
      weekdayTargetHours: 25,
      weekendTargetHours: 5,
    })
    expect(result.success).toBe(false)
  })
})
