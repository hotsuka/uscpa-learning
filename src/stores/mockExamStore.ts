import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FarArea } from "@/data/questions/far/farScope";
import type { MockExamSubject } from "@/lib/mockExam";

export interface MockExamAnswer {
  questionId: string;
  topic: string;
  area: FarArea;
  difficulty: "basic" | "intermediate" | "advanced";
  /** 元ラベル（A〜D）。未回答は null */
  selectedAnswer: string | null;
  /** 元ラベル（A〜D） */
  correctAnswer: string;
  /** 未回答は不正解として扱う */
  isCorrect: boolean;
}

export interface MockExamResult {
  id: string;
  /** 模試の科目。BAR模試の追加（2026-09）より前の結果には無く、それらはFARとして扱う */
  subject?: MockExamSubject;
  startedAt: string;
  finishedAt: string;
  totalQuestions: number;
  correctCount: number;
  /** 正答率（%、四捨五入） */
  score: number;
  areaBreakdown: Record<string, { correct: number; total: number }>;
  difficultyBreakdown: Record<string, { correct: number; total: number }>;
  topicBreakdown: Record<string, { correct: number; total: number }>;
  answers: MockExamAnswer[];
}

/** 科目が記録されていない過去の結果はFAR模試しか存在しなかった時期のもの */
export const getMockExamSubject = (result: MockExamResult): MockExamSubject =>
  result.subject ?? "FAR";

interface MockExamState {
  results: MockExamResult[];
  addResult: (result: MockExamResult) => void;
  deleteResult: (id: string) => void;
}

export const useMockExamStore = create<MockExamState>()(
  persist(
    (set) => ({
      results: [],

      addResult: (result) => {
        set((state) => ({
          results: [result, ...state.results],
        }));
      },

      deleteResult: (id) => {
        set((state) => ({
          results: state.results.filter((r) => r.id !== id),
        }));
      },
    }),
    {
      name: "uscpa-mock-exams",
      version: 1,
    },
  ),
);
