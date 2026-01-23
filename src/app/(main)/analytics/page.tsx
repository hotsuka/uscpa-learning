"use client"

import { useMemo, useState } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { SUBJECTS, SUBJECT_OPTIONS, type Subject } from "@/types"
import { useRecordStore } from "@/stores/recordStore"
import { useSettingsStore } from "@/stores/settingsStore"
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Target,
  Clock,
  CheckCircle2,
  BookOpen,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Period = "week" | "month" | "all"

export default function AnalyticsPage() {
  const { records } = useRecordStore()
  const { subjectTargetHours } = useSettingsStore()
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week")
  const [selectedTopic, setSelectedTopic] = useState<string>("")

  // 期間でフィルタしたレコードを取得
  const filteredRecords = useMemo(() => {
    const now = new Date()

    if (selectedPeriod === "all") {
      return records
    }

    let startDate: Date
    if (selectedPeriod === "week") {
      // 今週の月曜日を取得
      startDate = new Date(now)
      const day = startDate.getDay()
      const diff = day === 0 ? -6 : 1 - day
      startDate.setDate(startDate.getDate() + diff)
      startDate.setHours(0, 0, 0, 0)
    } else {
      // 今月の初日
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const startDateStr = startDate.toISOString().split("T")[0]
    return records.filter((r) => r.studiedAt >= startDateStr)
  }, [records, selectedPeriod])

  // サマリー統計を計算
  const summaryStats = useMemo(() => {
    const totalMinutes = filteredRecords.reduce((sum, r) => sum + (r.studyMinutes || 0), 0)
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10

    const practiceRecords = filteredRecords.filter((r) => r.recordType === "practice")
    const totalQuestions = practiceRecords.reduce((sum, r) => sum + (r.totalQuestions || 0), 0)
    const totalCorrect = practiceRecords.reduce((sum, r) => sum + (r.correctAnswers || 0), 0)
    const averageAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

    // 目標時間（期間に応じて計算）
    const totalTargetHours = Object.values(subjectTargetHours).reduce((sum, h) => sum + h, 0)
    let targetHours: number
    if (selectedPeriod === "week") {
      targetHours = Math.round(totalTargetHours / 52) // 年間目標を週換算
    } else if (selectedPeriod === "month") {
      targetHours = Math.round(totalTargetHours / 12) // 年間目標を月換算
    } else {
      targetHours = totalTargetHours
    }

    const achievementRate = targetHours > 0 ? Math.round((totalHours / targetHours) * 100) : 0

    return {
      totalHours,
      totalQuestions,
      averageAccuracy,
      targetHours,
      achievementRate,
    }
  }, [filteredRecords, selectedPeriod, subjectTargetHours])

  // 週間学習時間（過去7日分）を計算
  const weeklyHours = useMemo(() => {
    const days = ["日", "月", "火", "水", "木", "金", "土"]
    const result: { day: string; hours: number; date: string }[] = []

    const today = new Date()

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      const dayRecords = records.filter((r) => r.studiedAt === dateStr)
      const minutes = dayRecords.reduce((sum, r) => sum + (r.studyMinutes || 0), 0)

      result.push({
        day: days[date.getDay()],
        hours: Math.round(minutes / 60 * 10) / 10,
        date: dateStr,
      })
    }

    return result
  }, [records])

  const maxHours = Math.max(...weeklyHours.map((d) => d.hours), 1)

  // 科目別統計を計算
  const subjectStats = useMemo(() => {
    const stats: Record<Subject, { totalHours: number; accuracy: number; questionsCount: number }> = {
      FAR: { totalHours: 0, accuracy: 0, questionsCount: 0 },
      AUD: { totalHours: 0, accuracy: 0, questionsCount: 0 },
      REG: { totalHours: 0, accuracy: 0, questionsCount: 0 },
      BAR: { totalHours: 0, accuracy: 0, questionsCount: 0 },
    }

    for (const subject of SUBJECT_OPTIONS) {
      const subjectRecords = filteredRecords.filter((r) => r.subject === subject)
      const totalMinutes = subjectRecords.reduce((sum, r) => sum + (r.studyMinutes || 0), 0)
      stats[subject].totalHours = Math.round(totalMinutes / 60 * 10) / 10

      const practiceRecords = subjectRecords.filter((r) => r.recordType === "practice")
      const totalQuestions = practiceRecords.reduce((sum, r) => sum + (r.totalQuestions || 0), 0)
      const totalCorrect = practiceRecords.reduce((sum, r) => sum + (r.correctAnswers || 0), 0)

      stats[subject].questionsCount = totalQuestions
      stats[subject].accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
    }

    return stats
  }, [filteredRecords])

  // 弱点テーマを抽出（サブテーマ/チャプター別の正答率が低いもの）
  const weakTopics = useMemo(() => {
    const topicStats: Record<string, { subject: Subject; topic: string; correct: number; total: number }> = {}

    for (const record of filteredRecords) {
      if (record.recordType !== "practice") continue
      const topic = record.subtopic || record.chapter
      if (!topic) continue

      const key = `${record.subject}-${topic}`
      if (!topicStats[key]) {
        topicStats[key] = { subject: record.subject, topic, correct: 0, total: 0 }
      }
      topicStats[key].total += record.totalQuestions || 0
      topicStats[key].correct += record.correctAnswers || 0
    }

    return Object.values(topicStats)
      .filter((t) => t.total >= 5) // 最低5問以上のデータがあるテーマのみ
      .map((t) => ({
        subject: t.subject,
        topic: t.topic,
        accuracy: Math.round((t.correct / t.total) * 100),
        total: t.total,
      }))
      .filter((t) => t.accuracy < 60) // 正答率60%未満を弱点とする
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5) // 上位5件
  }, [filteredRecords])

  // 全てのテーマ（サブトピック/チャプター）を取得
  const allTopics = useMemo(() => {
    const topicSet = new Set<string>()
    for (const record of records) {
      const topic = record.subtopic || record.chapter
      if (topic) {
        topicSet.add(topic)
      }
    }
    return Array.from(topicSet).sort()
  }, [records])

  // 選択されたテーマの統計を計算
  const topicStats = useMemo(() => {
    if (!selectedTopic) return null

    const topicRecords = records.filter((r) => {
      const topic = r.subtopic || r.chapter
      return topic === selectedTopic && r.recordType === "practice"
    })

    if (topicRecords.length === 0) return null

    const totalQuestions = topicRecords.reduce((sum, r) => sum + (r.totalQuestions || 0), 0)
    const totalCorrect = topicRecords.reduce((sum, r) => sum + (r.correctAnswers || 0), 0)
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

    // 科目別の内訳
    const bySubject: Record<Subject, { questions: number; correct: number }> = {
      FAR: { questions: 0, correct: 0 },
      AUD: { questions: 0, correct: 0 },
      REG: { questions: 0, correct: 0 },
      BAR: { questions: 0, correct: 0 },
    }

    for (const record of topicRecords) {
      bySubject[record.subject].questions += record.totalQuestions || 0
      bySubject[record.subject].correct += record.correctAnswers || 0
    }

    return {
      totalQuestions,
      totalCorrect,
      accuracy,
      recordCount: topicRecords.length,
      bySubject,
    }
  }, [records, selectedTopic])

  return (
    <>
      <Header title="分析・レポート" />
      <div className="p-4 md:p-8 space-y-6">
        {/* 期間選択 */}
        <div className="flex gap-2">
          {(["week", "month", "all"] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {period === "week" ? "週間" : period === "month" ? "月間" : "全期間"}
            </button>
          ))}
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">学習時間</span>
              </div>
              <p className="text-2xl font-bold">{summaryStats.totalHours}h</p>
              <p className="text-xs text-muted-foreground mt-1">
                目標: {summaryStats.targetHours}h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">解答問題数</span>
              </div>
              <p className="text-2xl font-bold">{summaryStats.totalQuestions}</p>
              <p className="text-xs text-muted-foreground mt-1">問</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Target className="h-4 w-4" />
                <span className="text-sm">平均正答率</span>
              </div>
              <p className="text-2xl font-bold">
                {summaryStats.averageAccuracy > 0 ? `${summaryStats.averageAccuracy}%` : "-"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">目標: 75%</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">目標達成率</span>
              </div>
              <p className="text-2xl font-bold">
                {summaryStats.achievementRate > 0 ? `${summaryStats.achievementRate}%` : "-"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 週間学習時間グラフ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              直近7日間の学習時間
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40">
              {weeklyHours.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-xs text-muted-foreground mb-1">
                      {data.hours > 0 ? `${data.hours}h` : ""}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all ${
                        data.hours > 0 ? "bg-primary" : "bg-muted"
                      }`}
                      style={{
                        height: data.hours > 0 ? `${(data.hours / maxHours) * 100}px` : "4px",
                        minHeight: "4px",
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">{data.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 科目別統計 */}
        <Card>
          <CardHeader>
            <CardTitle>科目別統計</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {SUBJECT_OPTIONS.map((subject) => {
              const stats = subjectStats[subject]
              const subjectInfo = SUBJECTS[subject]
              const hasData = stats.totalHours > 0 || stats.questionsCount > 0
              return (
                <div key={subject} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: subjectInfo.color }}
                      />
                      <span className="font-medium">{subject}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{stats.totalHours}h</span>
                      <span className="text-muted-foreground">{stats.questionsCount}問</span>
                      {hasData ? (
                        <Badge
                          variant={stats.accuracy >= 70 ? "default" : "secondary"}
                          className="min-w-[60px] justify-center"
                        >
                          {stats.accuracy > 0 ? `${stats.accuracy}%` : "-"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="min-w-[60px] justify-center">
                          -
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress
                    value={stats.accuracy}
                    className="h-2"
                    style={{
                      // @ts-expect-error CSS custom property
                      "--progress-color": subjectInfo.color,
                    }}
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* 弱点分析 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              要強化テーマ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weakTopics.length > 0 ? (
              <>
                <div className="space-y-3">
                  {weakTopics.map((topic, index) => {
                    const subjectInfo = SUBJECTS[topic.subject]
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge
                            style={{
                              backgroundColor: subjectInfo.lightColor,
                              color: subjectInfo.color,
                            }}
                          >
                            {topic.subject}
                          </Badge>
                          <span className="text-sm">{topic.topic}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">({topic.total}問)</span>
                          <span className="text-sm font-medium text-red-500">
                            {topic.accuracy}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  ※ 正答率60%未満のテーマを表示（5問以上のデータがあるもの）
                </p>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>弱点テーマはありません</p>
                <p className="text-xs mt-1">
                  学習記録が蓄積されると、正答率の低いテーマが表示されます
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* テーマ別統計 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              テーマ別統計
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* テーマ選択 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">テーマを選択</label>
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="テーマを選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {allTopics.length > 0 ? (
                    allTopics.map((topic) => (
                      <SelectItem key={topic} value={topic}>
                        {topic}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_empty" disabled>
                      テーマがありません
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 統計表示 */}
            {selectedTopic && topicStats ? (
              <div className="space-y-4">
                {/* サマリー */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">問題数</p>
                    <p className="text-2xl font-bold">{topicStats.totalQuestions}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">正解数</p>
                    <p className="text-2xl font-bold">{topicStats.totalCorrect}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">正答率</p>
                    <p className={`text-2xl font-bold ${
                      topicStats.accuracy >= 80 ? "text-green-600" :
                      topicStats.accuracy >= 60 ? "text-yellow-600" : "text-red-600"
                    }`}>
                      {topicStats.accuracy}%
                    </p>
                  </div>
                </div>

                {/* 科目別内訳 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">科目別内訳</p>
                  <div className="space-y-2">
                    {SUBJECT_OPTIONS.map((subject) => {
                      const subjectData = topicStats.bySubject[subject]
                      if (subjectData.questions === 0) return null
                      const subjectAccuracy = Math.round((subjectData.correct / subjectData.questions) * 100)
                      const subjectInfo = SUBJECTS[subject]
                      return (
                        <div
                          key={subject}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: subjectInfo.color }}
                            />
                            <span className="text-sm font-medium">{subject}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">
                              {subjectData.correct}/{subjectData.questions}問
                            </span>
                            <Badge
                              variant={subjectAccuracy >= 70 ? "default" : "secondary"}
                              className="min-w-[50px] justify-center"
                            >
                              {subjectAccuracy}%
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  ※ 全期間の演習記録から集計（{topicStats.recordCount}件の記録）
                </p>
              </div>
            ) : selectedTopic ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>このテーマの演習記録がありません</p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>テーマを選択すると統計が表示されます</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* データが無い場合のメッセージ */}
        {filteredRecords.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {selectedPeriod === "week"
                  ? "今週のデータがありません"
                  : selectedPeriod === "month"
                  ? "今月のデータがありません"
                  : "学習記録がありません"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                学習記録を追加すると、ここに分析結果が表示されます
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
