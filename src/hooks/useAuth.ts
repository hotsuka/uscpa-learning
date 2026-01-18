"use client"

import { useState, useEffect, useCallback } from "react"

interface NotionUser {
  id: string
  name?: string
  avatarUrl?: string | null
  botId: string
  workspaceId: string
  workspaceName: string | null
  workspaceIcon: string | null
}

interface AuthState {
  user: NotionUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  })

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      setAuthState({
        user: data.user,
        isAuthenticated: data.isAuthenticated,
        isLoading: false,
      })
    } catch {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const login = useCallback(() => {
    // Notion OAuthログインページへリダイレクト
    window.location.href = "/api/auth/login"
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
      // ログインページへリダイレクト
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }, [])

  return {
    ...authState,
    login,
    logout,
    refresh: checkSession,
  }
}
