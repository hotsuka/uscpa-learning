import type { QuestionSet } from "@/types/questions";

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
