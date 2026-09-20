import type { TBSQuestion } from "@/types/tbs";
import capitalBudgeting from "./capital-budgeting.json";
import derivatives from "./derivatives.json";
import fxTranslation from "./fx-translation.json";
import leasesLessor from "./leases-lessor.json";
import stockComp from "./stock-comp.json";
import varianceAnalysis from "./variance-analysis.json";

// BAR TBS。Area I（差異分析・資本コスト）と Area II（技術論点）を混在させる
export const barTBSQuestions: TBSQuestion[] = [
  ...(varianceAnalysis as TBSQuestion[]),
  ...(capitalBudgeting as TBSQuestion[]),
  ...(stockComp as TBSQuestion[]),
  ...(leasesLessor as TBSQuestion[]),
  ...(derivatives as TBSQuestion[]),
  ...(fxTranslation as TBSQuestion[]),
];
