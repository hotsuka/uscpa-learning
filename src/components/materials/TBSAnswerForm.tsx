"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TBSTask, TBSTableCell, TBSAnswerValue } from "@/types/tbs";

interface TBSAnswerFormProps {
  task: TBSTask;
  onSubmit: (answer: TBSAnswerValue, isCorrect: boolean) => void;
  isAnswered: boolean;
  userAnswer: TBSAnswerValue | null;
}

// ASC引用の正規化: 数字以外の区切りをハイフンに統一（"ASC 606-10-32-28" → "606-10-32-28"）
function normalizeCitation(value: string): string {
  return value.replace(/[^0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// テーブルセルの正誤判定（数値は許容誤差つき、文字列は正規化比較）
function checkTableCell(cell: TBSTableCell, rawInput: string): boolean {
  if (typeof cell.correctValue === "number") {
    if (rawInput.trim() === "") return false;
    const tolerance = cell.tolerance ?? 0;
    return Math.abs(Number(rawInput) - cell.correctValue) <= tolerance;
  }
  return (
    rawInput.trim().toLowerCase() === cell.correctValue.trim().toLowerCase()
  );
}

function checkCorrect(task: TBSTask, answer: TBSAnswerValue): boolean {
  if (task.answerType === "table") {
    const cells = task.tableConfig?.cells;
    if (!cells || cells.length === 0) return false;
    const input = answer as Record<string, string>;
    return cells.every((cell) =>
      checkTableCell(cell, input[`${cell.rowLabel}__${cell.colLabel}`] ?? ""),
    );
  }

  const correct = task.correctAnswer;
  if (correct === undefined) return false;

  if (task.answerType === "number") {
    const tolerance = task.tolerance ?? 0;
    return Math.abs(Number(answer) - Number(correct)) <= tolerance;
  }
  if (task.answerType === "multiselect") {
    const a = [...(answer as string[])].sort();
    const c = [...(correct as string[])].sort();
    return JSON.stringify(a) === JSON.stringify(c);
  }
  if (task.answerType === "research") {
    return (
      normalizeCitation(String(answer)) === normalizeCitation(String(correct))
    );
  }
  return String(answer) === String(correct);
}

export function TBSAnswerForm({
  task,
  onSubmit,
  isAnswered,
  userAnswer,
}: TBSAnswerFormProps) {
  const [numberInput, setNumberInput] = useState(
    isAnswered && task.answerType === "number" ? String(userAnswer ?? "") : "",
  );
  const [selectInput, setSelectInput] = useState(
    isAnswered && task.answerType === "select" ? String(userAnswer ?? "") : "",
  );
  const [researchInput, setResearchInput] = useState(
    isAnswered && task.answerType === "research"
      ? String(userAnswer ?? "")
      : "",
  );
  const [multiInput, setMultiInput] = useState<string[]>(
    isAnswered && task.answerType === "multiselect"
      ? ((userAnswer as string[]) ?? [])
      : [],
  );
  const [tableInput, setTableInput] = useState<Record<string, string>>(() => {
    if (isAnswered && task.answerType === "table" && userAnswer) {
      return userAnswer as Record<string, string>;
    }
    const init: Record<string, string> = {};
    task.tableConfig?.cells.forEach((cell) => {
      init[`${cell.rowLabel}__${cell.colLabel}`] = "";
    });
    return init;
  });

  const isCorrect =
    isAnswered && userAnswer !== null ? checkCorrect(task, userAnswer) : null;

  const handleSubmit = () => {
    let answer: TBSAnswerValue;
    if (task.answerType === "number") {
      answer = Number(numberInput);
    } else if (task.answerType === "select") {
      answer = selectInput;
    } else if (task.answerType === "research") {
      answer = researchInput;
    } else if (task.answerType === "multiselect") {
      answer = multiInput;
    } else {
      answer = tableInput;
    }
    const correct = checkCorrect(task, answer);
    onSubmit(answer, correct);
  };

  const canSubmit = (() => {
    if (task.answerType === "number") return numberInput.trim() !== "";
    if (task.answerType === "select") return selectInput !== "";
    if (task.answerType === "research") return researchInput.trim() !== "";
    if (task.answerType === "multiselect") return multiInput.length > 0;
    return Object.values(tableInput).every((v) => v.trim() !== "");
  })();

  return (
    <div className="space-y-4">
      {task.answerType === "number" && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            金額を入力（ドル単位、カンマなし）
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">$</span>
            <Input
              type="number"
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              placeholder="例: 48000"
              disabled={isAnswered}
              className="max-w-48"
            />
          </div>
        </div>
      )}

      {task.answerType === "select" && task.options && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            最も適切なものを選択してください
          </label>
          <Select
            value={selectInput}
            onValueChange={setSelectInput}
            disabled={isAnswered}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {task.options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {task.answerType === "research" && (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            該当するASC引用を入力（例: 606-10-32-28）
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">ASC</span>
            <Input
              type="text"
              value={researchInput}
              onChange={(e) => setResearchInput(e.target.value)}
              placeholder="例: 606-10-32-28"
              disabled={isAnswered}
              className="max-w-64"
            />
          </div>
        </div>
      )}

      {task.answerType === "multiselect" && task.options && (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">
            該当するものをすべて選択してください
          </label>
          {task.options.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`opt-${opt}`}
                checked={multiInput.includes(opt)}
                disabled={isAnswered}
                onChange={(e) => {
                  setMultiInput((prev) =>
                    e.target.checked
                      ? [...prev, opt]
                      : prev.filter((v) => v !== opt),
                  );
                }}
                className="h-4 w-4 accent-blue-600"
              />
              <label
                htmlFor={`opt-${opt}`}
                className="text-sm cursor-pointer leading-snug"
              >
                {opt}
              </label>
            </div>
          ))}
        </div>
      )}

      {task.answerType === "table" && task.tableConfig && (
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse w-full">
            <thead>
              <tr>
                <th className="border px-2 py-1 bg-gray-50 text-xs text-left w-32">
                  項目
                </th>
                {task.tableConfig.columns.map((col) => (
                  <th
                    key={col}
                    className="border px-2 py-1 bg-gray-50 text-xs text-center"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {task.tableConfig.rows.map((row) => (
                <tr key={row}>
                  <td className="border px-2 py-1 text-xs font-medium bg-gray-50">
                    {row}
                  </td>
                  {task.tableConfig!.columns.map((col) => {
                    const key = `${row}__${col}`;
                    const cell = task.tableConfig!.cells.find(
                      (c) => c.rowLabel === row && c.colLabel === col,
                    );
                    if (!cell) {
                      return (
                        <td key={col} className="border px-1 py-1">
                          <span className="text-gray-300 text-center block">
                            —
                          </span>
                        </td>
                      );
                    }
                    const cellCorrect =
                      isAnswered && checkTableCell(cell, tableInput[key] ?? "");
                    return (
                      <td key={col} className="border px-1 py-1">
                        <Input
                          type={
                            typeof cell.correctValue === "number"
                              ? "number"
                              : "text"
                          }
                          value={tableInput[key] ?? ""}
                          onChange={(e) =>
                            setTableInput((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          disabled={isAnswered}
                          className={cn(
                            "h-7 text-xs text-right",
                            isAnswered &&
                              (cellCorrect
                                ? "border-green-500 bg-green-50"
                                : "border-red-400 bg-red-50"),
                          )}
                        />
                        {isAnswered && !cellCorrect && (
                          <span className="block text-right text-xs text-red-600 mt-0.5 pr-1">
                            正解:{" "}
                            {typeof cell.correctValue === "number"
                              ? cell.correctValue.toLocaleString()
                              : cell.correctValue}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isAnswered && (
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="sm"
          className="mt-2"
        >
          回答する
        </Button>
      )}

      {isAnswered && isCorrect !== null && (
        <div
          className={`flex items-center gap-2 text-sm font-medium ${isCorrect ? "text-green-600" : "text-red-600"}`}
        >
          {isCorrect ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> 正解
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" /> 不正解
              {task.answerType === "number" && (
                <span className="font-normal text-gray-500 ml-2">
                  （正解: ${Number(task.correctAnswer).toLocaleString()}）
                </span>
              )}
              {task.answerType === "research" && (
                <span className="font-normal text-gray-500 ml-2">
                  （正解: ASC {String(task.correctAnswer)}）
                </span>
              )}
              {(task.answerType === "select" ||
                task.answerType === "multiselect") && (
                <span className="font-normal text-gray-500 ml-2">
                  （正解: {String(task.correctAnswer)}）
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
