import { JobDetailClient } from "./job-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MixcutJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <JobDetailClient id={id} />;
}
