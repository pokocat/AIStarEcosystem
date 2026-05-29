import { ScriptLibrary } from "@/components/material-ops/ScriptLibrary";

export const dynamic = "force-dynamic";

// ?compose=<productId>：从商品库「脚本生成」深链进来，自动锚定该商品建草稿进编辑。
export default async function WorkshopPage({ searchParams }: { searchParams: Promise<{ compose?: string }> }) {
  const { compose } = await searchParams;
  return <ScriptLibrary composeProductId={compose} />;
}
