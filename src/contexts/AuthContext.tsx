"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

interface NotionUser {
  id: string
  name?: string
  avatarUrl?: string | null
  botId: string
  workspaceId: string
  workspaceName: string | null
  workspaceIcon: string | null
}

interface AuthContextType {
  user: NotionUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: () => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<NotionUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session")
      const data = await response.json()

      setUser(data.user)
      setIsAuthenticated(data.isAuthenticated)
    } catch {
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const login = useCallback(() => {
    window.location.href = "/api/auth/login"
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
      setIsAuthenticated(false)
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refresh: checkSession,
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
