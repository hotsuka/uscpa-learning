import { describe, it, expect } from "vitest";
import { padRow } from "./QuestionStem";

describe("padRow", () => {
  it("列見出しは値の列に合わせて右へ寄せる（BAR-CA-003）", () => {
    // Number of | Cost of  ... 語で始まるが見出しなので右寄せ
    expect(padRow(["Number of", "Cost of"], 3, true)).toEqual([
      "",
      "Number of",
      "Cost of",
    ]);
    expect(padRow(["units", "materials"], 3, true)).toEqual([
      "",
      "units",
      "materials",
    ]);
  });

  it("ラベルで始まるデータ行は左詰めにする（BAR-CA-003）", () => {
    // 42,500 は Number of units の列に入る
    expect(padRow(["Units completed", "42,500"], 3, false)).toEqual([
      "Units completed",
      "42,500",
      "",
    ]);
    expect(padRow(["Ending work-in-process", "12,500"], 3, false)).toEqual([
      "Ending work-in-process",
      "12,500",
      "",
    ]);
  });

  it("値だけの行は右へ寄せて見出しの列に合わせる（BAR-CA-012）", () => {
    // Costs incurred | Maintenance | Power に対する $99,000 | $54,000
    expect(padRow(["$99,000", "$54,000"], 3, false)).toEqual([
      "",
      "$99,000",
      "$54,000",
    ]);
  });

  it("No.150 のような語を持たない列見出しも右へ寄せる（BAR-CA-095）", () => {
    expect(padRow(["No.150", "No.151", "No.152"], 4, false)).toEqual([
      "",
      "No.150",
      "No.151",
      "No.152",
    ]);
  });

  it("列数が揃っている行はそのまま返す", () => {
    expect(padRow(["Raw materials", "--", "$4,000", "$1,000"], 4, false)).toEqual([
      "Raw materials",
      "--",
      "$4,000",
      "$1,000",
    ]);
  });
});
