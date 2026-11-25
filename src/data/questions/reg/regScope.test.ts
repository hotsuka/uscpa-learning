import { describe, it, expect } from "vitest";
import { regQuestionSets } from "./index";
import { REG_SCOPE_BY_SET_ID, getRegScopeForQuestion } from "./regScope";

describe("REG出題範囲区分", () => {
  it("登録したセットIDと問題IDが実在する（ID変更で判定が黙って外れないため）", () => {
    const setsById = new Map(regQuestionSets.map((s) => [s.id, s]));
    for (const [setId, info] of Object.entries(REG_SCOPE_BY_SET_ID)) {
      const set = setsById.get(setId);
      expect(set, setId).toBeDefined();
      const ids = new Set(set!.questions.map((q) => q.id));
      for (const group of info.questionGroups ?? []) {
        expect(group.ids.filter((id) => !ids.has(id)), setId).toEqual([]);
      }
    }
  });

  it("Trusts, Gift の範囲内は免税団体と寄附金控除の5問だけで、残る60問が範囲外", () => {
    const set = regQuestionSets.find((s) => s.id === "reg-trusts-gift-exempt")!;
    const inIds = set.questions
      .filter((q) => getRegScopeForQuestion(set.id, q.id) === "in")
      .map((q) => q.id);
    expect(inIds).toEqual([
      "reg-tge-005",
      "reg-tge-015",
      "reg-tge-024",
      "reg-tge-030",
      "reg-tge-035",
    ]);
    expect(set.questions.length - inIds.length).toBe(60);
  });

  it("登録の無いセットは全問が範囲内", () => {
    for (const set of regQuestionSets.filter((s) => !REG_SCOPE_BY_SET_ID[s.id])) {
      for (const q of set.questions) {
        expect(getRegScopeForQuestion(set.id, q.id), q.id).toBe("in");
      }
    }
  });
});
