"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"

interface ResizablePanelProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  defaultLeftWidth?: number // パーセント
  minLeftWidth?: number // パーセント
  maxLeftWidth?: number // パーセント
  storageKey?: string // localStorageに保存するキー
  className?: string
}

export function ResizableHorizontalPanel({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 66,
  minLeftWidth = 30,
  maxLeftWidth = 85,
  storageKey,
  className,
}: ResizablePanelProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // localStorageから初期値を読み込む
  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const width = parseFloat(stored)
        if (!isNaN(width) && width >= minLeftWidth && width <= maxLeftWidth) {
          setLeftWidth(width)
        }
      }
    }
  }, [storageKey, minLeftWidth, maxLeftWidth])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return

      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100

      if (newWidth >= minLeftWidth && newWidth <= maxLeftWidth) {
        setLeftWidth(newWidth)
      }
    },
    [isResizing, minLeftWidth, maxLeftWidth]
  )

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false)
      // localStorageに保存
      if (storageKey && typeof window !== "undefined") {
        localStorage.setItem(storageKey, leftWidth.toString())
      }
    }
  }, [isResizing, storageKey, leftWidth])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full", className)}
      style={{ cursor: isResizing ? "col-resize" : undefined }}
    >
      {/* 左パネル */}
      <div style={{ width: `${leftWidth}%` }} className="overflow-hidden">
        {leftPanel}
      </div>

      {/* リサイズハンドル */}
      <div
        className={cn(
          "w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors flex-shrink-0",
          isResizing && "bg-primary"
        )}
        onMouseDown={handleMouseDown}
      />

      {/* 右パネル */}
      <div style={{ width: `${100 - leftWidth}%` }} className="overflow-hidden">
        {rightPanel}
      </div>
    </div>
  )
}

interface ResizableVerticalPanelProps {
  topPanel: React.ReactNode
  bottomPanel: React.ReactNode
  defaultTopHeight?: number // パーセント
  minTopHeight?: number // パーセント
  maxTopHeight?: number // パーセント
  storageKey?: string
  className?: string
}

export function ResizableVerticalPanel({
  topPanel,
  bottomPanel,
  defaultTopHeight = 60,
  minTopHeight = 20,
  maxTopHeight = 85,
  storageKey,
  className,
}: ResizableVerticalPanelProps) {
  const [topHeight, setTopHeight] = useState(defaultTopHeight)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // localStorageから初期値を読み込む
  useEffect(() => {
    if (storageKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const height = parseFloat(stored)
        if (!isNaN(height) && height >= minTopHeight && height <= maxTopHeight) {
          setTopHeight(height)
        }
      }
    }
  }, [storageKey, minTopHeight, maxTopHeight])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return

      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const newHeight = ((e.clientY - rect.top) / rect.height) * 100

      if (newHeight >= minTopHeight && newHeight <= maxTopHeight) {
        setTopHeight(newHeight)
      }
    },
    [isResizing, minTopHeight, maxTopHeight]
  )

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false)
      if (storageKey && typeof window !== "undefined") {
        localStorage.setItem(storageKey, topHeight.toString())
      }
    }
  }, [isResizing, storageKey, topHeight])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col h-full", className)}
      style={{ cursor: isResizing ? "row-resize" : undefined }}
    >
      {/* 上パネル */}
      <div style={{ height: `${topHeight}%` }} className="overflow-hidden">
        {topPanel}
      </div>

      {/* リサイズハンドル */}
      <div
        className={cn(
          "h-1 bg-border hover:bg-primary/50 cursor-row-resize transition-colors flex-shrink-0",
          isResizing && "bg-primary"
        )}
        onMouseDown={handleMouseDown}
      />

      {/* 下パネル */}
      <div style={{ height: `${100 - topHeight}%` }} className="overflow-hidden">
        {bottomPanel}
      </div>
    </div>
  )
}
