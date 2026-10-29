import { NextResponse, type NextRequest } from "next/server"
import { get, issueSignedToken, presignUrl } from "@vercel/blob"
import {
  MATERIALS_KEY_HEADER,
  isAllowedPdfPath,
  isCloudConfigured,
  isValidMaterialsKey,
} from "@/lib/materials/cloudServer"

export const dynamic = "force-dynamic"

const URL_TTL_MS = 10 * 60 * 1000

// 非公開PDFの取得。既定は期限付きURLを返し、ブラウザがBlobから直接取る（関数の応答サイズ上限を避ける）。
// mode=stream のときはサーバー経由で本体を返す（期限付きURLが使えないときの予備）
export async function GET(request: NextRequest) {
  if (!isCloudConfigured()) {
    return NextResponse.json(
      { error: "教材のクラウド保存が設定されていません" },
      { status: 503 },
    )
  }
  if (!isValidMaterialsKey(request.headers.get(MATERIALS_KEY_HEADER))) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 })
  }

  const pathname = request.nextUrl.searchParams.get("path") ?? ""
  if (!isAllowedPdfPath(pathname)) {
    return NextResponse.json({ error: "パスが不正です" }, { status: 400 })
  }

  try {
    if (request.nextUrl.searchParams.get("mode") === "stream") {
      const result = await get(pathname, { access: "private" })
      if (!result || result.statusCode !== 200) {
        return NextResponse.json({ error: "PDFが見つかりません" }, { status: 404 })
      }
      return new NextResponse(result.stream, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, no-store",
        },
      })
    }

    const validUntil = Date.now() + URL_TTL_MS
    const token = await issueSignedToken({
      pathname,
      operations: ["get"],
      validUntil,
    })
    const { presignedUrl } = await presignUrl(token, {
      operation: "get",
      pathname,
      access: "private",
      validUntil,
    })
    return NextResponse.json({ url: presignedUrl })
  } catch (error) {
    console.error("Failed to get material PDF:", error)
    return NextResponse.json({ error: "PDFの取得に失敗しました" }, { status: 500 })
  }
}
