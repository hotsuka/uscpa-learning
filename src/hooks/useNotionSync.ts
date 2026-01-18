"use client"

import { useState, useEffect, useCallback } from "react"

interface NotionStatus {
  configured: boolean
  connected: boolean
  databases?: {
    settings: boolean
    sessions: boolean
    records: boolean
    notes: boolean
  }
  message?: string
}

// Notion接続状態を管理するフック
export function useNotionStatus() {
  const [status, setStatus] = useState<NotionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/notion/status")
      if (!response.ok) {
        throw new Error("Failed to check Notion status")
      }
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setStatus({ configured: false, connected: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  return { status, loading, error, refresh: checkStatus }
}

// オフライン同期キューを管理
interface SyncQueueItem {
  id: string
  type: "settings" | "session" | "record" | "note"
  action: "create" | "update" | "delete"
  data: any
  timestamp: number
  retryCount: number
}

const SYNC_QUEUE_KEY = "uscpa-notion-sync-queue"
const MAX_RETRIES = 3

export function useSyncQueue() {
  const [queue, setQueue] = useState<SyncQueueItem[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  // キューを読み込み
  useEffect(() => {
    const stored = localStorage.getItem(SYNC_QUEUE_KEY)
    if (stored) {
      try {
        setQueue(JSON.parse(stored))
      } catch {
        localStorage.removeItem(SYNC_QUEUE_KEY)
      }
    }
  }, [])

  // キューを保存
  useEffect(() => {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
  }, [queue])

  // キューに追加
  const addToQueue = useCallback((item: Omit<SyncQueueItem, "id" | "timestamp" | "retryCount">) => {
    const newItem: SyncQueueItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    }
    setQueue((prev) => [...prev, newItem])
    return newItem.id
  }, [])

  // キューから削除
  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }, [])

  // 同期実行
  const processQueue = useCallback(async () => {
    if (isSyncing || queue.length === 0) return

    setIsSyncing(true)

    for (const item of queue) {
      try {
        let endpoint = ""
        let method = ""
        let body: any = null

        switch (item.type) {
          case "settings":
            endpoint = "/api/notion/settings"
            break
          case "session":
            endpoint = "/api/notion/sessions"
            break
          case "record":
            endpoint = "/api/notion/records"
            break
          case "note":
            endpoint = "/api/notion/notes"
            break
        }

        switch (item.action) {
          case "create":
            method = "POST"
            body = item.data
            break
          case "update":
            method = "PATCH"
            body = item.data
            break
          case "delete":
            method = "DELETE"
            endpoint += `?id=${item.data.id}`
            break
        }

        const response = await fetch(endpoint, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        })

        if (response.ok) {
          removeFromQueue(item.id)
        } else if (response.status === 503) {
          // Notion未設定 - スキップ
          break
        } else {
          // リトライ
          if (item.retryCount < MAX_RETRIES) {
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id ? { ...q, retryCount: q.retryCount + 1 } : q
              )
            )
          } else {
            // 最大リトライ回数超過 - 削除
            removeFromQueue(item.id)
            console.error(`Failed to sync item after ${MAX_RETRIES} retries:`, item)
          }
        }
      } catch (err) {
        console.error("Sync error:", err)
        // オフラインの場合は後で再試行
        if (!navigator.onLine) {
          break
        }
      }
    }

    setIsSyncing(false)
  }, [queue, isSyncing, removeFromQueue])

  // オンライン復帰時に同期
  useEffect(() => {
    const handleOnline = () => {
      processQueue()
    }

    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [processQueue])

  return {
    queue,
    queueLength: queue.length,
    isSyncing,
    addToQueue,
    removeFromQueue,
    processQueue,
  }
}

// 汎用的なNotion APIフック
export function useNotionApi<T>(
  endpoint: string,
  options?: {
    enabled?: boolean
    refetchInterval?: number
  }
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (options?.enabled === false) return

    try {
      setLoading(true)
      setError(null)
      const response = await fetch(endpoint)

      if (response.status === 503) {
        // Notion未設定
        setData(null)
        return
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [endpoint, options?.enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 定期的なリフェッチ
  useEffect(() => {
    if (!options?.refetchInterval) return

    const interval = setInterval(fetchData, options.refetchInterval)
    return () => clearInterval(interval)
  }, [fetchData, options?.refetchInterval])

  return { data, loading, error, refetch: fetchData }
}
