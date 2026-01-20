"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { BottomNav } from "@/components/layout/BottomNav"
import { SyncProvider } from "@/components/providers/SyncProvider"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
