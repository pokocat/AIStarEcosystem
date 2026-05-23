import { Suspense } from "react";
import { CreateClient } from "./create-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MixcutCreatePage({ params }: PageProps) {
  const { id } = await params;
  // v0.26+: CreateClient 用了 useSearchParams 读 product_id；Next 16 build 要求 Suspense 包裹
  return (
    <Suspense
      fallback={
        <div className="px-6 lg:px-8 py-12 max-w-[1600px] mx-auto text-center text-muted-foreground text-sm">
          加载中…
        </div>
      }
    >
      <CreateClient id={id} />
    </Suspense>
  );
}
