import { describe, it, expect } from "vitest";
import {
  parseMaterialFileName,
  groupMaterialFiles,
} from "./parseMaterialFileName";

// File はNode環境では未定義のことがあるため、名前だけ持つ最小限のスタブを使う
const file = (name: string) => ({ name }) as File;

describe("parseMaterialFileName", () => {
  it("テキストの回答なし版を解析する", () => {
    expect(
      parseMaterialFileName("BAR_Cost & Managerial Accounting_テキスト.pdf"),
    ).toEqual({
      baseName: "BAR_Cost & Managerial Accounting_テキスト",
      subject: "BAR",
      subtopic: "Cost & Managerial Accounting",
      variant: "without",
    });
  });

  it("回答あり版は同じbaseNameになりペアが成立する", () => {
    const without = parseMaterialFileName("BAR_Pensions_テキスト.pdf");
    const withAnswers = parseMaterialFileName(
      "BAR_Pensions_テキスト_回答あり.pdf",
    );
    expect(withAnswers.variant).toBe("with");
    expect(withAnswers.baseName).toBe(without.baseName);
  });

  it("演習問題の出典章まで含めてbaseNameを作る（同分野の別教材を区別する）", () => {
    const ch51 = parseMaterialFileName(
      "BAR_Financial Management_演習問題_CH51.pdf",
    );
    const m44 = parseMaterialFileName(
      "BAR_Financial Management_演習問題_M44.pdf",
    );
    expect(ch51.baseName).not.toBe(m44.baseName);
    // 分野名は同じなのでフィルターでは同じテーマにまとまる
    expect(ch51.subtopic).toBe("Financial Management");
    expect(m44.subtopic).toBe("Financial Management");
  });

  it("「_テキスト」がない既存FAR形式も分野名を取れる", () => {
    expect(parseMaterialFileName("FAR_Cash Flows.pdf").subtopic).toBe(
      "Cash Flows",
    );
  });

  it("二重拡張子を落とす", () => {
    expect(
      parseMaterialFileName("FAR-Not-for-profit-Accounting.pdf.pdf").baseName,
    ).toBe("FAR-Not-for-profit-Accounting");
  });

  it("ASCII表記のファイル名も日本語表記と同じ教材名に揃える", () => {
    expect(parseMaterialFileName("BAR_Pensions_text.pdf")).toEqual(
      parseMaterialFileName("BAR_Pensions_テキスト.pdf"),
    );
    expect(
      parseMaterialFileName("BAR_Cost Accounting_questions_CH53.pdf"),
    ).toEqual(parseMaterialFileName("BAR_Cost Accounting_演習問題_CH53.pdf"));
  });

  it("ASCII表記の回答あり版も日本語表記の回答なし版とペアになる", () => {
    const without = parseMaterialFileName("BAR_Pensions_text.pdf");
    const withAnswers = parseMaterialFileName("BAR_Pensions_text_answers.pdf");
    expect(withAnswers.variant).toBe("with");
    expect(withAnswers.baseName).toBe(without.baseName);
    expect(withAnswers.baseName).toBe("BAR_Pensions_テキスト");
  });

  it("対象外の科目プレフィックスはsubjectをnullにする", () => {
    const parsed = parseMaterialFileName(
      "ISC_Information Technology_テキスト.pdf",
    );
    expect(parsed.subject).toBeNull();
    expect(parsed.subtopic).toBeNull();
  });
});

describe("groupMaterialFiles", () => {
  it("reference/のBAR教材15本が12教材にまとまる", () => {
    const files = [
      "BAR_Cost & Managerial Accounting_テキスト.pdf",
      "BAR_Cost & Managerial Accounting_テキスト_回答あり.pdf",
      "BAR_Financial Management_テキスト.pdf",
      "BAR_Financial Management_テキスト_回答あり.pdf",
      "BAR_Pensions_テキスト.pdf",
      "BAR_Pensions_テキスト_回答あり.pdf",
      "BAR_Cost Accounting_演習問題_CH53.pdf",
      "BAR_Cost Measurement & Assignment_演習問題_M46.pdf",
      "BAR_Decision Making_演習問題_CH52.pdf",
      "BAR_Financial Management_演習問題_CH51.pdf",
      "BAR_Financial Management_演習問題_M44.pdf",
      "BAR_Financial Risk Management & Capital Budgeting_演習問題_M43.pdf",
      "BAR_Performance Measures & Management Techniques_演習問題_M45.pdf",
      "BAR_Planning Control & Analysis_演習問題_M47.pdf",
      "BAR_Strategic Planning_演習問題_CH54.pdf",
    ].map(file);

    const groups = groupMaterialFiles(files);

    expect(groups).toHaveLength(12);
    // 回答あり版とペアになるのはテキスト3分野だけ
    expect(groups.filter((g) => g.with && g.without)).toHaveLength(3);
    // 全て回答なし版を主PDFとして持つ
    expect(groups.every((g) => g.without !== null)).toBe(true);
    expect(groups.every((g) => g.subject === "BAR")).toBe(true);
  });
});
