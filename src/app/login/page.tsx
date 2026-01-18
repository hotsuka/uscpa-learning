"use client"

import { useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"

function LoginContent() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()

  const error = searchParams.get("error")

  useEffect(() => {
    // 既にログイン済みの場合はダッシュボードへ
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, isLoading, router])

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case "oauth_error":
        return "Notion認証中にエラーが発生しました。"
      case "no_code":
        return "認証コードが取得できませんでした。"
      case "not_configured":
        return "Notion連携が設定されていません。"
      case "token_exchange_failed":
        return "認証トークンの取得に失敗しました。"
      case "unexpected_error":
        return "予期しないエラーが発生しました。"
      default:
        return null
    }
  }

  const errorMessage = getErrorMessage(error)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">USCPA学習管理</CardTitle>
          <CardDescription>
            Notionアカウントでログインして、学習データを同期しましょう
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {errorMessage}
            </div>
          )}

          <Button
            onClick={login}
            className="w-full"
            size="lg"
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.166V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.746c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.494-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.933.653.933 1.166v16.946c0 1.073-.373 1.7-1.68 1.794l-15.458.933c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.668c0-.84.374-1.54 1.448-1.633z" />
            </svg>
            Notionでログイン
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>Notionアカウントをお持ちでない場合は、</p>
            <a
              href="https://www.notion.so/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              こちらから無料で作成できます
            </a>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">または</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/dashboard")}
          >
            ログインせずに使う
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            ログインせずに使用した場合、データはこのブラウザにのみ保存されます。
            Notionでログインすると、データがNotionと同期され、他のデバイスでもアクセスできます。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
