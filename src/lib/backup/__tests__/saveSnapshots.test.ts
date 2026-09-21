import { describe, it, expect, vi, beforeEach } from "vitest";

// IndexedDB の中断・ブロックは実ブラウザでしか起きにくいので、最小限の偽物で再現する
type FakeTx = {
  objectStore: () => {
    put: () => void;
    delete: () => void;
    getAll: () => unknown;
  };
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  error: Error | null;
};

let nextTxOutcome: "complete" | "abort" = "complete";

const fakeDb = {
  transaction: (): FakeTx => {
    const tx: FakeTx = {
      objectStore: () => ({
        put: () => {},
        delete: () => {},
        getAll: () => {
          const request: {
            result: unknown[];
            onsuccess: (() => void) | null;
            onerror: (() => void) | null;
          } = {
            result: [],
            onsuccess: null,
            onerror: null,
          };
          setTimeout(() => request.onsuccess?.(), 0);
          return request;
        },
      }),
      oncomplete: null,
      onerror: null,
      onabort: null,
      error: null,
    };
    setTimeout(() => {
      if (nextTxOutcome === "abort") {
        // 容量不足でのコミット失敗は error を出さずに abort だけが発火する
        tx.error = new Error("QuotaExceededError");
        tx.onabort?.();
      } else {
        tx.oncomplete?.();
      }
    }, 0);
    return tx;
  },
};

vi.mock("@/lib/indexeddb", () => ({
  BACKUP_STORE_NAME: "backups",
  openDB: () => Promise.resolve(fakeDb),
}));

describe("saveSnapshots", () => {
  beforeEach(() => {
    nextTxOutcome = "complete";
  });

  it("保存できたら解決する", async () => {
    const { saveSnapshots } = await import("@/lib/backup/autoBackup");
    await expect(
      saveSnapshots("manual", [{ originalKey: "uscpa-records", data: "{}" }]),
    ).resolves.toBeUndefined();
  });

  it("トランザクションが中断されたら、止まらずに失敗として返す", async () => {
    const { saveSnapshots } = await import("@/lib/backup/autoBackup");
    nextTxOutcome = "abort";
    // 修正前は abort を拾わず、この Promise が永久に未確定だった（復元が黙って止まった原因）
    await expect(
      saveSnapshots("manual", [{ originalKey: "uscpa-records", data: "{}" }]),
    ).rejects.toThrow("QuotaExceededError");
  });
});
