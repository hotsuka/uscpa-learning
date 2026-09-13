import { MAX_GENERATIONS, type SnapshotType } from "./constants";

export interface PrunableSnapshot {
  id: string;
  originalKey: string;
  createdAt: string;
  // 種類を持たない既存の保存分は、自動バックアップとして扱う
  type?: SnapshotType;
}

/**
 * データの種類（originalKey）× バックアップの種類ごとに、上限を超えた古いスナップショットのIDを返す。
 * 種類ごとに数えるので、毎日の自動バックアップが手動・移行前のバックアップを押し出すことはない。
 */
export function selectSnapshotsToPrune(
  items: PrunableSnapshot[],
  limits: Record<SnapshotType, number> = MAX_GENERATIONS,
): string[] {
  const groups = new Map<string, PrunableSnapshot[]>();
  for (const item of items) {
    const groupKey = `${item.originalKey}|${item.type ?? "auto"}`;
    const group = groups.get(groupKey) ?? [];
    group.push(item);
    groups.set(groupKey, group);
  }

  const idsToDelete: string[] = [];
  for (const group of groups.values()) {
    const limit = limits[group[0].type ?? "auto"];
    const newestFirst = [...group].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    for (const old of newestFirst.slice(limit)) {
      idsToDelete.push(old.id);
    }
  }
  return idsToDelete;
}
