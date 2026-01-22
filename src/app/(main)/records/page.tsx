"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Clock, BookOpen } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DailySummary } from "@/components/records/DailySummary"
import { useRecordStore } from "@/stores/recordStore"
import { formatMinutes } from "@/lib/utils"

export default function RecordsPage() {
  const { records } = useRecordStore()
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0])

  // 日付の新しい順にソート
  const sortedRecords = [...records].sort((a, b) =>
    b.studiedAt.localeCompare(a.studiedAt) || b.createdAt.localeCompare(a.createdAt)
  )

  return (
    <>
      <Header title="記録" />
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold hidden md:block">学習記録</h1>
            <Button asChild>
              <Link href="/records/new">
                <Plus className="h-4 w-4 mr-2" />
                記録を追加
              </Link>
            </Button>
          </div>

          {/* 日別サマリー */}
          <DailySummary
            records={records}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />

          <div className="space-y-4">
            {sortedRecords.map((record) => {
              const accuracy = record.totalQuestions && record.correctAnswers
                ? Math.round((record.correctAnswers / record.totalQuestions) * 100)
                : null

              return (
                <Link key={record.id} href={`/records/${record.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={record.subject.toLowerCase() as "far" | "aud" | "reg" | "bar"}
                            >
                              {record.subject}
                            </Badge>
                            {record.recordType === "practice" && record.roundNumber && (
                              <span className="text-sm text-muted-foreground">
                                {record.roundNumber}周目
                              </span>
                            )}
                            {record.recordType === "textbook" && (
                              <Badge variant="outline" className="text-xs">
                                <BookOpen className="h-3 w-3 mr-1" />
                                テキスト
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium">
                            {record.subtopic || record.chapter || "テーマなし"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {record.studiedAt}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          {/* 学習時間 */}
                          <div className="flex items-center justify-end gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium text-foreground">
                              {formatMinutes(record.studyMinutes)}
                            </span>
                          </div>
                          {/* 正答率（過去問演習のみ） */}
                          {record.recordType === "practice" && accuracy !== null && (
                            <>
                              <p className="text-2xl font-bold">
                                {accuracy}%
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {record.correctAnswers}/{record.totalQuestions}問
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      {/* メモがあれば表示 */}
                      {record.memo && (
                        <p className="mt-2 text-sm text-muted-foreground border-t pt-2 line-clamp-2">
                          {record.memo}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {sortedRecords.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  まだ記録がありません
                </p>
                <Button asChild className="mt-4">
                  <Link href="/records/new">
                    <Plus className="h-4 w-4 mr-2" />
                    最初の記録を追加
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
