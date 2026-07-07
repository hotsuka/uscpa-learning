"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import { MarkdownPreview } from "@/components/notes/MarkdownPreview"
import {
  buildMockExam,
  MOCK_EXAM_QUESTION_COUNT,
  MOCK_EXAM_MINUTES,
  MOCK_EXAM_TARGET_RATE,
  type MockExamQuestionEntry,
} from "@/lib/mockExam"
import { useQuestionBankStore } from "@/stores/questionBankStore"
import {
  useMockExamStore,
  type MockExamAnswer,
  type MockExamResult,
} from "@/stores/mockExamStore"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Timer,
  Flag,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
} from "lucide-react"

type Phase = "intro" | "running" | "result"

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

const formatRemaining = (sec: number): string => {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

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
function WrongAnswerReview({
  entry,
  answer,
}: {
  entry: MockExamQuestionEntry
  answer: MockExamAnswer
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 p-3 text-left text-sm hover:bg-muted/50 transition-colors"
      >
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        <Badge variant="outline" className="text-xs font-mono shrink-0">
          {entry.question.id.toUpperCase()}
        </Badge>
        <span className="truncate flex-1 text-muted-foreground">
          {entry.question.subtopic}
          {answer.selectedAnswer === null && "（未回答）"}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0" />
        )}
      </button>
      {open && (
        <div className="p-4 border-t space-y-3">
          <div className="text-sm leading-relaxed">
            <MarkdownPreview content={entry.question.stem} />
          </div>
          <div className="space-y-1.5">
            {entry.question.choices.map((choice) => {
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
            <p className="text-sm leading-relaxed">{entry.question.explanation}</p>
            {entry.question.explanationJa && (
              <p className="text-sm leading-relaxed text-muted-foreground border-t pt-2">
                {entry.question.explanationJa}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MockExamPage() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [entries, setEntries] = useState<MockExamQuestionEntry[]>([])
  // index -> シャッフル後ラベル
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [remainingSec, setRemainingSec] = useState(MOCK_EXAM_MINUTES * 60)
  const [result, setResult] = useState<MockExamResult | null>(null)
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)

  const startedAtRef = useRef<string>("")
  const deadlineRef = useRef<number>(0)
  const finishedRef = useRef(false)

  const addAttempt = useQuestionBankStore((s) => s.addAttempt)
  const addResult = useMockExamStore((s) => s.addResult)
  const pastResults = useMockExamStore((s) => s.results)

  const handleStart = (): void => {
    setEntries(buildMockExam())
    setAnswers({})
    setFlagged(new Set())
    setCurrentIndex(0)
    setRemainingSec(MOCK_EXAM_MINUTES * 60)
    setResult(null)
    startedAtRef.current = new Date().toISOString()
    deadlineRef.current = Date.now() + MOCK_EXAM_MINUTES * 60 * 1000
    finishedRef.current = false
    setPhase("running")
  }

  const finishExam = useCallback((): void => {
    if (finishedRef.current) return
    finishedRef.current = true
    const finishedAt = new Date().toISOString()

    const answerRecords: MockExamAnswer[] = entries.map((entry, i) => {
      const selectedShuffled = answers[i] ?? null
      const selectedOriginal = selectedShuffled
        ? (entry.shuffledToOriginalLabel[selectedShuffled] ?? selectedShuffled)
        : null
      // 未回答は不正解として集計する
      const isCorrect = selectedShuffled !== null && selectedShuffled === entry.correctAnswer
      return {
        questionId: entry.question.id,
        topic: entry.question.topic,
        area: entry.area,
        difficulty: entry.question.difficulty,
        selectedAnswer: selectedOriginal,
        correctAnswer: entry.question.correctAnswer,
        isCorrect,
      }
    })

    // 回答した問題は通常の解答履歴（初見統計等）にも記録する
    for (const record of answerRecords) {
      if (record.selectedAnswer !== null) {
        addAttempt({
          questionId: record.questionId,
          topic: record.topic,
          selectedAnswer: record.selectedAnswer,
          isCorrect: record.isCorrect,
          attemptedAt: finishedAt,
        })
      }
    }

    const breakdown = (keyOf: (a: MockExamAnswer) => string) => {
      const acc: Record<string, { correct: number; total: number }> = {}
      for (const a of answerRecords) {
        const key = keyOf(a)
        if (!acc[key]) acc[key] = { correct: 0, total: 0 }
        acc[key].total++
        if (a.isCorrect) acc[key].correct++
      }
      return acc
    }

    const correctCount = answerRecords.filter((a) => a.isCorrect).length
    const mockResult: MockExamResult = {
      id: crypto.randomUUID(),
      startedAt: startedAtRef.current,
      finishedAt,
      totalQuestions: answerRecords.length,
      correctCount,
      score:
        answerRecords.length > 0
          ? Math.round((correctCount / answerRecords.length) * 100)
          : 0,
      areaBreakdown: breakdown((a) => a.area),
      difficultyBreakdown: breakdown((a) => a.difficulty),
      topicBreakdown: breakdown((a) => a.topic),
      answers: answerRecords,
    }
    addResult(mockResult)
    setResult(mockResult)
    setPhase("result")
  }, [entries, answers, addAttempt, addResult])

  // タイマー（0で自動提出）
  useEffect(() => {
    if (phase !== "running") return
    const timer = setInterval(() => {
      const rest = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
      setRemainingSec(rest)
      if (rest <= 0) {
        finishExam()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [phase, finishExam])

  // 実施中のページ離脱警告
  useEffect(() => {
    if (phase !== "running") return
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [phase])

  const answeredCount = Object.keys(answers).length
  const currentEntry = entries[currentIndex]

  const handleSubmitClick = (): void => {
    setConfirmSubmitOpen(true)
  }

  const toggleFlag = (index: number): void => {
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-3xl mx-auto p-4 pb-24">
        {phase !== "running" && (
          <Link
            href="/materials/questions"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            問題バンクに戻る
          </Link>
        )}

        {/* ===== 開始画面 ===== */}
        {phase === "intro" && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2">FAR 模試モード</h1>
              <p className="text-sm text-muted-foreground">
                本番のMCQセクション相当の演習（解答中は正誤・解説が表示されません）
              </p>
            </div>
            <Card className="mb-6">
              <CardContent className="p-6 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                  <span>
                    全{MOCK_EXAM_QUESTION_COUNT}問 — FAR出題範囲からArea配分
                    （I:18問 / II:17問 / III:15問）で自動抽出
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-muted-foreground" />
                  <span>
                    制限時間{MOCK_EXAM_MINUTES}分 — 時間切れで自動提出、目標は正答率
                    {MOCK_EXAM_TARGET_RATE}%以上
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-muted-foreground" />
                  <span>見直しフラグと問題番号グリッドで自由に行き来できます</span>
                </div>
                <Button onClick={handleStart} className="w-full mt-2">
                  模試を開始する
                </Button>
              </CardContent>
            </Card>

            {pastResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">過去の模試結果</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pastResults.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-sm px-3 py-2 rounded-md border bg-muted/30"
                    >
                      <span className="text-muted-foreground">
                        {formatDateTime(r.finishedAt)}
                      </span>
                      <span
                        className={cn(
                          "font-bold",
                          r.score >= MOCK_EXAM_TARGET_RATE
                            ? "text-green-600"
                            : "text-red-500"
                        )}
                      >
                        {r.score}%
                        <span className="font-normal text-muted-foreground text-xs ml-1">
                          ({r.correctCount}/{r.totalQuestions})
                        </span>
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ===== 演習画面 ===== */}
        {phase === "running" && currentEntry && (
          <>
            {/* タイマーバー */}
            <div className="flex items-center justify-between mb-4 sticky top-0 z-10 bg-background py-2 border-b">
              <div
                className={cn(
                  "flex items-center gap-1.5 font-mono text-lg font-bold",
                  remainingSec <= 300 && "text-red-500"
                )}
              >
                <Timer className="w-5 h-5" />
                {formatRemaining(remainingSec)}
              </div>
              <div className="text-sm text-muted-foreground">
                回答 {answeredCount} / {entries.length}
              </div>
              <Button size="sm" onClick={handleSubmitClick}>
                提出する
              </Button>
            </div>

            {/* 問題 */}
            <Card className="mb-4">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">
                    {currentIndex + 1} / {entries.length}
                  </span>
                  <Button
                    variant={flagged.has(currentIndex) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleFlag(currentIndex)}
                  >
                    <Flag className="w-4 h-4 mr-1" />
                    {flagged.has(currentIndex) ? "フラグ解除" : "見直しフラグ"}
                  </Button>
                </div>
                <div className="text-base font-medium mb-6 leading-relaxed">
                  <MarkdownPreview content={currentEntry.question.stem} />
                </div>
                <div className="space-y-3">
                  {currentEntry.choices.map((choice) => {
                    const isSelected = answers[currentIndex] === choice.label
                    return (
                      <button
                        key={choice.label}
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [currentIndex]: choice.label }))
                        }
                        className={cn(
                          "w-full text-left p-4 rounded-lg border-2 transition-all",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary hover:bg-accent cursor-pointer"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="font-bold text-sm shrink-0 mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            {choice.label}
                          </span>
                          <span className="text-sm leading-relaxed">{choice.text}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ナビゲーション */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                前の問題
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((i) => Math.min(i + 1, entries.length - 1))}
                disabled={currentIndex === entries.length - 1}
              >
                次の問題
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* 問題番号グリッド */}
            <Card>
              <CardContent className="p-3">
                <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> 回答済み
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> フラグ
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" /> 未回答
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {entries.map((entry, i) => {
                    const isAnswered = answers[i] !== undefined
                    const isFlagged = flagged.has(i)
                    const isCurrent = i === currentIndex
                    return (
                      <button
                        key={entry.question.id}
                        onClick={() => setCurrentIndex(i)}
                        className={cn(
                          "w-8 h-8 rounded text-xs font-medium transition-all flex items-center justify-center",
                          isCurrent && "ring-2 ring-primary ring-offset-1",
                          isFlagged
                            ? "bg-orange-100 text-orange-800 hover:bg-orange-200"
                            : isAnswered
                              ? "bg-primary/15 text-primary hover:bg-primary/25"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {i + 1}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ===== 結果画面 ===== */}
        {phase === "result" && result && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2">模試結果</h1>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(result.startedAt)} 〜 {formatDateTime(result.finishedAt)}
              </p>
            </div>

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
                <Badge
                  variant={result.score >= MOCK_EXAM_TARGET_RATE ? "default" : "destructive"}
                >
                  目標{MOCK_EXAM_TARGET_RATE}%
                  {result.score >= MOCK_EXAM_TARGET_RATE ? "達成" : `まで あと${MOCK_EXAM_TARGET_RATE - result.score}pt`}
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
                    .map(([key, v]) => ({
                      label: AREA_LABELS[key] ?? key,
                      ...v,
                    }))}
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
                    .sort(
                      ([, a], [, b]) =>
                        a.correct / a.total - b.correct / b.total
                    )
                    .map(([key, v]) => ({ label: key, ...v }))}
                />
              </CardContent>
            </Card>

            {/* 誤答レビュー */}
            {result.answers.some((a) => !a.isCorrect) && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">
                    誤答・未回答の見直し（
                    {result.answers.filter((a) => !a.isCorrect).length}問）
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {entries.map((entry, i) => {
                    const answer = result.answers[i]
                    if (!answer || answer.isCorrect) return null
                    return (
                      <WrongAnswerReview
                        key={entry.question.id}
                        entry={entry}
                        answer={answer}
                      />
                    )
                  })}
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button onClick={handleStart} className="flex-1">
                もう一度受ける
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/materials/questions">問題バンクに戻る</Link>
              </Button>
            </div>
          </>
        )}
      </main>

      <ConfirmDialog
        open={confirmSubmitOpen}
        onOpenChange={setConfirmSubmitOpen}
        title="模試を提出しますか？"
        description={
          answeredCount < entries.length
            ? `未回答が${entries.length - answeredCount}問あります。未回答は不正解として採点されます。`
            : "全問回答済みです。採点結果を表示します。"
        }
        confirmLabel="提出する"
        onConfirm={() => {
          setConfirmSubmitOpen(false)
          finishExam()
        }}
      />
    </div>
  )
}
