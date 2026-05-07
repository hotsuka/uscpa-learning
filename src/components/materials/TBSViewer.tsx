"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TBSExhibitPanel } from "./TBSExhibitPanel";
import { TBSTaskPanel } from "./TBSTaskPanel";
import { useTBSBankStore } from "@/stores/tbsBankStore";
import type { TBSQuestion, TBSTaskAttempt, TBSAttempt } from "@/types/tbs";

interface TBSViewerProps {
  question: TBSQuestion;
}

export function TBSViewer({ question }: TBSViewerProps) {
  const [taskAttempts, setTaskAttempts] = useState<TBSTaskAttempt[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [savedAttempt, setSavedAttempt] = useState<TBSAttempt | null>(null);
  const addAttempt = useTBSBankStore((s) => s.addAttempt);

  const handleTaskSubmit = useCallback(
    (
      taskId: string,
      answer: string | number | string[],
      isCorrect: boolean,
    ) => {
      const newAttempt: TBSTaskAttempt = {
        tbsId: question.id,
        taskId,
        userAnswer: answer,
        isCorrect,
        attemptedAt: new Date().toISOString(),
      };

      setTaskAttempts((prev) => {
        const filtered = prev.filter((a) => a.taskId !== taskId);
        return [...filtered, newAttempt];
      });
    },
    [question.id],
  );

  const handleComplete = useCallback(() => {
    const correctCount = taskAttempts.filter((a) => a.isCorrect).length;
    const totalScore = Math.round((correctCount / question.tasks.length) * 100);
    const attempt: TBSAttempt = {
      tbsId: question.id,
      taskAttempts,
      completedAt: new Date().toISOString(),
      totalScore,
    };
    addAttempt(attempt);
    setSavedAttempt(attempt);
    setIsCompleted(true);
  }, [taskAttempts, question, addAttempt]);

  const handleReset = () => {
    setTaskAttempts([]);
    setIsCompleted(false);
    setSavedAttempt(null);
  };

  const allAnswered = taskAttempts.length === question.tasks.length;

  if (isCompleted && savedAttempt) {
    const correctCount = savedAttempt.taskAttempts.filter(
      (a) => a.isCorrect,
    ).length;
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">TBS 完了！</h2>
          <p className="text-gray-500 mt-1">{question.title}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-6 w-full max-w-sm">
          <p className="text-4xl font-bold text-blue-600">
            {savedAttempt.totalScore}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {correctCount} / {question.tasks.length} タスク正解
          </p>
          <div className="mt-4 space-y-2">
            {savedAttempt.taskAttempts
              .slice()
              .sort((a, b) => a.taskId.localeCompare(b.taskId))
              .map((ta) => {
                const task = question.tasks.find((t) => t.id === ta.taskId);
                return (
                  <div
                    key={ta.taskId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-600">
                      {task?.workTab ?? ta.taskId}
                    </span>
                    <span
                      className={
                        ta.isCorrect ? "text-green-600" : "text-red-500"
                      }
                    >
                      {ta.isCorrect ? "正解" : "不正解"}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            再挑戦
          </Button>
          <Link href="/materials/tbs">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-1" />
              問題一覧へ
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-white shrink-0">
        <Link
          href="/materials/tbs"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-sm font-semibold text-gray-800 flex-1 truncate">
          {question.title}
        </h1>
        {allAnswered && (
          <Button size="sm" onClick={handleComplete}>
            完了・採点
          </Button>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 min-w-0 flex flex-col">
          <TBSExhibitPanel
            scenario={question.scenario}
            exhibits={question.exhibits}
          />
        </div>
        <div className="w-1/2 min-w-0 flex flex-col">
          <TBSTaskPanel
            tasks={question.tasks}
            taskAttempts={taskAttempts}
            onTaskSubmit={handleTaskSubmit}
          />
        </div>
      </div>
    </div>
  );
}
