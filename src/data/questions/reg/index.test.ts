import { readdirSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { farQuestionSets } from "@/data/questions/far";
import { barPracticeQuestionSets } from "@/data/questions/bar";
import { regQuestionSets } from "./index";

describe("REG問題バンク", () => {
  it("フォルダ内の問題JSONが全てindexに登録されている", () => {
    // 登録漏れがあるとそのセットだけ黙って画面から消える
    const files = readdirSync(join(__dirname)).filter(
      (f) => f.endsWith(".json") && !f.startsWith("_") && !f.includes(".bak"),
    );
    expect(regQuestionSets.length).toBe(files.length);
  });

  it("テーマ名が衝突しない（画面のテーマ選択は topic をキーにしている）", () => {
    const topics = regQuestionSets.map((set) => set.topic);
    expect(new Set(topics).size).toBe(topics.length);
  });

  it("問題IDがFAR・BARを含めて重複しない（解答履歴は1つのstoreに問題ID単位で入るため）", () => {
    const otherIds = new Set(
      [...farQuestionSets, ...barPracticeQuestionSets].flatMap((s) => s.questions.map((q) => q.id)),
    );
    const regIds = regQuestionSets.flatMap((s) => s.questions.map((q) => q.id));
    expect(new Set(regIds).size).toBe(regIds.length);
    expect(regIds.filter((id) => otherIds.has(id))).toEqual([]);
  });

  it("全問が4択で、正解ラベルが選択肢に存在する", () => {
    for (const q of regQuestionSets.flatMap((s) => s.questions)) {
      expect(q.choices.map((c) => c.label), q.id).toEqual(["A", "B", "C", "D"]);
      expect(["A", "B", "C", "D"], q.id).toContain(q.correctAnswer);
    }
  });

  it("解説で選択肢をラベル（Choice B 等）で参照しない（画面で選択肢をシャッフルするため）", () => {
    const labelRef = /\bChoices? [A-D]\b|選択肢[A-D]|\b[A-D]は(?:正|誤)/;
    const offenders = regQuestionSets
      .flatMap((s) => s.questions)
      .filter((q) => labelRef.test(q.explanation) || labelRef.test(q.explanationJa))
      .map((q) => q.id);
    expect(offenders).toEqual([]);
  });
});
