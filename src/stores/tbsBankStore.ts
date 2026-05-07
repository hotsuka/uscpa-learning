import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TBSAttempt } from "@/types/tbs";

interface TBSBankState {
  attempts: TBSAttempt[];
  addAttempt: (attempt: TBSAttempt) => void;
  getAttemptedTBSIds: () => Set<string>;
  getLatestAttempt: (tbsId: string) => TBSAttempt | undefined;
  getTBSScore: (tbsId: string) => number | null;
  getTopicStats: (topic: string) => { total: number; avgScore: number } | null;
  clearAttempts: () => void;
}

export const useTBSBankStore = create<TBSBankState>()(
  persist(
    (set, get) => ({
      attempts: [],

      addAttempt: (attempt) => {
        set((state) => ({ attempts: [...state.attempts, attempt] }));
      },

      getAttemptedTBSIds: () => {
        return new Set(get().attempts.map((a) => a.tbsId));
      },

      getLatestAttempt: (tbsId) => {
        const all = get().attempts.filter((a) => a.tbsId === tbsId);
        if (all.length === 0) return undefined;
        return all[all.length - 1];
      },

      getTBSScore: (tbsId) => {
        const latest = get().getLatestAttempt(tbsId);
        return latest ? latest.totalScore : null;
      },

      getTopicStats: (topic) => {
        const topicAttempts = get().attempts.filter((a) => {
          return a.tbsId.startsWith(
            `far-${topic.toLowerCase().replace(/\s+/g, "-")}`,
          );
        });
        if (topicAttempts.length === 0) return null;
        const avgScore =
          topicAttempts.reduce((sum, a) => sum + a.totalScore, 0) /
          topicAttempts.length;
        return { total: topicAttempts.length, avgScore: Math.round(avgScore) };
      },

      clearAttempts: () => {
        set({ attempts: [] });
      },
    }),
    {
      name: "uscpa-tbs-bank",
      version: 1,
    },
  ),
);
