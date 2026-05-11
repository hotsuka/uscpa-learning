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
        const latest = Array.from(latestByQuestion.values());
        const correct = latest.filter((a) => a.isCorrect).length;
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
          if (!stats[attempt.topic]) {
            stats[attempt.topic] = { correct: 0, total: 0, rate: 0 };
          }
          stats[attempt.topic].total++;
          if (attempt.isCorrect) stats[attempt.topic].correct++;
        }
        for (const topic of Object.keys(stats)) {
          stats[topic].rate = Math.round(
            (stats[topic].correct / stats[topic].total) * 100,
          );
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
      version: 3,
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
        return state;
      },
    },
  ),
);
