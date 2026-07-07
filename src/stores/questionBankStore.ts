import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuestionAttempt } from "@/types/questions";
import { farQuestionSets } from "@/data/questions/far";
import { backupBeforeMigrate } from "@/lib/backup/utils";

interface QuestionBankState {
  attempts: QuestionAttempt[];
  addAttempt: (attempt: QuestionAttempt) => void;
  getTopicAccuracy: (topic: string) => {
    correct: number;
    total: number;
    rate: number;
  };
  getQuestionAttempts: (questionId: string) => QuestionAttempt[];
  getTopicStats: () => Record<
    string,
    { correct: number; total: number; rate: number }
  >;
  getFirstAttemptStats: () => Record<
    string,
    { correct: number; total: number; rate: number }
  >;
  getAttemptedQuestionIds: () => Set<string>;
  clearAttempts: () => void;
}

export const useQuestionBankStore = create<QuestionBankState>()(
  persist(
    (set, get) => ({
      attempts: [],

      addAttempt: (attempt) => {
        set((state) => ({
          attempts: [...state.attempts, attempt],
        }));
      },

      getTopicAccuracy: (topic) => {
        const topicAttempts = get().attempts.filter((a) => a.topic === topic);
        if (topicAttempts.length === 0)
          return { correct: 0, total: 0, rate: 0 };
        const latestByQuestion = new Map<string, (typeof topicAttempts)[0]>();
        for (const a of topicAttempts) {
          const existing = latestByQuestion.get(a.questionId);
          if (
            !existing ||
            new Date(a.attemptedAt) > new Date(existing.attemptedAt)
          ) {
            latestByQuestion.set(a.questionId, a);
          }
        }
        // 正誤不明(null)は分母から除外
        const latest = Array.from(latestByQuestion.values()).filter(
          (a) => a.isCorrect !== null,
        );
        if (latest.length === 0) return { correct: 0, total: 0, rate: 0 };
        const correct = latest.filter((a) => a.isCorrect === true).length;
        return {
          correct,
          total: latest.length,
          rate: Math.round((correct / latest.length) * 100),
        };
      },

      getQuestionAttempts: (questionId) => {
        return get().attempts.filter((a) => a.questionId === questionId);
      },

      getTopicStats: () => {
        const allAttempts = get().attempts;
        const latestByQuestion = new Map<string, (typeof allAttempts)[0]>();
        for (const a of allAttempts) {
          const existing = latestByQuestion.get(a.questionId);
          if (
            !existing ||
            new Date(a.attemptedAt) > new Date(existing.attemptedAt)
          ) {
            latestByQuestion.set(a.questionId, a);
          }
        }

        const stats: Record<
          string,
          { correct: number; total: number; rate: number }
        > = {};
        for (const attempt of latestByQuestion.values()) {
          // 正誤不明(null)は分母にカウントしない
          if (attempt.isCorrect === null) continue;
          if (!stats[attempt.topic]) {
            stats[attempt.topic] = { correct: 0, total: 0, rate: 0 };
          }
          stats[attempt.topic].total++;
          if (attempt.isCorrect === true) stats[attempt.topic].correct++;
        }
        for (const topic of Object.keys(stats)) {
          stats[topic].rate =
            stats[topic].total > 0
              ? Math.round((stats[topic].correct / stats[topic].total) * 100)
              : 0;
        }
        return stats;
      },

      // 初見正答率: 各問題の「最初の解答」のみで集計する（解き直しで上書きされないため実力の目安になる）
      // キーは QuestionSet.topic（個別問題の topic がセットの topic と異なるケースを正規化）
      getFirstAttemptStats: () => {
        const setTopicByQuestionId = new Map<string, string>();
        for (const s of farQuestionSets) {
          for (const q of s.questions) {
            setTopicByQuestionId.set(q.id, s.topic);
          }
        }

        const firstByQuestion = new Map<string, QuestionAttempt>();
        for (const a of get().attempts) {
          // 正誤不明(null)は初見判定・分母の両方から除外
          if (a.isCorrect === null) continue;
          const existing = firstByQuestion.get(a.questionId);
          if (
            !existing ||
            new Date(a.attemptedAt) < new Date(existing.attemptedAt)
          ) {
            firstByQuestion.set(a.questionId, a);
          }
        }

        const stats: Record<
          string,
          { correct: number; total: number; rate: number }
        > = {};
        for (const attempt of firstByQuestion.values()) {
          const topic =
            setTopicByQuestionId.get(attempt.questionId) ?? attempt.topic;
          if (!stats[topic]) {
            stats[topic] = { correct: 0, total: 0, rate: 0 };
          }
          stats[topic].total++;
          if (attempt.isCorrect === true) stats[topic].correct++;
        }
        for (const topic of Object.keys(stats)) {
          stats[topic].rate =
            stats[topic].total > 0
              ? Math.round((stats[topic].correct / stats[topic].total) * 100)
              : 0;
        }
        return stats;
      },

      getAttemptedQuestionIds: () => {
        return new Set(get().attempts.map((a) => a.questionId));
      },

      clearAttempts: () => {
        set({ attempts: [] });
      },
    }),
    {
      name: "uscpa-question-bank",
      version: 14,
      migrate: (persisted, version) => {
        // 破壊的処理の前に現在の localStorage 値を退避する
        backupBeforeMigrate("uscpa-question-bank", version);
        const state = persisted as { attempts: QuestionAttempt[] };
        // 問題データの正解が変更された場合に isCorrect を再計算する共通処理
        // 注意: selectedAnswer はシャッフル前の元ラベルで保存されている前提（v3以降）
        const recalculate = () => {
          const answerMap = new Map<string, string>();
          for (const set of farQuestionSets) {
            for (const q of set.questions) {
              answerMap.set(q.id, q.correctAnswer);
            }
          }
          state.attempts = state.attempts.map((a) => {
            const correct = answerMap.get(a.questionId);
            if (correct) {
              return { ...a, isCorrect: a.selectedAnswer === correct };
            }
            return a;
          });
        };
        if (version === 0) recalculate();
        if (version === 1) recalculate();
        // v2: selectedAnswer がシャッフル後ラベルで保存されていたため recalculate 不可
        // v2→v3 はデータをそのまま保持（ユーザーが解き直すと正しいデータに更新される）

        // v3→v4: バグ混入コミット (073a2bb, 2026-05-11T07:28:48+09:00) 以前の
        // attempts は recalculate により isCorrect が信頼できない状態にあるため、
        // 「設問単位」で境界以降の回答が1件もない場合は isCorrect=null にリセットする。
        // 解答済みフラグ自体は保持（UI で「解答済み・正誤不明」として表示）。
        if (version === 3) {
          const BOUNDARY = new Date("2026-05-11T07:28:48+09:00").getTime();
          // questionId ごとに「境界以降の attempt が1件でもあるか」を判定
          const hasTrustedAttempt = new Set<string>();
          for (const a of state.attempts) {
            if (new Date(a.attemptedAt).getTime() >= BOUNDARY) {
              hasTrustedAttempt.add(a.questionId);
            }
          }
          state.attempts = state.attempts.map((a) => {
            if (hasTrustedAttempt.has(a.questionId)) return a;
            // 境界より前の回答しかない設問 → isCorrect をリセット
            return { ...a, isCorrect: null };
          });
        }

        // v4→v5: inv-031 の選択肢バグ（C・D が $75,000 に重複）修正に伴い、
        // selectedAnswer="A" かつ isCorrect=false の attempt を正解に補正する。
        // シャッフルマップのバグで B 選択が A に変換されて保存されていたため。
        if (version === 4) {
          const answerMap = new Map<string, string>();
          for (const set of farQuestionSets) {
            for (const q of set.questions) {
              answerMap.set(q.id, q.correctAnswer);
            }
          }
          state.attempts = state.attempts.map((a) => {
            if (a.questionId !== "inv-031") return a;
            const correct = answerMap.get("inv-031");
            if (correct && a.selectedAnswer === correct) {
              return { ...a, isCorrect: true };
            }
            return a;
          });
        }

        // v5→v6: sc-016 の選択肢バグ（B・D が共に $80,000 に重複）修正に伴い、
        // selectedAnswer="B" の attempt を "D" に補正し正解扱いにする。
        // ユーザーは正解値 $80,000 を選んでいたが、シャッフルにより重複側の B に
        // マッピングされ不正解として記録されていたため。
        if (version === 5) {
          state.attempts = state.attempts.map((a) => {
            if (a.questionId !== "sc-016") return a;
            if (a.selectedAnswer === "B" && a.isCorrect === false) {
              return { ...a, selectedAnswer: "D", isCorrect: true };
            }
            return a;
          });
        }

        // v6→v7: inv-052 の correctAnswer バグ（"C" $65,000 → 正解は "A" $85,000）修正に伴い、
        // selectedAnswer="A" かつ isCorrect=false の attempt を正解に補正する。
        // $85,000（元ラベルA）を選んだ回答が誤った correctAnswer="C" との比較で不正解に記録されていたため。
        if (version === 6) {
          state.attempts = state.attempts.map((a) => {
            if (a.questionId !== "inv-052") return a;
            if (a.selectedAnswer === "A" && a.isCorrect === false) {
              return { ...a, isCorrect: true };
            }
            return a;
          });
        }

        // v7→v8: ppe-049 の correctAnswer バグ（"A" $40,000 → 正解は "B" $36,000）修正に伴い、
        // selectedAnswer="B" かつ isCorrect=false の attempt を正解に補正する。
        if (version === 7) {
          state.attempts = state.attempts.map((a) => {
            if (a.questionId !== "ppe-049") return a;
            if (a.selectedAnswer === "B" && a.isCorrect === false) {
              return { ...a, isCorrect: true };
            }
            return a;
          });
        }

        // v8→v9: inv-i-041 の選択肢バグ（正解 $42,000 が選択肢に存在しなかった）修正に伴い、
        // 問題自体が解答不能だったため、この設問への全回答を正解に補正する。
        if (version === 8) {
          state.attempts = state.attempts.map((a) => {
            if (a.questionId !== "inv-i-041") return a;
            return { ...a, isCorrect: true };
          });
        }

        // v9→v10: inv-i-052 の correctAnswer バグ（"B" $500 → 正解は "A" $440）修正に伴い、
        // selectedAnswer="A" かつ isCorrect=false の attempt を正解に補正する。
        if (version === 9) {
          state.attempts = state.attempts.map((a) => {
            if (a.questionId !== "inv-i-052") return a;
            if (a.selectedAnswer === "A" && a.isCorrect === false) {
              return { ...a, isCorrect: true };
            }
            return a;
          });
        }

        // v10→v11: eq-048 の選択肢バグ（正解 $3.86 が選択肢に存在しなかった）修正に伴い、
        // 問題自体が解答不能だったため、この設問への全回答を正解に補正する。
        if (version === 10) {
          state.attempts = state.attempts.map((a) => {
            if (a.questionId !== "eq-048") return a;
            return { ...a, isCorrect: true };
          });
        }

        // v11→v12: cecl-054 の解説末尾に "The answer is B." と記載されていたが、
        // シャッフルにより表示上の B が $350,000 になる場合があり誤解を招いていた。
        // (JSON 上 correctAnswer="B"=$320,000 は正しいが、表示 B と混同されうる)
        // isCorrect=false の attempt を正解補正し、selectedAnswer も正解ラベル "B" に統一する。
        if (version === 11) {
          state.attempts = state.attempts.map((a) => {
            if (a.questionId !== "cecl-054") return a;
            if (a.isCorrect === false) {
              return { ...a, selectedAnswer: "B", isCorrect: true };
            }
            return a;
          });
        }

        // v12→v13: cce-131 の correctAnswer バグ（"C" 88日 → 正解は "D" 95日）修正に伴い、
        // 平均在庫ベースの95日を選んだ回答を正解に、期末在庫ベースの88日を不正解に補正する。
        if (version === 12) {
          state.attempts = state.attempts.map((a) => {
            if (a.questionId !== "cce-131") return a;
            if (a.selectedAnswer === "D" && a.isCorrect === false) {
              return { ...a, isCorrect: true };
            }
            if (a.selectedAnswer === "C" && a.isCorrect === true) {
              return { ...a, isCorrect: false };
            }
            return a;
          });
        }

        // v13→v14: cce-148 の correctAnswer バグ（"B" Decreased both → 正解は "C" Increased current/Decreased quick）修正。
        // 比率>1なら同額減少で比率上昇、<1なら低下。selectedAnswer="C"を正解に、"B"を不正解に補正。
        if (version === 13) {
          state.attempts = state.attempts.map((a) => {
            if (a.questionId !== "cce-148") return a;
            if (a.selectedAnswer === "C" && a.isCorrect === false) {
              return { ...a, isCorrect: true };
            }
            if (a.selectedAnswer === "B" && a.isCorrect === true) {
              return { ...a, isCorrect: false };
            }
            return a;
          });
        }

        return state;
      },
    },
  ),
);
