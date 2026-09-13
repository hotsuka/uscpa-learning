import { describe, it, expect } from "vitest";
import { selectSnapshotsToPrune, type PrunableSnapshot } from "./prune";

const snapshot = (
  originalKey: string,
  createdAt: string,
  type?: PrunableSnapshot["type"],
): PrunableSnapshot => ({
  id: `${originalKey}.${type ?? "auto"}.${createdAt}`,
  originalKey,
  createdAt,
  type,
});

describe("selectSnapshotsToPrune", () => {
  it("上限を超えた分だけ、古いものから消す", () => {
    const items = [
      snapshot("uscpa-question-bank", "2026-09-01T00:00:00.000Z", "auto"),
      snapshot("uscpa-question-bank", "2026-09-03T00:00:00.000Z", "auto"),
      snapshot("uscpa-question-bank", "2026-09-02T00:00:00.000Z", "auto"),
    ];

    const ids = selectSnapshotsToPrune(items, { auto: 2, manual: 10, "pre-migrate": 10 });

    expect(ids).toEqual(["uscpa-question-bank.auto.2026-09-01T00:00:00.000Z"]);
  });

  it("種類を持たない既存の保存分は自動バックアップとして数える", () => {
    const items = [
      snapshot("uscpa-question-bank", "2026-09-01T00:00:00.000Z"),
      snapshot("uscpa-question-bank", "2026-09-02T00:00:00.000Z", "auto"),
    ];

    const ids = selectSnapshotsToPrune(items, { auto: 1, manual: 10, "pre-migrate": 10 });

    expect(ids).toEqual(["uscpa-question-bank.auto.2026-09-01T00:00:00.000Z"]);
  });

  it("自動バックアップが増えても、手動・移行前のバックアップは消さない", () => {
    const items = [
      snapshot("uscpa-question-bank", "2026-05-01T00:00:00.000Z", "pre-migrate"),
      snapshot("uscpa-question-bank", "2026-07-01T00:00:00.000Z", "manual"),
      snapshot("uscpa-question-bank", "2026-09-01T00:00:00.000Z", "auto"),
      snapshot("uscpa-question-bank", "2026-09-02T00:00:00.000Z", "auto"),
    ];

    const ids = selectSnapshotsToPrune(items, { auto: 1, manual: 1, "pre-migrate": 1 });

    expect(ids).toEqual(["uscpa-question-bank.auto.2026-09-01T00:00:00.000Z"]);
  });

  it("データの種類ごとに数える", () => {
    const items = [
      snapshot("uscpa-question-bank", "2026-09-01T00:00:00.000Z", "manual"),
      snapshot("uscpa-records", "2026-09-01T00:00:00.000Z", "manual"),
    ];

    expect(selectSnapshotsToPrune(items, { auto: 7, manual: 1, "pre-migrate": 10 })).toEqual([]);
  });

  it("上限以内なら何も消さない", () => {
    const items = [snapshot("uscpa-notes", "2026-09-01T00:00:00.000Z", "manual")];

    expect(selectSnapshotsToPrune(items)).toEqual([]);
  });
});
