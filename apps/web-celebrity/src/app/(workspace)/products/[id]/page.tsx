import { CelebrityProductDetail } from "@/components/celebrity-zone/CelebrityProductDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <CelebrityProductDetail productId={id} />;
}
