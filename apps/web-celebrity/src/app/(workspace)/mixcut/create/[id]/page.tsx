import { CreateClient } from "./create-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MixcutCreatePage({ params }: PageProps) {
  const { id } = await params;
  return <CreateClient id={id} />;
}
