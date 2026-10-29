import { upload } from "@vercel/blob/client"
import type { Material } from "@/types"
import { getPDFFromIndexedDB, savePDFToIndexedDB } from "@/lib/indexeddb"
import type { CloudManifest, CloudMaterial } from "@/lib/materials/cloudManifest"

// 合言葉は端末ごとに1回だけ入力してもらい、このブラウザに覚えさせる
const KEY_STORAGE = "uscpa-materials-cloud-key"
const KEY_HEADER = "x-materials-key"

export class CloudKeyError extends Error {}
export class CloudNotConfiguredError extends Error {}

export function getStoredKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE)
  } catch {
    return null
  }
}

export function setStoredKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    // 保存できなくても今回の操作は続ける
  }
}

const requireKey = (): string => {
  const key = getStoredKey()
  if (!key) throw new CloudKeyError("合言葉が未入力です")
  return key
}

const checkResponse = async (res: Response): Promise<void> => {
  if (res.ok) return
  if (res.status === 401) {
    setStoredKey(null)
    throw new CloudKeyError("合言葉が違います")
  }
  if (res.status === 503) throw new CloudNotConfiguredError("クラウド保存が未設定です")
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  throw new Error(body.error ?? `HTTP ${res.status}`)
}

export async function fetchManifest(): Promise<CloudManifest> {
  const res = await fetch("/api/materials", {
    headers: { [KEY_HEADER]: requireKey() },
    cache: "no-store",
  })
  await checkResponse(res)
  return (await res.json()) as CloudManifest
}

export async function pushMaterials(materials: CloudMaterial[]): Promise<CloudManifest> {
  const res = await fetch("/api/materials", {
    method: "PUT",
    headers: { [KEY_HEADER]: requireKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ materials }),
  })
  await checkResponse(res)
  return (await res.json()) as CloudManifest
}

export const pdfPathForHash = (hash: string): string => `materials/pdf/${hash}.pdf`

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// PDFをクラウドへ上げ、保存先パスを返す。同じ内容なら同じパスになるので二重に増えない
export async function uploadPdf(blob: Blob): Promise<string> {
  const pathname = pdfPathForHash(await sha256Hex(blob))
  await upload(pathname, blob, {
    access: "private",
    handleUploadUrl: "/api/materials/upload",
    clientPayload: requireKey(),
    contentType: "application/pdf",
    multipart: blob.size > 8 * 1024 * 1024,
  })
  return pathname
}

export async function downloadPdf(pathname: string): Promise<Blob> {
  const key = requireKey()
  const query = `path=${encodeURIComponent(pathname)}`
  const res = await fetch(`/api/materials/file?${query}`, {
    headers: { [KEY_HEADER]: key },
    cache: "no-store",
  })
  await checkResponse(res)
  const { url } = (await res.json()) as { url: string }
  try {
    const direct = await fetch(url)
    if (direct.ok) return await direct.blob()
    console.warn("Presigned download failed:", direct.status)
  } catch (error) {
    console.warn("Presigned download failed:", error)
  }
  // 期限付きURLで取れなかったときはサーバー経由で取る
  const streamed = await fetch(`/api/materials/file?${query}&mode=stream`, {
    headers: { [KEY_HEADER]: key },
    cache: "no-store",
  })
  await checkResponse(streamed)
  return await streamed.blob()
}

// クラウドへまだ送れていない削除の印。送る前に端末へ控え、次の同期で必ず送る
const TOMBSTONE_STORAGE_KEY = "uscpa-materials-cloud-deleted"

export function loadPendingTombstones(): CloudMaterial[] {
  try {
    return JSON.parse(localStorage.getItem(TOMBSTONE_STORAGE_KEY) ?? "[]") as CloudMaterial[]
  } catch {
    return []
  }
}

export function savePendingTombstones(tombstones: CloudMaterial[]): void {
  if (tombstones.length === 0) localStorage.removeItem(TOMBSTONE_STORAGE_KEY)
  else localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(tombstones))
}

// 削除した教材に印を付けて控える（クラウドのPDF本体は消さない）。控えた件数を返す
export function addPendingTombstones(removed: Material[]): number {
  const now = new Date().toISOString()
  const tombstones = removed
    .filter((m) => m.cloudPathWithout)
    .map((m) => ({ ...m, updatedAt: now, deletedAt: now }))
  if (tombstones.length > 0) {
    savePendingTombstones([...loadPendingTombstones(), ...tombstones])
  }
  return tombstones.length
}

// 端末の教材のうち、まだクラウドにPDFが無いもの
export const needsUpload = (m: Material): boolean =>
  Boolean(
    (m.pdfWithoutAnswers?.startsWith("indexeddb:") && !m.cloudPathWithout) ||
      (m.pdfWithAnswers?.startsWith("indexeddb:") && !m.cloudPathWith),
  )

/**
 * 教材PDFを表示用のURLで返す。この端末に無ければクラウドから取得してIndexedDBに保存する
 * （2回目以降はオフラインでも開ける）
 */
export async function loadMaterialPdfUrl(
  material: Material,
  type: "without" | "with",
): Promise<string | null> {
  const local = await getPDFFromIndexedDB(material.id, type)
  if (local) return local
  const cloudPath = type === "without" ? material.cloudPathWithout : material.cloudPathWith
  if (!cloudPath || !getStoredKey()) return null
  const blob = await downloadPdf(cloudPath)
  await savePDFToIndexedDB(material.id, blob, type)
  return URL.createObjectURL(blob)
}
