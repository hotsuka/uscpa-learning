import type { QuestionSet } from "@/types/questions";
import { farQuestionSets } from "@/data/questions/far";
import { BAR_AREA_II_III_SOURCES } from "./barScope";

import costAccounting from "./cost-accounting.json";
import costMeasurement from "./cost-measurement.json";
import decisionMaking from "./decision-making.json";
import economicTheory from "./economic-theory.json";
import financialManagementCh51 from "./financial-management-ch51.json";
import financialManagementM44 from "./financial-management-m44.json";
import financialRiskCapitalBudgeting from "./financial-risk-capital-budgeting.json";
import performanceMeasures from "./performance-measures.json";
import planningControl from "./planning-control.json";
import riskManagementErm from "./risk-management-erm.json";
import strategicPlanning from "./strategic-planning.json";

export type BarArea = "I" | "II" | "III";

// BAR Area I（Business Analysis, 配点40-50%）に対応する問題セット。
// 同じ分野でも出典教材が異なるものは別セットとして持つ（CH51とM44など）。
export const barQuestionSets: QuestionSet[] = [
  costAccounting,
  costMeasurement,
  decisionMaking,
  planningControl,
  strategicPlanning,
  performanceMeasures,
  financialManagementCh51,
  financialManagementM44,
  financialRiskCapitalBudgeting,
  riskManagementErm,
  economicTheory,
] as QuestionSet[];

export const getBarTotalQuestionCount = (): number =>
  barQuestionSets.reduce((sum, set) => sum + set.questions.length, 0);

// FARセットID → BAR上のArea。BAR_AREA_II_III_SOURCES の並び順（ブループリント順）を保つ
const barAreaByFarSetId = new Map<string, Exclude<BarArea, "I">>();
for (const source of BAR_AREA_II_III_SOURCES) {
  for (const setId of source.farSetIds) {
    if (!barAreaByFarSetId.has(setId))
      barAreaByFarSetId.set(setId, source.area);
  }
}

// BAR Area II / III の演習用に、FARセットをコピーせずそのまま参照する。
// 問題IDが同じなので、FAR時代の解答履歴もそのまま引き継がれる。
// リース・連結・政府会計などはセット内にFAR論点も含むが、問題単位の仕分けは
// 未整備のためセット丸ごと載せる（BAR論点だけに絞るのは今後の課題）
export const barAreaIIIIIQuestionSets: QuestionSet[] = [
  ...barAreaByFarSetId.keys(),
]
  .map((setId) => farQuestionSets.find((set) => set.id === setId))
  .filter((set): set is QuestionSet => set !== undefined);

// BAR画面で演習対象にする全セット（Area I → II → III）
export const barPracticeQuestionSets: QuestionSet[] = [
  ...barQuestionSets,
  ...barAreaIIIIIQuestionSets,
];

/** BAR画面のセットがどのAreaに属するか。FAR側から借りたセットは II / III */
export const getBarAreaForSet = (setId: string): BarArea =>
  barAreaByFarSetId.get(setId) ?? "I";
