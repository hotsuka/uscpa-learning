import { describe, it, expect } from "vitest"
import { ANSWER_CORRECTIONS, applyAnswerCorrections } from "./answerCorrections"
import { farQuestionSets } from "@/data/questions/far"
import type { QuestionAttempt } from "@/types/questions"

const attempt = (overrides: Partial<QuestionAttempt> & { questionId: string; attemptedAt: string }): QuestionAttempt => ({
  topic: "Inventory",
  selectedAnswer: "A",
  isCorrect: false,
  ...overrides,
})

describe("applyAnswerCorrections", () => {
  it("修正より前の回答を migrate と同じ内容で補正する", () => {
    expect(
      applyAnswerCorrections(
        attempt({ questionId: "sc-016", selectedAnswer: "B", attemptedAt: "2026-05-15T00:00:00.000Z" }),
      ),
    ).toMatchObject({ selectedAnswer: "D", isCorrect: true })

    expect(
      applyAnswerCorrections(
        attempt({ questionId: "cce-131", selectedAnswer: "C", isCorrect: true, attemptedAt: "2026-06-01T00:00:00.000Z" }),
      ).isCorrect,
    ).toBe(false)
  })

  it("修正より後の回答は触らない（修正後のBは正しく不正解）", () => {
    const after = attempt({ questionId: "sc-016", selectedAnswer: "B", attemptedAt: "2026-05-22T00:00:00.000Z" })
    expect(applyAnswerCorrections(after)).toBe(after)

    const afterAllCorrect = attempt({ questionId: "eq-048", selectedAnswer: "C", attemptedAt: "2026-06-01T00:00:00.000Z" })
    expect(applyAnswerCorrections(afterAllCorrect).isCorrect).toBe(false)
  })

  it("何度かけても結果は変わらない", () => {
    for (const c of ANSWER_CORRECTIONS) {
      for (const label of ["A", "B", "C", "D"]) {
        for (const isCorrect of [true, false, null]) {
          const a = attempt({
            questionId: c.questionId,
            selectedAnswer: label,
            isCorrect,
            attemptedAt: "2026-05-01T00:00:00.000Z",
          })
          const once = applyAnswerCorrections(a)
          expect(applyAnswerCorrections(once)).toEqual(once)
        }
      }
    }
  })

  it("補正で正解になるのは問題データの現在の正解だけ（解答不能だった問題を除く）", () => {
    const answerMap = new Map<string, string>()
    for (const s of farQuestionSets) for (const q of s.questions) answerMap.set(q.id, q.correctAnswer)
    // 正解が選択肢に無く、全回答を正解にした問題
    const allCorrect = new Set(["inv-i-041", "eq-048"])

    for (const c of ANSWER_CORRECTIONS) {
      expect(answerMap.has(c.questionId)).toBe(true)
      if (allCorrect.has(c.questionId)) continue
      for (const label of ["A", "B", "C", "D"]) {
        const fixed = applyAnswerCorrections(
          attempt({ questionId: c.questionId, selectedAnswer: label, isCorrect: false, attemptedAt: "2026-05-01T00:00:00.000Z" }),
        )
        if (fixed.isCorrect === true) expect(fixed.selectedAnswer).toBe(answerMap.get(c.questionId))
      }
    }
  })

  it("補正対象でない問題は同じ参照を返す", () => {
    const a = attempt({ questionId: "reg-ind-001", attemptedAt: "2026-05-01T00:00:00.000Z" })
    expect(applyAnswerCorrections(a)).toBe(a)
  })
})
