import { ProductMaterial } from "@/components/material-ops/ProductMaterial";

export const dynamic = "force-dynamic";

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  return <ProductMaterial initialProductId={product} />;
}
