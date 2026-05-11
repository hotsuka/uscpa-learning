"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, History, Clock } from "lucide-react"
import type { FARQuestion, QuestionAttempt } from "@/types/questions"
import { useQuestionBankStore } from "@/stores/questionBankStore"
import { cn } from "@/lib/utils"

interface QuestionCardProps {
  question: FARQuestion
  questionNumber: number
  totalQuestions: number
}

export function QuestionCard({ question, questionNumber, totalQuestions }: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  // 選択肢テキストのみシャッフル（ラベルA～Dは固定）
  const { choices: shuffledChoices, correctAnswer: shuffledCorrectAnswer, shuffledToOriginalLabel } = useRef(
    (() => {
      const labels = question.choices.map((c) => c.label)
      const correctText = question.choices.find((c) => c.label === question.correctAnswer)!.text
      // テキスト配列をシャッフル
      const texts = question.choices.map((c) => c.text)
      for (let i = texts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[texts[i], texts[j]] = [texts[j], texts[i]]
      }
      // シャッフル後ラベル→元ラベルの変換マップ（recalculateとの整合性を保つため）
      const shuffledToOriginalLabel: Record<string, string> = {}
      labels.forEach((label, i) => {
        const originalLabel = question.choices.find((c) => c.text === texts[i])?.label ?? label
        shuffledToOriginalLabel[label] = originalLabel
      })
      return {
        choices: labels.map((label, i) => ({ label, text: texts[i] })),
        correctAnswer: labels[texts.indexOf(correctText)],
        shuffledToOriginalLabel,
      }
    })()
  ).current

  const addAttempt = useQuestionBankStore((s) => s.addAttempt)
  const attempts = useQuestionBankStore((s) => s.attempts)

  const pastAttempts = useMemo(() => {
    return attempts
      .filter((a) => a.questionId === question.id)
      .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())
  }, [attempts, question.id])

  const pastCorrectCount = pastAttempts.filter((a) => a.isCorrect).length
  const pastAccuracy = pastAttempts.length > 0 ? Math.round((pastCorrectCount / pastAttempts.length) * 100) : null

  const handleSubmit = () => {
    if (!selectedAnswer) return
    const isCorrect = selectedAnswer === shuffledCorrectAnswer
    setIsAnswered(true)
    setShowExplanation(true)
    addAttempt({
      questionId: question.id,
      topic: question.topic,
      selectedAnswer: shuffledToOriginalLabel[selectedAnswer] ?? selectedAnswer,
      isCorrect,
      attemptedAt: new Date().toISOString(),
    })
  }

  const handleReset = () => {
    setSelectedAnswer(null)
    setIsAnswered(false)
    setShowExplanation(false)
  }

  const isCorrect = selectedAnswer === shuffledCorrectAnswer

  const difficultyColor = {
    basic: "bg-green-100 text-green-800",
    intermediate: "bg-yellow-100 text-yellow-800",
    advanced: "bg-red-100 text-red-800",
  }

  const difficultyLabel = {
    basic: "基礎",
    intermediate: "標準",
    advanced: "応用",
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {questionNumber} / {totalQuestions}
            </span>
            <Badge variant="outline" className={difficultyColor[question.difficulty]}>
              {difficultyLabel[question.difficulty]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              {question.id.toUpperCase()}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {question.subtopic}
            </Badge>
          </div>
        </div>

        {/* 解答履歴サマリー */}
        {pastAttempts.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <History className="w-3.5 h-3.5" />
                <span>{pastAttempts.length}回解答済み</span>
                <span>·</span>
                <span className={cn(
                  "font-medium",
                  pastAccuracy !== null && pastAccuracy >= 80 && "text-green-600",
                  pastAccuracy !== null && pastAccuracy >= 50 && pastAccuracy < 80 && "text-yellow-600",
                  pastAccuracy !== null && pastAccuracy < 50 && "text-red-600",
                )}>
                  正答率 {pastAccuracy}%
                </span>
                <span>·</span>
                <span>直近: {pastAttempts[0].isCorrect ? "○" : "✕"}</span>
              </div>
              {showHistory ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {pastAttempts.map((a, i) => (
                  <div key={a.attemptedAt} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-muted/30">
                    <span className="text-muted-foreground w-5 text-right">{pastAttempts.length - i}</span>
                    {a.isCorrect ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    )}
                    <span className={a.isCorrect ? "text-green-700" : "text-red-700"}>
                      {a.selectedAnswer}
                    </span>
                    <span className="text-muted-foreground ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(a.attemptedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                      {" "}
                      {new Date(a.attemptedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 問題文 */}
        <p className="text-base font-medium mb-6 leading-relaxed">{question.stem}</p>

        {/* 選択肢 */}
        <div className="space-y-3 mb-6">
          {shuffledChoices.map((choice) => {
            const isSelected = selectedAnswer === choice.label
            const isCorrectChoice = choice.label === shuffledCorrectAnswer
            let choiceStyle = "border-border hover:border-primary hover:bg-accent cursor-pointer"

            if (isAnswered) {
              if (isCorrectChoice) {
                choiceStyle = "border-green-500 bg-green-50"
              } else if (isSelected && !isCorrectChoice) {
                choiceStyle = "border-red-500 bg-red-50"
              } else {
                choiceStyle = "border-border opacity-60"
              }
            } else if (isSelected) {
              choiceStyle = "border-primary bg-primary/5 ring-1 ring-primary"
            }

            return (
              <button
                key={choice.label}
                onClick={() => !isAnswered && setSelectedAnswer(choice.label)}
                disabled={isAnswered}
                className={cn(
                  "w-full text-left p-4 rounded-lg border-2 transition-all",
                  choiceStyle
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="font-bold text-sm shrink-0 mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    {choice.label}
                  </span>
                  <span className="text-sm leading-relaxed">{choice.text}</span>
                  {isAnswered && isCorrectChoice && (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 ml-auto" />
                  )}
                  {isAnswered && isSelected && !isCorrectChoice && (
                    <XCircle className="w-5 h-5 text-red-600 shrink-0 ml-auto" />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* 回答ボタン */}
        {!isAnswered ? (
          <Button onClick={handleSubmit} disabled={!selectedAnswer} className="w-full">
            回答する
          </Button>
        ) : (
          <div className="space-y-4">
            {/* 結果表示 */}
            <div
              className={cn(
                "p-3 rounded-lg text-center font-medium",
                isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              )}
            >
              {isCorrect ? "正解!" : `不正解 — 正解は ${shuffledCorrectAnswer}`}
            </div>

            {/* 解説トグル */}
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              <span className="text-sm font-medium">解説を表示</span>
              {showExplanation ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showExplanation && (
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <p className="text-sm leading-relaxed">{question.explanation}</p>
                {question.explanationJa && (
                  <p className="text-sm leading-relaxed text-muted-foreground border-t pt-2">
                    {question.explanationJa}
                  </p>
                )}
                {question.references.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {question.references.map((ref) => (
                      <Badge key={ref} variant="outline" className="text-xs">
                        {ref}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* リセット */}
            <Button variant="outline" onClick={handleReset} className="w-full">
              もう一度解く
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
