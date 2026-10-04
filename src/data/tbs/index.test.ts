import { describe, it, expect } from "vitest";
import {
  allTBSQuestions,
  findTBSQuestionById,
  getTBSMockSetsBySubject,
  getTBSQuestionsBySubject,
} from "./index";

describe("通し模試用TBS", () => {
  const mockQuestions = getTBSMockSetsBySubject("BAR").flatMap((set) => set.questions);

  it("演習一覧に含めない（演習で解くと初見でなくなる）", () => {
    const practiceIds = new Set(getTBSQuestionsBySubject("BAR").map((q) => q.id));
    expect(mockQuestions.filter((q) => practiceIds.has(q.id)).map((q) => q.id)).toEqual([]);
  });

  it("問題IDが全科目で一意で、詳細ページから引ける", () => {
    const ids = allTBSQuestions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of mockQuestions) expect(findTBSQuestionById(q.id)).toBe(q);
  });

  it("1回分は本番と同じ7問以内で、BARの問題だけ", () => {
    for (const set of getTBSMockSetsBySubject("BAR")) {
      expect(set.questions.length).toBeLessThanOrEqual(7);
      expect(set.questions.every((q) => q.subject === "BAR")).toBe(true);
    }
  });
});
