"use client";
// ============================================================
// hooks.ts — 数据获取 / 轮询 / mock 订阅。
// mock 模式：store 自带 ticker + emit，hook 订阅后实时刷新；
// live 模式：对进行中数据做轮询（任务进度），其余按需 reload。
// ============================================================
import * as React from "react";
import { USE_MOCK } from "@ai-star-eco/api-client";
import { mockStore } from "@/mocks/store";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** 跑一个 async fetcher；deps 变化重跑。mock 模式自动订阅 store 变更刷新。 */
export function useApi<T>(fetcher: () => Promise<T>, deps: React.DependencyList = []): AsyncState<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;
  const mounted = React.useRef(true);

  const run = React.useCallback(async () => {
    try {
      const d = await fetcherRef.current();
      if (mounted.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  React.useEffect(() => {
    mounted.current = true;
    run();
    return () => {
      mounted.current = false;
    };
  }, [run]);

  // mock：订阅 store，任何 mutation / tick 后刷新当前视图。
  React.useEffect(() => {
    if (!USE_MOCK) return;
    const unsub = mockStore().subscribe(() => run());
    return unsub;
  }, [run]);

  return { data, loading, error, reload: run };
}

/** 周期性回调（active=false 暂停）。 */
export function usePolling(cb: () => void, ms: number, active = true) {
  const cbRef = React.useRef(cb);
  cbRef.current = cb;
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => cbRef.current(), ms);
    return () => window.clearInterval(id);
  }, [ms, active]);
}

/** 在 mock 模式订阅 store 变更（live 模式 no-op）。 */
export function useMockSubscribe(cb: () => void) {
  const cbRef = React.useRef(cb);
  cbRef.current = cb;
  React.useEffect(() => {
    if (!USE_MOCK) return;
    return mockStore().subscribe(() => cbRef.current());
  }, []);
}
