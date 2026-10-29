import type { Material } from "@/types";

// クラウドに置く教材一覧の1件。削除は行を消さずに deletedAt を付ける（他の端末に削除を伝えるため）
export interface CloudMaterial extends Material {
  deletedAt?: string;
}

export interface CloudManifest {
  version: 1;
  materials: CloudMaterial[];
}

export const EMPTY_MANIFEST: CloudManifest = { version: 1, materials: [] };

// 端末ごとに保存されているIndexedDB上の参照。クラウドから取り込んだ教材もこの形にそろえる
const localRefs = (id: string, hasWith: boolean) => ({
  pdfWithoutAnswers: `indexeddb:${id}-without`,
  pdfWithAnswers: hasWith ? `indexeddb:${id}-with` : null,
});

const newer = (a: string | undefined, b: string | undefined): boolean =>
  (a ?? "") > (b ?? "");

/**
 * クラウドの一覧に端末側の教材を足し込む。行は消さない（和集合）。
 * 同じidが両方にあるときは updatedAt / deletedAt の新しい方を採る。
 */
export function mergeIntoManifest(
  manifest: CloudManifest,
  incoming: CloudMaterial[],
): CloudManifest {
  const byId = new Map(manifest.materials.map((m) => [m.id, m]));
  for (const m of incoming) {
    const current = byId.get(m.id);
    if (!current) {
      byId.set(m.id, m);
      continue;
    }
    const merged: CloudMaterial = newer(m.updatedAt, current.updatedAt)
      ? { ...current, ...m }
      : { ...m, ...current };
    // クラウドのパスは片方にしかないことがあるので、空で上書きしない
    merged.cloudPathWithout = m.cloudPathWithout ?? current.cloudPathWithout;
    merged.cloudPathWith = m.cloudPathWith ?? current.cloudPathWith;
    // 削除の印は新しい方を残す
    merged.deletedAt = newer(m.deletedAt, current.deletedAt)
      ? m.deletedAt
      : current.deletedAt;
    byId.set(m.id, merged);
  }
  return { version: 1, materials: [...byId.values()] };
}

/**
 * 端末の教材一覧にクラウドの教材を取り込む。
 * - 端末にない教材は追加する（PDF本体は開いたときにクラウドから取る）
 * - 端末にある教材はクラウドのパスだけ補う
 * - クラウドで削除済みの教材は端末からも外す
 */
export function mergeIntoLocal(
  local: Material[],
  manifest: CloudManifest,
): { materials: Material[]; removedIds: string[] } {
  const cloudById = new Map(manifest.materials.map((m) => [m.id, m]));
  const removedIds: string[] = [];
  const result: Material[] = [];

  for (const m of local) {
    const cloud = cloudById.get(m.id);
    if (cloud?.deletedAt) {
      removedIds.push(m.id);
      continue;
    }
    result.push(
      cloud
        ? {
            ...m,
            cloudPathWithout: m.cloudPathWithout ?? cloud.cloudPathWithout,
            cloudPathWith: m.cloudPathWith ?? cloud.cloudPathWith,
          }
        : m,
    );
  }

  const localIds = new Set(local.map((m) => m.id));
  for (const cloud of manifest.materials) {
    if (localIds.has(cloud.id) || cloud.deletedAt || !cloud.cloudPathWithout)
      continue;
    const { deletedAt: _deletedAt, ...rest } = cloud;
    result.push({
      ...rest,
      ...localRefs(cloud.id, Boolean(cloud.cloudPathWith)),
    });
  }

  result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { materials: result, removedIds };
}
