"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Timer, BookOpen, CalendarDays, TrendingUp, Target, Clock, AlertCircle, CheckCircle } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { formatMinutes, daysUntil } from "@/lib/utils"
import { SUBJECTS, SUBJECT_OPTIONS, type Subject } from "@/types"
import { useRecordStore } from "@/stores/recordStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { calculateWeeklyTarget } from "@/lib/holidays"

export default function DashboardPage() {
  const { records, getTodayTotalMinutes } = useRecordStore()
  const {
    examDates,
    subjectTargetHours,
    weekdayTargetHours,
    weekendTargetHours,
  } = useSettingsStore()

  // 今週の週間目標を計算（祝日を考慮）
  const weeklyTargetResult = useMemo(() => {
    return calculateWeeklyTarget(weekdayTargetHours, weekendTargetHours)
  }, [weekdayTargetHours, weekendTargetHours])

  const weeklyTargetMinutes = weeklyTargetResult.totalHours * 60

  // 今日の統計を計算
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const todayRecords = records.filter((r) => r.studiedAt === today)

    const studyMinutes = todayRecords.reduce((sum, r) => sum + (r.studyMinutes || 0), 0)
    const practiceRecords = todayRecords.filter((r) => r.recordType === "practice")
    const totalQuestions = practiceRecords.reduce((sum, r) => sum + (r.totalQuestions || 0), 0)
    const correctAnswers = practiceRecords.reduce((sum, r) => sum + (r.correctAnswers || 0), 0)
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

    return { studyMinutes, totalQuestions, accuracy }
  }, [records])

  // 今週の学習時間を計算
  const weeklyStudyMinutes = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    const day = monday.getDay()
    const diff = day === 0 ? -6 : 1 - day
    monday.setDate(monday.getDate() + diff)
    monday.setHours(0, 0, 0, 0)

    const mondayStr = monday.toISOString().split("T")[0]
    const thisWeekRecords = records.filter((r) => r.studiedAt >= mondayStr)
    return thisWeekRecords.reduce((sum, r) => sum + (r.studyMinutes || 0), 0)
  }, [records])

  // 科目別の累計学習時間を計算
  const subjectStudyHours = useMemo(() => {
    const hours: Record<Subject, number> = { FAR: 0, AUD: 0, REG: 0, BAR: 0 }
    for (const record of records) {
      hours[record.subject] += (record.studyMinutes || 0) / 60
    }
    // 小数点1桁に丸める
    for (const subject of SUBJECT_OPTIONS) {
      hours[subject] = Math.round(hours[subject] * 10) / 10
    }
    return hours
  }, [records])

  const weeklyProgress = weeklyTargetMinutes > 0
    ? Math.round((weeklyStudyMinutes / weeklyTargetMinutes) * 100)
    : 0

  // 総合計の計算
  const totalStudyHours = Object.values(subjectStudyHours).reduce((sum, h) => sum + h, 0)
  const totalTargetHours = Object.values(subjectTargetHours).reduce((sum, h) => sum + h, 0)
  const totalProgress = totalTargetHours > 0 ? Math.round((totalStudyHours / totalTargetHours) * 100) : 0

  // タイマーの今日の時間も加算して表示
  const todayTimerMinutes = getTodayTotalMinutes()
  const todayDisplayMinutes = todayStats.studyMinutes + todayTimerMinutes

  return (
    <>
      <Header title="ダッシュボード" />
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 試験日カウントダウン */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                試験日カウントダウン
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {SUBJECT_OPTIONS.map((subject) => {
                  const examDate = examDates[subject]
                  const days = examDate ? daysUntil(examDate) : null
                  const targetHours = subjectTargetHours[subject]
                  const studiedHours = subjectStudyHours[subject]
                  const remainingHours = Math.max(0, targetHours - studiedHours)
                  const requiredPacePerDay = days && days > 0 ? remainingHours / days : 0
                  const isOnTrack = days !== null && days > 0 && requiredPacePerDay <= (weekdayTargetHours + weekendTargetHours) / 2

                  return (
                    <div
                      key={subject}
                      className="text-center p-3 rounded-lg bg-muted"
                    >
                      <Badge
                        variant={subject.toLowerCase() as "far" | "aud" | "reg" | "bar"}
                        className="mb-2"
                      >
                        {subject}
                      </Badge>
                      {days !== null ? (
                        <>
                          <p className="text-3xl font-bold">{days}</p>
                          <p className="text-xs text-muted-foreground mb-2">日</p>
                          {days > 0 && targetHours > 0 && (
                            <div className="text-xs space-y-1">
                              <p className="text-muted-foreground">
                                残り {remainingHours.toFixed(0)}h
                              </p>
                              <p className={`font-medium flex items-center justify-center gap-1 ${
                                isOnTrack ? "text-green-600" : "text-amber-600"
                              }`}>
                                {isOnTrack ? (
                                  <CheckCircle className="h-3 w-3" />
                                ) : (
                                  <AlertCircle className="h-3 w-3" />
                                )}
                                {requiredPacePerDay.toFixed(1)}h/日
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">未設定</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* 今日のサマリー */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">今日の学習</p>
                    <p className="text-2xl font-bold">
                      {formatMinutes(todayDisplayMinutes)}
                    </p>
                    {todayTimerMinutes > 0 && todayStats.studyMinutes > 0 && (
                      <p className="text-xs text-muted-foreground">
                        記録: {formatMinutes(todayStats.studyMinutes)} + タイマー: {formatMinutes(todayTimerMinutes)}
                      </p>
                    )}
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">解いた問題</p>
                    <p className="text-2xl font-bold">
                      {todayStats.totalQuestions}問
                    </p>
                  </div>
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">正答率</p>
                    <p className="text-2xl font-bold">
                      {todayStats.accuracy > 0 ? `${todayStats.accuracy}%` : "-"}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 週間進捗 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">週間進捗</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {formatMinutes(weeklyStudyMinutes)} /{" "}
                  {formatMinutes(weeklyTargetMinutes)}
                </span>
                <span>{weeklyProgress}%</span>
              </div>
              <Progress value={Math.min(weeklyProgress, 100)} className="h-3" />
              <p className="text-xs text-muted-foreground">
                今週の目標: 平日{weekdayTargetHours}時間 × {weeklyTargetResult.breakdown.weekdays}日 +
                休日{weekendTargetHours}時間 × {weeklyTargetResult.breakdown.weekends + weeklyTargetResult.breakdown.holidays}日
              </p>
            </CardContent>
          </Card>

          {/* 総合進捗（科目別） */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                科目別進捗
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 科目別進捗バー */}
              {SUBJECT_OPTIONS.map((subject) => {
                const studyHours = subjectStudyHours[subject]
                const targetHours = subjectTargetHours[subject]
                const progress = targetHours > 0 ? Math.round((studyHours / targetHours) * 100) : 0
                const subjectInfo = SUBJECTS[subject]
                return (
                  <div key={subject} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: subjectInfo.color }}
                        />
                        <span className="font-medium">{subject}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {studyHours}h / {targetHours}h ({progress}%)
                      </span>
                    </div>
                    <Progress
                      value={progress}
                      className="h-2"
                      style={{
                        // @ts-expect-error CSS custom property
                        "--progress-color": subjectInfo.color,
                      }}
                    />
                  </div>
                )
              })}

              {/* 合計 */}
              <div className="pt-3 border-t mt-4">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>合計</span>
                  <span>
                    {totalStudyHours.toFixed(1)}h / {totalTargetHours}h ({totalProgress}%)
                  </span>
                </div>
                <Progress value={totalProgress} className="h-3 mt-2" />
              </div>
            </CardContent>
          </Card>

          {/* クイックアクション */}
          <div className="grid grid-cols-2 gap-4">
            <Button asChild size="lg" className="h-16">
              <Link href="/timer">
                <Timer className="h-5 w-5 mr-2" />
                学習を始める
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-16">
              <Link href="/records/new">
                <BookOpen className="h-5 w-5 mr-2" />
                記録を追加
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
