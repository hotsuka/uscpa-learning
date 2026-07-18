"use client";

import { useEffect, type RefObject } from "react";
import { useTimer } from "@/hooks/useTimer";
import type { MiniTimerRef } from "@/components/materials/MiniTimer";

// タイマーの開始/停止(Space)と問題数・正解数の増減(Q/A, Shift+Q/Shift+A)を
// キーボードショートカットで操作する（FAR問題バンクと同じ挙動）
export function useTimerShortcuts(
  miniTimerRef: RefObject<MiniTimerRef | null>,
) {
  const { isRunning, start, pause } = useTimer();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true";

      if (isInputFocused) return;

      // Space: タイマー開始/停止
      if (e.key === " " && e.code === "Space") {
        e.preventDefault();
        if (isRunning) {
          pause();
        } else {
          start();
        }
        return;
      }

      // Q: 問題数を増減
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        if (e.shiftKey) {
          miniTimerRef.current?.decrementQuestions();
        } else {
          miniTimerRef.current?.incrementQuestions();
        }
        return;
      }

      // A: 正解数を増減
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        if (e.shiftKey) {
          miniTimerRef.current?.decrementCorrect();
        } else {
          miniTimerRef.current?.incrementCorrect();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, start, pause, miniTimerRef]);
}
