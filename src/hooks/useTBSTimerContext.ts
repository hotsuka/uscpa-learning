"use client";

import { useEffect } from "react";
import { useTimerStore } from "@/stores/timerStore";

// TBS問題バンクを利用中はタイマーのテーマ（サブトピック）に固定で反映する
// （FAR問題バンクがトピック選択に応じてsetQuestionBankContextするのと同じ仕組み）
export const TBS_TIMER_SUBTOPIC = "Module 9 Task-Based Simulation";

export function useTBSTimerContext() {
  useEffect(() => {
    // TBS問題バンクはFARのみ
    useTimerStore.getState().setQuestionBankContext("FAR", TBS_TIMER_SUBTOPIC);
  }, []);
}
