"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { TBSCard } from "@/components/materials/TBSCard";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";
import { farTBSQuestions, getTBSTopics } from "@/data/tbs/far";
import { useTBSBankStore } from "@/stores/tbsBankStore";

type StatusFilter = "all" | "unattempted" | "attempted";
type DifficultyFilter = "all" | "basic" | "intermediate" | "advanced";

const difficultyLabel: Record<string, string> = {
  all: "すべての難易度",
  basic: "基礎",
  intermediate: "標準",
  advanced: "応用",
};

export default function TBSListPage() {
  const [topic, setTopic] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const getTBSScore = useTBSBankStore((s) => s.getTBSScore);
  const attemptedIds = useTBSBankStore((s) => s.getAttemptedTBSIds)();

  const topics = useMemo(() => getTBSTopics(), []);

  const filtered = useMemo(() => {
    return farTBSQuestions.filter((q) => {
      if (topic !== "all" && q.topic !== topic) return false;
      if (difficulty !== "all" && q.difficulty !== difficulty) return false;
      if (status === "unattempted" && attemptedIds.has(q.id)) return false;
      if (status === "attempted" && !attemptedIds.has(q.id)) return false;
      return true;
    });
  }, [topic, difficulty, status, attemptedIds]);

  const totalAttempted = farTBSQuestions.filter((q) =>
    attemptedIds.has(q.id),
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/materials"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-500" />
              FAR TBS 問題バンク
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Task Based Simulation — シナリオ形式の演習問題
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-3 mb-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-600">
            <BookOpen className="h-4 w-4 text-purple-400" />
            <span>全 {farTBSQuestions.length} 問</span>
          </div>
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {totalAttempted} 問完了（
              {farTBSQuestions.length > 0
                ? Math.round((totalAttempted / farTBSQuestions.length) * 100)
                : 0}
              %）
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="トピック" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのトピック</SelectItem>
              {topics.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as DifficultyFilter)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="難易度" />
            </SelectTrigger>
            <SelectContent>
              {(["all", "basic", "intermediate", "advanced"] as const).map(
                (d) => (
                  <SelectItem key={d} value={d}>
                    {difficultyLabel[d]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            {(
              [
                { value: "all", label: "すべて" },
                { value: "unattempted", label: "未挑戦" },
                { value: "attempted", label: "挑戦済み" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStatus(value)}
                className={`px-3 h-8 rounded text-xs font-medium transition-colors ${
                  status === value
                    ? "bg-blue-500 text-white"
                    : "bg-white border text-gray-500 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">条件に一致する問題がありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => (
              <TBSCard
                key={q.id}
                question={q}
                latestScore={getTBSScore(q.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
