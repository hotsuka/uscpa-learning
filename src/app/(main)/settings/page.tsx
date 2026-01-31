"use client"

import { useMemo, useEffect } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loading } from "@/components/common/Loading"
import { SUBJECTS, type Subject } from "@/types"
import { useSettingsStore } from "@/stores/settingsStore"
import { useRecordStore } from "@/stores/recordStore"
import { daysUntil } from "@/lib/utils"
import {
  Calendar,
  Clock,
  Database,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Info,
  Target,
  TrendingUp,
  RefreshCw,
  Bot,
  Loader2,
} from "lucide-react"
import { useAuthContext } from "@/contexts/AuthContext"
import {
  calculateWeeklyTarget,
  getThisWeekHolidays,
  getThisWeekMonday,
} from "@/lib/holidays"

export default function SettingsPage() {
  // 設定ストアから値を取得
  const {
    examDates,
    subjectTargetHours,
    weekdayTargetHours,
    weekendTargetHours,
    pomodoroMinutes,
    breakMinutes,
    setExamDate,
    setSubjectTargetHours,
    setWeekdayTargetHours,
    setWeekendTargetHours,
    setPomodoroMinutes,
    setBreakMinutes,
    getTotalTargetHours,
    isSyncing,
    syncToNotion,
    fetchFromNotion,
    notionPageId,
  } = useSettingsStore()

  // 初回マウント時にNotionから設定を読み込む
  useEffect(() => {
    // ローカルにnotion pageIdがない場合のみNotionからフェッチ
    if (!notionPageId) {
      fetchFromNotion()
    }
  }, [notionPageId, fetchFromNotion])

  // 学習記録から科目別の累計時間を取得
  const { records } = useRecordStore()
  const subjectStudyHours = useMemo(() => {
    const hours: Record<Subject, number> = { FAR: 0, AUD: 0, REG: 0, BAR: 0 }
    for (const record of records) {
      hours[record.subject] += (record.studyMinutes || 0) / 60
    }
    return hours
  }, [records])

  // 週間平均学習時間を計算（平日5日×平日時間 + 土日2日×休日時間）
  const weeklyAverageHours = useMemo(() => {
    return weekdayTargetHours * 5 + weekendTargetHours * 2
  }, [weekdayTargetHours, weekendTargetHours])

  // 推奨学習時間の参考データ
  const recommendedHours: Record<Subject, { min: number; max: number; description: string }> = {
    FAR: { min: 350, max: 450, description: "最もボリュームが大きい科目" },
    AUD: { min: 200, max: 300, description: "実務経験により変動" },
    REG: { min: 200, max: 300, description: "税法は暗記量が多い" },
    BAR: { min: 150, max: 250, description: "選択科目（BAR）" },
  }

  // 合計目標時間
  const totalTargetHours = getTotalTargetHours()

  // 週間目標の計算結果
  const weeklyTargetResult = useMemo(() => {
    return calculateWeeklyTarget(weekdayTargetHours, weekendTargetHours)
  }, [weekdayTargetHours, weekendTargetHours])

  // 今週の祝日情報
  const thisWeekHolidays = useMemo(() => getThisWeekHolidays(), [])

  // 今週の月曜日
  const thisWeekMonday = useMemo(() => getThisWeekMonday(), [])

  // Notion接続状態を取得
  const { user, isConnected, isConfigured, isLoading: authLoading, refresh, errorMessage } = useAuthContext()

  return (
    <>
      <Header title="設定" />
      <div className="p-4 md:p-8 space-y-6">
        {/* Notion連携状態 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Notion連携
            </CardTitle>
            <CardDescription>
              Notionデータベースとの接続状態
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authLoading ? (
              <Loading size="sm" message="接続状態を確認中..." />
            ) : !isConfigured ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">未設定</p>
                    <p className="text-sm text-muted-foreground">
                      環境変数でNotion APIを設定してください
                    </p>
                  </div>
                </div>
                {/* 未設定でも同期ボタンを表示（試行用） */}
                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    onClick={syncToNotion}
                    disabled={isSyncing}
                    className="w-full"
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    設定をNotionに同期
                  </Button>
                </div>
              </div>
            ) : isConnected && user ? (
              <div className="space-y-4">
                {/* ボット情報 */}
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <Bot className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{user.name || "Notion Integration"}</p>
                    <p className="text-sm text-muted-foreground">
                      Internal Integration
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>

                {/* 接続状態 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">接続済み</p>
                      <p className="text-sm text-muted-foreground">
                        データはNotionに同期されています
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={syncToNotion}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Notionに同期
                    </Button>
                    <Button variant="ghost" onClick={refresh}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-medium">接続エラー</p>
                      <p className="text-sm text-muted-foreground">
                        {errorMessage || "Notionへの接続に失敗しました"}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={refresh}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    再試行
                  </Button>
                </div>
                {/* エラー時も同期ボタンを表示 */}
                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    onClick={syncToNotion}
                    disabled={isSyncing}
                    className="w-full"
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    設定をNotionに同期
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 試験日設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              試験日設定
            </CardTitle>
            <CardDescription>
              各科目の受験予定日を設定してカウントダウンに反映
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {(Object.keys(SUBJECTS) as Subject[]).map((subject) => {
                const subjectInfo = SUBJECTS[subject]
                const examDate = examDates[subject]
                const days = examDate ? daysUntil(examDate) : null
                const targetHours = subjectTargetHours[subject]
                const studiedHours = Math.round(subjectStudyHours[subject] * 10) / 10
                const remainingHours = Math.max(0, targetHours - studiedHours)

                // 残り日数から見込み学習時間を計算
                // 週間平均時間を日割りにして、残り日数をかける
                const dailyAverageHours = weeklyAverageHours / 7
                const projectedHours = days !== null && days > 0
                  ? Math.round(dailyAverageHours * days * 10) / 10
                  : 0

                // 目標達成可能かどうか判定
                const canAchieve = projectedHours >= remainingHours
                const shortfall = remainingHours - projectedHours

                return (
                  <div key={subject} className="space-y-2 p-3 rounded-lg border">
                    <Label className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: subjectInfo.color }}
                      />
                      {subject} - {subjectInfo.name}
                    </Label>
                    <Input
                      type="date"
                      value={examDates[subject]}
                      onChange={(e) => setExamDate(subject, e.target.value)}
                    />

                    {/* 見込み学習時間の表示 */}
                    {examDate && days !== null && (
                      <div className="mt-2 pt-2 border-t space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">残り日数</span>
                          <span className="font-medium">{days}日</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">見込み学習時間</span>
                          <span className="font-medium">{projectedHours}時間</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">残り必要時間</span>
                          <span className="font-medium">
                            {remainingHours.toFixed(1)}時間
                            <span className="text-xs text-muted-foreground ml-1">
                              (目標{targetHours}h - 学習済{studiedHours}h)
                            </span>
                          </span>
                        </div>

                        {/* 達成可否の判定 */}
                        {days > 0 && (
                          <div className={`flex items-center gap-2 mt-2 p-2 rounded text-sm ${
                            canAchieve
                              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }`}>
                            {canAchieve ? (
                              <>
                                <TrendingUp className="h-4 w-4" />
                                <span>現在のペースで目標達成可能</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-4 w-4" />
                                <span>
                                  あと{Math.abs(shortfall).toFixed(1)}時間不足
                                  （1日+{(shortfall / days).toFixed(1)}h必要）
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {days <= 0 && (
                          <div className="flex items-center gap-2 mt-2 p-2 rounded text-sm bg-muted text-muted-foreground">
                            <Info className="h-4 w-4" />
                            <span>試験日を過ぎています</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 科目別目標学習時間 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              科目別目標学習時間
            </CardTitle>
            <CardDescription>
              各科目の累計目標学習時間を設定（USCPA合格には一般的に1,000〜1,500時間必要）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {(Object.keys(SUBJECTS) as Subject[]).map((subject) => {
                  const subjectInfo = SUBJECTS[subject]
                  const recommended = recommendedHours[subject]
                  return (
                    <div key={subject} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: subjectInfo.color }}
                        />
                        {subject} - {subjectInfo.name}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="1000"
                          value={subjectTargetHours[subject]}
                          onChange={(e) =>
                            setSubjectTargetHours(subject, parseInt(e.target.value) || 0)
                          }
                          className="w-24"
                        />
                        <span className="text-muted-foreground">時間</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        推奨: {recommended.min}〜{recommended.max}時間（{recommended.description}）
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* 合計表示 */}
              <div className="bg-muted/50 rounded-lg p-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">合計目標時間</span>
                  <span className="text-2xl font-bold">{totalTargetHours.toLocaleString()}時間</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  USCPA4科目合格の目安: 1,000〜1,500時間
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 週間学習目標 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              週間学習目標
            </CardTitle>
            <CardDescription>
              平日・休日それぞれの目標時間を設定（祝日は休日として計算）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* 平日・休日の目標時間入力 */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="weekdayTarget">平日の目標学習時間</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="weekdayTarget"
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={weekdayTargetHours}
                      onChange={(e) => setWeekdayTargetHours(parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">時間/日</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weekendTarget">休日の目標学習時間</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="weekendTarget"
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={weekendTargetHours}
                      onChange={(e) => setWeekendTargetHours(parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">時間/日</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    土日・祝日に適用されます
                  </p>
                </div>
              </div>

              {/* 週間目標の自動計算結果 */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="h-4 w-4" />
                  今週の目標（{thisWeekMonday.toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}〜）
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {weeklyTargetResult.totalHours.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">時間/週</span>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>平日 ({weeklyTargetResult.breakdown.weekdays}日)</span>
                    <span>{weeklyTargetResult.breakdown.weekdayHours.toFixed(1)}時間</span>
                  </div>
                  <div className="flex justify-between">
                    <span>土日 ({weeklyTargetResult.breakdown.weekends}日)</span>
                    <span>
                      {(weeklyTargetResult.breakdown.weekends * weekendTargetHours).toFixed(1)}時間
                    </span>
                  </div>
                  {weeklyTargetResult.breakdown.holidays > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>祝日 ({weeklyTargetResult.breakdown.holidays}日)</span>
                      <span>
                        {(weeklyTargetResult.breakdown.holidays * weekendTargetHours).toFixed(1)}時間
                      </span>
                    </div>
                  )}
                </div>

                {/* 今週の祝日表示 */}
                {thisWeekHolidays.length > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-primary mb-1">
                      <Info className="h-3 w-3" />
                      今週の祝日
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {thisWeekHolidays.map((holiday) => (
                        <Badge
                          key={holiday.date.toISOString()}
                          variant="secondary"
                          className="text-xs"
                        >
                          {holiday.date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                          {" "}{holiday.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 月間・年間の目安 */}
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-muted-foreground">月間目安（4週換算）</div>
                  <div className="text-xl font-semibold mt-1">
                    約{Math.round(weeklyTargetResult.totalHours * 4)}時間
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="text-muted-foreground">年間目安（52週換算）</div>
                  <div className="text-xl font-semibold mt-1">
                    約{Math.round(weeklyTargetResult.totalHours * 52)}時間
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ポモドーロ設定 */}
        <Card>
          <CardHeader>
            <CardTitle>ポモドーロ設定</CardTitle>
            <CardDescription>ポモドーロタイマーの時間設定</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pomodoro">作業時間</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="pomodoro"
                    type="number"
                    min="5"
                    max="60"
                    value={pomodoroMinutes}
                    onChange={(e) => setPomodoroMinutes(parseInt(e.target.value) || 25)}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">分</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="break">休憩時間</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="break"
                    type="number"
                    min="1"
                    max="30"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 5)}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">分</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 科目カラーリファレンス */}
        <Card>
          <CardHeader>
            <CardTitle>科目カラー</CardTitle>
            <CardDescription>各科目に割り当てられた識別カラー</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(SUBJECTS) as Subject[]).map((subject) => {
                const subjectInfo = SUBJECTS[subject]
                return (
                  <Badge
                    key={subject}
                    style={{
                      backgroundColor: subjectInfo.lightColor,
                      color: subjectInfo.color,
                    }}
                    className="px-4 py-2"
                  >
                    {subject}: {subjectInfo.name}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 設定は自動保存されることを表示 */}
        <div className="text-center text-sm text-muted-foreground">
          設定は自動的に保存されます
        </div>
      </div>
    </>
  )
}
