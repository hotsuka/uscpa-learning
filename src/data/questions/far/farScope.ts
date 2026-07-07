// FAR問題バンクの各テーマ（QuestionSet）が現行FAR試験の出題範囲に含まれるかの区分。
// AICPA Uniform CPA Examination Blueprints (2026年版) に基づく。
// - in:      FAR Coreの出題範囲内
// - partial: 一部のみFAR（残りはBAR Discipline領域）
// - out:     FAR範囲外（BAR Discipline領域）
// area はFARブループリント上の主帰属エリア（模試の層化抽出に使用）。out のテーマは null。
//   Area I:   Financial Reporting (30-40%)
//   Area II:  Select Balance Sheet Accounts (30-40%)
//   Area III: Select Transactions (25-35%)

export type FarScope = "in" | "partial" | "out";
export type FarArea = "I" | "II" | "III";

export interface FarScopeInfo {
  scope: FarScope;
  area: FarArea | null;
  note: string;
}

// キーは QuestionSet.id（topic は name と一致しないセットがあるため id で引く）
export const FAR_SCOPE_BY_SET_ID: Record<string, FarScopeInfo> = {
  "far-accounting-changes": {
    scope: "in",
    area: "III",
    note: "FAR III-A 会計方針の変更と誤謬訂正",
  },
  "far-cash-equivalents": {
    scope: "in",
    area: "II",
    note: "FAR II-A 現金及び現金同等物",
  },
  "far-cash-flows": {
    scope: "in",
    area: "I",
    note: "FAR I-A5 キャッシュフロー計算書",
  },
  "far-consolidations": {
    scope: "partial",
    area: "I",
    note: "基本連結+NCIはFAR I-A6。VIE・在外子会社換算はBAR",
  },
  "far-credit-loss-cecl": {
    scope: "in",
    area: "II",
    note: "売上債権のCECLはFAR II-B",
  },
  "far-derivatives-hedging": {
    scope: "out",
    area: null,
    note: "デリバティブ・ヘッジ会計はBAR Area II",
  },
  "far-equity": {
    scope: "in",
    area: "II",
    note: "FAR II-I 資本取引（増資・株式配当・分割・自己株式）",
  },
  "far-foreign-currency-eps": {
    scope: "partial",
    area: "I",
    note: "外貨建取引損益=FAR I-A2、EPS(基本/希薄化)=FAR I-D。在外営業体の換算はBAR",
  },
  "far-government-accounting": {
    scope: "partial",
    area: "I",
    note: "概念（測定焦点・会計基礎・ファンド区分）のみFAR I-C。政府財務諸表の詳細はBAR III",
  },
  "far-income-taxes": {
    scope: "in",
    area: "III",
    note: "FAR III-D 法人所得税会計",
  },
  "far-inventory": { scope: "in", area: "II", note: "FAR II-C 棚卸資産" },
  "far-investments": {
    scope: "in",
    area: "II",
    note: "FAR II-E 投資（公正価値・償却原価・持分法）",
  },
  "far-leases": {
    scope: "partial",
    area: "III",
    note: "借手会計はFAR III-F。貸手・セール&リースバックはBAR",
  },
  "far-liabilities": {
    scope: "in",
    area: "II",
    note: "FAR II-G/H 未払負債・社債・コベナンツ",
  },
  "far-nonprofit-accounting": {
    scope: "in",
    area: "I",
    note: "FAR I-B 非営利組織の財務諸表",
  },
  "far-partnerships": {
    scope: "out",
    area: null,
    note: "現行ブループリントの出題範囲外",
  },
  "far-pensions": {
    scope: "out",
    area: null,
    note: "確定給付年金はBAR。FARは未払給与・有給休暇等（Liabilitiesで学習）のみ",
  },
  "far-ppe-intangibles": {
    scope: "in",
    area: "II",
    note: "FAR II-D/F 有形固定資産・耐用年数のある無形資産。のれん減損のみBAR",
  },
  "far-receivables": { scope: "in", area: "II", note: "FAR II-B 売上債権" },
  "far-revenue-recognition": {
    scope: "in",
    area: "III",
    note: "FAR III-C 収益認識（5ステップ+NFP寄付）",
  },
  "far-stock-compensation": {
    scope: "out",
    area: null,
    note: "株式報酬はBAR Area II",
  },
};

// 未知のセットは安全側（範囲内扱い）に倒す
export function getFarScopeForSet(setId: string): FarScopeInfo {
  return (
    FAR_SCOPE_BY_SET_ID[setId] ?? { scope: "in", area: null, note: "" }
  );
}

// UI表示用ラベル（partial=一部がBAR領域、out=全体がBAR領域でFAR範囲外）
export const FAR_SCOPE_LABELS: Record<FarScope, string> = {
  in: "FAR",
  partial: "一部BAR",
  out: "BAR",
};
