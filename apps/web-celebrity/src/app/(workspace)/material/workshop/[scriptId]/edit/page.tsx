import { EditorClient } from "./editor-client";

export const dynamic = "force-dynamic";

export default async function ScriptEditPage({ params }: { params: Promise<{ scriptId: string }> }) {
  const { scriptId } = await params;
  return <EditorClient scriptId={scriptId} />;
}
