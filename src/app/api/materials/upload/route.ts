import { NextResponse, type NextRequest } from "next/server"
import { issueSignedToken } from "@vercel/blob"
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client"
import {
  isAllowedPdfPath,
  isCloudConfigured,
  isValidMaterialsKey,
} from "@/lib/materials/cloudServer"

export const dynamic = "force-dynamic"

const MAX_PDF_BYTES = 200 * 1024 * 1024
const TOKEN_TTL_MS = 15 * 60 * 1000

// ブラウザから Vercel Blob へ直接アップロードするための期限付きURLを発行する。
// サーバー経由だと4.5MBの上限に当たるため、PDF本体はここを通さない。
// ストアはOIDC認証で接続しているので、読み書きトークン方式ではなく presigned 方式を使う
export async function POST(request: NextRequest) {
  if (!isCloudConfigured()) {
    return NextResponse.json(
      { error: "教材のクラウド保存が設定されていません" },
      { status: 503 },
    )
  }
  try {
    const body = (await request.json()) as HandleUploadPresignedBody
    const result = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        if (!isValidMaterialsKey(clientPayload)) {
          throw new Error("合言葉が違います")
        }
        if (!isAllowedPdfPath(pathname)) {
          throw new Error("保存先のパスが不正です")
        }
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          validUntil: Date.now() + TOKEN_TTL_MS,
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
        })
        return {
          token,
          urlOptions: {
            allowedContentTypes: ["application/pdf"],
            maximumSizeInBytes: MAX_PDF_BYTES,
            addRandomSuffix: false,
            allowOverwrite: true,
          },
        }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("Failed to issue upload URL:", error)
    const message = error instanceof Error ? error.message : "アップロードの準備に失敗しました"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
