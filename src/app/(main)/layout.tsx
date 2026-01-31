"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { BottomNav } from "@/components/layout/BottomNav"
import { SyncProvider } from "@/components/providers/SyncProvider"
import { Loading } from "@/components/common/Loading"
import { useHydration } from "@/hooks/useHydration"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const hydrated = useHydration()

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <SyncProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="md:ml-64 pb-20 md:pb-0">
          {children}
        </main>
        <BottomNav />
      </div>
    </SyncProvider>
  )
}
