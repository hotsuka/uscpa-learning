import { cn } from "@/lib/utils"
import { type ReactNode } from "react"
import { type LucideIcon } from "lucide-react"

interface EmptyStateProps {
  message: string
  icon?: LucideIcon
  children?: ReactNode
  className?: string
}

export function EmptyState({ message, icon: Icon, children, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-8", className)}>
      {Icon && <Icon className="h-12 w-12 text-muted-foreground mb-4" />}
      <p className="text-muted-foreground text-sm">{message}</p>
      {children}
    </div>
  )
}
