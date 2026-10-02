"use client";

import { ErrorBlock } from "@/components/common";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorBlock title="数字人演员没加载出来" message={error.message} onRetry={reset} />;
}
