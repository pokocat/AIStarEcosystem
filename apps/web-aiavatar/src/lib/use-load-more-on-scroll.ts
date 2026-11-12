"use client";

import { useEffect, useEffectEvent, useRef } from "react";

/** Observe the end of the list. The browser also clips it against any scrollable ancestor. */
export function useLoadMoreOnScroll<T extends HTMLElement = HTMLDivElement>(
  enabled: boolean,
  page: number,
  onMore: () => void,
  filterKey?: string,
) {
  const end = useRef<T>(null);
  const load = useEffectEvent((observedPage: number, observedFilter?: string) => {
    if (enabled && page === observedPage && filterKey === observedFilter) onMore();
  });

  useEffect(() => {
    const element = end.current;
    if (!enabled || !element || typeof IntersectionObserver === "undefined") return;
    let active = true;
    const observer = new IntersectionObserver(entries => {
      if (!active || !entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0)) return;
      active = false;
      observer.disconnect();
      load(page, filterKey);
    }, { threshold: 0.01 });
    observer.observe(element);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [enabled, page, filterKey]);

  return end;
}
