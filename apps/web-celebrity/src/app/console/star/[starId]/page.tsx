import { notFound } from "next/navigation";
import { CelebrityStarDetail } from "@/components/celebrity-zone/CelebrityStarDetail";
import { STAR_DETAIL_MAP } from "@/mocks/celebrity-zone";

interface PageProps {
  params: Promise<{ starId: string }>;
}

export default async function StarDetailPage({ params }: PageProps) {
  const { starId } = await params;
  const star = STAR_DETAIL_MAP[starId];
  if (!star) notFound();
  return <CelebrityStarDetail star={star} />;
}
