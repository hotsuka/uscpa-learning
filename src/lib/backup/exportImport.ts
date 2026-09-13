import { BACKUP_KEYS, type BackupKey } from "./constants"
import { writeBackupMeta } from "./autoBackup"

export interface ExportPayload {
  schema: "uscpa-backup"
  schemaVersion: 1
  exportedAt: string
  data: Partial<Record<BackupKey, string>> // 各キーの localStorage 生文字列
}

const isBrowser = (): boolean => typeof window !== "undefined" && typeof localStorage !== "undefined"

const formatFilenameTimestamp = (d: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

/**
 * 現在の localStorage のうちバックアップ対象（BACKUP_KEYS）の生文字列を JSON 化してダウンロードする。
 * 問題演習の履歴に加え、学習記録・ノート・ページメモも含める。
 */
export function downloadCurrentStateAsJson(): void {
  if (!isBrowser()) return
  const data: Partial<Record<BackupKey, string>> = {}
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw !== null) data[key] = raw
  }
  const payload: ExportPayload = {
    schema: "uscpa-backup",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `uscpa-backup-${formatFilenameTimestamp(new Date())}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  // リマインダー表示の判定に使う最終ダウンロード日時を記録
  writeBackupMeta({ lastJsonDownloadAt: new Date().toISOString() })
}

const isExportPayload = (obj: unknown): obj is ExportPayload => {
  if (!obj || typeof obj !== "object") return false
  const o = obj as Record<string, unknown>
  if (o.schema !== "uscpa-backup") return false
  if (typeof o.schemaVersion !== "number") return false
  if (!o.data || typeof o.data !== "object") return false
  return true
}

/**
 * JSON ファイルから localStorage を復元する。ファイルに含まれているデータだけを上書きする
 * （学習記録などを含まない古い書き出しファイルでは、それらは今のまま残る）。
 * 呼び出し側で `window.location.reload()` を行うこと。
 */
export async function importFromJsonFile(
  file: File,
): Promise<{ ok: boolean; importedKeys: string[]; error?: string }> {
  if (!isBrowser()) return { ok: false, importedKeys: [], error: "ブラウザ環境ではありません" }
  try {
    const text = await file.text()
    const parsed: unknown = JSON.parse(text)
    if (!isExportPayload(parsed)) {
      return { ok: false, importedKeys: [], error: "JSON 形式が不正です" }
    }
    const imported: string[] = []
    for (const key of BACKUP_KEYS) {
      const raw = parsed.data[key]
      if (typeof raw === "string") {
        localStorage.setItem(key, raw)
        imported.push(key)
      }
    }
    return { ok: true, importedKeys: imported }
  } catch (e) {
    return { ok: false, importedKeys: [], error: e instanceof Error ? e.message : "読み込みエラー" }
  }
}
