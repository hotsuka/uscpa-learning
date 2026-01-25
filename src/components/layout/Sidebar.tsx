"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Timer, BookOpen, FileText, BarChart3, Settings, GraduationCap, Keyboard } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ダッシュボード" },
  { href: "/timer", icon: Timer, label: "タイマー" },
  { href: "/records", icon: BookOpen, label: "記録" },
  { href: "/materials", icon: FileText, label: "教材" },
  { href: "/analytics", icon: BarChart3, label: "分析" },
  { href: "/settings", icon: Settings, label: "設定" },
]

export function Sidebar() {
  const pathname = usePathname()

  // 教材詳細ページかどうか判定（/materials/[id] の形式）
  const isMaterialDetailPage = pathname.startsWith("/materials/") && pathname !== "/materials/"

  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-card h-screen fixed left-0 top-0">
      <div className="flex items-center gap-2 p-6 border-b">
        <GraduationCap className="h-8 w-8 text-primary" />
        <div>
          <h1 className="font-bold text-lg">USCPA学習管理</h1>
          <p className="text-xs text-muted-foreground">Study Tracker</p>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 教材詳細ページのショートカット説明 */}
      {isMaterialDetailPage && (
        <div className="p-4 border-t">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Keyboard className="h-4 w-4" />
            <span className="text-xs font-medium">ショートカット</span>
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">←/→</kbd>
              <span>ページ移動</span>
            </div>
            <div className="flex items-center justify-between">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">[ / ]</kbd>
              <span>縮小/拡大</span>
            </div>
            <div className="flex items-center justify-between">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+F</kbd>
              <span>検索</span>
            </div>
            <div className="flex items-center justify-between">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+S</kbd>
              <span>メモを保存</span>
            </div>
            <div className="flex items-center justify-between">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Space</kbd>
              <span>タイマー開始/停止</span>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Powered by Notion API
        </p>
      </div>
    </aside>
  )
}
