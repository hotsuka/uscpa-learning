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

      getAttemptedQuestionIds: () => {
        return new Set(get().attempts.map((a) => a.questionId));
      },

      clearAttempts: () => {
        set({ attempts: [] });
      },
    }),
    {
      name: "uscpa-question-bank",
      version: 5,
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

        return state;
      },
    },
  ),
);
