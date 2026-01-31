import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold mb-2">404</h2>
      <p className="text-muted-foreground mb-6">
        ページが見つかりません
      </p>
      <Button asChild>
        <Link href="/dashboard">ダッシュボードに戻る</Link>
      </Button>
    </div>
  )
}
