import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuestionAttempt } from "@/types/questions";

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
        const correct = topicAttempts.filter((a) => a.isCorrect).length;
        return {
          correct,
          total: topicAttempts.length,
          rate: Math.round((correct / topicAttempts.length) * 100),
        };
      },

      getQuestionAttempts: (questionId) => {
        return get().attempts.filter((a) => a.questionId === questionId);
      },

      getTopicStats: () => {
        const stats: Record<
          string,
          { correct: number; total: number; rate: number }
        > = {};
        for (const attempt of get().attempts) {
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
    },
  ),
);
