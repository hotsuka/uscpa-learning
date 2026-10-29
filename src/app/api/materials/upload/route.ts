import { NextResponse, type NextRequest } from "next/server"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import {
  isAllowedPdfPath,
  isCloudConfigured,
  isValidMaterialsKey,
} from "@/lib/materials/cloudServer"

export const dynamic = "force-dynamic"

const MAX_PDF_BYTES = 200 * 1024 * 1024

// ブラウザから Vercel Blob へ直接アップロードするための一時トークンを発行する。
// サーバー経由だと4.5MBの上限に当たるため、PDF本体はここを通さない
export async function POST(request: NextRequest) {
  if (!isCloudConfigured()) {
    return NextResponse.json(
      { error: "教材のクラウド保存が設定されていません" },
      { status: 503 },
    )
  }
  try {
    const body = (await request.json()) as HandleUploadBody
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!isValidMaterialsKey(clientPayload)) {
          throw new Error("合言葉が違います")
        }
        if (!isAllowedPdfPath(pathname)) {
          throw new Error("保存先のパスが不正です")
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Failed to issue upload token:", error)
    const message = error instanceof Error ? error.message : "アップロードの準備に失敗しました"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
