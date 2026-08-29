"use client";
// 中枢新界面（P1）· 数据拉取小工具：带 loading / error 的异步 hook。
// 数据本体仍走 src/proto/api.ts 的域 API（mock/live 双模式行为不变）。
//
// 语义约定（review #6/#13）：
// - enabled=false（守卫未放行）期间 loading 恒为 true，不会闪初始空数据；
// - deps 变化（如 /assets/A → /assets/B）先重置回 initial + loading，不残留上一实体。
import { useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export function useHubData<T>(fn: () => Promise<T>, initial: T, deps: unknown[] = [], enabled = true): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: initial, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const initialRef = useRef(initial);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ data: initialRef.current, loading: true, error: null });
    fnRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "加载失败，请稍后重试";
          setState({ data: initialRef.current, loading: false, error: message });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return state;
}

/** 一个查询是否已拿到可下结论的数据（加载中 / 出错都不算）。 */
export function settled(s: AsyncState<unknown>): boolean {
  return !s.loading && !s.error;
}

/** 老 SPA（/studio）内各类资产详情的 hash 深链。 */
export function studioHref(hash: string): string {
  return `/studio${hash.startsWith("#") ? hash : `#/${hash}`}`;
}
