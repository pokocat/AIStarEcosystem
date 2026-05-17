import { TemplateDetailClient } from "./template-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TemplateDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <TemplateDetailClient id={id} />;
}
