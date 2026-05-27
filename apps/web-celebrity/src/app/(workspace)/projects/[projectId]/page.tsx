import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CelebrityProjectDetail } from "@/components/celebrity-zone/CelebrityProjectDetail";
import {
  CELEBRITY_PROJECTS,
  PROJECT_VIDEOS_MAP,
} from "@/mocks/celebrity-zone";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;
  const project = CELEBRITY_PROJECTS.find((p) => p.id === projectId);
  if (!project) notFound();
  const videos = PROJECT_VIDEOS_MAP[projectId] ?? [];
  // CelebrityProjectDetail 内部用 useSearchParams 读 ?action=distribute；Next 16 要求 Suspense 包裹
  return (
    <Suspense
      fallback={
        <div className="px-6 lg:px-8 py-12 text-center text-sm text-zinc-500">加载中…</div>
      }
    >
      <CelebrityProjectDetail project={project} videos={videos} />
    </Suspense>
  );
}
