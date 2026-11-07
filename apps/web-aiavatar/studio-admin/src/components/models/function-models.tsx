"use client";

// 功能与售价：每个功能用哪个模型、卖多少积分。共用配置改一处影响多个功能，保存前列出来确认。

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Card } from "@ai-star-eco/ui/ui/card";
import { Checkbox } from "@ai-star-eco/ui/ui/checkbox";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ai-star-eco/ui/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@ai-star-eco/ui/ui/sheet";
import { Switch } from "@ai-star-eco/ui/ui/switch";
import { cn } from "@ai-star-eco/ui/ui/utils";
import type {
  AiAppEndpointCandidate, ModelFunctionPricing, ModelFunctionPricingRow, ModelFunctionRow, ModelFunctionStatus, VideoStudioPricingConfig,
} from "@ai-star-eco/types/ai-model-config";
import { ModelConfigApi } from "@/lib/api";
import { useConfirmDialog } from "@/components/use-confirm-dialog";
import { AffectedList, APP_CODES, APP_LABEL, errorText, Field, functionNames, Notice, unitLabel, type ModelConfigData } from "./shared";

const ALL = "all";
const STATUS: Record<ModelFunctionStatus, { label: string; tone: string }> = {
  configured: { label: "已配置", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  unconfigured: { label: "未配置", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  unavailable: { label: "不可用", tone: "border-rose-200 bg-rose-50 text-rose-700" },
  external: { label: "外部定价", tone: "border-slate-200 bg-slate-50 text-slate-500" },
  not_required: { label: "无需配置", tone: "border-slate-200 bg-slate-50 text-slate-500" },
};

const VIDEO_MODE_LABEL: Record<string, string> = { t2v: "文生视频", i2v: "图生视频", first_last_frame_video: "首尾帧", universal_reference_video: "全能参考" };

const keyOf = (row: { appCode: string; feature: string }) => `${row.appCode}.${row.feature}`;

function priceSummary(pricing: ModelFunctionPricing | undefined): string {
  if (!pricing) return "—";
  const unit = unitLabel(pricing.billingUnit);
  const point = (value: unknown) => (typeof value === "number" ? `${value} 积分 / ${unit}` : "");
  const fallback = pricing.fallback != null ? `未定价，按默认 ${pricing.fallback} 积分` : "未定价";
  switch (pricing.pricingKind) {
    case "none": return "不收费";
    case "action": { const value = (pricing.value ?? {}) as { creditPrice?: number; useEnginePricing?: boolean }; return value.useEnginePricing ? "按引擎价" : point(value.creditPrice) || fallback; }
    case "config": return point(pricing.value) || fallback;
    case "candidate": case "supplier_points": return "按模型定价";
    case "engine_matrix": return "按引擎定价";
    case "video_matrix": return "按模式和清晰度定价";
    case "scene_policy": return "按模型定价";
    case "runtime_snapshot": return "按发布价";
    default: return "—";
  }
}

/** IP Studio 剧本和图片的默认模型在场景配置里，共享绑定只是它们没配置时的回退。 */
function defaultModelName(row: ModelFunctionRow, data: ModelConfigData): string | undefined {
  if (row.routingKind === "scene_policy") {
    const policy = data.scenes.find((scene) => scene.scene === (row.feature === "script" ? "script" : "image"))?.policy;
    if (policy) return data.endpoints.find((endpoint) => endpoint.id === policy.defaultEndpointId)?.name ?? policy.defaultEndpointId;
  }
  return row.binding?.endpointName ?? row.candidates?.find((candidate) => candidate.isDefault)?.endpointName;
}

export function FunctionModels({ data, reload }: { data: ModelConfigData; reload: () => Promise<void> }) {
  const [app, setApp] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const pricing = React.useMemo(() => new Map(data.pricing.map((row) => [keyOf(row), row])), [data.pricing]);
  const rows = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.functions.filter((row) => {
      if (app !== ALL && row.appCode !== app) return false;
      if (status !== ALL && row.status !== status) return false;
      return !needle || [row.name, row.feature, row.binding?.endpointName].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [data.functions, app, status, query]);
  const counts = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (const row of data.functions) out[row.status] = (out[row.status] ?? 0) + 1;
    return out;
  }, [data.functions]);
  const current = data.functions.find((row) => keyOf(row) === editing);

  return (
    <Card className="min-w-0 gap-0 p-0">
      <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50/60 px-4 py-2.5">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索功能或模型" aria-label="搜索功能" className="h-9 bg-white pl-8" />
        </div>
        <Select value={app} onValueChange={setApp}>
          <SelectTrigger aria-label="按产品筛选" className="h-9 w-36 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>全部产品</SelectItem>{APP_CODES.map((code) => <SelectItem key={code} value={code}>{APP_LABEL[code]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="按状态筛选" className="h-9 w-32 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部状态</SelectItem>
            {(Object.keys(STATUS) as ModelFunctionStatus[]).filter((key) => counts[key]).map((key) => <SelectItem key={key} value={key}>{STATUS[key].label}（{counts[key]}）</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500">
            <th className="px-4 py-2.5 font-medium">功能</th>
            <th className="px-3 py-2.5 font-medium">默认模型</th>
            <th className="px-3 py-2.5 font-medium">可选模型</th>
            <th className="px-3 py-2.5 font-medium">售价</th>
            <th className="px-3 py-2.5 font-medium">状态</th>
            <th className="px-4 py-2.5" />
          </tr></thead>
          <tbody>
            {rows.map((row) => {
              const defaultName = defaultModelName(row, data);
              const enabledCount = row.candidates?.filter((candidate) => candidate.enabled).length ?? 0;
              return (
                <tr key={keyOf(row)} className="border-b last:border-b-0 hover:bg-slate-50/70">
                  <td className="max-w-64 px-4 py-2.5">
                    <p className="truncate font-medium text-slate-900">{row.name}</p>
                    <p className="truncate text-xs text-slate-500">{APP_LABEL[row.appCode] ?? row.appCode}</p>
                  </td>
                  <td className="max-w-56 px-3 py-2.5"><p className={cn("truncate text-xs", defaultName ? "text-slate-700" : "text-slate-400")} title={defaultName}>{defaultName ?? (row.purpose ? "未设置" : "不用模型")}</p></td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{row.routingKind === "scene_policy" || !row.purpose ? "—" : `${enabledCount} 个`}</td>
                  <td className="max-w-48 px-3 py-2.5"><p className="truncate text-xs text-slate-700" title={priceSummary(pricing.get(keyOf(row))?.pricing)}>{priceSummary(pricing.get(keyOf(row))?.pricing)}</p></td>
                  <td className="px-3 py-2.5"><Badge variant="outline" className={STATUS[row.status]?.tone}>{STATUS[row.status]?.label ?? row.status}</Badge></td>
                  <td className="px-4 py-2 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(keyOf(row))}>配置</Button></td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-14 text-center text-sm text-slate-500">没有符合条件的功能</td></tr>}
          </tbody>
        </table>
      </div>
      {current && <FunctionEditor key={editing} row={current} pricing={pricing.get(keyOf(current))} data={data} reload={reload} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function FunctionEditor({ row, pricing, data, reload, onClose }: {
  row: ModelFunctionRow; pricing: ModelFunctionPricingRow | undefined; data: ModelConfigData; reload: () => Promise<void>; onClose: () => void;
}) {
  const names = React.useMemo(() => functionNames(data.functions), [data.functions]);
  const others = row.affectedFeatures.filter((key) => key !== keyOf(row));
  const toStudio = row.routingKind === "scene_policy" || row.routingKind === "video_group";
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[640px]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>{row.name}</SheetTitle>
          <SheetDescription>{APP_LABEL[row.appCode] ?? row.appCode}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {others.length > 0 && <details className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <summary className="cursor-pointer font-medium">这项配置和 {others.length} 个功能共用，改动同时影响它们</summary>
            <AffectedList keys={others} names={names} />
          </details>}
          {toStudio && <Notice tone="warn">这个功能的模型在<Link href="/models?tab=studio" className="mx-1 underline underline-offset-2">IP Studio 模型</Link>里配置。</Notice>}
          {row.routingKind === "shared_purpose" && <ModelSection row={row} data={data} reload={reload} names={names} />}
          {row.routingKind === "shared_purpose" && pricing?.pricing.pricingKind === "candidate" && <CandidatePriceSection row={row} reload={reload} names={names} />}
          {pricing && <PriceSection row={pricing} functionRow={row} reload={reload} names={names} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-slate-900">{children}</h3>;
}

function ModelSection({ row, data, reload, names }: { row: ModelFunctionRow; data: ModelConfigData; reload: () => Promise<void>; names: Map<string, string> }) {
  const { confirm, dialog } = useConfirmDialog();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const candidates = row.candidates ?? [];
  const defaultId = candidates.find((candidate) => candidate.isDefault)?.endpointId ?? row.binding?.endpointId ?? "";
  const shared = row.affectedFeatures.length > 1;
  const allowed = (id: string) => { const policy = data.access.find((item) => item.endpointId === id)?.policy; return !policy || policy.scope === "all" || policy.appCodes.includes(row.appCode); };
  const addable = data.endpoints.filter((endpoint) => !candidates.some((candidate) => candidate.endpointId === endpoint.id) && allowed(endpoint.id));

  const confirmShared = async (title: string) => !shared || confirm(title, <div><p>这项配置共用，同时影响：</p><AffectedList keys={row.affectedFeatures} names={names} /></div>, "确认");
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await task(); await reload(); } catch (e) { setError(errorText(e)); await reload(); } finally { setBusy(false); }
  };
  const prepare = (endpointId: string, value: Record<string, unknown>) => ModelConfigApi.command("functionCandidatePrepare", { appCode: row.appCode, feature: row.feature, endpointId, value, acknowledgedAffectedFeatures: row.affectedFeatures });

  const setDefault = async (endpointId: string) => {
    if (!await confirmShared("更换默认模型？")) return;
    await run(() => ModelConfigApi.command("functionDefaultSave", { appCode: row.appCode, feature: row.feature, endpointId, acknowledgedAffectedFeatures: row.affectedFeatures }));
  };
  const add = async (endpointId: string) => {
    if (!await confirmShared("添加可选模型？")) return;
    await run(() => prepare(endpointId, { enabled: true }));
  };
  const toggle = async (candidate: AiAppEndpointCandidate, enabled: boolean) => {
    if (!await confirmShared(enabled ? "启用这个可选模型？" : "停用这个可选模型？")) return;
    await run(() => prepare(candidate.endpointId, { enabled }));
  };

  return (
    <section className="space-y-3">
      {dialog}
      <SectionTitle>模型</SectionTitle>
      <Field label="默认模型">
        <Select value={defaultId} onValueChange={(value) => void setDefault(value)} disabled={busy}>
          <SelectTrigger className="w-full"><SelectValue placeholder="选择默认模型" /></SelectTrigger>
          <SelectContent>{candidates.filter((candidate) => candidate.enabled && candidate.endpointEnabled).map((candidate) => <SelectItem key={candidate.endpointId} value={candidate.endpointId}>{candidate.endpointName ?? candidate.endpointId}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-600">可选模型</p>
        <div className="divide-y rounded-lg border">
          {candidates.map((candidate) => <CandidateRow key={candidate.endpointId} candidate={candidate} busy={busy} onToggle={(enabled) => void toggle(candidate, enabled)} onSave={async (value) => { if (await confirmShared("修改模型能力？")) await run(() => prepare(candidate.endpointId, value)); }} />)}
          {!candidates.length && <p className="px-3 py-6 text-center text-sm text-slate-500">还没有可选模型</p>}
        </div>
        <Select value="" onValueChange={(value) => void add(value)} disabled={busy}>
          <SelectTrigger aria-label="添加可选模型" className="w-full"><SelectValue placeholder="添加可选模型" /></SelectTrigger>
          <SelectContent>{addable.map((endpoint) => <SelectItem key={endpoint.id} value={endpoint.id}>{endpoint.name}{endpoint.enabled ? "" : "（已停用）"}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}

function CandidateRow({ candidate, busy, onToggle, onSave }: { candidate: AiAppEndpointCandidate; busy: boolean; onToggle: (enabled: boolean) => void; onSave: (value: Record<string, unknown>) => Promise<void> }) {
  const capability = candidate.capability ?? {};
  const initial = {
    maxRefImages: capability.maxRefImages == null ? "" : String(capability.maxRefImages),
    maxDurationSec: capability.maxDurationSec == null ? "" : String(capability.maxDurationSec),
    minImagePixels: capability.minImagePixels == null ? "" : String(capability.minImagePixels),
    supportsFirstLastFrame: !!capability.supportsFirstLastFrame,
    supportsSubjectReference: !!capability.supportsSubjectReference,
  };
  const [draft, setDraft] = React.useState(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const numberProblem = [draft.maxRefImages, draft.maxDurationSec, draft.minImagePixels].some((value) => value !== "" && !(Number.isSafeInteger(Number(value)) && Number(value) >= 0));
  const value = () => {
    const out: Record<string, unknown> = {};
    for (const key of ["maxRefImages", "maxDurationSec", "minImagePixels"] as const) if (draft[key] !== initial[key] && draft[key] !== "") out[key] = Number(draft[key]);
    for (const key of ["supportsFirstLastFrame", "supportsSubjectReference"] as const) if (draft[key] !== initial[key]) out[key] = draft[key];
    return out;
  };
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2">
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm", candidate.endpointEnabled === false ? "text-slate-400" : "text-slate-800")}>{candidate.endpointName ?? candidate.endpointId}</span>
          {(candidate.isDefault || candidate.endpointEnabled === false) && <span className="block text-xs text-slate-500">{candidate.isDefault ? "默认模型" : "模型已停用"}</span>}
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
        <span onClick={(event) => event.stopPropagation()}><Switch checked={candidate.enabled} disabled={busy || candidate.isDefault} aria-label={`${candidate.enabled ? "停用" : "启用"} ${candidate.endpointName ?? candidate.endpointId}`} onCheckedChange={onToggle} /></span>
      </summary>
      <div className="space-y-3 border-t bg-slate-50/60 px-3 py-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="最多参考图"><Input inputMode="numeric" className="h-8 bg-white" value={draft.maxRefImages} onChange={(event) => setDraft({ ...draft, maxRefImages: event.target.value })} /></Field>
          <Field label="最长时长（秒）"><Input inputMode="numeric" className="h-8 bg-white" value={draft.maxDurationSec} onChange={(event) => setDraft({ ...draft, maxDurationSec: event.target.value })} /></Field>
          <Field label="最小像素数"><Input inputMode="numeric" className="h-8 bg-white" value={draft.minImagePixels} onChange={(event) => setDraft({ ...draft, minImagePixels: event.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700"><Checkbox checked={draft.supportsFirstLastFrame} onCheckedChange={(checked) => setDraft({ ...draft, supportsFirstLastFrame: checked === true })} />支持首尾帧</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><Checkbox checked={draft.supportsSubjectReference} onCheckedChange={(checked) => setDraft({ ...draft, supportsSubjectReference: checked === true })} />支持人物参考</label>
        </div>
        <div className="flex items-center justify-end gap-3">
          {numberProblem && <span className="text-xs text-rose-600">要填不小于 0 的整数</span>}
          <Button size="sm" disabled={!dirty || numberProblem || busy} onClick={() => void onSave(value())}>保存</Button>
        </div>
      </div>
    </details>
  );
}

function CandidatePriceSection({ row, reload, names }: { row: ModelFunctionRow; reload: () => Promise<void>; names: Map<string, string> }) {
  const candidates = row.candidates ?? [];
  return (
    <section className="space-y-2">
      <SectionTitle>各模型售价</SectionTitle>
      <div className="divide-y rounded-lg border">
        {candidates.map((candidate) => (
          <PriceRow key={candidate.endpointId} label={candidate.endpointName ?? candidate.endpointId} unit={unitLabel(row.billingUnit)} initial={candidate.creditCostOverride ?? null} allowEmpty confirmTitle="修改售价？" affected={row.affectedFeatures} names={names}
            save={(value) => ModelConfigApi.command("functionCandidatePriceSave", { appCode: row.appCode, feature: row.feature, endpointId: candidate.endpointId, creditCostOverride: value, acknowledgedAffectedFeatures: row.affectedFeatures })}
            reload={reload} />
        ))}
        {!candidates.length && <p className="px-3 py-6 text-center text-sm text-slate-500">先添加可选模型</p>}
      </div>
    </section>
  );
}

function PriceRow({ label, unit, initial, allowEmpty, confirmTitle, affected, names, save, reload }: {
  label: string; unit: string; initial: number | null; allowEmpty?: boolean; confirmTitle?: string; affected?: string[]; names: Map<string, string>;
  save: (value: number | null) => Promise<unknown>; reload: () => Promise<void>;
}) {
  const { confirm, dialog } = useConfirmDialog();
  const text = initial == null ? "" : String(initial);
  const [value, setValue] = React.useState(text);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => setValue(text), [text]);
  const invalid = value.trim() === "" ? !allowEmpty : !(Number.isFinite(Number(value)) && Number(value) >= 0);
  const submit = async () => {
    if (affected && affected.length > 1 && confirmTitle && !await confirm(confirmTitle, <div><p>这项售价共用，同时影响：</p><AffectedList keys={affected} names={names} /></div>, "确认修改")) return;
    setSaving(true); setError("");
    try { await save(value.trim() === "" ? null : Number(value)); await reload(); }
    catch (e) { setError(errorText(e)); } finally { setSaving(false); }
  };
  return (
    <div className="px-3 py-2">
      {dialog}
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm text-slate-800" title={label}>{label}</span>
        <Input aria-label={`${label} 的积分价`} inputMode="decimal" className="h-8 w-24" value={value} onChange={(event) => setValue(event.target.value)} placeholder={allowEmpty ? "默认价" : undefined} />
        <span className="w-14 shrink-0 text-xs text-slate-500">积分 / {unit}</span>
        <Button size="sm" variant="outline" disabled={value === text || invalid || saving} onClick={() => void submit()}>{saving && <Loader2 className="size-3.5 animate-spin" />}保存</Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function PriceSection({ row, functionRow, reload, names }: { row: ModelFunctionPricingRow; functionRow: ModelFunctionRow; reload: () => Promise<void>; names: Map<string, string> }) {
  const { pricing } = row;
  const command = ModelConfigApi.command;
  const app = { appCode: pricing.appCode, feature: pricing.feature };
  const unit = unitLabel(pricing.billingUnit);
  const affected = row.priceAffectedFeatures ?? [];
  // 还没单独定价时才提示：一旦定过价，这个默认值就不起作用了。
  const unpriced = pricing.pricingKind === "action" ? (pricing.value as { creditPrice?: number } | null)?.creditPrice == null : pricing.value == null;
  const fallback = unpriced && pricing.fallback != null ? <p className="text-xs text-slate-500">还没有单独定价，现在按默认价 {pricing.fallback} 积分收费。</p> : null;

  switch (pricing.pricingKind) {
    case "action": {
      const value = (pricing.value ?? {}) as { creditPrice?: number; useEnginePricing?: boolean };
      return <section className="space-y-2"><SectionTitle>售价</SectionTitle><div className="rounded-lg border">
        <PriceRow label={functionRow.name} unit={unit} initial={value.creditPrice ?? null} confirmTitle="修改售价？" affected={affected} names={names} reload={reload}
          save={(creditPrice) => command("functionActionPriceSave", { ...app, value: { creditPrice, useEnginePricing: !!value.useEnginePricing } })} />
      </div>{value.useEnginePricing && <p className="text-xs text-slate-500">现在按引擎价收费，这里的价格只作备用。</p>}{fallback}</section>;
    }
    case "config":
      return <section className="space-y-2"><SectionTitle>售价</SectionTitle><div className="rounded-lg border">
        <PriceRow label={functionRow.name} unit={unit} initial={typeof pricing.value === "number" ? pricing.value : null} confirmTitle="修改售价？" affected={affected} names={names} reload={reload}
          save={(creditPrice) => command("functionConfigPriceSave", { ...app, creditPrice })} />
      </div>{fallback}</section>;
    case "supplier_points": {
      const entries = (Array.isArray(pricing.value) ? pricing.value : []) as { endpointId: string; endpointName?: string; creditPrice?: number | null }[];
      return <section className="space-y-2"><SectionTitle>各模型售价</SectionTitle><div className="divide-y rounded-lg border">
        {entries.map((entry) => <PriceRow key={entry.endpointId} label={entry.endpointName ?? entry.endpointId} unit={unit} initial={entry.creditPrice ?? null} confirmTitle="修改售价？" affected={affected} names={names} reload={reload}
          save={(creditPrice) => command("functionSupplierPointPriceSave", { ...app, endpointId: entry.endpointId, creditPrice, acknowledgedAffectedFeatures: affected })} />)}
        {!entries.length && <p className="px-3 py-6 text-center text-sm text-slate-500">先添加可选模型</p>}
      </div></section>;
    }
    case "engine_matrix": {
      const entries = Object.entries((pricing.value ?? {}) as Record<string, { creditPrice?: number }>);
      return <section className="space-y-2"><SectionTitle>各引擎售价</SectionTitle><div className="divide-y rounded-lg border">
        {entries.map(([engine, value]) => <PriceRow key={engine} label={engine} unit={unit} initial={value.creditPrice ?? null} names={names} reload={reload}
          save={(creditPrice) => command("functionEnginePriceSave", { ...app, engine, value: { creditPrice } })} />)}
      </div></section>;
    }
    case "video_matrix":
      return <VideoMatrix pricing={pricing} affected={affected} names={names} reload={reload} />;
    case "scene_policy":
      return <p className="text-sm text-slate-600">售价在<Link href="/models?tab=studio" className="mx-1 text-[#4f6692] underline underline-offset-2">IP Studio 模型</Link>里配置。</p>;
    case "runtime_snapshot":
      return <p className="text-sm text-slate-600">售价由平台发布价决定，这里不能修改。</p>;
    case "none":
      return <p className="text-sm text-slate-600">这个功能不收费。</p>;
    default:
      return null;
  }
}

function VideoMatrix({ pricing, affected, names, reload }: { pricing: ModelFunctionPricing; affected: string[]; names: Map<string, string>; reload: () => Promise<void> }) {
  const { confirm, dialog } = useConfirmDialog();
  const initial = (pricing.value ?? { perSecond: {} }) as VideoStudioPricingConfig;
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => setDraft(initial), [pricing.value]); // eslint-disable-line react-hooks/exhaustive-deps

  // 表头取「已有的价格」和「模型支持的」的并集：线上配了价的格子不能因为模型暂时没开就看不见。
  const modeLabel = new Map([...Object.entries(VIDEO_MODE_LABEL), ...(pricing.videoDimensions?.modes ?? []).filter((item) => item.label !== item.mode && !VIDEO_MODE_LABEL[item.mode]).map((item) => [item.mode, item.label] as [string, string])]);
  const dimensionModes = (pricing.videoDimensions?.modes ?? []).map((item) => item.mode);
  const modes = [...new Set([...Object.keys(initial.perSecond ?? {}), ...dimensionModes])];
  const tiers = [...new Set([...Object.values(initial.perSecond ?? {}).flatMap((row) => Object.keys(row ?? {})), ...(pricing.videoDimensions?.tiers ?? [])])];
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const setCell = (mode: string, tier: string, raw: string) => {
    if (raw !== "" && !(Number.isSafeInteger(Number(raw)) && Number(raw) >= 0)) return;
    setDraft((current) => ({ ...current, perSecond: { ...current.perSecond, [mode]: { ...(current.perSecond?.[mode] ?? {}), [tier]: raw === "" ? null : Number(raw) } } }));
  };
  const setNumber = (key: "freeRefImages" | "extraRefImagePerSecond" | "promptOptimizationPerCall", raw: string) => {
    if (raw !== "" && !(Number.isSafeInteger(Number(raw)) && Number(raw) >= 0)) return;
    setDraft((current) => ({ ...current, [key]: raw === "" ? undefined : Number(raw) }));
  };
  const save = async () => {
    if (!await confirm("修改视频价格表？", <div><p>价格表共用，同时影响：</p><AffectedList keys={affected} names={names} /></div>, "确认修改")) return;
    setSaving(true); setError("");
    try { await ModelConfigApi.command("videoPricesSave", { value: draft }); await reload(); }
    catch (e) { setError(errorText(e)); } finally { setSaving(false); }
  };

  return (
    <section className="space-y-3">
      {dialog}
      <SectionTitle>视频价格表（积分 / 秒）</SectionTitle>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500"><th className="px-3 py-2 font-medium">模式</th>{tiers.map((tier) => <th key={tier} className="px-2 py-2 font-medium">{tier}</th>)}</tr></thead>
          <tbody>{modes.map((mode) => (
            <tr key={mode} className="border-b last:border-b-0">
              <td className="whitespace-nowrap px-3 py-1.5 text-xs text-slate-700">{modeLabel.get(mode) ?? mode}</td>
              {tiers.map((tier) => <td key={tier} className="px-2 py-1.5"><Input aria-label={`${modeLabel.get(mode) ?? mode} ${tier} 每秒积分`} inputMode="numeric" className="h-8 w-20" placeholder="未定价" value={draft.perSecond?.[mode]?.[tier] ?? ""} onChange={(event) => setCell(mode, tier, event.target.value)} /></td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">留空的格子按模型的每秒价收费；模型也没定价时不能提交生成。</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="免费参考图（张）"><Input inputMode="numeric" className="h-8" value={draft.freeRefImages ?? ""} onChange={(event) => setNumber("freeRefImages", event.target.value)} /></Field>
        <Field label="每多一张加价（积分 / 秒）"><Input inputMode="numeric" className="h-8" value={draft.extraRefImagePerSecond ?? ""} onChange={(event) => setNumber("extraRefImagePerSecond", event.target.value)} /></Field>
        <Field label="提示词优化（积分 / 次）"><Input inputMode="numeric" className="h-8" value={draft.promptOptimizationPerCall ?? ""} onChange={(event) => setNumber("promptOptimizationPerCall", event.target.value)} /></Field>
      </div>
      <div className="flex justify-end"><Button disabled={!dirty || saving} onClick={() => void save()}>{saving && <Loader2 className="size-4 animate-spin" />}保存</Button></div>
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
