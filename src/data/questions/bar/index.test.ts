import { describe, it, expect } from "vitest";
import {
  barQuestionSets,
  barAreaIIIIIQuestionSets,
  barOwnAreaIIIIIQuestionSets,
  barPracticeQuestionSets,
  getBarAreaForSet,
  getBarQuestionById,
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

  it("BAR専用に作問した Area II/III セットが演習対象に入っている", () => {
    const ids = barPracticeQuestionSets.map((set) => set.id);
    for (const set of barOwnAreaIIIIIQuestionSets) {
      // 登録漏れがあるとそのセットだけ黙って画面から消える
      expect(ids).toContain(set.id);
      expect(getBarAreaForSet(set.id)).not.toBe("I");
      expect(set.questions.length).toBeGreaterThan(0);
    }
  });

  it("BAR専用セットとFARから借りたセットでIDが衝突しない", () => {
    const ids = barPracticeQuestionSets.map((set) => set.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("BARに対応しないFARセットは載せない", () => {
    const ids = barAreaIIIIIQuestionSets.map((set) => set.id);
    expect(ids).not.toContain("far-partnerships");
    expect(ids).not.toContain("far-cash-flows");
  });
});

describe("getBarQuestionById", () => {
  it("BAR専用セット・FARから借りたセットの両方の問題を引ける", () => {
    // BAR模試の誤答見直しで解説が出なかった問題（Area I / III のBAR専用セット）
    expect(getBarQuestionById("bar3-gw-009")?.id).toBe("bar3-gw-009");
    expect(getBarQuestionById("bar-erm-051")?.id).toBe("bar-erm-051");
    expect(getBarQuestionById("bar-sp-046")?.id).toBe("bar-sp-046");
    // FARから借りた政府会計セットの問題
    expect(getBarQuestionById("gov-234")?.id).toBe("gov-234");
  });

  it("BAR画面で演習できる全問題を引ける", () => {
    for (const set of barPracticeQuestionSets) {
      for (const q of set.questions) {
        expect(getBarQuestionById(q.id)).toBe(q);
      }
    }
  });
});
