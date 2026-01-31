import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"

interface ErrorMessageProps {
  message: string
  className?: string
}

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <div className={cn("flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive", className)}>
      <AlertCircle className="h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  )
}
