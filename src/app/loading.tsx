import { Loading as LoadingSpinner } from "@/components/common/Loading"

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner size="md" />
    </div>
  )
}
