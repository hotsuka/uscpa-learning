"use client";

import { useEffect } from "react";
import { useTimerStore } from "@/stores/timerStore";
import type { TBSSubject } from "@/data/tbs";

// TBS問題バンクを利用中はタイマーの科目とテーマ（サブトピック）を固定で反映する
// （問題バンクがトピック選択に応じてsetQuestionBankContextするのと同じ仕組み）
// FARは既存記録との連続性のため従来のサブトピック名を維持する
export const TBS_TIMER_SUBTOPICS: Record<TBSSubject, string> = {
  FAR: "Module 9 Task-Based Simulation",
  BAR: "Task-Based Simulation",
};

export function useTBSTimerContext(subject: TBSSubject) {
  useEffect(() => {
    useTimerStore
      .getState()
      .setQuestionBankContext(subject, TBS_TIMER_SUBTOPICS[subject]);
  }, [subject]);
}
