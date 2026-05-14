"use client";

import { ErrorBlock } from "@/components/common";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorBlock title="演员阵容加载失败" message={error.message} onRetry={reset} />;
}
