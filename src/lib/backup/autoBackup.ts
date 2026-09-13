/**
 * バックアップのスナップショット（IndexedDB）
 *
 * 自動（アプリ起動時に24時間間隔）・手動・データ移行前のバックアップをすべてIndexedDBに保存する。
 * localStorageは容量が約5MBしかなく、バックアップを置くと本体データの保存が失敗するため使わない。
 * 世代数はデータの種類×バックアップの種別ごとに MAX_GENERATIONS 件までローテーションする。
 */

import { openDB, BACKUP_STORE_NAME } from "@/lib/indexeddb";
import {
  BACKUP_KEYS,
  RECORD_ARRAY_PATH,
  type BackupKey,
  type SnapshotType,
} from "./constants";
import { selectSnapshotsToPrune } from "./prune";

const META_KEY = "uscpa-backup-meta";
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface StoredSnapshot {
  id: string; // `${originalKey}.${type}.${ISO8601}`
  originalKey: string;
  createdAt: string;
  // 種別を持たない既存の保存分は自動バックアップ
  type?: SnapshotType;
  // 移行前バックアップの移行元バージョンなど
  label?: string;
  data: string; // localStorage の生文字列
}

export interface IndexedDbBackupItem {
  id: string;
  originalKey: string;
  createdAt: string;
  type: SnapshotType;
  label?: string;
  byteSize: number;
  recordCount: number | null;
}

export interface SnapshotEntry {
  originalKey: string;
  data: string;
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
const extractRecordCount = (key: string, raw: string): number | null => {
  const arrayPath = RECORD_ARRAY_PATH[key as BackupKey];
  if (!arrayPath) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const state = (parsed as { state?: Record<string, unknown> }).state;
    const arr = state?.[arrayPath];
    return Array.isArray(arr) ? arr.length : null;
  } catch {
    return null;
  }
};

const getAllSnapshots = (db: IDBDatabase): Promise<StoredSnapshot[]> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE_NAME, "readonly");
    const request = tx.objectStore(BACKUP_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as StoredSnapshot[]);
    request.onerror = () => reject(request.error);
  });

const pruneOldSnapshots = async (db: IDBDatabase): Promise<void> => {
  const idsToDelete = selectSnapshotsToPrune(await getAllSnapshots(db));
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
 * スナップショットをまとめてIndexedDBに保存し、古い世代を整理する。
 */
export async function saveSnapshots(
  type: SnapshotType,
  entries: SnapshotEntry[],
  label?: string,
): Promise<void> {
  if (!isBrowser() || entries.length === 0) return;
  const now = new Date().toISOString();
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE_NAME, "readwrite");
    const store = tx.objectStore(BACKUP_STORE_NAME);
    for (const entry of entries) {
      const snapshot: StoredSnapshot = {
        id: `${entry.originalKey}.${type}.${now}`,
        originalKey: entry.originalKey,
        createdAt: now,
        type,
        label,
        data: entry.data,
      };
      store.put(snapshot);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await pruneOldSnapshots(db);
}

// バックアップ対象のうち、localStorageに値があるものを集める
export function collectBackupEntries(): SnapshotEntry[] {
  if (!isBrowser()) return [];
  const entries: SnapshotEntry[] = [];
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) entries.push({ originalKey: key, data: raw });
  }
  return entries;
}

// 実行中の自動バックアップ。同時に呼ばれても1回だけ保存するために使う
let runningAutoBackup: Promise<boolean> | null = null;

/**
 * 前回の自動バックアップから24時間以上経過していたら実行する。
 * 実行した場合は true を返す。アプリ起動時（SyncProvider）から呼ばれる。
 * 起動処理が重なって同時に呼ばれても（開発モードの二重実行など）、保存は1回にまとめる。
 */
export function runAutoBackupIfNeeded(): Promise<boolean> {
  if (!runningAutoBackup) {
    runningAutoBackup = runAutoBackup().finally(() => {
      runningAutoBackup = null;
    });
  }
  return runningAutoBackup;
}

async function runAutoBackup(): Promise<boolean> {
  if (!isBrowser()) return false;

  const meta = readBackupMeta();
  if (
    meta.lastAutoBackupAt &&
    Date.now() - new Date(meta.lastAutoBackupAt).getTime() <
      AUTO_BACKUP_INTERVAL_MS
  ) {
    return false;
  }

  const entries = collectBackupEntries();
  if (entries.length === 0) return false;

  await saveSnapshots("auto", entries);
  writeBackupMeta({ lastAutoBackupAt: new Date().toISOString() });
  return true;
}

/**
 * IndexedDB内のバックアップ一覧（新しい順）
 */
export async function listIndexedDbBackups(): Promise<IndexedDbBackupItem[]> {
  if (!isBrowser()) return [];
  const db = await openDB();
  const all = await getAllSnapshots(db);
  return all
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => ({
      id: b.id,
      originalKey: b.originalKey,
      createdAt: b.createdAt,
      type: b.type ?? "auto",
      label: b.label,
      byteSize: b.data.length,
      recordCount: extractRecordCount(b.originalKey, b.data),
    }));
}

/**
 * バックアップから localStorage に復元する。
 * 呼び出し側で復元前スナップショット取得と `window.location.reload()` を行うこと。
 */
export async function restoreFromIndexedDbBackup(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isBrowser()) return { ok: false, error: "ブラウザ環境ではありません" };
  try {
    const db = await openDB();
    const backup = await new Promise<StoredSnapshot | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(BACKUP_STORE_NAME, "readonly");
        const request = tx.objectStore(BACKUP_STORE_NAME).get(id);
        request.onsuccess = () =>
          resolve(request.result as StoredSnapshot | undefined);
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
 * バックアップを1件削除する
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
