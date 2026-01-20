"use client"

import { useState, useEffect } from "react"

/**
 * メディアクエリの状態を監視するフック
 * @param query メディアクエリ文字列（例: "(min-width: 768px)"）
 * @returns メディアクエリにマッチしているかどうか
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)

    // 初期値を設定
    setMatches(mediaQuery.matches)

    // 変更を監視
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [query])

  return matches
}

/**
 * Tailwindのブレークポイントに基づくフック
 * md以上（768px以上）かどうかを返す
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)")
}
