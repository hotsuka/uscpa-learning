"use client"

import { GraduationCap } from "lucide-react"

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-background border-b md:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="font-semibold">
            {title || "USCPA学習管理"}
          </span>
        </div>
      </div>
    </header>
  )
}
