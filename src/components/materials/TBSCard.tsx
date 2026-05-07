"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText, CheckCircle2, Circle } from "lucide-react";
import type { TBSQuestion } from "@/types/tbs";
import { cn } from "@/lib/utils";

interface TBSCardProps {
  question: TBSQuestion;
  latestScore: number | null;
}

const difficultyLabel: Record<string, string> = {
  basic: "基礎",
  intermediate: "標準",
  advanced: "応用",
};

const difficultyColor: Record<string, string> = {
  basic: "bg-green-100 text-green-800",
  intermediate: "bg-yellow-100 text-yellow-800",
  advanced: "bg-red-100 text-red-800",
};

export function TBSCard({ question, latestScore }: TBSCardProps) {
  const isAttempted = latestScore !== null;

  return (
    <Link href={`/materials/tbs/${question.id}`}>
      <Card className="cursor-pointer transition-all hover:shadow-md hover:border-blue-300">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {question.subject}
                </span>
                <span className="text-xs text-gray-500">{question.topic}</span>
              </div>
              <h3 className="font-medium text-sm leading-snug text-gray-900 line-clamp-2">
                {question.title}
              </h3>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {question.tasks.length} タスク
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  約 {question.estimatedMinutes} 分
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge
                className={cn(
                  "text-xs font-normal",
                  difficultyColor[question.difficulty],
                )}
                variant="outline"
              >
                {difficultyLabel[question.difficulty]}
              </Badge>
              {isAttempted ? (
                <div className="flex items-center gap-1 text-xs font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span
                    className={cn(
                      latestScore! >= 80
                        ? "text-green-600"
                        : latestScore! >= 60
                          ? "text-yellow-600"
                          : "text-red-600",
                    )}
                  >
                    {latestScore}%
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Circle className="h-4 w-4" />
                  未挑戦
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
