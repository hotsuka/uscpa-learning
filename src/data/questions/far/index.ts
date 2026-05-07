import type { QuestionSet } from "@/types/questions";

import cashFlows from "./cash-flows.json";
import receivables from "./receivables.json";
import inventory from "./inventory.json";
import ppeIntangibles from "./ppe-intangibles.json";
import investments from "./investments.json";
import liabilities from "./liabilities.json";
import equity from "./equity.json";
import revenueRecognition from "./revenue-recognition.json";
import leases from "./leases.json";
import incomeTaxes from "./income-taxes.json";
import pensions from "./pensions.json";
import consolidations from "./consolidations.json";
import governmentAccounting from "./government-accounting.json";
import nonprofitAccounting from "./nonprofit-accounting.json";
import accountingChanges from "./accounting-changes.json";
import derivativesHedging from "./derivatives-hedging.json";
import foreignCurrencyEps from "./foreign-currency-eps.json";
import partnerships from "./partnerships.json";
import creditLossCecl from "./credit-loss-cecl.json";

export const farQuestionSets: QuestionSet[] = [
  cashFlows,
  receivables,
  inventory,
  ppeIntangibles,
  investments,
  liabilities,
  equity,
  revenueRecognition,
  leases,
  incomeTaxes,
  pensions,
  consolidations,
  governmentAccounting,
  nonprofitAccounting,
  accountingChanges,
  derivativesHedging,
  foreignCurrencyEps,
  partnerships,
  creditLossCecl,
] as QuestionSet[];

export const getTotalQuestionCount = (): number => {
  return farQuestionSets.reduce((sum, set) => sum + set.questions.length, 0);
};

export const getQuestionSetByTopic = (
  topic: string,
): QuestionSet | undefined => {
  return farQuestionSets.find((set) => set.topic === topic);
};
