import { describe, it, expect } from "vitest";
import {
  barQuestionSets,
  barAreaIIIIIQuestionSets,
  barPracticeQuestionSets,
  getBarAreaForSet,
} from "./index";
import { BAR_AREA_II_III_SOURCES } from "./barScope";

describe("BAR画面の演習セット", () => {
  it("Area II/III 対応表のFARセットIDが全て実在する", () => {
    const loadedIds = new Set(barAreaIIIIIQuestionSets.map((set) => set.id));
    const referencedIds = BAR_AREA_II_III_SOURCES.flatMap((s) => s.farSetIds);
    // IDの打ち間違いがあると、そのセットだけ黙ってBAR画面から消えるため
    expect(referencedIds.filter((id) => !loadedIds.has(id))).toEqual([]);
  });

  it("同じFARセットを重複して載せない", () => {
    const ids = barAreaIIIIIQuestionSets.map((set) => set.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("テーマ名が衝突しない（画面のテーマ選択は topic をキーにしている）", () => {
    const topics = barPracticeQuestionSets.map((set) => set.topic);
    expect(new Set(topics).size).toBe(topics.length);
  });

  it("Area I は BAR問題バンク、II/III は FARセットから引く", () => {
    expect(barPracticeQuestionSets.slice(0, barQuestionSets.length)).toEqual(barQuestionSets);
    expect(getBarAreaForSet("bar-cost-accounting")).toBe("I");
    expect(getBarAreaForSet("far-derivatives-hedging")).toBe("II");
    expect(getBarAreaForSet("far-government-accounting")).toBe("III");
  });

  it("BARに対応しないFARセットは載せない", () => {
    const ids = barAreaIIIIIQuestionSets.map((set) => set.id);
    expect(ids).not.toContain("far-partnerships");
    expect(ids).not.toContain("far-cash-flows");
  });
});
