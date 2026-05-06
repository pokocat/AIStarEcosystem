import { notFound, redirect } from "next/navigation";
import { CelebrityGenerationWorkspace } from "@/components/celebrity-zone/CelebrityGenerationWorkspace";
import { STAR_DETAIL_MAP } from "@/mocks/celebrity-zone";

interface PageProps {
  params: Promise<{ starId: string }>;
}

/**
 * 生成工作台守卫：未授权 / 待审核 / 已过期均拦截回明星详情页，避免直接拼 URL 越过授权。
 * 只有 authorized 状态可进入工作台。
 */
export default async function StarGeneratePage({ params }: PageProps) {
  const { starId } = await params;
  const star = STAR_DETAIL_MAP[starId];
  if (!star) notFound();
  if (star.authorization.status !== "authorized") {
    redirect(`/producer/celebrity-zone/star/${starId}`);
  }
  return <CelebrityGenerationWorkspace starId={starId} />;
}
