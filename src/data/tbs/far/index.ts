import type { TBSQuestion } from "@/types/tbs";
import revenueRecognition from "./revenue-recognition.json";
import leases from "./leases.json";
import incomeTaxes from "./income-taxes.json";
import government from "./government.json";
import consolidations from "./consolidations.json";
import cashFlows from "./cash-flows.json";
import receivablesCecl from "./receivables-cecl.json";
import equity from "./equity.json";
import ppeIntangibles from "./ppe-intangibles.json";
import bondsLiabilities from "./bonds-liabilities.json";
import investments from "./investments.json";
import eps from "./eps.json";
import changesErrors from "./changes-errors.json";
import ratios from "./ratios.json";
import cash from "./cash.json";
import nfp from "./nfp.json";

export const farTBSQuestions: TBSQuestion[] = [
  ...(revenueRecognition as TBSQuestion[]),
  ...(leases as TBSQuestion[]),
  ...(incomeTaxes as TBSQuestion[]),
  ...(government as TBSQuestion[]),
  ...(consolidations as TBSQuestion[]),
  ...(cashFlows as TBSQuestion[]),
  ...(receivablesCecl as TBSQuestion[]),
  ...(equity as TBSQuestion[]),
  ...(ppeIntangibles as TBSQuestion[]),
  ...(bondsLiabilities as TBSQuestion[]),
  ...(investments as TBSQuestion[]),
  ...(eps as TBSQuestion[]),
  ...(changesErrors as TBSQuestion[]),
  ...(ratios as TBSQuestion[]),
  ...(cash as TBSQuestion[]),
  ...(nfp as TBSQuestion[]),
];

export function getTBSQuestionById(id: string): TBSQuestion | undefined {
  return farTBSQuestions.find((q) => q.id === id);
}

export function getTBSTopics(): string[] {
  return [...new Set(farTBSQuestions.map((q) => q.topic))];
}
