"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * 控制台 tab 与 URL 的双向绑定：
 * - 首次渲染从 `?tab=xxx` 回填；缺省时用 `defaultValue`
 * - setPage 写回 URL（`router.replace`，不入历史栈但地址可复制、可刷新）
 * - 监听 popstate / searchParams 变化，支持浏览器前进后退
 */
export function usePageParam<T extends string>(defaultValue: T, paramName = "tab"): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = (searchParams?.get(paramName) as T | null) ?? defaultValue;
  const [page, setPageState] = useState<T>(initial);

  useEffect(() => {
    const fromUrl = searchParams?.get(paramName) as T | null;
    if (fromUrl && fromUrl !== page) setPageState(fromUrl);
  }, [searchParams, paramName]);

  const setPage = useCallback((next: T) => {
    setPageState(next);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === defaultValue) {
      params.delete(paramName);
    } else {
      params.set(paramName, next);
    }
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    router.replace(url, { scroll: false });
  }, [router, pathname, searchParams, paramName, defaultValue]);

  return [page, setPage];
}
