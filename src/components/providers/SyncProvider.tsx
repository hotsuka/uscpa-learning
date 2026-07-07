"use client";

import { useEffect } from "react";
import { useSyncOnMount, useSyncOnOnline } from "@/hooks/useSyncOnMount";
import { runAutoBackupIfNeeded } from "@/lib/backup/autoBackup";

/**
 * アプリ起動時およびオンライン復帰時にNotionデータを同期するプロバイダー
 * メインレイアウトで使用する
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  // 初回マウント時に同期
  useSyncOnMount();

  // オンライン復帰時に同期
  useSyncOnOnline();

  // 起動時に回答履歴の自動バックアップ（24時間間隔）をIndexedDBへ保存
  useEffect(() => {
    runAutoBackupIfNeeded().catch(console.error);
  }, []);

  return <>{children}</>;
}
