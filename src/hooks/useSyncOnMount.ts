"use client"

import { useEffect, useRef } from "react"
import { useRecordStore } from "@/stores/recordStore"
import { useNotesStore } from "@/stores/notesStore"

/**
 * アプリ起動時にNotionからデータを同期するフック
 * - 初回マウント時のみ実行
 * - オンライン時のみ同期を試みる
 * - バックグラウンドで実行（UIをブロックしない）
 */
export function useSyncOnMount() {
  const hasRun = useRef(false)
  const fetchRecordsFromNotion = useRecordStore((state) => state.fetchRecordsFromNotion)
  const fetchNotesFromNotion = useNotesStore((state) => state.fetchNotesFromNotion)
  const recordLastSyncedAt = useRecordStore((state) => state.lastSyncedAt)
  const noteLastSyncedAt = useNotesStore((state) => state.lastSyncedAt)

  useEffect(() => {
    // 初回のみ実行
    if (hasRun.current) return
    hasRun.current = true

    // オフラインの場合はスキップ
    if (!navigator.onLine) {
      console.log("[Sync] Offline - skipping initial sync")
      return
    }

    // 前回の同期から5分以上経過している場合のみ同期
    const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5分

    const shouldSyncRecords = !recordLastSyncedAt ||
      Date.now() - new Date(recordLastSyncedAt).getTime() > SYNC_INTERVAL_MS

    const shouldSyncNotes = !noteLastSyncedAt ||
      Date.now() - new Date(noteLastSyncedAt).getTime() > SYNC_INTERVAL_MS

    // バックグラウンドで同期（並行実行）
    const syncPromises: Promise<void>[] = []

    if (shouldSyncRecords) {
      console.log("[Sync] Fetching records from Notion...")
      syncPromises.push(
        fetchRecordsFromNotion()
          .then(() => console.log("[Sync] Records synced successfully"))
          .catch((error) => console.error("[Sync] Failed to sync records:", error))
      )
    }

    if (shouldSyncNotes) {
      console.log("[Sync] Fetching notes from Notion...")
      syncPromises.push(
        fetchNotesFromNotion()
          .then(() => console.log("[Sync] Notes synced successfully"))
          .catch((error) => console.error("[Sync] Failed to sync notes:", error))
      )
    }

    if (syncPromises.length === 0) {
      console.log("[Sync] Data is up to date - skipping sync")
    }
  }, [fetchRecordsFromNotion, fetchNotesFromNotion, recordLastSyncedAt, noteLastSyncedAt])
}

/**
 * オンライン復帰時に同期を試みるフック
 */
export function useSyncOnOnline() {
  const fetchRecordsFromNotion = useRecordStore((state) => state.fetchRecordsFromNotion)
  const fetchNotesFromNotion = useNotesStore((state) => state.fetchNotesFromNotion)

  useEffect(() => {
    const handleOnline = () => {
      console.log("[Sync] Online - syncing data...")
      Promise.all([
        fetchRecordsFromNotion(),
        fetchNotesFromNotion(),
      ]).catch((error) => {
        console.error("[Sync] Failed to sync on online:", error)
      })
    }

    window.addEventListener("online", handleOnline)
    return () => {
      window.removeEventListener("online", handleOnline)
    }
  }, [fetchRecordsFromNotion, fetchNotesFromNotion])
}
