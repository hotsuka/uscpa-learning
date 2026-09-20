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

// Area II / III 用にBAR専用で作問したセット（FARセットから借りたものとは別枠）
import area2BenefitPlans from "./benefit-plans.json";
import area2BusinessCombinations from "./business-combinations.json";
import area2Derivatives from "./derivatives.json";
import area2FxTranslation from "./fx-translation.json";
import area2LeasesLessor from "./leases-lessor.json";
import area2PublicReporting from "./public-reporting.json";
import area2RevenueAnalytics from "./revenue-analytics.json";
import area2SoftwareIntangibles from "./software-intangibles.json";
import area2StockComp from "./stock-comp.json";
import area3GovernmentFunds from "./government-funds.json";
import area3GovernmentWide from "./government-wide.json";

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

// BAR専用に作問した Area II / III のセット。FARセットは科目の深度が違う（借手リースなど）ため、
// BARで問われる深度の問題はこちら側に持つ。setId → Area の対応もここで持つ。
const barOwnAreaBySetId = new Map<string, Exclude<BarArea, "I">>([
  [area2LeasesLessor.id, "II"],
  [area2BusinessCombinations.id, "II"],
  [area2StockComp.id, "II"],
  [area2Derivatives.id, "II"],
  [area2PublicReporting.id, "II"],
  [area2FxTranslation.id, "II"],
  [area2SoftwareIntangibles.id, "II"],
  [area2BenefitPlans.id, "II"],
  [area2RevenueAnalytics.id, "II"],
  [area3GovernmentWide.id, "III"],
  [area3GovernmentFunds.id, "III"],
]);

export const barOwnAreaIIIIIQuestionSets: QuestionSet[] = [
  area2LeasesLessor,
  area2BusinessCombinations,
  area2StockComp,
  area2Derivatives,
  area2PublicReporting,
  area2FxTranslation,
  area2SoftwareIntangibles,
  area2BenefitPlans,
  area2RevenueAnalytics,
  area3GovernmentWide,
  area3GovernmentFunds,
] as QuestionSet[];

// BAR画面で演習対象にする全セット（Area I → II → III）
export const barPracticeQuestionSets: QuestionSet[] = [
  ...barQuestionSets,
  ...barOwnAreaIIIIIQuestionSets,
  ...barAreaIIIIIQuestionSets,
];

/** BAR画面のセットがどのAreaに属するか。FAR側から借りたセットは II / III */
export const getBarAreaForSet = (setId: string): BarArea =>
  barOwnAreaBySetId.get(setId) ?? barAreaByFarSetId.get(setId) ?? "I";
