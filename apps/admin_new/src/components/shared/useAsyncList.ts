"use client";

import * as React from "react";

/**
 * useAsyncList — 统一的异步列表加载 hook。
 * 支持 fallback 数据（mock）以便 SSR 后 hydrate 不闪屏。
 */
export function useAsyncList<T>(
  loader: () => Promise<T[]>,
  fallback: T[] = []
): { data: T[]; loading: boolean; error: unknown; reload: () => void } {
  const [data, setData] = React.useState<T[]>(fallback);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    loader()
      .then((res) => {
        if (!alive) return;
        setData(res ?? []);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
