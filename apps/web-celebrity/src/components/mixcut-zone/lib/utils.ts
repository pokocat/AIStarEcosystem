import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("zh-CN").format(n);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleDateString("zh-CN");
}

export function shortHash(s: string, n = 8): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

/**
 * 把归一化的 rect (x,y,w,h ∈ 0..1) 翻译成"画面顶部居中、占满宽 / 中部、占 80% 宽"这类
 * 人话描述。给运营看,而不是 (0.05, 0.52) · 90×5% 这种工程话术。
 */
export function describeRect(rect?: { x: number; y: number; w: number; h: number }): string {
  if (!rect) return "全屏";
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const v = cy < 0.33 ? "顶部" : cy > 0.67 ? "底部" : "中部";
  const h = cx < 0.33 ? "靠左" : cx > 0.67 ? "靠右" : "居中";
  const sizeLabel =
    rect.w >= 0.95 && rect.h >= 0.95
      ? "占满全屏"
      : rect.w >= 0.95
        ? `占满宽 · 高 ${Math.round(rect.h * 100)}%`
        : `${Math.round(rect.w * 100)}% × ${Math.round(rect.h * 100)}%`;
  return `${v}${h} · ${sizeLabel}`;
}

/**
 * 时间段描述:整段显示 / 0–15 秒 / 2 秒后出现。
 */
export function describeTimeRange(range: readonly [number, number], totalDuration?: number): string {
  const [start, end] = range;
  if (totalDuration && start === 0 && end >= totalDuration) return "全程显示";
  if (start === 0) return `开头到 ${end} 秒`;
  if (totalDuration && end >= totalDuration) return `${start} 秒后出现`;
  return `${start}–${end} 秒`;
}
