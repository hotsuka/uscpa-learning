"use client"

import { useSyncOnMount, useSyncOnOnline } from "@/hooks/useSyncOnMount"

/**
 * アプリ起動時およびオンライン復帰時にNotionデータを同期するプロバイダー
 * メインレイアウトで使用する
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  // 初回マウント時に同期
  useSyncOnMount()

  // オンライン復帰時に同期
  useSyncOnOnline()

  return <>{children}</>
}
