"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@ai-star-eco/ui/ui/utils";
import type {
  AiModelAccessRow, AiModelEndpoint, AiModelProviderPreset, AiSceneCatalogRow, AiStudioVideoGroup, ModelFunctionPricingRow, ModelFunctionRow,
} from "@ai-star-eco/types/ai-model-config";

export interface ModelConfigData {
  endpoints: AiModelEndpoint[];
  access: AiModelAccessRow[];
  presets: AiModelProviderPreset[];
  functions: ModelFunctionRow[];
  pricing: ModelFunctionPricingRow[];
  scenes: AiSceneCatalogRow[];
  videoGroup: AiStudioVideoGroup | null;
  directorDefault: string | null;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "操作没有完成，请重试");

export const APP_LABEL: Record<string, string> = { studio: "IP Studio", aiavatar: "数字资产", drama: "AI 短剧", celebrity: "AI 明星带货", music: "AI 音乐人" };
export const APP_CODES = ["studio", "aiavatar", "drama", "celebrity", "music"];

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0 space-y-1.5", className)}>
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-5 text-slate-400">{hint}</span>}
    </label>
  );
}

export function Notice({ tone, children, onClose }: { tone: "error" | "ok" | "warn"; children: React.ReactNode; onClose?: () => void }) {
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
      tone === "error" && "border-rose-200 bg-rose-50 text-rose-700",
      tone === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-700",
      tone === "warn" && "border-amber-200 bg-amber-50 text-amber-800")}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {onClose && <button type="button" onClick={onClose} className="shrink-0 text-xs opacity-70 hover:opacity-100">关闭</button>}
    </div>
  );
}

/** 共用配置改一处影响多个功能：列出来让人看清再确认。 */
export function AffectedList({ keys, names }: { keys: string[]; names: Map<string, string> }) {
  return (
    <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm text-slate-600">
      {keys.map((key) => <li key={key}>{names.get(key) ?? key}</li>)}
    </ul>
  );
}

export function functionNames(functions: ModelFunctionRow[]): Map<string, string> {
  return new Map(functions.map((row) => [`${row.appCode}.${row.feature}`, `${APP_LABEL[row.appCode] ?? row.appCode} · ${row.name}`]));
}

const UNIT_LABEL: Record<string, string> = { per_call: "次", per_second: "秒", per_image: "张", endpoint: "秒" };
export const unitLabel = (unit: string) => UNIT_LABEL[unit] ?? "次";

export const yuanCost = (micros: number) => {
  const value = micros / 1_000_000;
  return `¥${value >= 0.01 ? value.toFixed(value >= 1 ? 2 : 4).replace(/0+$/, "").replace(/\.$/, "") : String(value)}`;
};
