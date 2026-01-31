import { useEffect, useState } from "react"

/**
 * SSR/クライアントハイドレーションの完了を検知するフック。
 * サーバーレンダリング時と初回クライアントレンダリング時はfalseを返し、
 * useEffect実行後（ハイドレーション完了後）にtrueを返す。
 *
 * Zustand persistストアのlocalStorageデータがSSRデフォルト値と異なる場合の
 * React Error #418（ハイドレーション不一致）を防止するために使用。
 */
export function useHydration() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated
}
