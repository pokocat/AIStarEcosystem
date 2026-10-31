"use client";
// 资产页和资产选择框的瀑布流：按容器宽度定列数，每张卡放进当前最矮的那一列，读起来仍是从左到右、从上到下。
import { useEffect, useState, type RefObject } from 'react';

/** 容器宽度能放下几列（每列至少 min 宽）。没有 ResizeObserver（测试环境）时按 fallback 列。 */
export function useMasonryColumns(ref: RefObject<HTMLElement | null>, min = 196, gap = 14, fallback = 4): number {
  const [columns, setColumns] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = (width: number) => setColumns(Math.max(2, Math.floor((width + gap) / (min + gap))));
    measure(el.getBoundingClientRect().width || min * fallback);
    const observer = new ResizeObserver(([entry]) => entry && measure(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, min, gap, fallback]);
  return columns;
}

/** 把 items 分到 n 列：高 / 宽比（ratio）越大越占高度，另加一行标题的高度。 */
export function masonry<T>(items: T[], n: number, ratio: (item: T) => number, caption = 0.3): T[][] {
  const cols = Array.from({ length: Math.max(1, n) }, () => ({ height: 0, items: [] as T[] }));
  for (const item of items) {
    const shortest = cols.reduce((a, b) => (b.height < a.height ? b : a));
    shortest.items.push(item);
    shortest.height += ratio(item) + caption;
  }
  return cols.map(c => c.items);
}

/** 媒体的高宽比，读不到尺寸时按方图算，并限制在 9:16 到 16:9 之间。 */
export function mediaRatio(width?: number, height?: number, fallback = 1): number {
  if (!width || !height) return fallback;
  return Math.min(16 / 9, Math.max(9 / 16, height / width));
}
