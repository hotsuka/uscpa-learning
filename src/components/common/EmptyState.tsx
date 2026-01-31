import { cn } from "@/lib/utils"

interface EmptyStateProps {
  message: string
  className?: string
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
}
