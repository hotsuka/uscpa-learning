/**
 * 回答履歴の自動バックアップ（IndexedDB）
 *
 * attempts（問題バンク・TBSの回答履歴）は localStorage 単独保存で Notion にも
 * 同期されないため、localStorage の破損・誤操作・migrate事故に備えて
 * アプリ起動時に24時間間隔で IndexedDB へスナップショットを保存する。
 * 世代数は TARGET_KEYS のキーごとに MAX_GENERATIONS 件までローテーションする。
 */

import { openDB, BACKUP_STORE_NAME } from "@/lib/indexeddb";
import { TARGET_KEYS, RECORD_ARRAY_PATH, type TargetKey } from "./constants";

const META_KEY = "uscpa-backup-meta";
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_GENERATIONS = 7;

interface StoredAutoBackup {
  id: string; // `${originalKey}.auto.${ISO8601}`
  originalKey: TargetKey;
  createdAt: string;
  data: string; // localStorage の生文字列（Zustand persist 形式）
}

export interface IndexedDbBackupItem {
  id: string;
  originalKey: TargetKey;
  createdAt: string;
  byteSize: number;
  recordCount: number | null;
}

export interface BackupMeta {
  lastAutoBackupAt?: string;
  lastJsonDownloadAt?: string;
  reminderDismissedOn?: string; // JST日付文字列（その日はリマインダーを表示しない）
}

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof localStorage !== "undefined";

export function readBackupMeta(): BackupMeta {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as BackupMeta;
  } catch {
    return {};
  }
}

export function writeBackupMeta(patch: Partial<BackupMeta>): void {
  if (!isBrowser()) return;
  try {
    const next = { ...readBackupMeta(), ...patch };
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    // メタ情報の保存失敗はバックアップ本体に影響させない
  }
}

// Zustand persist 形式の生文字列からレコード件数を取り出す（表示用）
const extractRecordCount = (key: TargetKey, raw: string): number | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    const arrayPath = RECORD_ARRAY_PATH[key];
    const state = (parsed as { state?: Record<string, unknown> }).state;
    const arr = state?.[arrayPath];
    return Array.isArray(arr) ? arr.length : null;
  } catch {
    return null;
  }
};

const getAllBackups = (db: IDBDatabase): Promise<StoredAutoBackup[]> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE_NAME, "readonly");
    const request = tx.objectStore(BACKUP_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as StoredAutoBackup[]);
    request.onerror = () => reject(request.error);
  });

// キーごとに新しい順で MAX_GENERATIONS 件を超えた分を削除する
const pruneOldBackups = async (db: IDBDatabase): Promise<void> => {
  const all = await getAllBackups(db);
  const idsToDelete: string[] = [];
  for (const key of TARGET_KEYS) {
    const ofKey = all
      .filter((b) => b.originalKey === key)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const old of ofKey.slice(MAX_GENERATIONS)) {
      idsToDelete.push(old.id);
    }
  }
  if (idsToDelete.length === 0) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE_NAME, "readwrite");
    const store = tx.objectStore(BACKUP_STORE_NAME);
    for (const id of idsToDelete) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * 前回の自動バックアップから24時間以上経過していたら実行する。
 * 実行した場合は true を返す。アプリ起動時（SyncProvider）から呼ばれる。
 */
export async function runAutoBackupIfNeeded(): Promise<boolean> {
  if (!isBrowser()) return false;

  const meta = readBackupMeta();
  if (
    meta.lastAutoBackupAt &&
    Date.now() - new Date(meta.lastAutoBackupAt).getTime() <
      AUTO_BACKUP_INTERVAL_MS
  ) {
    return false;
  }

  const now = new Date().toISOString();
  const targets: StoredAutoBackup[] = [];
  for (const key of TARGET_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      targets.push({
        id: `${key}.auto.${now}`,
        originalKey: key,
        createdAt: now,
        data: raw,
      });
    }
  }
  if (targets.length === 0) return false;

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE_NAME, "readwrite");
    const store = tx.objectStore(BACKUP_STORE_NAME);
    for (const backup of targets) store.put(backup);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await pruneOldBackups(db);

  writeBackupMeta({ lastAutoBackupAt: now });
  return true;
}

/**
 * IndexedDB内の自動バックアップ一覧（新しい順）
 */
export async function listIndexedDbBackups(): Promise<IndexedDbBackupItem[]> {
  if (!isBrowser()) return [];
  const db = await openDB();
  const all = await getAllBackups(db);
  return all
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => ({
      id: b.id,
      originalKey: b.originalKey,
      createdAt: b.createdAt,
      byteSize: b.data.length,
      recordCount: extractRecordCount(b.originalKey, b.data),
    }));
}

/**
 * 自動バックアップから localStorage に復元する。
 * 呼び出し側で復元前スナップショット取得と `window.location.reload()` を行うこと。
 */
export async function restoreFromIndexedDbBackup(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isBrowser()) return { ok: false, error: "ブラウザ環境ではありません" };
  try {
    const db = await openDB();
    const backup = await new Promise<StoredAutoBackup | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(BACKUP_STORE_NAME, "readonly");
        const request = tx.objectStore(BACKUP_STORE_NAME).get(id);
        request.onsuccess = () =>
          resolve(request.result as StoredAutoBackup | undefined);
        request.onerror = () => reject(request.error);
      },
    );
    if (!backup) return { ok: false, error: "バックアップが見つかりません" };
    localStorage.setItem(backup.originalKey, backup.data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "復元エラー" };
  }
}

/**
 * 自動バックアップを1件削除する
 */
export async function deleteIndexedDbBackup(id: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE_NAME, "readwrite");
    tx.objectStore(BACKUP_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
