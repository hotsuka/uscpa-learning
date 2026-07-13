"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { TBSAnswerForm } from "./TBSAnswerForm";
import type { TBSTask, TBSTaskAttempt } from "@/types/tbs";
import { cn } from "@/lib/utils";

interface TBSTaskPanelProps {
  tasks: TBSTask[];
  taskAttempts: TBSTaskAttempt[];
  onTaskSubmit: (
    taskId: string,
    answer: string | number | string[],
    isCorrect: boolean,
  ) => void;
}

export function TBSTaskPanel({
  tasks,
  taskAttempts,
  onTaskSubmit,
}: TBSTaskPanelProps) {
  const [activeTaskId, setActiveTaskId] = useState(tasks[0]?.id ?? "");

  const activeTask = tasks.find((t) => t.id === activeTaskId);
  const activeAttempt = taskAttempts.find((a) => a.taskId === activeTaskId);
  const isAnswered = !!activeAttempt;

  const answeredCount = taskAttempts.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex overflow-x-auto border-b bg-gray-50 shrink-0">
        {tasks.map((task) => {
          const attempt = taskAttempts.find((a) => a.taskId === task.id);
          return (
            <button
              key={task.id}
              onClick={() => setActiveTaskId(task.id)}
              className={cn(
                "px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1",
                activeTaskId === task.id
                  ? "border-b-2 border-blue-500 text-blue-600 bg-white"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
              )}
            >
              {attempt ? (
                <CheckCircle2
                  className={cn(
                    "h-3 w-3",
                    attempt.isCorrect ? "text-green-500" : "text-red-400",
                  )}
                />
              ) : (
                <Circle className="h-3 w-3 text-gray-300" />
              )}
              {task.workTab}
            </button>
          );
        })}
        <div className="ml-auto px-3 py-2 text-xs text-gray-400 shrink-0">
          {answeredCount}/{tasks.length} 回答済
        </div>
      </div>

      {activeTask && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-gray-900 mb-1">
                {activeTask.title}
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeTask.instruction}
                </ReactMarkdown>
              </div>
            </div>

            <TBSAnswerForm
              key={activeTask.id}
              task={activeTask}
              onSubmit={(answer, isCorrect) =>
                onTaskSubmit(activeTask.id, answer, isCorrect)
              }
              isAnswered={isAnswered}
              userAnswer={activeAttempt?.userAnswer ?? null}
            />

            {isAnswered && (
              <div className="mt-4 rounded-lg border bg-blue-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-800">解説</p>
                <div className="prose prose-sm max-w-none text-blue-900">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeTask.explanationJa}
                  </ReactMarkdown>
                </div>
                {activeTask.references && activeTask.references.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {activeTask.references.map((ref) => (
                      <Badge
                        key={ref}
                        variant="outline"
                        className="text-xs bg-white text-blue-700 border-blue-300"
                      >
                        {ref}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isAnswered && activeTaskId !== tasks[tasks.length - 1]?.id && (
              <button
                onClick={() => {
                  const idx = tasks.findIndex((t) => t.id === activeTaskId);
                  if (idx < tasks.length - 1) {
                    setActiveTaskId(tasks[idx + 1].id);
                  }
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                次のタスクへ →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
