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
  return <CelebrityProjectDetail project={project} videos={videos} />;
}
