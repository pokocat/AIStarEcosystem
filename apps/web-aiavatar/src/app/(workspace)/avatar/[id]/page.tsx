import { AvatarDetailClient } from "@/components/avatar/avatar-detail-client";

// Next 16：params 是 Promise，server 外壳 await 后传给 client。
export default async function AvatarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AvatarDetailClient avatarId={id} />;
}
