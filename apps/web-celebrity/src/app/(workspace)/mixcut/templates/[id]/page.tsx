import { TemplateDetailClient } from "./template-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string | string[] }>;
}

export default async function TemplateDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const legacyEditQuery = Array.isArray(sp.edit) ? sp.edit.includes("1") : sp.edit === "1";

  return <TemplateDetailClient id={id} legacyEditQuery={legacyEditQuery} />;
}
