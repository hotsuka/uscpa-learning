"use client"

import { useState, useMemo } from "react"
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
import { farQuestionSets, getTotalQuestionCount } from "@/data/questions/far"
import { useQuestionBankStore } from "@/stores/questionBankStore"
import { useRecordStore } from "@/stores/recordStore"
import type { FARQuestion } from "@/types/questions"
import {
  ArrowLeft,
  Brain,
  Target,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react"

type DifficultyFilter = "all" | "basic" | "intermediate" | "advanced"

export default function QuestionsPage() {
  const [selectedTopic, setSelectedTopic] = useState<string>("all")
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all")
  const [weaknessMode, setWeaknessMode] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const topicStats = useQuestionBankStore((s) => s.getTopicStats())
  const attemptedIds = useQuestionBankStore((s) => s.getAttemptedQuestionIds())
  const records = useRecordStore((s) => s.records)

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
  }, [selectedTopic, difficulty, weaknessMode, weakTopics])

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

  // 統計計算
  const totalQuestions = getTotalQuestionCount()
  const attemptedCount = attemptedIds.size

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-3xl mx-auto p-4 pb-24">
        {/* 戻るリンク */}
        <Link
          href="/materials"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          教材一覧に戻る
        </Link>

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
          </CardContent>
        </Card>

        {/* 問題表示 */}
        {filteredQuestions.length > 0 && currentQuestion ? (
          <>
            <QuestionCard
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
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {filteredQuestions.length}
              </span>
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
