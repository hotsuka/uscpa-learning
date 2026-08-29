"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MarkdownPreview } from "@/components/notes/MarkdownPreview"
import { QuestionStem } from "@/components/materials/QuestionStem";
import { getQuestionById } from "@/data/questions/far"
import { MOCK_EXAM_TARGET_RATE } from "@/lib/mockExam"
import type { MockExamAnswer, MockExamResult } from "@/stores/mockExamStore"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react"

const AREA_LABELS: Record<string, string> = {
  I: "Area I 財務報告",
  II: "Area II B/S項目",
  III: "Area III 個別取引",
}

const DIFFICULTY_LABELS: Record<string, string> = {
  basic: "基礎",
  intermediate: "標準",
  advanced: "応用",
}

// 内訳テーブル（Area別・難易度別・テーマ別で共用）
function BreakdownTable({
  title,
  rows,
}: {
  title: string
  rows: { label: string; correct: number; total: number }[]
}) {
  return (
    <div>
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const rate = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0
          return (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="truncate flex-1">{row.label}</span>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      rate >= MOCK_EXAM_TARGET_RATE
                        ? "bg-green-500"
                        : rate >= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
                <span className="w-20 text-right text-muted-foreground text-xs">
                  {row.correct}/{row.total}問 {rate}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 誤答・未回答問題のレビュー（元ラベルの選択肢で表示するため解説のラベルと整合する）
function WrongAnswerReview({ answer }: { answer: MockExamAnswer }) {
  const [open, setOpen] = useState(false)
  const question = getQuestionById(answer.questionId)

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-3 text-left text-sm hover:bg-muted/50 transition-colors"
      >
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        <Badge variant="outline" className="text-xs font-mono shrink-0">
          {answer.questionId.toUpperCase()}
        </Badge>
        <span className="truncate flex-1 text-muted-foreground">
          {question?.subtopic ?? answer.topic}
          {answer.selectedAnswer === null && "（未回答）"}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0" />
        )}
      </button>
      {open &&
        (question ? (
          <div className="p-4 border-t space-y-3">
            <div className="text-sm leading-relaxed">
              <QuestionStem content={question.stem} figure={question.figure} />
            </div>
            <div className="space-y-1.5">
              {question.choices.map((choice) => {
                const isCorrectChoice = choice.label === answer.correctAnswer
                const isSelected = choice.label === answer.selectedAnswer
                return (
                  <div
                    key={choice.label}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded text-sm border",
                      isCorrectChoice && "border-green-500 bg-green-50",
                      isSelected && !isCorrectChoice && "border-red-500 bg-red-50",
                      !isCorrectChoice && !isSelected && "border-transparent"
                    )}
                  >
                    <span className="font-bold shrink-0">{choice.label}</span>
                    <span className="leading-relaxed">{choice.text}</span>
                    {isCorrectChoice && (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 ml-auto" />
                    )}
                    {isSelected && !isCorrectChoice && (
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 ml-auto" />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm leading-relaxed">{question.explanation}</p>
              {question.explanationJa && (
                <p className="text-sm leading-relaxed text-muted-foreground border-t pt-2">
                  {question.explanationJa}
                </p>
              )}
            </div>
          </div>
        ) : (
          // 問題バンクから削除・IDが変更された問題（過去の結果を開いたときに起こりうる）
          <div className="p-4 border-t space-y-1 text-sm text-muted-foreground">
            <p>この問題は現在の問題バンクに存在しないため、本文と解説を表示できません。</p>
            <p>
              あなたの解答: {answer.selectedAnswer ?? "未回答"} / 正解:{" "}
              {answer.correctAnswer}
            </p>
          </div>
        ))}
    </div>
  )
}

/**
 * 模試1回分の結果表示（スコア・内訳・誤答レビュー）。
 * MockExamResult だけを入力にするため、直後の結果画面でも履歴からの閲覧でも同じ表示になる。
 */
export function MockExamResultDetail({ result }: { result: MockExamResult }) {
  const wrongAnswers = result.answers.filter((a) => !a.isCorrect)

  return (
    <>
      {/* スコア */}
      <Card className="mb-6">
        <CardContent className="p-6 text-center">
          <div
            className={cn(
              "text-5xl font-bold mb-1",
              result.score >= MOCK_EXAM_TARGET_RATE ? "text-green-600" : "text-red-500"
            )}
          >
            {result.score}%
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {result.correctCount} / {result.totalQuestions} 問正解
          </p>
          <Badge variant={result.score >= MOCK_EXAM_TARGET_RATE ? "default" : "destructive"}>
            目標{MOCK_EXAM_TARGET_RATE}%
            {result.score >= MOCK_EXAM_TARGET_RATE
              ? "達成"
              : `まで あと${MOCK_EXAM_TARGET_RATE - result.score}pt`}
          </Badge>
        </CardContent>
      </Card>

      {/* 内訳 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">内訳</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <BreakdownTable
            title="Area別"
            rows={Object.entries(result.areaBreakdown)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, v]) => ({ label: AREA_LABELS[key] ?? key, ...v }))}
          />
          <BreakdownTable
            title="難易度別"
            rows={(["basic", "intermediate", "advanced"] as const)
              .filter((d) => result.difficultyBreakdown[d])
              .map((d) => ({
                label: DIFFICULTY_LABELS[d],
                ...result.difficultyBreakdown[d],
              }))}
          />
          <BreakdownTable
            title="テーマ別"
            rows={Object.entries(result.topicBreakdown)
              .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
              .map(([key, v]) => ({ label: key, ...v }))}
          />
        </CardContent>
      </Card>

      {/* 誤答レビュー */}
      {wrongAnswers.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              誤答・未回答の見直し（{wrongAnswers.length}問）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {wrongAnswers.map((answer, i) => (
              <WrongAnswerReview key={`${answer.questionId}-${i}`} answer={answer} />
            ))}
          </CardContent>
        </Card>
      )}
    </>
  )
}
