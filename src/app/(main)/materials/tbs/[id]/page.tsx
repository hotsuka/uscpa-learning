import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { TBSViewer } from "@/components/materials/TBSViewer";
import { TBSTimerBar } from "@/components/materials/TBSTimerBar";
import { allTBSQuestions, findTBSQuestionById } from "@/data/tbs";

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return allTBSQuestions.map((q) => ({ id: q.id }));
}

export default async function TBSDetailPage({ params }: Props) {
  const { id } = await params;
  const question = findTBSQuestionById(id);

  if (!question) {
    notFound();
  }

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <TBSTimerBar />
      <div className="flex-1 min-h-0">
        <TBSViewer question={question} />
      </div>
    </div>
  );
}
