import { Badge } from "@/components/ui/badge"
import type { Subject } from "@/types"
import { cn } from "@/lib/utils"

interface SubjectBadgeProps {
  subject: Subject
  className?: string
}

export function SubjectBadge({ subject, className }: SubjectBadgeProps) {
  return (
    <Badge
      variant={subject.toLowerCase() as "far" | "aud" | "reg" | "bar"}
      className={cn(className)}
    >
      {subject}
    </Badge>
  )
}
