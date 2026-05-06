import { notFound } from "next/navigation";
import { CelebrityApplyForm } from "@/components/celebrity-zone/CelebrityApplyForm";
import { STAR_DETAIL_MAP } from "@/mocks/celebrity-zone";

interface PageProps {
  params: Promise<{ starId: string }>;
}

export default async function StarApplyPage({ params }: PageProps) {
  const { starId } = await params;
  const star = STAR_DETAIL_MAP[starId];
  if (!star) notFound();
  return <CelebrityApplyForm star={star} />;
}
