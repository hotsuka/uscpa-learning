"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { QuestionCard } from "@/components/materials/QuestionCard"
import { MiniTimer, type MiniTimerRef } from "@/components/materials/MiniTimer"
import { useTimer } from "@/hooks/useTimer"
import { farQuestionSets, getTotalQuestionCount } from "@/data/questions/far"
import { useQuestionBankStore } from "@/stores/questionBankStore"
import { useRecordStore } from "@/stores/recordStore"
import type { FARQuestion } from "@/types/questions"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Brain,
  Target,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  XCircle,
} from "lucide-react"

type DifficultyFilter = "all" | "basic" | "intermediate" | "advanced"

export default function QuestionsPage() {
  const [selectedTopic, setSelectedTopic] = useState<string>("all")
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all")
  const [weaknessMode, setWeaknessMode] = useState(false)
  const [neverCorrectOnly, setNeverCorrectOnly] = useState(false)
  const [unattemptedOnly, setUnattemptedOnly] = useState(false)
  // フィルターをオンにした時点でのスナップショット（回答後に問題が消えないようにするため）
  const [frozenAttemptedIds, setFrozenAttemptedIds] = useState<Set<string> | null>(null)
  const [frozenEverCorrectIds, setFrozenEverCorrectIds] = useState<Set<string> | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const miniTimerRef = useRef<MiniTimerRef>(null)
  const { isRunning, start, pause } = useTimer()

  const attempts = useQuestionBankStore((s) => s.attempts)
  const records = useRecordStore((s) => s.records)

  // 問題IDからQuestionSetのtopicへのマップ（個別問題のtopicではなくセット単位で集約）
  const questionSetTopicMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const set of farQuestionSets) {
      for (const q of set.questions) {
        map.set(q.id, set.topic)
      }
    }
    return map
  }, [])

  // attemptsからトピック別統計を算出（QuestionSetのtopic基準）
  const topicStats = useMemo(() => {
    const stats: Record<string, { correct: number; total: number; rate: number }> = {}
    for (const attempt of attempts) {
      const setTopic = questionSetTopicMap.get(attempt.questionId) ?? attempt.topic
      if (!stats[setTopic]) stats[setTopic] = { correct: 0, total: 0, rate: 0 }
      stats[setTopic].total++
      if (attempt.isCorrect) stats[setTopic].correct++
    }
    for (const topic of Object.keys(stats)) {
      stats[topic].rate = Math.round((stats[topic].correct / stats[topic].total) * 100)
    }
    return stats
  }, [attempts, questionSetTopicMap])

  const attemptedIds = useMemo(() => new Set(attempts.map((a) => a.questionId)), [attempts])
  const attemptedCount = attemptedIds.size

  // recordStoreから弱点トピック（正答率60%未満）を抽出
  const weakTopics = useMemo(() => {
    const stats: Record<string, { correct: number; total: number }> = {}
    for (const record of records) {
      if (record.subject !== "FAR") continue
      if (!record.subtopic || !record.totalQuestions || !record.correctAnswers) continue
      if (!stats[record.subtopic]) stats[record.subtopic] = { correct: 0, total: 0 }
      stats[record.subtopic].total += record.totalQuestions
      stats[record.subtopic].correct += record.correctAnswers
    }
    return Object.entries(stats)
      .filter(([, s]) => s.total >= 5 && Math.round((s.correct / s.total) * 100) < 60)
      .map(([topic]) => topic)
  }, [records])

  // 1回でも正解したことがある問題IDのセット
  const everCorrectIds = useMemo(() => {
    const ids = new Set<string>()
    for (const a of attempts) {
      if (a.isCorrect) ids.add(a.questionId)
    }
    return ids
  }, [attempts])

  // 問題をフィルタリング
  const filteredQuestions = useMemo(() => {
    let questions: FARQuestion[] = []

    if (selectedTopic === "all") {
      questions = farQuestionSets.flatMap((set) => set.questions)
    } else {
      const set = farQuestionSets.find((s) => s.topic === selectedTopic)
      questions = set ? set.questions : []
    }

    if (difficulty !== "all") {
      questions = questions.filter((q) => q.difficulty === difficulty)
    }

    // 未解答のみフィルター（フィルター適用時点のスナップショットを使い、回答後も問題が消えないようにする）
    if (unattemptedOnly) {
      const idsForFilter = frozenAttemptedIds ?? attemptedIds
      questions = questions.filter((q) => !idsForFilter.has(q.id))
    }

    // 未正解のみフィルター（同様にスナップショットを使う）
    if (neverCorrectOnly) {
      const idsForFilter = frozenEverCorrectIds ?? everCorrectIds
      questions = questions.filter((q) => !idsForFilter.has(q.id))
    }

    if (weaknessMode && weakTopics.length > 0) {
      // 弱点トピックに関連する問題を優先
      const weakQuestions = questions.filter((q) =>
        weakTopics.some(
          (wt) =>
            q.topic.toLowerCase().includes(wt.toLowerCase()) ||
            wt.toLowerCase().includes(q.subtopic.toLowerCase())
        )
      )
      const otherQuestions = questions.filter(
        (q) =>
          !weakTopics.some(
            (wt) =>
              q.topic.toLowerCase().includes(wt.toLowerCase()) ||
              wt.toLowerCase().includes(q.subtopic.toLowerCase())
          )
      )
      questions = [...weakQuestions, ...otherQuestions]
    }

    return questions
  }, [selectedTopic, difficulty, weaknessMode, weakTopics, neverCorrectOnly, everCorrectIds, frozenEverCorrectIds, unattemptedOnly, attemptedIds, frozenAttemptedIds])

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true"

      if (isInputFocused) return

      // Space: タイマー開始/停止
      if (e.key === " " && e.code === "Space") {
        e.preventDefault()
        if (isRunning) {
          pause()
        } else {
          start()
        }
        return
      }

      // ←: 前の問題
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setCurrentIndex((i) => Math.max(i - 1, 0))
        return
      }

      // →: 次の問題
      if (e.key === "ArrowRight") {
        e.preventDefault()
        setCurrentIndex((i) => Math.min(i + 1, filteredQuestions.length - 1))
        return
      }

      // Q: 問題数を増減
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault()
        if (e.shiftKey) {
          miniTimerRef.current?.decrementQuestions()
        } else {
          miniTimerRef.current?.incrementQuestions()
        }
        return
      }

      // A: 正解数を増減
      if (e.key === "a" || e.key === "A") {
        e.preventDefault()
        if (e.shiftKey) {
          miniTimerRef.current?.decrementCorrect()
        } else {
          miniTimerRef.current?.incrementCorrect()
        }
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isRunning, start, pause, filteredQuestions.length])

  // ページ操作
  const currentQuestion = filteredQuestions[currentIndex]
  const goNext = () => setCurrentIndex((i) => Math.min(i + 1, filteredQuestions.length - 1))
  const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0))

  // トピック変更時にインデックスリセット
  const handleTopicChange = (value: string) => {
    setSelectedTopic(value)
    setCurrentIndex(0)
  }

  const handleDifficultyChange = (value: string) => {
    setDifficulty(value as DifficultyFilter)
    setCurrentIndex(0)
  }

  // 問題ごとの解答状態マップ（未解答/最終正解/最終不正解）
  const questionStatusMap = useMemo(() => {
    const map = new Map<string, "correct" | "incorrect">()
    for (const a of attempts) {
      map.set(a.questionId, a.isCorrect ? "correct" : "incorrect")
    }
    return map
  }, [attempts])

  const [showGrid, setShowGrid] = useState(false)

  // 統計計算
  const totalQuestions = getTotalQuestionCount()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="sm:hidden border-b bg-muted/30 p-2 flex justify-center">
        <MiniTimer />
      </div>
      <main className="container max-w-3xl mx-auto p-4 pb-24">
        {/* 戻るリンク */}
        <Link
          href="/materials"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          教材一覧に戻る
        </Link>

        {/* デスクトップ用ミニタイマー */}
        <div className="hidden sm:flex justify-end mb-2">
          <MiniTimer ref={miniTimerRef} />
        </div>

        {/* ページヘッダー */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">FAR 問題バンク</h1>
          <p className="text-sm text-muted-foreground">
            AICPA公開問題ベースの追加演習（全{totalQuestions}問）
          </p>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <BookOpen className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <div className="text-lg font-bold">{totalQuestions}</div>
              <div className="text-xs text-muted-foreground">全問題数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Target className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <div className="text-lg font-bold">{attemptedCount}</div>
              <div className="text-xs text-muted-foreground">回答済み</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-orange-500" />
              <div className="text-lg font-bold">{weakTopics.length}</div>
              <div className="text-xs text-muted-foreground">弱点トピック</div>
            </CardContent>
          </Card>
        </div>

        {/* フィルター */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Select value={selectedTopic} onValueChange={handleTopicChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="トピック選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全トピック</SelectItem>
                    {farQuestionSets.map((set) => (
                      <SelectItem key={set.id} value={set.topic}>
                        {set.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-40">
                <Select value={difficulty} onValueChange={handleDifficultyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="難易度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全難易度</SelectItem>
                    <SelectItem value="basic">基礎</SelectItem>
                    <SelectItem value="intermediate">標準</SelectItem>
                    <SelectItem value="advanced">応用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant={weaknessMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setWeaknessMode(!weaknessMode)
                  setCurrentIndex(0)
                }}
                className="w-full sm:w-auto"
                disabled={weakTopics.length === 0}
              >
                <Brain className="w-4 h-4 mr-2" />
                弱点優先モード
                {weakTopics.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {weakTopics.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={unattemptedOnly ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!unattemptedOnly) {
                    setFrozenAttemptedIds(new Set(attemptedIds))
                    setUnattemptedOnly(true)
                  } else {
                    setFrozenAttemptedIds(null)
                    setUnattemptedOnly(false)
                  }
                  setCurrentIndex(0)
                }}
                className="w-full sm:w-auto"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                未解答のみ
                <Badge variant="secondary" className="ml-2">
                  {getTotalQuestionCount() - attemptedCount}
                </Badge>
              </Button>
              <Button
                variant={neverCorrectOnly ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!neverCorrectOnly) {
                    setFrozenEverCorrectIds(new Set(everCorrectIds))
                    setNeverCorrectOnly(true)
                  } else {
                    setFrozenEverCorrectIds(null)
                    setNeverCorrectOnly(false)
                  }
                  setCurrentIndex(0)
                }}
                className="w-full sm:w-auto"
              >
                <XCircle className="w-4 h-4 mr-2" />
                未正解のみ
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 問題表示 */}
        {filteredQuestions.length > 0 && currentQuestion ? (
          <>
            <QuestionCard
              key={currentQuestion.id}
              question={currentQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={filteredQuestions.length}
            />

            {/* ナビゲーション */}
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                前の問題
              </Button>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {currentIndex + 1} / {filteredQuestions.length}
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={goNext}
                disabled={currentIndex === filteredQuestions.length - 1}
              >
                次の問題
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* 問題番号グリッド */}
            {showGrid && (
              <Card className="mt-3">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> 正解</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> 不正解</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" /> 未解答</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {filteredQuestions.map((q, i) => {
                      const status = questionStatusMap.get(q.id)
                      const isCurrent = i === currentIndex
                      return (
                        <button
                          key={q.id}
                          onClick={() => { setCurrentIndex(i); setShowGrid(false) }}
                          className={cn(
                            "w-8 h-8 rounded text-xs font-medium transition-all flex items-center justify-center",
                            isCurrent && "ring-2 ring-primary ring-offset-1",
                            status === "correct" && "bg-green-100 text-green-800 hover:bg-green-200",
                            status === "incorrect" && "bg-red-100 text-red-800 hover:bg-red-200",
                            !status && "bg-muted text-muted-foreground hover:bg-muted/80",
                          )}
                        >
                          {i + 1}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                該当する問題がありません。フィルターを変更してください。
              </p>
            </CardContent>
          </Card>
        )}

        {/* トピック別正答率 */}
        {Object.keys(topicStats).length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">トピック別正答率</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {farQuestionSets.map((set) => {
                  const stat = topicStats[set.topic]
                  if (!stat) return null
                  return (
                    <div key={set.id} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1">{set.name}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              stat.rate >= 80
                                ? "bg-green-500"
                                : stat.rate >= 60
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${stat.rate}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-muted-foreground">
                          {stat.rate}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
