import { redirect } from "next/navigation"

export default function Home() {
  // トップページはダッシュボードにリダイレクト
  redirect("/dashboard")
}
