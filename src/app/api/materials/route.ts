import { NextResponse, type NextRequest } from "next/server"
import {
  MATERIALS_KEY_HEADER,
  isCloudConfigured,
  isValidMaterialsKey,
  readManifest,
  writeManifest,
} from "@/lib/materials/cloudServer"
import {
  mergeIntoManifest,
  type CloudMaterial,
} from "@/lib/materials/cloudManifest"

export const dynamic = "force-dynamic"

const guard = (request: NextRequest): NextResponse | null => {
  if (!isCloudConfigured()) {
    return NextResponse.json(
      { error: "教材のクラウド保存が設定されていません" },
      { status: 503 },
    )
  }
  if (!isValidMaterialsKey(request.headers.get(MATERIALS_KEY_HEADER))) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 })
  }
  return null
}

// クラウドの教材一覧を返す
export async function GET(request: NextRequest) {
  const denied = guard(request)
  if (denied) return denied
  try {
    return NextResponse.json(await readManifest())
  } catch (error) {
    console.error("Failed to read materials manifest:", error)
    return NextResponse.json(
      { error: "教材一覧の取得に失敗しました" },
      { status: 500 },
    )
  }
}

// 端末側の教材をクラウドの一覧に足し込む（行は消さない）
export async function PUT(request: NextRequest) {
  const denied = guard(request)
  if (denied) return denied
  try {
    const body = (await request.json()) as { materials?: CloudMaterial[] }
    if (!Array.isArray(body.materials)) {
      return NextResponse.json({ error: "materials がありません" }, { status: 400 })
    }
    const merged = mergeIntoManifest(await readManifest(), body.materials)
    await writeManifest(merged)
    return NextResponse.json(merged)
  } catch (error) {
    console.error("Failed to update materials manifest:", error)
    return NextResponse.json(
      { error: "教材一覧の保存に失敗しました" },
      { status: 500 },
    )
  }
}
