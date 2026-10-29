import { timingSafeEqual } from "node:crypto";
import { get, put } from "@vercel/blob";
import {
  EMPTY_MANIFEST,
  type CloudManifest,
} from "@/lib/materials/cloudManifest";

// 教材PDFは有料講座の資料なので、合言葉を知っている人だけが出し入れできるようにする
export const MATERIALS_KEY_HEADER = "x-materials-key";
const MANIFEST_PATH = "materials/index.json";

export function isCloudConfigured(): boolean {
  // ストアの接続方式によって、読み書きトークンかストアID（OIDC認証）のどちらかが入る
  const hasStore = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
    process.env.BLOB_STORE_ID?.trim(),
  );
  return hasStore && Boolean(process.env.MATERIALS_ACCESS_KEY?.trim());
}

export function isValidMaterialsKey(key: string | null | undefined): boolean {
  const expected = process.env.MATERIALS_ACCESS_KEY?.trim();
  if (!expected || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// PDFの置き場所は内容ハッシュで決める。同じPDFを別の端末から上げても1つにまとまる
export function isAllowedPdfPath(pathname: string): boolean {
  return /^materials\/pdf\/[0-9a-f]{64}\.pdf$/.test(pathname);
}

export async function readManifest(): Promise<CloudManifest> {
  const result = await get(MANIFEST_PATH, {
    access: "private",
    useCache: false,
  });
  if (!result || result.statusCode !== 200) return EMPTY_MANIFEST;
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text) as CloudManifest;
  return Array.isArray(parsed.materials) ? parsed : EMPTY_MANIFEST;
}

export async function writeManifest(manifest: CloudManifest): Promise<void> {
  await put(MANIFEST_PATH, JSON.stringify(manifest), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}
