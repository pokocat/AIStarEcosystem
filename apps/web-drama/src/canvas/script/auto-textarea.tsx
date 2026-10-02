"use client";

// 高度跟着内容走的多行文本框（剧本页的故事大纲、分集剧情、分集剧本正文都用它）。
// 高度上限由 CSS 的 max-height 管（长正文超过上限就在框里滚动，页面不会被撑成几万像素高）。
// 只在内容或宽度变了时量一次高度；宽度变化靠 ResizeObserver（没有的环境就只跟内容走）。
import * as React from "react";

export type AutoTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

function fit(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  // scrollHeight 不含边框；box-sizing 是 border-box，要把上下边框加回去，否则每次都差两三像素、出现滚动条
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = `${el.scrollHeight + Math.max(0, border)}px`;
}

export const AutoTextarea = React.memo(function AutoTextarea({ value, onValueChange, ...rest }: AutoTextareaProps) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);

  React.useLayoutEffect(() => {
    if (ref.current) fit(ref.current);
  }, [value]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit(el);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return <textarea ref={ref} rows={1} {...rest} value={value} onChange={(e) => onValueChange(e.target.value)} />;
});
