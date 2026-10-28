"use client";

import { useEffect } from "react";
import { useQuestionBankStore } from "@/stores/questionBankStore";
import { useTBSBankStore } from "@/stores/tbsBankStore";
import { useMockExamStore } from "@/stores/mockExamStore";
import {
  PUSH_AFTER_ANSWER_DELAY_MS,
  isAutoSyncDue,
  readAutoSyncStatus,
  runPracticeLogAutoSync,
} from "@/lib/sync/practiceLogAutoSync";

/**
 * 問題演習ログ（回答・TBS・模試）をNotionと自動で同期するフック
 * - 起動時・画面に戻ったとき: 前回から5分以上空いていれば取り込み→送信
 * - オンライン復帰時: 取り込み→送信
 * - 回答した後: 最後の回答から30秒後に送信だけ
 */
export function usePracticeLogAutoSync() {
  useEffect(() => {
    const syncIfDue = () => {
      if (isAutoSyncDue(readAutoSyncStatus())) {
        void runPracticeLogAutoSync({ pull: true });
      }
    };
    const handleOnline = () => {
      void runPracticeLogAutoSync({ pull: true });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncIfDue();
    };

    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePush = () => {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        pushTimer = null;
        void runPracticeLogAutoSync({ pull: false });
      }, PUSH_AFTER_ANSWER_DELAY_MS);
    };
    // 取り込みで増えた分も通知されるが、取り込み分は送らないので送信は空振りで終わる
    const unsubscribes = [
      useQuestionBankStore.subscribe((state, prev) => {
        if (state.attempts !== prev.attempts) schedulePush();
      }),
      useTBSBankStore.subscribe((state, prev) => {
        if (state.attempts !== prev.attempts) schedulePush();
      }),
      useMockExamStore.subscribe((state, prev) => {
        if (state.results !== prev.results) schedulePush();
      }),
    ];

    syncIfDue();
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      for (const unsubscribe of unsubscribes) unsubscribe();
      if (pushTimer) clearTimeout(pushTimer);
    };
  }, []);
}
