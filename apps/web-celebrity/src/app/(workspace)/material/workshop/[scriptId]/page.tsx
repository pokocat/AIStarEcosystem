import { PreviewClient } from "./preview-client";

export const dynamic = "force-dynamic";

export default async function ScriptPreviewPage({ params }: { params: Promise<{ scriptId: string }> }) {
  const { scriptId } = await params;
  return <PreviewClient scriptId={scriptId} />;
}
