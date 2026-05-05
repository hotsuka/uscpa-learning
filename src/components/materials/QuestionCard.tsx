"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react"
import type { FARQuestion } from "@/types/questions"
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
  const addAttempt = useQuestionBankStore((s) => s.addAttempt)

  const handleSubmit = () => {
    if (!selectedAnswer) return
    const isCorrect = selectedAnswer === question.correctAnswer
    setIsAnswered(true)
    setShowExplanation(true)
    addAttempt({
      questionId: question.id,
      topic: question.topic,
      selectedAnswer,
      isCorrect,
      attemptedAt: new Date().toISOString(),
    })
  }

  const handleReset = () => {
    setSelectedAnswer(null)
    setIsAnswered(false)
    setShowExplanation(false)
  }

  const isCorrect = selectedAnswer === question.correctAnswer

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
        <div className="flex items-center justify-between mb-4">
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

        {/* 問題文 */}
        <p className="text-base font-medium mb-6 leading-relaxed">{question.stem}</p>

        {/* 選択肢 */}
        <div className="space-y-3 mb-6">
          {question.choices.map((choice) => {
            const isSelected = selectedAnswer === choice.label
            const isCorrectChoice = choice.label === question.correctAnswer
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
              {isCorrect ? "正解!" : `不正解 — 正解は ${question.correctAnswer}`}
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
