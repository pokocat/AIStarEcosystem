"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 平台 · AI 模型与用量
//   · 模型接入端点 = 固定 {上游密钥 + 单模型 + 地址}，仅供平台内部 AI 应用绑定调用。
//   · AI 应用绑定 = 每个用途（脚本起草 / 卖点提取 / 变量抽取…）固定指向一个端点。
//   上游密钥由 server AES-GCM 加密落库，列表仅显示脱敏值。
//   本期仅 OpenAI / OpenAI 兼容协议 真实可用；其它类型可建档，连通性测试返回「暂不支持」。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lock,
  ShieldCheck,
  ChevronRight,
  Settings2,
  Search,
  Wand2,
  Download,
  Copy,
  AlertTriangle,
  Link2,
  BarChart3,
  FileSearch,
  RotateCcw,
} from "lucide-react";
import { useConfirm, useToast } from "@/components/feedback";
import { AiModelsApi } from "@/api";
import { cn } from "@/lib/utils";
import type {
  AiModelEndpoint,
  AiModelBillingMode,
  AiModelProviderType,
  AiModelPurpose,
  AiModelEntry,
  AiModelProviderPreset,
  AiAppBinding,
  AiModelUsageReport,
  AiModelUsageStat,
  AiModelUsageDaily,
  AiModelUsageRecord,
  AiModelAlert,
  AiModelFailureStat,
  AdminAiModelEndpointUpsert,
  AiAppEndpointCandidate,
} from "@/api/ai-models";

const PROVIDER_TYPES: AiModelProviderType[] = [
  "OPENAI",
  "OPENAI_COMPATIBLE",
  "ANTHROPIC",
  "AZURE_OPENAI",
  "MOONSHOT",
  "DEEPSEEK",
  "BAIDU",
  "ALIYUN",
  "TENCENT",
  "VOLCENGINE",
  "CUSTOM",
];

const PROVIDER_LABEL: Record<AiModelProviderType, string> = {
  OPENAI: "OpenAI 原生",
  OPENAI_COMPATIBLE: "OpenAI 兼容协议",
  ANTHROPIC: "Anthropic Claude",
  AZURE_OPENAI: "Azure OpenAI",
  MOONSHOT: "月之暗面 Kimi",
  DEEPSEEK: "DeepSeek",
  BAIDU: "百度文心",
  ALIYUN: "阿里通义",
  TENCENT: "腾讯混元",
  VOLCENGINE: "火山豆包",
  CUSTOM: "自定义",
};

const SUPPORTED_PROVIDERS = new Set<AiModelProviderType>(["OPENAI", "OPENAI_COMPATIBLE"]);
const NONE = "__none__";

type BillingModeFormValue = "AUTO" | AiModelBillingMode;

const BILLING_MODE_LABEL: Record<BillingModeFormValue, string> = {
  AUTO: "自动",
  TOKENS: "按 Token",
  PER_CALL: "按次",
  PER_SECOND: "按秒",
};

type EditMode = "create" | "edit" | "copy";

interface FormDefaults {
  name?: string;
  baseUrl?: string;
  apiVersion?: string;
  model?: string;
  modelAlias?: string;
  ownerUserId?: string;
  defaultTemperature?: string;
  defaultMaxTokens?: string;
  defaultTopP?: string;
  rpmLimit?: string;
  tpmLimit?: string;
  dailyTokenQuota?: string;
  dailyCostQuotaYuan?: string;
  alertFailureRatePct?: string;
  billingMode?: BillingModeFormValue;
  promptPriceYuan?: string;
  completionPriceYuan?: string;
  unitPriceYuan?: string;
  apiKeyHint?: string;
  sourceName?: string;
}

interface FormState {
  id?: string;
  mode: EditMode;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  model: string;
  modelAlias: string;
  defaultTemperature: string;
  defaultMaxTokens: string;
  defaultTopP: string;
  rpmLimit: string;
  tpmLimit: string;
  dailyTokenQuota: string;
  dailyCostQuotaYuan: string;
  alertFailureRatePct: string;
  billingMode: BillingModeFormValue;
  models: AiModelEntry[];
  ownerUserId: string;
  clearOwnerUserId: boolean;
  promptPriceYuan: string;
  completionPriceYuan: string;
  unitPriceYuan: string;
  enabled: boolean;
  defaults?: FormDefaults;
}

const EMPTY_FORM: FormState = {
  mode: "create",
  name: "",
  providerType: "OPENAI_COMPATIBLE",
  baseUrl: "",
  apiKey: "",
  apiVersion: "",
  model: "",
  modelAlias: "",
  defaultTemperature: "",
  defaultMaxTokens: "",
  defaultTopP: "",
  rpmLimit: "",
  tpmLimit: "",
  dailyTokenQuota: "",
  dailyCostQuotaYuan: "",
  alertFailureRatePct: "",
  billingMode: "AUTO",
  models: [],
  ownerUserId: "",
  clearOwnerUserId: false,
  promptPriceYuan: "",
  completionPriceYuan: "",
  unitPriceYuan: "",
  enabled: true,
  defaults: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
  },
};

type TestState = "idle" | "running" | "ok" | "fail";

type BindingGroupKey = "celebrity" | "drama" | "aiavatar" | "creator" | "platform";

const MICROS_PER_YUAN = 1_000_000;
const USAGE_WINDOW_CHOICES = [
  { value: 1, label: "近 1 天" },
  { value: 7, label: "近 7 天" },
  { value: 14, label: "近 14 天" },
  { value: 30, label: "近 30 天" },
  { value: 60, label: "近 60 天" },
  { value: 90, label: "近 90 天" },
  { value: 180, label: "近 180 天" },
  { value: 365, label: "近 365 天" },
] as const;

const BINDING_GROUPS: Array<{
  key: BindingGroupKey;
  label: string;
  description: string;
  purposes: AiModelPurpose[];
}> = [
  {
    key: "celebrity",
    label: "明星带货",
    description: "模板脚本、商品卖点、变量抽取、参考分析与带货视频生成。",
    purposes: ["SCRIPT_DRAFT", "SELLING_POINTS", "VARIABLE_EXTRACT", "VIDEO_GENERATION", "VIDEO_REF_ANALYSIS", "TEMPLATE_REWRITE"],
  },
  {
    key: "drama",
    label: "AI 短剧",
    description:
      "短剧生成链路：分场景脚本起草、分镜首帧图像、短剧/短视频生成。其中「图像生成 / 视频生成」为跨产品共享端点（同一端点亦服务明星带货视频），在此改绑会同时影响其它产品线。",
    purposes: ["DRAMA_SCRIPT_DRAFT", "IMAGE_GENERATION", "VIDEO_GENERATION"],
  },
  {
    key: "aiavatar",
    label: "AiAvatar",
    description: "数字人人设解析、图片生成与视频生成的多模态调用。",
    purposes: ["DAP_PERSONA", "DAP_IMAGE", "DAP_VIDEO"],
  },
  {
    key: "creator",
    label: "音乐/短剧形象",
    description: "AI 音乐人与 AI 短剧共用的形象锻造顾问能力。",
    purposes: ["APPEARANCE_FORGE"],
  },
  {
    key: "platform",
    label: "平台通用",
    description: "风控复检与兜底通用能力。新增未归类用途也会先落在这里。",
    purposes: ["SAFETY_REVIEW", "GENERAL"],
  },
];

// 被任一分组显式声明的用途集合；未声明的用途落到「平台通用」兜底分组。
// 注意：一个用途可以出现在多个分组（如 VIDEO_GENERATION 同时服务明星带货与短剧），
// 故这里用集合判定「是否已声明」，而非 purpose→单一分组 的映射。
const DECLARED_PURPOSES = new Set<AiModelPurpose>(BINDING_GROUPS.flatMap((group) => group.purposes));

function valueOrDefault(form: FormState, key: keyof Pick<FormState, "name" | "baseUrl" | "apiVersion" | "model" | "modelAlias" | "ownerUserId" | "defaultTemperature" | "defaultMaxTokens" | "defaultTopP" | "rpmLimit" | "tpmLimit" | "dailyTokenQuota" | "dailyCostQuotaYuan" | "alertFailureRatePct">): string {
  const value = form[key].trim();
  if (value) return value;
  const fallback = form.defaults?.[key]?.trim();
  return fallback ?? "";
}

function placeholderFor(form: FormState, key: keyof FormDefaults, fallback: string): string {
  const value = form.defaults?.[key]?.trim();
  if (!value) return fallback;
  if (form.mode === "edit") return `当前：${value}`;
  if (form.mode === "copy") return `复制来源：${value}`;
  return value;
}

function microsToYuanText(value: number | null | undefined): string {
  if (!value || value <= 0) return "";
  return (value / MICROS_PER_YUAN).toFixed(6).replace(/\.?0+$/, "");
}

