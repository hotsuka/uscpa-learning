import type { TBSQuestion } from "@/types/tbs";
import revenueRecognition from "./revenue-recognition.json";
import leases from "./leases.json";
import incomeTaxes from "./income-taxes.json";
import government from "./government.json";
import consolidations from "./consolidations.json";

export const farTBSQuestions: TBSQuestion[] = [
  ...(revenueRecognition as TBSQuestion[]),
  ...(leases as TBSQuestion[]),
  ...(incomeTaxes as TBSQuestion[]),
  ...(government as TBSQuestion[]),
  ...(consolidations as TBSQuestion[]),
];

export function getTBSQuestionById(id: string): TBSQuestion | undefined {
  return farTBSQuestions.find((q) => q.id === id);
}

export function getTBSTopics(): string[] {
  return [...new Set(farTBSQuestions.map((q) => q.topic))];
}
