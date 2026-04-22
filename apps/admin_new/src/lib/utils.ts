import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyCN(amount: number): string {
  if (!Number.isFinite(amount)) return "¥0";
  if (Math.abs(amount) >= 100_000_000) return `¥${(amount / 100_000_000).toFixed(2)}亿`;
  if (Math.abs(amount) >= 10_000) return `¥${(amount / 10_000).toFixed(1)}万`;
  return `¥${amount.toLocaleString("zh-CN")}`;
}

export function formatCountCN(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("zh-CN");
}

export function formatDateCN(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function daysUntil(iso: string): number {
  const now = new Date();
  const target = new Date(iso);
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function pluralCN(n: number, unit: string): string {
  return `${n.toLocaleString("zh-CN")}${unit}`;
}