function parsePriceMicros(value: string): number | null {
  const raw = value.trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * MICROS_PER_YUAN);
}

function parseOptionalNumber(value: string, min: number, max: number): number | null | undefined {
  const raw = value.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

function parseOptionalInt(value: string, min: number): number | null | undefined {
  const raw = value.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) return undefined;
  return n;
}

function parseOptionalLong(value: string, min: number): number | null | undefined {
  const raw = value.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min) return undefined;
  return n;
}

function priceLabel(value: number | null | undefined): string {
  const text = microsToYuanText(value);
  return text ? `¥${text} / 1K` : "¥0 / 1K";
}

function unitPriceLabel(value: number | null | undefined, mode?: AiModelBillingMode | null): string {
  const text = microsToYuanText(value);
  const suffix = mode === "PER_SECOND" ? "/秒" : mode === "PER_CALL" ? "/次" : mode === "TOKENS" ? "" : "/次或秒";
  return text ? `¥${text}${suffix}` : `¥0${suffix}`;
}

function billingModeLabel(mode?: AiModelBillingMode | null): string {
  return BILLING_MODE_LABEL[mode ?? "AUTO"];
}

function durationUsageLabel(seconds: number): string {
  if (!seconds || seconds <= 0) return "0秒";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}小时${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

function meteredUsageLabel(units: number, seconds: number): string {
  const parts: string[] = [];
  if (units > 0) parts.push(`${units.toLocaleString()} 次`);
  if (seconds > 0) parts.push(durationUsageLabel(seconds));
  return parts.length ? parts.join(" / ") : "0";
}

function microsCostLabel(value: number | null | undefined): string {
  if (!value || value <= 0) return "¥0";
  return `¥${(value / MICROS_PER_YUAN).toFixed(4).replace(/\.?0+$/, "")}`;
}

function formTitle(form: FormState | null): string {
  if (!form) return "操作";
  if (form.mode === "edit") return "编辑端点";
  if (form.mode === "copy") return "复制为新端点";
  return "新建端点";
}

function editFormFromEndpoint(p: AiModelEndpoint): FormState {
  return {
    ...EMPTY_FORM,
    id: p.id,
    mode: "edit",
    name: p.name,
    providerType: p.providerType,
    baseUrl: p.baseUrl,
    apiVersion: p.apiVersion ?? "",
    model: p.model ?? "",
    modelAlias: p.modelAlias ?? "",
    defaultTemperature: p.defaultTemperature != null ? String(p.defaultTemperature) : "",
    defaultMaxTokens: p.defaultMaxTokens != null ? String(p.defaultMaxTokens) : "",
    defaultTopP: p.defaultTopP != null ? String(p.defaultTopP) : "",
    rpmLimit: p.rpmLimit != null ? String(p.rpmLimit) : "",
    tpmLimit: p.tpmLimit != null ? String(p.tpmLimit) : "",
    dailyTokenQuota: p.dailyTokenQuota != null ? String(p.dailyTokenQuota) : "",
    dailyCostQuotaYuan: microsToYuanText(p.dailyCostQuotaMicros),
    alertFailureRatePct: p.alertFailureRatePct != null ? String(p.alertFailureRatePct) : "",
    billingMode: p.billingMode ?? "AUTO",
    models: p.models ?? [],
    ownerUserId: p.ownerUserId ?? "",
    promptPriceYuan: microsToYuanText(p.promptTokenPriceMicros),
    completionPriceYuan: microsToYuanText(p.completionTokenPriceMicros),
    unitPriceYuan: microsToYuanText(p.unitPriceMicros),
    enabled: p.enabled,
    defaults: {
      name: p.name,
      baseUrl: p.baseUrl,
      apiVersion: p.apiVersion ?? "",
      model: p.model ?? "",
      modelAlias: p.modelAlias ?? "",
      ownerUserId: p.ownerUserId ?? "",
      defaultTemperature: p.defaultTemperature != null ? String(p.defaultTemperature) : "",
      defaultMaxTokens: p.defaultMaxTokens != null ? String(p.defaultMaxTokens) : "",
      defaultTopP: p.defaultTopP != null ? String(p.defaultTopP) : "",
      rpmLimit: p.rpmLimit != null ? String(p.rpmLimit) : "",
      tpmLimit: p.tpmLimit != null ? String(p.tpmLimit) : "",
      dailyTokenQuota: p.dailyTokenQuota != null ? String(p.dailyTokenQuota) : "",
      dailyCostQuotaYuan: microsToYuanText(p.dailyCostQuotaMicros),
      alertFailureRatePct: p.alertFailureRatePct != null ? String(p.alertFailureRatePct) : "",
      billingMode: p.billingMode ?? "AUTO",
      promptPriceYuan: microsToYuanText(p.promptTokenPriceMicros),
      completionPriceYuan: microsToYuanText(p.completionTokenPriceMicros),
      unitPriceYuan: microsToYuanText(p.unitPriceMicros),
      sourceName: p.name,
    },
  };
}

function copyFormFromEndpoint(p: AiModelEndpoint): FormState {
  return {
    ...EMPTY_FORM,
    mode: "copy",
    name: `${p.name} 副本`,
    providerType: p.providerType,
    baseUrl: p.baseUrl,
    apiVersion: p.apiVersion ?? "",
    model: p.model ?? "",
    models: p.models ?? [],
    modelAlias: p.modelAlias ?? "",
    defaultTemperature: p.defaultTemperature != null ? String(p.defaultTemperature) : "",
    defaultMaxTokens: p.defaultMaxTokens != null ? String(p.defaultMaxTokens) : "",
    defaultTopP: p.defaultTopP != null ? String(p.defaultTopP) : "",
    rpmLimit: p.rpmLimit != null ? String(p.rpmLimit) : "",
    tpmLimit: p.tpmLimit != null ? String(p.tpmLimit) : "",
    dailyTokenQuota: p.dailyTokenQuota != null ? String(p.dailyTokenQuota) : "",
    dailyCostQuotaYuan: microsToYuanText(p.dailyCostQuotaMicros),
    alertFailureRatePct: p.alertFailureRatePct != null ? String(p.alertFailureRatePct) : "",
    ownerUserId: p.ownerUserId ?? "",
    billingMode: p.billingMode ?? "AUTO",
    promptPriceYuan: microsToYuanText(p.promptTokenPriceMicros),
    completionPriceYuan: microsToYuanText(p.completionTokenPriceMicros),
    unitPriceYuan: microsToYuanText(p.unitPriceMicros),
    enabled: p.enabled,
    defaults: {
      name: `${p.name} 副本`,
      baseUrl: p.baseUrl,
      apiVersion: p.apiVersion ?? "",
      model: p.model ?? "",
      modelAlias: p.modelAlias ?? "",
      ownerUserId: p.ownerUserId ?? "",
      defaultTemperature: p.defaultTemperature != null ? String(p.defaultTemperature) : "",
      defaultMaxTokens: p.defaultMaxTokens != null ? String(p.defaultMaxTokens) : "",
      defaultTopP: p.defaultTopP != null ? String(p.defaultTopP) : "",
      rpmLimit: p.rpmLimit != null ? String(p.rpmLimit) : "",
      tpmLimit: p.tpmLimit != null ? String(p.tpmLimit) : "",
      dailyTokenQuota: p.dailyTokenQuota != null ? String(p.dailyTokenQuota) : "",
      dailyCostQuotaYuan: microsToYuanText(p.dailyCostQuotaMicros),
      alertFailureRatePct: p.alertFailureRatePct != null ? String(p.alertFailureRatePct) : "",
      billingMode: p.billingMode ?? "AUTO",
      promptPriceYuan: microsToYuanText(p.promptTokenPriceMicros),
      completionPriceYuan: microsToYuanText(p.completionTokenPriceMicros),
      unitPriceYuan: microsToYuanText(p.unitPriceMicros),
      sourceName: p.name,
    },
  };
}

export default function AdminAiModelsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [endpoints, setEndpoints] = React.useState<AiModelEndpoint[]>([]);
  const [bindings, setBindings] = React.useState<AiAppBinding[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<FormState | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [bindingGroup, setBindingGroup] = React.useState<BindingGroupKey>("celebrity");
  const [testing, setTesting] = React.useState<Record<string, { state: TestState; message?: string }>>({});
  const [presets, setPresets] = React.useState<AiModelProviderPreset[]>([]);
  const [fetchingModels, setFetchingModels] = React.useState(false);
  const [query, setQuery] = React.useState("");
  // 用量统计（v0.41，合并自 goods_to_video）
  const [usage, setUsage] = React.useState<AiModelUsageReport | null>(null);
  const [records, setRecords] = React.useState<AiModelUsageRecord[]>([]);
  const [usageDays, setUsageDays] = React.useState(30);
  const [usageLoading, setUsageLoading] = React.useState(true);
  const [usageErr, setUsageErr] = React.useState<string | null>(null);
  const [recordQuery, setRecordQuery] = React.useState("");
  const [replayingRecordId, setReplayingRecordId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [eps, bs] = await Promise.all([AiModelsApi.list(), AiModelsApi.listBindings()]);
      setEndpoints(eps);
      setBindings(bs);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    void AiModelsApi.listPresets()
      .then(setPresets)
      .catch(() => {
        /* 预设拉取失败不阻塞页面 */
      });
  }, []);

  const loadUsage = React.useCallback(async (days: number) => {
    setUsageLoading(true);
    setUsageErr(null);
    try {
      const [report, latestRecords] = await Promise.all([
        AiModelsApi.getUsage(days),
        AiModelsApi.getUsageRecords({ days, q: recordQuery.trim() || undefined, size: 80 }),
      ]);
      setUsage(report);
      setRecords(latestRecords);
    } catch (e) {
      setUsageErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setUsageLoading(false);
    }
  }, [recordQuery]);

  React.useEffect(() => {
    void loadUsage(usageDays);
  }, [loadUsage, usageDays]);

  function startFromPreset(p: AiModelProviderPreset) {
    setEditing({
      ...EMPTY_FORM,
      mode: "create",
      providerType: p.providerType,
      models: [],
      defaults: {
        name: p.name,
        baseUrl: p.baseUrl,
        model: p.suggestedModel ?? "",
        apiKeyHint: p.apiKeyHint,
      },
    });
    setShowAdvanced(false);
  }

  const bindingsByGroup = React.useMemo(() => {
    const grouped: Record<BindingGroupKey, AiAppBinding[]> = {
      celebrity: [],
      drama: [],
      aiavatar: [],
      creator: [],
      platform: [],
    };
    const byPurpose = new Map(bindings.map((b) => [b.purpose, b] as const));
    // 显式分组：一个用途可被多个分组声明（共享端点同时出现在各产品线 tab）。
    for (const group of BINDING_GROUPS) {
      for (const purpose of group.purposes) {
        const b = byPurpose.get(purpose);
        if (b) grouped[group.key].push(b);
      }
    }
    // 未被任何分组声明的用途 → 落到「平台通用」兜底。
    for (const b of bindings) {
      if (!DECLARED_PURPOSES.has(b.purpose)) grouped.platform.push(b);
    }
    return grouped;
  }, [bindings]);

  React.useEffect(() => {
    if (bindingsByGroup[bindingGroup]?.length) return;
    const firstNonEmpty = BINDING_GROUPS.find((group) => bindingsByGroup[group.key].length > 0);
    if (firstNonEmpty) setBindingGroup(firstNonEmpty.key);
  }, [bindingGroup, bindingsByGroup]);

  async function onFetchModels() {
    if (!editing) return;
    const baseUrl = valueOrDefault(editing, "baseUrl");
    if (!baseUrl) {
      toast.warning({ title: "请先填写调用地址" });
      return;
    }
    const useStored = !!editing.id && !editing.apiKey.trim();
    if (!useStored && !editing.apiKey.trim()) {
      toast.warning({ title: "请先填写 API 密钥（已存端点可留空，用已存密钥）" });
      return;
    }
    setFetchingModels(true);
    try {
      const r = useStored
        ? await AiModelsApi.fetchModels(editing.id!)
        : await AiModelsApi.discoverModels({
            providerType: editing.providerType,
            baseUrl,
            apiKey: editing.apiKey.trim(),
          });
      if (r.ok) {
        const models = r.models ?? [];
        setEditing((prev) =>
          prev ? { ...prev, models, model: prev.model || (models[0]?.id ?? "") } : prev,
        );
        toast.success({ title: `已获取 ${models.length} 个模型`, description: "点选一个模型设为本端点固定模型；保存后写入配置。" });
      } else {
        toast.danger({ title: "获取模型失败", description: r.error ?? `HTTP ${r.statusCode ?? "?"}` });
      }
    } catch (e) {
      toast.danger({ title: "获取模型失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setFetchingModels(false);
    }
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return endpoints;
    return endpoints.filter((p) =>
      [p.name, p.id, p.baseUrl, p.model ?? "", PROVIDER_LABEL[p.providerType] ?? p.providerType]
        .some((s) => s.toLowerCase().includes(q)),
    );
  }, [endpoints, query]);

  async function onSave() {
    if (!editing) return;
    const name = valueOrDefault(editing, "name");
    const baseUrl = valueOrDefault(editing, "baseUrl");
    const apiVersion = valueOrDefault(editing, "apiVersion");
    const model = valueOrDefault(editing, "model");
    const modelAlias = valueOrDefault(editing, "modelAlias");
    const ownerUserId = valueOrDefault(editing, "ownerUserId");
    const promptTokenPriceMicros = parsePriceMicros(editing.promptPriceYuan);
    const completionTokenPriceMicros = parsePriceMicros(editing.completionPriceYuan);
    const unitPriceMicros = parsePriceMicros(editing.unitPriceYuan);
    const defaultTemperature = parseOptionalNumber(editing.defaultTemperature, 0, 2);
    const defaultMaxTokens = parseOptionalInt(editing.defaultMaxTokens, 1);
    const defaultTopP = parseOptionalNumber(editing.defaultTopP, 0, 1);
    const rpmLimit = parseOptionalInt(editing.rpmLimit, 1);
    const tpmLimit = parseOptionalInt(editing.tpmLimit, 1);
    const dailyTokenQuota = parseOptionalLong(editing.dailyTokenQuota, 1);
    const dailyCostQuotaMicros = parsePriceMicros(editing.dailyCostQuotaYuan);
    const alertFailureRatePct = parseOptionalInt(editing.alertFailureRatePct, 1);

    if (!name || !baseUrl) {
      toast.warning({ title: "端点名称 / 调用地址 必填" });
      return;
    }
    if (!editing.id && !editing.apiKey.trim()) {
      toast.warning({ title: "新建时上游 API 密钥 必填" });
      return;
    }
    if (promptTokenPriceMicros == null || completionTokenPriceMicros == null || unitPriceMicros == null || dailyCostQuotaMicros == null) {
      toast.warning({ title: "计价和成本配额必须是大于等于 0 的数字" });
      return;
    }
    if (
      defaultTemperature === undefined ||
      defaultMaxTokens === undefined ||
      defaultTopP === undefined ||
      rpmLimit === undefined ||
      tpmLimit === undefined ||
      dailyTokenQuota === undefined ||
      alertFailureRatePct === undefined ||
      (alertFailureRatePct != null && alertFailureRatePct > 100)
    ) {
      toast.warning({ title: "默认参数、限速、配额或告警阈值格式不正确" });
      return;
    }
    try {
      const body: AdminAiModelEndpointUpsert = {
        name,
        providerType: editing.providerType,
        baseUrl,
        ...(editing.apiKey.trim() ? { apiKey: editing.apiKey.trim() } : {}),
        apiVersion: apiVersion || undefined,
        model: model || undefined,
        modelAlias: modelAlias || "",
        defaultTemperature,
        defaultMaxTokens,
        defaultTopP,
        rpmLimit,
        tpmLimit,
        dailyTokenQuota,
        dailyCostQuotaMicros: dailyCostQuotaMicros > 0 ? dailyCostQuotaMicros : null,
        alertFailureRatePct,
        models: editing.models,
        billingMode: editing.billingMode,
        promptTokenPriceMicros,
        completionTokenPriceMicros,
        unitPriceMicros,
        enabled: editing.enabled,
      };
      if (editing.clearOwnerUserId) {
        body.ownerUserId = "";
      } else if (editing.ownerUserId.trim()) {
        body.ownerUserId = editing.ownerUserId.trim();
      } else if (ownerUserId) {
        body.ownerUserId = ownerUserId;
      }
      if (editing.id) {
        await AiModelsApi.update(editing.id, body);
      } else {
        await AiModelsApi.create(body);
      }
      setEditing(null);
      setShowAdvanced(false);
      await refresh();
      toast.success({ title: editing.id ? "已保存" : "端点已创建" });
    } catch (e) {
      toast.danger({ title: "保存失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onDelete(p: AiModelEndpoint) {
    const boundPurposes = bindings.filter((b) => b.endpointId === p.id).map((b) => b.purposeLabel);
    const res = await confirm({
      title: "删除模型接入端点",
      tone: "danger",
      confirmLabel: "确认删除",
      requireReason: true,
      reasonPlaceholder: "例如：密钥泄漏 / 已迁移到新端点",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground">
            类型：{PROVIDER_LABEL[p.providerType]} · 模型：{p.model ?? "未设置"}
          </div>
          <div className="text-xs text-muted-foreground">
            端点编号 <span className="font-mono">{p.id}</span>
          </div>
          {boundPurposes.length > 0 && (
            <div className="text-xs text-warning">
              当前被 {boundPurposes.join("、")} 绑定，需先解绑才能删除。
            </div>
          )}
        </div>
      ),
      description: "删除后依赖该端点的 AI 应用会立即失效。请先在「AI 应用绑定」改绑或解绑。",
    });
    if (!res.ok) return;
    try {
      await AiModelsApi.remove(p.id);
      await refresh();
      toast.success({ title: "端点已删除" });
    } catch (e) {
      toast.danger({ title: "删除失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onTest(id: string) {
    setTesting((t) => ({ ...t, [id]: { state: "running" } }));
    try {
      const r = await AiModelsApi.testConnection(id);
      if (r.ok) {
        setTesting((t) => ({ ...t, [id]: { state: "ok", message: r.statusCode ? `HTTP ${r.statusCode}` : "联通" } }));
        toast.success({ title: "联通正常", description: r.statusCode ? `HTTP ${r.statusCode}` : undefined });
      } else {
        setTesting((t) => ({ ...t, [id]: { state: "fail", message: r.error ?? `HTTP ${r.statusCode ?? "?"}` } }));
        toast.danger({ title: "联通失败", description: r.error ?? `HTTP ${r.statusCode ?? "?"}` });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setTesting((t) => ({ ...t, [id]: { state: "fail", message: msg } }));
      toast.danger({ title: "联通失败", description: msg });
    }
  }

  async function onBind(purpose: AiModelPurpose, value: string) {
    try {
      if (value === NONE) await AiModelsApi.unbind(purpose);
      else await AiModelsApi.bind(purpose, value);
      await refresh();
      toast.success({ title: value === NONE ? "已解绑" : "已绑定" });
    } catch (e) {
      toast.danger({ title: "操作失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function onReplayRecord(record: AiModelUsageRecord) {
    setReplayingRecordId(record.id);
    try {
      const result = await AiModelsApi.replayUsageRecord(record.id);
      await loadUsage(usageDays);
      toast.success({
        title: "已重放请求",
        description: `${result.endpointUsed ?? record.providerName ?? "端点"} · ${result.tokensUsed ?? 0} tokens`,
      });
    } catch (e) {
      toast.danger({ title: "重放失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setReplayingRecordId(null);
    }
  }

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="AI 模型与用量"
        description="配置模型接入端点（固定上游密钥 + 单模型 + 地址），并把每个 AI 应用绑定到一个端点。密钥由服务端加密存储，列表仅显示脱敏值。"
      />

      <Tabs defaultValue="endpoints">
        <TabsList>
          <TabsTrigger value="endpoints">模型接入端点</TabsTrigger>
          <TabsTrigger value="bindings">AI 应用绑定</TabsTrigger>
          <TabsTrigger value="usage">用量统计</TabsTrigger>
          <TabsTrigger value="records">请求日志</TabsTrigger>
        </TabsList>

        {/* ── Tab 1：模型接入端点 ── */}
        <TabsContent value="endpoints" className="space-y-6">
          <Card>
            <CardHeader className="flex-col items-start gap-3 space-y-0 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">{formTitle(editing)}</CardTitle>
              {!editing && (
                <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                  <Button variant="outline" onClick={() => void refresh()}>
                    刷新
                  </Button>
                  <Button onClick={() => setEditing({ ...EMPTY_FORM })}>新建端点</Button>
                </div>
              )}
            </CardHeader>
            {!editing && presets.length > 0 && (
              <CardContent className="pt-0">
                <div className="mb-2 text-xs text-muted-foreground">
                  快速添加（内置常见服务商，选中后只需补上游 API 密钥）：
                </div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => startFromPreset(p)}
                      title={p.apiKeyHint}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <Wand2 className="h-3.5 w-3.5 text-primary" />
                      {p.name}
                    </button>
                  ))}
                </div>
              </CardContent>
            )}
            {editing && (
              <CardContent className="space-y-5">
                {editing.mode !== "create" && (
                  <div className="rounded-md border border-border bg-surface-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
                    {editing.mode === "edit" ? (
                      <>
                        正在编辑「{editing.defaults?.sourceName ?? editing.defaults?.name}」。当前配置已填入表单；上游 API 密钥不会回显，留空表示不修改。
                      </>
                    ) : (
                      <>
                        正在复制「{editing.defaults?.sourceName ?? editing.defaults?.name}」。原配置已填入表单；上游 API 密钥不会复制，需要重新填写。
                      </>
                    )}
                  </div>
                )}
                <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="端点名称" hint="给运营用的备注，例如「主用 GPT-4o」">
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder={placeholderFor(editing, "name", "主用 GPT-4o")}
                    />
                  </Field>
                  <Field
                    label="服务商类型"
                    hint={
                      SUPPORTED_PROVIDERS.has(editing.providerType)
                        ? "本期 chat 接口已真实接通"
                        : "本期 chat 接口尚未接通，可建档但联通性测试不可用"
                    }
                  >
                    <Select
                      value={editing.providerType}
                      onValueChange={(v) => setEditing({ ...editing, providerType: v as AiModelProviderType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            <div className="flex items-center gap-2">
                              <span>{PROVIDER_LABEL[t]}</span>
                              {!SUPPORTED_PROVIDERS.has(t) && (
                                <span className="text-[10px] text-muted-foreground">未接通</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="调用地址" hint="服务商提供的 API base URL">
                    <Input
                      value={editing.baseUrl}
                      onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
                      placeholder={placeholderFor(editing, "baseUrl", "https://api.openai.com/v1")}
                    />
                  </Field>
                  <Field
                    label="上游 API 密钥"
                    hint={
                      editing.id
                        ? "留空表示不修改；填写则覆盖。服务端用 AES-GCM 加密落库。"
                        : "新建时必填。服务端用 AES-GCM 加密落库，仅在调用时解密。"
                    }
                  >
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="password"
                        autoComplete="new-password"
                        className="pl-8"
                        placeholder={editing.defaults?.apiKeyHint ?? (editing.id ? "***（不修改）" : "sk-...")}
                        value={editing.apiKey}
                        onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
                      />
                    </div>
                  </Field>
                  <Field label="固定模型" hint="本端点固定调用的模型，例如 gpt-4o / qwen-plus / doubao-1-5-pro-32k">
                    <Input
                      value={editing.model}
                      onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                      placeholder={placeholderFor(editing, "model", "gpt-4o")}
                    />
                  </Field>
                  <Field label="模型别名" hint="业务调用可传别名，例如 default-chat；server 会映射到固定模型">
                    <Input
                      value={editing.modelAlias}
                      onChange={(e) => setEditing({ ...editing, modelAlias: e.target.value })}
                      placeholder={placeholderFor(editing, "modelAlias", "default-chat")}
                    />
                  </Field>
                  <Field label="启用" hint="停用后绑定到该端点的 AI 应用会报「未配置」">
                    <div className="flex h-9 items-center">
                      <Switch checked={editing.enabled} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
                      <span className="ml-2 text-sm text-muted-foreground">{editing.enabled ? "已启用" : "已停用"}</span>
                    </div>
                  </Field>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">可用模型</div>
                      <div className="text-xs text-muted-foreground">
                        从服务商接口拉取（GET /models），点选一个设为本端点固定模型；保存后写入配置。
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={fetchingModels} onClick={() => void onFetchModels()}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      {fetchingModels ? "获取中…" : "获取模型列表"}
                    </Button>
                  </div>
                  {editing.models.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      尚未获取。填好调用地址 + API 密钥后点「获取模型列表」（已存端点可留空密钥，用已存密钥）。
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {editing.models.map((m) => {
                        const activeModel = editing.model.trim() || editing.defaults?.model;
                        const active = activeModel === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setEditing({ ...editing, model: m.id })}
                            aria-pressed={active}
                            title={m.label && m.label !== m.id ? m.label : undefined}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-mono transition-colors",
                              active
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border bg-surface text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {m.id}
                            {active && <span className="font-sans">· {editing.model.trim() ? "固定" : "默认"}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-md border border-border bg-surface px-3.5 py-3">
                  <div className="mb-3">
                    <div className="text-sm font-medium">默认参数、限速与计价</div>
                    <div className="text-xs text-muted-foreground">
                      默认参数在业务 Prompt 未指定时生效。RPM/TPM 会在调用前实时拦截；每日配额用于控制成本风险。
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="默认 temperature" hint="0-2，留空则由 Prompt 或调用方决定">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="2"
                        step="0.1"
                        value={editing.defaultTemperature}
                        onChange={(e) => setEditing({ ...editing, defaultTemperature: e.target.value })}
                        placeholder={editing.defaults?.defaultTemperature || "留空"}
                      />
                    </Field>
                    <Field label="默认 max_tokens" hint="正整数，留空则由 Prompt 或调用方决定">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={editing.defaultMaxTokens}
                        onChange={(e) => setEditing({ ...editing, defaultMaxTokens: e.target.value })}
                        placeholder={editing.defaults?.defaultMaxTokens || "留空"}
                      />
                    </Field>
                    <Field label="默认 top_p" hint="0-1，留空则不传">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="1"
                        step="0.05"
                        value={editing.defaultTopP}
                        onChange={(e) => setEditing({ ...editing, defaultTopP: e.target.value })}
                        placeholder={editing.defaults?.defaultTopP || "留空"}
                      />
                    </Field>
                    <Field label="实时限速 RPM / TPM" hint="为空不限制；超过后会直接返回稍后重试">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={editing.rpmLimit}
                          onChange={(e) => setEditing({ ...editing, rpmLimit: e.target.value })}
                          placeholder={editing.defaults?.rpmLimit || "RPM"}
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={editing.tpmLimit}
                          onChange={(e) => setEditing({ ...editing, tpmLimit: e.target.value })}
                          placeholder={editing.defaults?.tpmLimit || "TPM"}
                        />
                      </div>
                    </Field>
                    <Field label="每日 Token 配额" hint="按北京时间自然日统计，留空不限制">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={editing.dailyTokenQuota}
                        onChange={(e) => setEditing({ ...editing, dailyTokenQuota: e.target.value })}
                        placeholder={editing.defaults?.dailyTokenQuota || "留空"}
                      />
                    </Field>
                    <Field label="每日成本配额" hint="单位：元；按北京时间自然日统计，留空不限制">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.000001"
                        value={editing.dailyCostQuotaYuan}
                        onChange={(e) => setEditing({ ...editing, dailyCostQuotaYuan: e.target.value })}
                        placeholder={editing.defaults?.dailyCostQuotaYuan || "留空"}
                      />
                    </Field>
                    <Field label="失败率告警阈值" hint="1-100，百分比；为空使用系统默认阈值">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="100"
                        step="1"
                        value={editing.alertFailureRatePct}
                        onChange={(e) => setEditing({ ...editing, alertFailureRatePct: e.target.value })}
                        placeholder={editing.defaults?.alertFailureRatePct || "默认"}
                      />
                    </Field>
                    <Field label="计费口径" hint="自动：文本按 Token，图片按次，视频按秒；也可强制指定。">
                      <Select
                        value={editing.billingMode}
                        onValueChange={(v) => setEditing({ ...editing, billingMode: v as BillingModeFormValue })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["AUTO", "TOKENS", "PER_CALL", "PER_SECOND"] as const).map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {BILLING_MODE_LABEL[mode]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="按次 / 按秒单价" hint="按次表示每张图/每条视频；按秒表示每秒视频。单位：元">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.000001"
                        value={editing.unitPriceYuan}
                        onChange={(e) => setEditing({ ...editing, unitPriceYuan: e.target.value })}
                        placeholder={editing.defaults?.unitPriceYuan || "0"}
                      />
                    </Field>
                    <Field label="输入 Token 单价" hint="例如 0.0015 表示每 1K 输入 Token 0.0015 元">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.000001"
                        value={editing.promptPriceYuan}
                        onChange={(e) => setEditing({ ...editing, promptPriceYuan: e.target.value })}
                        placeholder={editing.defaults?.promptPriceYuan || "0"}
                      />
                    </Field>
                    <Field label="输出 Token 单价" hint="例如 0.006 表示每 1K 输出 Token 0.006 元">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.000001"
                        value={editing.completionPriceYuan}
                        onChange={(e) => setEditing({ ...editing, completionPriceYuan: e.target.value })}
                        placeholder={editing.defaults?.completionPriceYuan || "0"}
                      />
                    </Field>
                  </div>
                </section>

                <section className="rounded-md border border-border bg-surface-muted/40">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Settings2 className="h-3.5 w-3.5" />
                      高级
                    </span>
                    <ChevronRight className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-90")} />
                  </button>
                  {showAdvanced && (
                    <div className="grid grid-cols-1 gap-4 border-t border-border p-3.5 md:grid-cols-2">
                      <Field label="API 版本" hint="仅 Azure OpenAI 需要，例如 2024-08-01-preview">
                        <Input
                          value={editing.apiVersion}
                          onChange={(e) => setEditing({ ...editing, apiVersion: e.target.value })}
                          placeholder={placeholderFor(editing, "apiVersion", "留空")}
                        />
                      </Field>
                      <Field label="计费归属用户" hint="该端点用量按 token 扣此用户钱包；留空 = 平台级，仅累计不扣费">
                        <div className="flex gap-2">
                          <Input
                            value={editing.ownerUserId}
                            onChange={(e) => setEditing({ ...editing, ownerUserId: e.target.value, clearOwnerUserId: false })}
                            placeholder={placeholderFor(editing, "ownerUserId", "留空 = 平台级（不计费）")}
                          />
                          {(editing.defaults?.ownerUserId || editing.ownerUserId) && (
                            <Button
                              type="button"
                              variant={editing.clearOwnerUserId ? "warning" : "outline"}
                              size="sm"
                              className="h-9 shrink-0"
                              onClick={() => setEditing({ ...editing, ownerUserId: "", clearOwnerUserId: !editing.clearOwnerUserId })}
                            >
                              {editing.clearOwnerUserId ? "将清空" : "平台级"}
                            </Button>
                          )}
                        </div>
                      </Field>
                    </div>
                  )}
                </section>

                <div className="flex gap-2 pt-1">
                  <Button onClick={() => void onSave()}>{editing.id ? "保存修改" : "新建"}</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(null);
                      setShowAdvanced(false);
                    }}
                  >
                    取消
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>端点列表（{filtered.length}）</span>
                <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" /> 密钥加密存储
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3 max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="搜索名称 / 编号 / 地址 / 模型…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
              {err && <div className="text-sm text-destructive">{err}</div>}
              {!loading && !err && (
                <Table className="min-w-[1950px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[190px]">名称</TableHead>
                      <TableHead className="w-[132px]">类型</TableHead>
                      <TableHead className="w-[190px]">调用地址</TableHead>
                      <TableHead className="w-[132px]">上游密钥</TableHead>
                      <TableHead className="w-[150px]">固定模型</TableHead>
                      <TableHead className="w-[130px]">别名</TableHead>
                      <TableHead className="w-[96px]">计费口径</TableHead>
                      <TableHead className="w-[112px] text-right">输入价</TableHead>
                      <TableHead className="w-[112px] text-right">输出价</TableHead>
                      <TableHead className="w-[116px] text-right">单位价</TableHead>
                      <TableHead className="w-[148px] text-right">累计用量</TableHead>
                      <TableHead className="w-[92px] text-right">调用</TableHead>
                      <TableHead className="w-[88px]">状态</TableHead>
                      <TableHead className="w-[220px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const t = testing[p.id];
                      return (
                        <TableRow key={p.id} className="h-[76px]">
                          <TableCell className="py-3">
                            <div className="truncate font-medium" title={p.name}>{p.name}</div>
                            <div className="truncate font-mono text-[10px] text-muted-foreground" title={p.id}>{p.id}</div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge tone="neutral" className="font-normal">
                              {PROVIDER_LABEL[p.providerType] ?? p.providerType}
                            </Badge>
                          </TableCell>
                          <TableCell className="truncate py-3 font-mono text-xs" title={p.baseUrl}>{p.baseUrl}</TableCell>
                          <TableCell className="truncate py-3 font-mono text-xs" title={p.upstreamApiKeyMasked}>{p.upstreamApiKeyMasked}</TableCell>
                          <TableCell className="truncate py-3 text-xs" title={p.model ?? undefined}>{p.model ?? "未设置"}</TableCell>
                          <TableCell className="truncate py-3 text-xs font-mono" title={p.modelAlias ?? undefined}>{p.modelAlias ?? "未设置"}</TableCell>
                          <TableCell className="whitespace-nowrap py-3 text-xs">{billingModeLabel(p.billingMode)}</TableCell>
                          <TableCell className="whitespace-nowrap py-3 text-right text-xs tabular-nums">{priceLabel(p.promptTokenPriceMicros)}</TableCell>
                          <TableCell className="whitespace-nowrap py-3 text-right text-xs tabular-nums">{priceLabel(p.completionTokenPriceMicros)}</TableCell>
                          <TableCell className="whitespace-nowrap py-3 text-right text-xs tabular-nums">{unitPriceLabel(p.unitPriceMicros, p.billingMode)}</TableCell>
                          <TableCell className="py-3 text-right text-xs tabular-nums">
                            <div>{p.totalTokens.toLocaleString()} Token</div>
                            {(p.totalBillableUnits > 0 || p.totalBillableSeconds > 0) && (
                              <div className="text-[10px] text-muted-foreground">
                                {meteredUsageLabel(p.totalBillableUnits, p.totalBillableSeconds)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap py-3 text-right tabular-nums text-xs">{p.totalCalls.toLocaleString()}</TableCell>
                          <TableCell className="py-3">
                            {p.enabled ? (
                              <Badge tone="success" className="font-normal">
                                已启用
                              </Badge>
                            ) : (
                              <Badge tone="neutral" className="font-normal text-muted-foreground">
                                已停用
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <div className="flex flex-nowrap justify-end gap-1 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                onClick={() => setEditing(editFormFromEndpoint(p))}
                              >
                                编辑
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                onClick={() => setEditing(copyFormFromEndpoint(p))}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                复制
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void onTest(p.id)}
                                aria-live="polite"
                                className={cn(
                                  "h-7 px-2",
                                  t?.state === "ok" && "border-success/40 text-success",
                                  t?.state === "fail" && "border-destructive/40 text-destructive",
                                )}
                              >
                                {t?.state === "running"
                                  ? "测试中"
                                  : t?.state === "ok"
                                  ? "已联通"
                                  : t?.state === "fail"
                                  ? "已失败"
                                  : "测试"}
                              </Button>
                              <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => void onDelete(p)}>
                                删除
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2：AI 应用绑定 ── */}
        <TabsContent value="bindings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="inline-flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" /> AI 应用绑定
                </span>
                <Button variant="outline" size="sm" onClick={() => void refresh()}>
                  刷新
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 text-xs text-muted-foreground">
                每个 AI 应用固定指向一个模型接入端点。按业务应用分组后，运营可以直接看出这条绑定服务哪条产品线。
              </div>
              {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
              {err && <div className="text-sm text-destructive">{err}</div>}
              {!loading && !err && (
                <Tabs value={bindingGroup} onValueChange={(v) => setBindingGroup(v as BindingGroupKey)}>
                  <TabsList className="h-auto flex-wrap justify-start">
                    {BINDING_GROUPS.map((group) => (
                      <TabsTrigger key={group.key} value={group.key} className="gap-1.5">
                        {group.label}
                        <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {bindingsByGroup[group.key].length}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {BINDING_GROUPS.map((group) => (
                    <TabsContent key={group.key} value={group.key} className="space-y-3">
                      <div className="rounded-md border border-border bg-surface-muted/45 px-3.5 py-2 text-xs text-muted-foreground">
                        {group.description}
                      </div>
                      <BindingTable bindings={bindingsByGroup[group.key]} endpoints={endpoints} onBind={onBind} />
                      {/* D-11：短剧渲染用途支持一用途多候选端点 + 能力（供「出片模型」下拉）。 */}
                      {group.key === "drama" &&
                        bindingsByGroup[group.key].map((b) => (
                          <CandidatePanel
                            key={b.purpose}
                            purpose={b.purpose}
                            purposeLabel={b.purposeLabel}
                            endpoints={endpoints}
                            onSetDefault={(endpointId) => onBind(b.purpose, endpointId)}
                          />
                        ))}
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3：用量统计 ── */}
        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader className="flex-col items-start gap-3 space-y-0 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-1.5 text-base">
                <BarChart3 className="h-4 w-4 text-primary" /> 用量统计
              </CardTitle>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Select value={String(usageDays)} onValueChange={(v) => setUsageDays(Number(v))}>
                  <SelectTrigger className="w-full md:h-8 sm:w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USAGE_WINDOW_CHOICES.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!usage || usage.totalCalls === 0}
                  onClick={() => usage && exportUsageCsv(usage)}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> 导出 CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => void loadUsage(usageDays)}>
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                文本模型按 token 汇总；图片 / 视频按次或按秒记录计费用量。成本按端点配置的单价估算，仅统计成功调用。
              </p>
              {usageLoading && <div className="text-sm text-muted-foreground">加载中…</div>}
              {usageErr && <div className="text-sm text-destructive">{usageErr}</div>}
              {!usageLoading && !usageErr && usage && (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                    <StatBox
                      label="调用次数"
                      value={usage.totalCalls.toLocaleString()}
                      sub={usage.failedCalls > 0 ? `另有 ${usage.failedCalls.toLocaleString()} 次失败` : undefined}
                      subTone="danger"
                    />
                    <StatBox label="总 Token" value={usage.totalTokens.toLocaleString()} />
                    <StatBox label="输入 Token" value={usage.promptTokens.toLocaleString()} />
                    <StatBox label="输出 Token" value={usage.completionTokens.toLocaleString()} />
                    <StatBox label="计费次数" value={usage.totalBillableUnits.toLocaleString()} />
                    <StatBox label="计费时长" value={durationUsageLabel(usage.totalBillableSeconds)} />
                    <StatBox label="估算成本" value={microsCostLabel(usage.estimatedCostMicros)} />
                  </div>
                  {(usage.alerts ?? []).length > 0 && <AlertList alerts={usage.alerts ?? []} />}
                  {usage.totalCalls === 0 && usage.failedCalls === 0 ? (
                    <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      该时间窗内暂无调用记录。发起脚本起草 / 卖点提取 / 变量抽取等会调用大模型的操作后，这里会出现用量。
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <UsageTrend data={usage.byDay} />
                      <div className="space-y-6">
                        <UsageTable title="按端点" col="端点" rows={usage.byProvider} totalCost={usage.estimatedCostMicros} />
                        <UsageTable title="按模型" col="模型" rows={usage.byModel} totalCost={usage.estimatedCostMicros} />
                      </div>
                      <UsageTable title="按用途" col="用途" rows={usage.byPurpose} totalCost={usage.estimatedCostMicros} />
                      <FailureCategoryTable rows={usage.byFailureCategory ?? []} />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4：请求日志 ── */}
        <TabsContent value="records" className="space-y-6">
          <Card>
            <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-1.5 text-base">
                <FileSearch className="h-4 w-4 text-primary" /> 请求日志
              </CardTitle>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <div className="relative w-full sm:w-[260px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8"
                    placeholder="搜索 requestId / 模型 / 错误…"
                    value={recordQuery}
                    onChange={(e) => setRecordQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void loadUsage(usageDays);
                    }}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadUsage(usageDays)}>
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usageLoading && <div className="text-sm text-muted-foreground">加载中…</div>}
              {usageErr && <div className="text-sm text-destructive">{usageErr}</div>}
              {!usageLoading && !usageErr && (
                records.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    暂无请求日志。
                  </div>
                ) : (
                  <Table className="min-w-[1320px] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">时间 / 请求</TableHead>
                        <TableHead className="w-[150px]">端点</TableHead>
                        <TableHead className="w-[150px]">模型</TableHead>
                        <TableHead className="w-[150px]">用途</TableHead>
                        <TableHead className="w-[120px]">来源</TableHead>
                        <TableHead className="w-[112px] text-right">用量</TableHead>
                        <TableHead className="w-[92px] text-right">成本</TableHead>
                        <TableHead className="w-[96px] text-right">延迟</TableHead>
                        <TableHead className="w-[120px]">状态</TableHead>
                        <TableHead className="w-[190px]">失败原因 / 质量</TableHead>
                        <TableHead className="w-[120px] text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow key={record.id} className="h-[72px]">
                          <TableCell className="py-3">
                            <div className="text-xs tabular-nums text-muted-foreground">{shortDateTime(record.createdAt)}</div>
                            <div className="truncate font-mono text-[10px]" title={record.requestId ?? record.id}>
                              {record.requestId ?? record.id}
                            </div>
                          </TableCell>
                          <TableCell className="truncate py-3 text-xs" title={record.providerName ?? undefined}>{record.providerName ?? "未归属端点"}</TableCell>
                          <TableCell className="truncate py-3 font-mono text-xs" title={record.model ?? undefined}>{record.model ?? "未记录"}</TableCell>
                          <TableCell className="py-3">
                            <div className="truncate text-xs">{record.purposeLabel}</div>
                            <div className="truncate font-mono text-[10px] text-muted-foreground">{record.purpose ?? "GENERAL"}</div>
                          </TableCell>
                          <TableCell className="py-3 text-xs">{record.appLabel}</TableCell>
                          <TableCell className="whitespace-nowrap py-3 text-right text-xs tabular-nums">
                            <div>{record.totalTokens.toLocaleString()} Token</div>
                            {(record.billableUnits > 0 || record.billableSeconds > 0) && (
                              <div className="text-[10px] text-muted-foreground">
                                {meteredUsageLabel(record.billableUnits, record.billableSeconds)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap py-3 text-right text-xs tabular-nums">{microsCostLabel(record.estimatedCostMicros)}</TableCell>
                          <TableCell className="whitespace-nowrap py-3 text-right text-xs tabular-nums">{record.latencyMs != null ? `${record.latencyMs}ms` : "-"}</TableCell>
                          <TableCell className="py-3">
                            <Badge tone={record.success ? "success" : "danger"} className="font-normal">
                              {record.success ? "成功" : "失败"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="truncate text-xs" title={record.errorMessage ?? record.qualityNote ?? undefined}>
                              {record.errorCategoryLabel ?? record.errorCode ?? record.qualityLabel ?? "未标注"}
                            </div>
                            {record.errorCategoryLabel && record.errorCode && (
                              <div className="truncate font-mono text-[10px] text-muted-foreground">{record.errorCode}</div>
                            )}
                            {record.qualityScore != null && (
                              <div className="text-[10px] text-muted-foreground">质量 {record.qualityScore}/100</div>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              disabled={!record.requestBodyJson || replayingRecordId === record.id}
                              onClick={() => void onReplayRecord(record)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {replayingRecordId === record.id ? "重放中" : "重放"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BindingTable({
  bindings,
  endpoints,
  onBind,
}: {
  bindings: AiAppBinding[];
  endpoints: AiModelEndpoint[];
  onBind: (purpose: AiModelPurpose, value: string) => void | Promise<void>;
}) {
  if (bindings.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        当前分组暂无 AI 应用绑定。
      </div>
    );
  }

  return (
    <Table className="min-w-[760px] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[220px]">AI 能力</TableHead>
          <TableHead>绑定端点</TableHead>
          <TableHead className="w-[140px]">状态</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bindings.map((binding) => (
          <TableRow key={binding.purpose} className="h-[68px]">
            <TableCell className="py-3">
              <div className="font-medium">{binding.purposeLabel}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{binding.purpose}</div>
            </TableCell>
            <TableCell className="py-3">
              <Select value={binding.endpointId ?? NONE} onValueChange={(value) => void onBind(binding.purpose, value)}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="未绑定" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>未绑定</SelectItem>
                  {endpoints.map((endpoint) => (
                    <SelectItem key={endpoint.id} value={endpoint.id}>
                      {endpoint.name}
                      {endpoint.model ? ` · ${endpoint.model}` : ""}
                      {!endpoint.enabled ? "（已停用）" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="py-3">
              <BindingStatusBadge binding={binding} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BindingStatusBadge({ binding }: { binding: AiAppBinding }) {
  if (!binding.endpointId) {
    return (
      <Badge tone="neutral" className="font-normal text-muted-foreground">
        未绑定
      </Badge>
    );
  }
  if (binding.endpointEnabled === false) {
    return (
      <Badge tone="danger" className="font-normal">
        端点已停用
      </Badge>
    );
  }
  return (
    <Badge tone="success" className="font-normal">
      已绑定
    </Badge>
  );
}

// ── D-11：一用途多候选端点 + 能力（供短剧「出片模型」下拉） ─────────────────────
function CandidatePanel({
  purpose,
  purposeLabel,
  endpoints,
  onSetDefault,
}: {
  purpose: AiModelPurpose;
  purposeLabel: string;
  endpoints: AiModelEndpoint[];
  onSetDefault: (endpointId: string) => void | Promise<void>;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<AiAppEndpointCandidate[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [addId, setAddId] = React.useState<string>("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setRows(await AiModelsApi.listCandidates(purpose));
    } catch (e) {
      toast.danger({ title: "候选端点加载失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [purpose, toast]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const candidateIds = new Set(rows.map((r) => r.endpointId));
  const addable = endpoints.filter((e) => !candidateIds.has(e.id));

  function patchLocal(endpointId: string, f: (r: AiAppEndpointCandidate) => AiAppEndpointCandidate) {
    setRows((prev) => prev.map((r) => (r.endpointId === endpointId ? f(r) : r)));
  }

  async function persist(row: AiAppEndpointCandidate) {
    try {
      const updated = await AiModelsApi.updateCandidate(purpose, row.endpointId, {
        sortOrder: row.sortOrder,
        enabled: row.enabled,
        maxRefImages: row.capability.maxRefImages ?? null,
        supportsFirstLastFrame: row.capability.supportsFirstLastFrame ?? null,
        supportsSubjectReference: row.capability.supportsSubjectReference ?? null,
        maxDurationSec: row.capability.maxDurationSec ?? null,
        creditCostOverride: row.creditCostOverride ?? null,
      });
      patchLocal(updated.endpointId, () => updated);
      toast.success({ title: "已保存" });
    } catch (e) {
      toast.danger({ title: "保存失败", description: e instanceof Error ? e.message : undefined });
      void load();
    }
  }

  async function add() {
    if (!addId) return;
    try {
      await AiModelsApi.addCandidate(purpose, { endpointId: addId });
      setAddId("");
      await load();
      toast.success({ title: "已加入候选" });
    } catch (e) {
      toast.danger({ title: "添加失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  async function remove(row: AiAppEndpointCandidate) {
    const res = await confirm({
      title: "移除候选端点",
      description: `确定把「${row.endpointName ?? row.endpointId}」从「${purposeLabel}」的候选池移除？出片时将不再可选此模型。`,
      tone: "danger",
      confirmLabel: "移除",
    });
    if (!res.ok) return;
    try {
      await AiModelsApi.removeCandidate(purpose, row.endpointId);
      await load();
      toast.success({ title: "已移除候选" });
    } catch (e) {
      toast.danger({ title: "移除失败", description: e instanceof Error ? e.message : undefined });
    }
  }

  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  return (
    <div className="rounded-md border border-border/70 bg-surface-muted/30">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-1.5">
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
          <span className="font-medium">{purposeLabel} · 候选端点与能力</span>
          <span className="text-muted-foreground">（供出片模型下拉；默认端点始终在列）</span>
        </span>
        {open && rows.length > 0 && (
          <span className="text-[10px] text-muted-foreground">{rows.length} 个候选</span>
        )}
      </button>
      {open && (
        <div className="space-y-3 px-3.5 pb-3.5">
          {loading && <div className="text-xs text-muted-foreground">加载中…</div>}
          {!loading && (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[860px] text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[190px]">端点</TableHead>
                      <TableHead className="w-[70px]">启用</TableHead>
                      <TableHead className="w-[92px]" title="最多可送参考图张数，留空按兼容默认 6（与旧版行为一致）">参考图上限</TableHead>
                      <TableHead className="w-[80px]" title="是否支持首+尾帧关键帧衔接">首尾帧</TableHead>
                      <TableHead className="w-[80px]" title="是否支持主体（人物）参考">主体参考</TableHead>
                      <TableHead className="w-[92px]" title="单条视频最长秒数，留空为未知">最长秒数</TableHead>
                      <TableHead className="w-[100px]" title="该端点单价（积分），留空用用途默认单价">单价覆盖</TableHead>
                      <TableHead className="w-[190px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-4 text-center text-muted-foreground">
                          暂无候选端点。默认端点会自动进入候选池；也可在下方添加。
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((row) => (
                      <TableRow key={row.endpointId}>
                        <TableCell className="py-2">
                          <div className="max-w-[180px] truncate font-medium" title={row.endpointName ?? row.endpointId}>
                            {row.endpointName ?? row.endpointId}
                          </div>
                          {row.isDefault && (
                            <Badge tone="success" className="mt-0.5 h-4 px-1.5 text-[9px] font-normal">
                              默认
                            </Badge>
                          )}
                          {row.endpointEnabled === false && (
                            <Badge tone="danger" className="mt-0.5 h-4 px-1.5 text-[9px] font-normal">
                              端点停用
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Switch
                            checked={row.enabled}
                            onCheckedChange={(v) => {
                              patchLocal(row.endpointId, (r) => ({ ...r, enabled: v }));
                              void persist({ ...row, enabled: v });
                            }}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number"
                            className="h-7 w-[76px]"
                            value={row.capability.maxRefImages ?? ""}
                            placeholder="1"
                            onChange={(e) =>
                              patchLocal(row.endpointId, (r) => ({
                                ...r,
                                capability: { ...r.capability, maxRefImages: num(e.target.value) },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Switch
                            checked={row.capability.supportsFirstLastFrame === true}
                            onCheckedChange={(v) =>
                              patchLocal(row.endpointId, (r) => ({
                                ...r,
                                capability: { ...r.capability, supportsFirstLastFrame: v },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Switch
                            checked={row.capability.supportsSubjectReference === true}
                            onCheckedChange={(v) =>
                              patchLocal(row.endpointId, (r) => ({
                                ...r,
                                capability: { ...r.capability, supportsSubjectReference: v },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number"
                            className="h-7 w-[76px]"
                            value={row.capability.maxDurationSec ?? ""}
                            placeholder="—"
                            onChange={(e) =>
                              patchLocal(row.endpointId, (r) => ({
                                ...r,
                                capability: { ...r.capability, maxDurationSec: num(e.target.value) },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number"
                            className="h-7 w-[84px]"
                            value={row.creditCostOverride ?? ""}
                            placeholder="默认"
                            onChange={(e) =>
                              patchLocal(row.endpointId, (r) => ({ ...r, creditCostOverride: num(e.target.value) }))
                            }
                          />
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button size="sm" variant="outline" className="h-7" onClick={() => void persist(row)}>
                              保存
                            </Button>
                            {!row.isDefault && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7"
                                disabled={row.endpointEnabled === false}
                                onClick={() => void onSetDefault(row.endpointId)}
                                title="设为该用途默认端点（不指定模型时用它）"
                              >
                                设默认
                              </Button>
                            )}
                            {!row.isDefault && (
                              <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => void remove(row)}>
                                移除
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center gap-2">
                <Select value={addId} onValueChange={setAddId}>
                  <SelectTrigger className="h-8 max-w-xs">
                    <SelectValue placeholder="选择要加入候选的端点…" />
                  </SelectTrigger>
                  <SelectContent>
                    {addable.length === 0 && (
                      <SelectItem value="__none__" disabled>
                        没有可添加的端点
                      </SelectItem>
                    )}
                    {addable.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                        {e.model ? ` · ${e.model}` : ""}
                        {!e.enabled ? "（已停用）" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8" disabled={!addId || addId === "__none__"} onClick={() => void add()}>
                  加入候选
                </Button>
                <span className="text-[10px] text-muted-foreground">能力字段留空 = 未知，装配按兼容默认（参考图上限 6、首尾帧按模型协议自动判定），与配置前行为一致。</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  subTone = "muted",
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "muted" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      {sub && (
        <div
          className={cn(
            "mt-0.5 text-[11px] tabular-nums",
            subTone === "danger" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function AlertList({ alerts }: { alerts: AiModelAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "rounded-md border px-3.5 py-3",
            alert.severity === "critical"
              ? "border-destructive/35 bg-destructive/8"
              : "border-warning/35 bg-warning/8",
          )}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                alert.severity === "critical" ? "text-destructive" : "text-warning",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium">{alert.title}</div>
                <Badge tone={alert.severity === "critical" ? "danger" : "warning"} className="font-normal">
                  {alert.severity === "critical" ? "严重" : "提醒"}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{alert.message}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FailureCategoryTable({ rows }: { rows: AiModelFailureStat[] }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">按失败原因</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">暂无失败调用</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>原因</TableHead>
              <TableHead className="text-right">失败次数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.category}>
                <TableCell>
                  <div className="text-sm">{row.label}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{row.category}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.calls.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function dailyTrendValue(day: AiModelUsageDaily): number {
  if (day.estimatedCostMicros > 0) return day.estimatedCostMicros;
  return day.totalTokens + day.billableUnits + day.billableSeconds;
}

/** 按天趋势：优先画成本；未配置成本时画 token+次数+秒数的综合用量。 */
function UsageTrend({ data }: { data: AiModelUsageDaily[] }) {
  if (!data || data.length === 0) return null;
  const values = data.map((d) => dailyTrendValue(d));
  const max = Math.max(...values, 1);
  const hasCost = data.some((d) => d.estimatedCostMicros > 0);
  const width = Math.max(560, data.length * 64);
  const height = 220;
  const pad = { left: 44, right: 24, top: 34, bottom: 38 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const points = data.map((d, index) => {
    const value = dailyTrendValue(d);
    const x = pad.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
    const y = pad.top + plotHeight - (value / max) * plotHeight;
    return { x, y, d, value };
  });
  const labelEvery = data.length <= 8 ? 1 : Math.ceil(data.length / 7);
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">按天趋势</div>
        <div className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          峰值 {hasCost ? microsCostLabel(max) : max.toLocaleString()} / 天
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block min-w-full">
          {[0, 0.5, 1].map((step) => {
            const y = pad.top + plotHeight - step * plotHeight;
            return (
              <g key={step}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="stroke-border" strokeDasharray={step === 0 ? undefined : "4 6"} />
                <text x={pad.left - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                  {hasCost ? microsCostLabel(Math.round(max * step)) : Math.round(max * step).toLocaleString("zh-CN")}
                </text>
              </g>
            );
          })}
          <path d={smoothUsagePath(points)} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, index) => {
            const showLabel = index === 0 || index === points.length - 1 || index % labelEvery === 0;
            return (
              <g key={p.d.date}>
                <circle cx={p.x} cy={p.y} r="3.5" className="fill-surface stroke-primary" strokeWidth="2" />
                {showLabel && (
                  <>
                    <text x={p.x} y={Math.max(12, p.y - 10)} textAnchor="middle" className="fill-foreground text-[10px] font-medium tabular-nums">
                      {hasCost ? microsCostLabel(p.value) : p.value.toLocaleString("zh-CN")}
                    </text>
                    <text x={p.x} y={height - 12} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
                      {shortUsageDate(p.d.date)}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function smoothUsagePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    d += ` Q ${prev.x} ${prev.y}, ${midX} ${(prev.y + curr.y) / 2}`;
    d += ` T ${curr.x} ${curr.y}`;
  }
  return d;
}

function shortUsageDate(value: string): string {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value;
}

function shortDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function UsageTable({
  title,
  col,
  rows,
  totalCost,
}: {
  title: string;
  col: string;
  rows: AiModelUsageStat[];
  totalCost: number;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">无数据</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{col}</TableHead>
              <TableHead className="text-right">调用</TableHead>
              <TableHead className="text-right">总 Token</TableHead>
              <TableHead className="text-right">计费量</TableHead>
              <TableHead className="text-right">成本</TableHead>
              <TableHead className="text-right">成本占比</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const pct = totalCost > 0 ? (r.estimatedCostMicros / totalCost) * 100 : 0;
              return (
                <TableRow key={r.key}>
                  <TableCell className="max-w-[180px] truncate text-xs font-medium" title={r.label}>
                    {r.label}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-xs">{r.calls.toLocaleString()}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-xs">{r.totalTokens.toLocaleString()}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-xs">
                    {meteredUsageLabel(r.billableUnits, r.billableSeconds)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-xs">
                    {microsCostLabel(r.estimatedCostMicros)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="h-1 w-12 overflow-hidden rounded-full bg-surface-muted">
                        <span className="block h-full rounded-full bg-primary/55" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-10 whitespace-nowrap text-right tabular-nums text-xs text-muted-foreground">
                        {totalCost > 0 ? `${pct.toFixed(1)}%` : "0%"}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** 把用量报表导出为 CSV（含汇总 + 按端点/模型/用途/天四张表）。客户端拼装，带 BOM 兼容 Excel 中文。 */
function exportUsageCsv(usage: AiModelUsageReport) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(`# 大模型用量报表（近 ${usage.windowDays} 天，自 ${usage.since}）`);
  lines.push("");
  lines.push("汇总,数值");
  lines.push(`成功调用,${usage.totalCalls}`);
  lines.push(`失败调用,${usage.failedCalls}`);
  lines.push(`总 Token,${usage.totalTokens}`);
  lines.push(`输入 Token,${usage.promptTokens}`);
  lines.push(`输出 Token,${usage.completionTokens}`);
  lines.push(`计费次数,${usage.totalBillableUnits}`);
  lines.push(`计费时长秒,${usage.totalBillableSeconds}`);
  lines.push(`估算成本,${microsCostLabel(usage.estimatedCostMicros)}`);
  lines.push("");

  const section = (title: string, dim: string, rows: AiModelUsageStat[]) => {
    lines.push(`# ${title}`);
    lines.push(`${dim},调用,总 Token,输入 Token,输出 Token,计费次数,计费时长秒,估算成本`);
    for (const r of rows) {
      lines.push([
        r.label,
        r.calls,
        r.totalTokens,
        r.promptTokens,
        r.completionTokens,
        r.billableUnits,
        r.billableSeconds,
        microsCostLabel(r.estimatedCostMicros),
      ].map(esc).join(","));
    }
    lines.push("");
  };
  section("按端点", "端点", usage.byProvider);
  section("按模型", "模型", usage.byModel);
  section("按用途", "用途", usage.byPurpose);

  lines.push("# 告警");
  lines.push("等级,类型,端点,标题,说明,当前值,阈值");
  for (const alert of usage.alerts ?? []) {
    lines.push([
      alert.severity === "critical" ? "严重" : "提醒",
      alert.type,
      alert.providerName,
      alert.title,
      alert.message,
      alert.metricValue,
      alert.threshold,
    ].map(esc).join(","));
  }
  lines.push("");

  lines.push("# 按失败原因");
  lines.push("原因,枚举,失败次数");
  for (const row of usage.byFailureCategory ?? []) {
    lines.push([row.label, row.category, row.calls].map(esc).join(","));
  }
  lines.push("");

  lines.push("# 按天趋势");
  lines.push("日期,调用,总 Token,输入 Token,输出 Token,计费次数,计费时长秒,估算成本");
  for (const d of usage.byDay) {
    lines.push([
      d.date,
      d.calls,
      d.totalTokens,
      d.promptTokens,
      d.completionTokens,
      d.billableUnits,
      d.billableSeconds,
      microsCostLabel(d.estimatedCostMicros),
    ].map(esc).join(","));
  }

  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-usage-${usage.windowDays}d.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
