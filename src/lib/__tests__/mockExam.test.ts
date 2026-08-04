import { describe, it, expect } from "vitest"
import {
  buildMockExam,
  countSeenQuestions,
  MOCK_EXAM_QUESTION_COUNT,
} from "@/lib/mockExam"

describe("countSeenQuestions", () => {
  it("questionIdごとの出題回数を集計する", () => {
    const counts = countSeenQuestions([
      { answers: [{ questionId: "a" }, { questionId: "b" }] },
      { answers: [{ questionId: "a" }] },
      {},
    ])
    expect(counts).toEqual({ a: 2, b: 1 })
  })
})

describe("buildMockExam", () => {
  it("50問をArea配分18/17/15で抽出する", () => {
    const entries = buildMockExam()
    expect(entries).toHaveLength(MOCK_EXAM_QUESTION_COUNT)
    const byArea = entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.area] = (acc[e.area] ?? 0) + 1
      return acc
    }, {})
    expect(byArea).toEqual({ I: 18, II: 17, III: 15 })
  })

  it("同一模試内で問題が重複しない", () => {
    const ids = buildMockExam().map((e) => e.question.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("正解ラベルがシャッフル後の選択肢と整合する", () => {
    for (const entry of buildMockExam()) {
      const shuffled = entry.choices.find((c) => c.label === entry.correctAnswer)
      const original = entry.question.choices.find(
        (c) => c.label === entry.question.correctAnswer,
      )
      expect(shuffled?.text).toBe(original?.text)
      expect(entry.shuffledToOriginalLabel[entry.correctAnswer]).toBe(
        entry.question.correctAnswer,
      )
    }
  })

  it("出題履歴を渡すと未出題を優先して重複を抑える", () => {
    const seenCounts: Record<string, number> = {}
    let duplicates = 0
    // 20回分（延べ1000問）を連続で生成し、既出が再出題される回数を数える
    for (let i = 0; i < 20; i++) {
      for (const entry of buildMockExam(seenCounts)) {
        const id = entry.question.id
        if (seenCounts[id]) duplicates++
        seenCounts[id] = (seenCounts[id] ?? 0) + 1
      }
    }
    // 履歴を渡さない従来ロジックでは同条件で約144回の重複が発生する
    expect(duplicates).toBeLessThan(10)
  })

  it("全問が出題済みでも50問を返す", () => {
    const seenCounts: Record<string, number> = {}
    for (const entry of buildMockExam()) seenCounts[entry.question.id] = 1
    // 重みが同値に潰れても抽出が成立すること
    expect(buildMockExam(seenCounts)).toHaveLength(MOCK_EXAM_QUESTION_COUNT)
  })
})
