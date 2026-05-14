"use client";

// drama-query — 极轻量 client-side cache。
// 设计目标：避免引入 React Query。提供：
//   - usePageData(key, loader): 包 React 19 use()，组件挂载后异步取数；
//   - invalidate(keyPrefix): mutation 后让相关 key 重新拉取；
//   - mutate(key, value): 写入本地缓存（乐观更新）。
//
// 内存数据结构：key -> { promise, value, error, ts }。
// 失败时 promise reject，组件由 error boundary 接住；retry 通过 invalidate 触发。

import * as React from "react";

interface CacheEntry<T> {
  promise: Promise<T>;
  value?: T;
  error?: unknown;
  ts: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const subscribers = new Map<string, Set<() => void>>();

function subscribe(key: string, cb: () => void): () => void {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) subscribers.delete(key);
  };
}

function notify(key: string) {
  subscribers.get(key)?.forEach((cb) => cb());
  // 通配前缀：以 / 开头时，也通知子项（暂未启用）
}

function load<T>(key: string, loader: () => Promise<T>): CacheEntry<T> {
  let entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    const promise = loader()
      .then((v) => {
        const cur = cache.get(key) as CacheEntry<T> | undefined;
        if (cur) {
          cur.value = v;
          cur.error = undefined;
        }
        notify(key);
        return v;
      })
      .catch((e) => {
        const cur = cache.get(key) as CacheEntry<T> | undefined;
        if (cur) cur.error = e;
        notify(key);
        throw e;
      });
    entry = { promise, ts: Date.now() };
    cache.set(key, entry as CacheEntry<unknown>);
  }
  return entry;
}

/**
 * 在 client component 中拉数据。返回值会 suspend（首次加载时抛 promise）。
 * 用 React 19 use() 语义；外层用 <Suspense> 或 loading.tsx 兜底。
 *
 * @param key      缓存键（建议路径形式：`/cast/list`、`/scripts/${id}`）
 * @param loader   异步取数函数
 */
export function usePageData<T>(key: string, loader: () => Promise<T>): T {
  const entry = load(key, loader);
  // 订阅刷新
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => subscribe(key, force), [key]);

  if (entry.error) throw entry.error;
  if (entry.value !== undefined) return entry.value as T;
  // 还没有值 — suspend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  throw entry.promise as any;
}

/**
 * 不 suspend 的版本：返回 { data, isLoading, error, refetch }。
 * 适合列表 + 详情可以共存于同一页面的场景。
 */
export function useAsync<T>(key: string, loader: () => Promise<T>): {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
} {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => subscribe(key, force), [key]);
  React.useEffect(() => {
    if (!cache.has(key)) {
      load(key, loader);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const entry = cache.get(key) as CacheEntry<T> | undefined;
  return {
    data: entry?.value,
    isLoading: !entry || (entry.value === undefined && !entry.error),
    error: entry?.error,
    refetch: () => {
      cache.delete(key);
      load(key, loader);
      notify(key);
    },
  };
}

/**
 * 清除一个或多个 cache 项，使其重新加载。
 * 参数：完整 key 或 key 前缀（以 `/` 开头视作前缀匹配）。
 */
export function invalidate(keyOrPrefix: string): void {
  if (keyOrPrefix.endsWith("/")) {
    for (const k of Array.from(cache.keys())) {
      if (k.startsWith(keyOrPrefix)) {
        cache.delete(k);
        notify(k);
      }
    }
  } else {
    cache.delete(keyOrPrefix);
    notify(keyOrPrefix);
  }
}

/**
 * 直接写入缓存（乐观更新）。
 */
export function mutate<T>(key: string, value: T): void {
  let entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    entry = { promise: Promise.resolve(value), value, ts: Date.now() };
    cache.set(key, entry as CacheEntry<unknown>);
  } else {
    entry.value = value;
    entry.error = undefined;
  }
  notify(key);
}

/**
 * 一次性清空所有 cache（用于登出）。
 */
export function clearAll(): void {
  for (const k of Array.from(cache.keys())) {
    cache.delete(k);
    notify(k);
  }
}
