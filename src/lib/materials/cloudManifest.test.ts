import { describe, expect, it } from "vitest"
import type { Material } from "@/types"
import {
  EMPTY_MANIFEST,
  mergeIntoLocal,
  mergeIntoManifest,
  type CloudManifest,
} from "./cloudManifest"

const material = (id: string, overrides: Partial<Material> = {}): Material => ({
  id,
  name: `REG_${id}`,
  subject: "REG",
  subtopic: null,
  pdfWithoutAnswers: `indexeddb:${id}-without`,
  pdfWithAnswers: null,
  totalPages: 10,
  createdAt: "2026-10-28T00:00:00.000Z",
  updatedAt: "2026-10-28T00:00:00.000Z",
  ...overrides,
})

const manifest = (materials: CloudManifest["materials"]): CloudManifest => ({
  version: 1,
  materials,
})

describe("mergeIntoManifest", () => {
  it("クラウドの行を消さずに端末の行を足す", () => {
    const cloud = manifest([material("a", { cloudPathWithout: "materials/pdf/a.pdf" })])
    const merged = mergeIntoManifest(cloud, [
      material("b", { cloudPathWithout: "materials/pdf/b.pdf" }),
    ])
    expect(merged.materials.map((m) => m.id).sort()).toEqual(["a", "b"])
  })

  it("同じidは updatedAt の新しい方を採り、クラウドのパスは空で上書きしない", () => {
    const cloud = manifest([
      material("a", {
        name: "old",
        cloudPathWithout: "materials/pdf/a.pdf",
        cloudPathWith: "materials/pdf/a2.pdf",
      }),
    ])
    const merged = mergeIntoManifest(cloud, [
      material("a", {
        name: "new",
        updatedAt: "2026-10-29T00:00:00.000Z",
        cloudPathWithout: "materials/pdf/a.pdf",
      }),
    ])
    expect(merged.materials[0].name).toBe("new")
    expect(merged.materials[0].cloudPathWith).toBe("materials/pdf/a2.pdf")
  })

  it("古い更新が来ても削除の印は消えない", () => {
    const cloud = manifest([
      material("a", {
        updatedAt: "2026-10-29T00:00:00.000Z",
        deletedAt: "2026-10-29T00:00:00.000Z",
      } as Partial<Material>),
    ])
    const merged = mergeIntoManifest(cloud, [material("a")])
    expect(merged.materials[0].deletedAt).toBe("2026-10-29T00:00:00.000Z")
  })
})

describe("mergeIntoLocal", () => {
  it("他の端末で登録した教材を取り込み、IndexedDBの参照にそろえる", () => {
    const cloud = manifest([
      material("b", {
        pdfWithoutAnswers: "anything",
        cloudPathWithout: "materials/pdf/b.pdf",
        cloudPathWith: "materials/pdf/b2.pdf",
      }),
    ])
    const { materials } = mergeIntoLocal([], cloud)
    expect(materials).toHaveLength(1)
    expect(materials[0].pdfWithoutAnswers).toBe("indexeddb:b-without")
    expect(materials[0].pdfWithAnswers).toBe("indexeddb:b-with")
    expect("deletedAt" in materials[0]).toBe(false)
  })

  it("クラウドにPDFが無い行は取り込まない", () => {
    const { materials } = mergeIntoLocal([], manifest([material("b")]))
    expect(materials).toHaveLength(0)
  })

  it("端末にしかない教材は残す", () => {
    const { materials } = mergeIntoLocal([material("a")], EMPTY_MANIFEST)
    expect(materials.map((m) => m.id)).toEqual(["a"])
  })

  it("クラウドで削除済みの教材は端末の一覧から外す", () => {
    const cloud = manifest([
      material("a", { deletedAt: "2026-10-29T00:00:00.000Z" } as Partial<Material>),
    ])
    const { materials, removedIds } = mergeIntoLocal([material("a")], cloud)
    expect(materials).toHaveLength(0)
    expect(removedIds).toEqual(["a"])
  })

  it("端末の教材にクラウドのパスを補う", () => {
    const cloud = manifest([material("a", { cloudPathWithout: "materials/pdf/a.pdf" })])
    const { materials } = mergeIntoLocal([material("a")], cloud)
    expect(materials[0].cloudPathWithout).toBe("materials/pdf/a.pdf")
  })
})
