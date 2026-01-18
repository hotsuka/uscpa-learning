"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

interface NotionUser {
  id: string
  name?: string
  avatarUrl?: string | null
  type: string
}

interface AuthContextType {
  user: NotionUser | null
  isConnected: boolean
  isConfigured: boolean
  isLoading: boolean
  refresh: () => Promise<void>
  errorMessage: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<NotionUser | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const checkConnection = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      setUser(data.user)
      setIsConnected(data.isAuthenticated)
      setIsConfigured(data.isConfigured ?? false)
      setErrorMessage(data.message ?? null)
    } catch {
      setUser(null)
      setIsConnected(false)
      setIsConfigured(false)
      setErrorMessage("接続状態の確認に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  return (
    <AuthContext.Provider
      value={{
        user,
        isConnected,
        isConfigured,
        isLoading,
        refresh: checkConnection,
        errorMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider")
  }
  return context
}
