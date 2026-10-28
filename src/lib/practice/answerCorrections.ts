import type { QuestionAttempt } from "@/types/questions";

/**
 * 問題データの正解誤りを直したときの、回答履歴の正誤補正（1問単位）
 *
 * questionBankStore の migrate (v4〜v14) で各端末の localStorage に対して行った補正と同じ内容。
 * 他の端末から取り込んだ回答は migrate を通らないため、取り込み時にこの関数を通して揃える。
 *
 * 各ルールは修正コミットの時刻 (fixedAt) より前の回答にだけ効く。
 * 修正後の回答は正しい正解と比較して保存されているので、触ると正しい不正解を正解に変えてしまう。
 * 時刻で区切るので何度適用しても結果は変わらない（冪等）。
 *
 * migrate v3 の「境界以前の回答しかない設問の isCorrect を null にする」処理は
 * 同じ設問の他の回答に依存するため1件単位では表せず、ここには含めない（各端末で適用済み）。
 */
export interface AnswerCorrection {
  questionId: string;
  /** 修正コミットの時刻。これより前の回答だけを補正する */
  fixedAt: string;
  /** migrate で同じ補正を入れたときの移行元バージョン */
  migratedFromVersion: number;
  apply: (attempt: QuestionAttempt) => QuestionAttempt;
}

export const ANSWER_CORRECTIONS: AnswerCorrection[] = [
  {
    // 選択肢 C・D の重複を解消。正解 A を選んだ回答を正解にする
    questionId: "inv-031",
    fixedAt: "2026-05-20T14:07:35+09:00",
    migratedFromVersion: 4,
    apply: (a) => (a.selectedAnswer === "A" ? { ...a, isCorrect: true } : a),
  },
  {
    // 選択肢 B・D の重複を解消。$80,000 を選んで B に記録された回答を D・正解にする
    questionId: "sc-016",
    fixedAt: "2026-05-21T06:53:07+09:00",
    migratedFromVersion: 5,
    apply: (a) =>
      a.selectedAnswer === "B" && a.isCorrect === false
        ? { ...a, selectedAnswer: "D", isCorrect: true }
        : a,
  },
  {
    // correctAnswer を C から A に訂正
    questionId: "inv-052",
    fixedAt: "2026-05-22T21:33:04+09:00",
    migratedFromVersion: 6,
    apply: (a) =>
      a.selectedAnswer === "A" && a.isCorrect === false
        ? { ...a, isCorrect: true }
        : a,
  },
  {
    // correctAnswer を A から B に訂正
    questionId: "ppe-049",
    fixedAt: "2026-05-23T07:45:56+09:00",
    migratedFromVersion: 7,
    apply: (a) =>
      a.selectedAnswer === "B" && a.isCorrect === false
        ? { ...a, isCorrect: true }
        : a,
  },
  {
    // 正解が選択肢に無く解答不能だったため全回答を正解にする
    questionId: "inv-i-041",
    fixedAt: "2026-05-23T12:03:57+09:00",
    migratedFromVersion: 8,
    apply: (a) => ({ ...a, isCorrect: true }),
  },
  {
    // correctAnswer を B から A に訂正
    questionId: "inv-i-052",
    fixedAt: "2026-05-23T12:20:54+09:00",
    migratedFromVersion: 9,
    apply: (a) =>
      a.selectedAnswer === "A" && a.isCorrect === false
        ? { ...a, isCorrect: true }
        : a,
  },
  {
    // 正解が選択肢に無く解答不能だったため全回答を正解にする
    questionId: "eq-048",
    fixedAt: "2026-05-23T15:08:48+09:00",
    migratedFromVersion: 10,
    apply: (a) => ({ ...a, isCorrect: true }),
  },
  {
    // 解説の表示ラベル依存の記述で誤解を招いたため、不正解を正解 B に統一する
    questionId: "cecl-054",
    fixedAt: "2026-06-01T06:40:30+09:00",
    migratedFromVersion: 11,
    apply: (a) =>
      a.isCorrect === false
        ? { ...a, selectedAnswer: "B", isCorrect: true }
        : a,
  },
  {
    // correctAnswer を C から D に訂正
    questionId: "cce-131",
    fixedAt: "2026-06-29T07:15:27+09:00",
    migratedFromVersion: 12,
    apply: (a) => {
      if (a.selectedAnswer === "D" && a.isCorrect === false) {
        return { ...a, isCorrect: true };
      }
      if (a.selectedAnswer === "C" && a.isCorrect === true) {
        return { ...a, isCorrect: false };
      }
      return a;
    },
  },
  {
    // correctAnswer を B から C に訂正
    questionId: "cce-148",
    fixedAt: "2026-06-29T07:36:10+09:00",
    migratedFromVersion: 13,
    apply: (a) => {
      if (a.selectedAnswer === "C" && a.isCorrect === false) {
        return { ...a, isCorrect: true };
      }
      if (a.selectedAnswer === "B" && a.isCorrect === true) {
        return { ...a, isCorrect: false };
      }
      return a;
    },
  },
];

const correctionsByQuestionId = new Map<string, AnswerCorrection[]>();
for (const c of ANSWER_CORRECTIONS) {
  const list = correctionsByQuestionId.get(c.questionId) ?? [];
  list.push(c);
  correctionsByQuestionId.set(c.questionId, list);
}

/** 1件の回答に、該当する正誤補正をすべて適用する。該当が無ければ同じ参照を返す */
export function applyAnswerCorrections(
  attempt: QuestionAttempt,
): QuestionAttempt {
  const corrections = correctionsByQuestionId.get(attempt.questionId);
  if (!corrections) return attempt;
  const attemptedAt = new Date(attempt.attemptedAt).getTime();
  let result = attempt;
  for (const c of corrections) {
    if (attemptedAt < new Date(c.fixedAt).getTime()) {
      result = c.apply(result);
    }
  }
  return result;
}
