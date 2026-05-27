"use client";

// v0.37+：项目详情接通真后端（getProject + listProjectVideos）。USE_MOCK=1 回退 mocks。
// 同时保留上游 Next 16 Suspense 包裹 —— CelebrityProjectDetail 内部用 useSearchParams 读
// ?action=distribute，Next 16 strict mode 要求 Suspense 边界。

import * as React from "react";
import { Suspense } from "react";
import { notFound, useParams } from "next/navigation";
import { CelebrityProjectDetail } from "@/components/celebrity-zone/CelebrityProjectDetail";
import { getProject, listProjectVideos } from "@/api/celebrity-zone";
import type {
  CelebrityProject,
  CelebrityProjectVideo,
} from "@ai-star-eco/types/celebrity-zone";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId;
  const [project, setProject] = React.useState<CelebrityProject | null | undefined>(undefined);
  const [videos, setVideos] = React.useState<CelebrityProjectVideo[]>([]);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      const [p, v] = await Promise.all([
        getProject(projectId).catch(() => null),
        listProjectVideos(projectId).catch(() => [] as CelebrityProjectVideo[]),
      ]);
      if (cancelled) return;
      setProject(p);
      setVideos(v);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (project === undefined) {
    return <div className="px-6 py-16 text-sm text-zinc-500">加载中…</div>;
  }
  if (project === null) {
    notFound();
  }
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
