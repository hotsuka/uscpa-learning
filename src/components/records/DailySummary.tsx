"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Target, CheckCircle2, Percent, ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { formatMinutes } from "@/lib/utils"
import type { StudyRecord } from "@/types"

interface DailySummaryProps {
  records: StudyRecord[]
  selectedDate: string // YYYY-MM-DD形式
  onDateChange: (date: string) => void
}

export function DailySummary({ records, selectedDate, onDateChange }: DailySummaryProps) {
  // 選択した日付の記録を集計
  const dailyStats = useMemo(() => {
    const dailyRecords = records.filter((r) => r.studiedAt === selectedDate)

    const totalStudyMinutes = dailyRecords.reduce((sum, r) => sum + (r.studyMinutes || 0), 0)
    const practiceRecords = dailyRecords.filter((r) => r.recordType === "practice")
    const totalQuestions = practiceRecords.reduce((sum, r) => sum + (r.totalQuestions || 0), 0)
    const totalCorrect = practiceRecords.reduce((sum, r) => sum + (r.correctAnswers || 0), 0)
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null

    return {
      recordCount: dailyRecords.length,
      totalStudyMinutes,
      totalQuestions,
      totalCorrect,
      accuracy,
    }
  }, [records, selectedDate])

  // 日付を前後に移動
  const changeDate = (days: number) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    onDateChange(date.toISOString().split("T")[0])
  }

  // 今日の日付
  const today = new Date().toISOString().split("T")[0]

  // 日付のフォーマット
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = weekdays[date.getDay()]
    return `${month}/${day} (${weekday})`
  }

  // 正答率の色
  const getAccuracyColor = (accuracy: number | null) => {
    if (accuracy === null) return "text-muted-foreground"
    if (accuracy >= 80) return "text-green-600"
    if (accuracy >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        {/* 日付選択 */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={() => changeDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-[120px] justify-center">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatDate(selectedDate)}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => changeDate(1)}
            disabled={selectedDate >= today}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {selectedDate !== today && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDateChange(today)}
              className="ml-2"
            >
              今日
            </Button>
          )}
        </div>

        {/* サマリー表示 */}
        {dailyStats.recordCount === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-2">
            この日の記録はありません
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 学習時間 */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">学習時間</p>
                <p className="font-bold text-lg">{formatMinutes(dailyStats.totalStudyMinutes)}</p>
              </div>
            </div>

            {/* 問題数 */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">問題数</p>
                <p className="font-bold text-lg">{dailyStats.totalQuestions}問</p>
              </div>
            </div>

            {/* 正解数 */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">正解数</p>
                <p className="font-bold text-lg">{dailyStats.totalCorrect}問</p>
              </div>
            </div>

            {/* 正答率 */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Percent className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">正答率</p>
                <p className={`font-bold text-lg ${getAccuracyColor(dailyStats.accuracy)}`}>
                  {dailyStats.accuracy !== null ? `${dailyStats.accuracy}%` : "-"}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
