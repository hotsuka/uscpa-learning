// Notion API レスポンスの型定義

import type { Subject, RecordType } from "@/types"

// Notionページのプロパティ型
export interface NotionSettingsProperties {
  名前: { title: Array<{ text: { content: string } }> }
  目標学習時間: { number: number | null }
  FAR試験日: { date: { start: string } | null }
  AUD試験日: { date: { start: string } | null }
  REG試験日: { date: { start: string } | null }
  BAR試験日: { date: { start: string } | null }
  平日目標時間: { number: number | null }
  休日目標時間: { number: number | null }
  FAR目標時間: { number: number | null }
  AUD目標時間: { number: number | null }
  REG目標時間: { number: number | null }
  BAR目標時間: { number: number | null }
}

export interface NotionSessionProperties {
  名前: { title: Array<{ text: { content: string } }> }
  科目: { select: { name: string } | null }
  "学習時間(分)": { number: number | null }
  開始日時: { date: { start: string } | null }
  終了日時: { date: { start: string } | null }
}

export interface NotionRecordProperties {
  名前: { title: Array<{ text: { content: string } }> }
  科目: { select: { name: string } | null }
  記録タイプ: { select: { name: string } | null }
  テーマ: { rich_text: Array<{ text: { content: string } }> }
  "学習時間(分)": { number: number | null }
  問題数: { number: number | null }
  正解数: { number: number | null }
  周回数: { number: number | null }
  チャプター: { rich_text: Array<{ text: { content: string } }> }
  ページ範囲: { rich_text: Array<{ text: { content: string } }> }
  メモ: { rich_text: Array<{ text: { content: string } }> }
  演習日: { date: { start: string } | null }
}

export interface NotionNoteProperties {
  名前: { title: Array<{ text: { content: string } }> }
  科目: { select: { name: string } | null }
  タグ: { multi_select: Array<{ name: string }> }
  周回数: { number: number | null }
}

// ローカル型へのマッピング用ヘルパー
export type NotionSubject = "FAR" | "AUD" | "REG" | "BAR"
export type NotionRecordType = "practice" | "textbook"

// Notionプロパティからテキストを取得
export function getTitleText(title: Array<{ text: { content: string } }>): string {
  return title.map((t) => t.text.content).join("")
}

export function getRichText(richText: Array<{ text: { content: string } }>): string {
  return richText.map((t) => t.text.content).join("")
}

// 日付文字列を取得
export function getDateString(date: { start: string } | null): string | null {
  return date?.start || null
}

// セレクトの値を取得
export function getSelectValue(select: { name: string } | null): string | null {
  return select?.name || null
}

// マルチセレクトの値を取得
export function getMultiSelectValues(multiSelect: Array<{ name: string }>): string[] {
  return multiSelect.map((s) => s.name)
}
