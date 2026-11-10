// 模型配置页的规则：服务商怎么分组、保存时发什么。都是纯函数，单测钉在 model-config.test.ts。

import type {
  AiModelAccessPolicy,
  AiModelCostSave,
  AiModelEndpoint,
  AiModelEndpointSave,
  AiModelEntry,
  AiModelRequestSpec,
  AiSceneCatalogRow,
  ModelFunctionRow,
} from "@ai-star-eco/types/ai-model-config";

// ── 服务商分组 ────────────────────────────────────────────────────────────
// 服务端没有「服务商」这张表，密钥也存在每个模型上。这里只按基础地址的主机名归组，方便看和筛。

const PROVIDER_NAMES: Record<string, string> = {
  "api.jusuanhub.com": "聚算",
  "ark.cn-beijing.volces.com": "火山方舟",
  "api.onetoken.love": "OneToken",
  "ai3.aiprox.tech": "CATech",
  "api.qnaigc.com": "七牛",
  "api.agnes-ai.cn": "Agnes",
  "api.deepseek.com": "DeepSeek",
  "api.siliconflow.cn": "硅基流动",
  "api.openai.com": "OpenAI",
  "api.moonshot.cn": "Moonshot",
  "dashscope.aliyuncs.com": "阿里云百炼",
};

export function providerHost(baseUrl: string | undefined): string {
  try { return new URL(baseUrl ?? "").hostname || "other"; } catch { return "other"; }
}

export function providerName(host: string): string {
  return host === "other" ? "地址无效" : PROVIDER_NAMES[host] ?? host;
}

export interface ProviderGroup {
  host: string;
  name: string;
  total: number;
  enabled: number;
  /** 新增模型时用来预填，取这组里最近更新的一条。 */
  sample: AiModelEndpoint;
}

export function providerGroups(endpoints: AiModelEndpoint[]): ProviderGroup[] {
  const groups = new Map<string, ProviderGroup>();
  for (const endpoint of endpoints) {
    const host = providerHost(endpoint.baseUrl);
    const group = groups.get(host);
    if (group) {
      group.total += 1;
      if (endpoint.enabled) group.enabled += 1;
      if (endpoint.updatedAt > group.sample.updatedAt) group.sample = endpoint;
    } else {
      groups.set(host, { host, name: providerName(host), total: 1, enabled: endpoint.enabled ? 1 : 0, sample: endpoint });
    }
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "zh-CN"));
}

// ── 模型类型和能力 ────────────────────────────────────────────────────────

export const KIND_LABEL: Record<string, string> = { text: "文本", image: "图片", video: "视频", audio: "音频", unclassified: "未分类" };

/** 运营标过的类型为准；没标的只看规格，不按模型名猜。 */
export function modelKind(endpoint: AiModelEndpoint, policy?: AiModelAccessPolicy): string {
  const marked = policy?.categories.find((category) => category !== "unclassified");
  if (marked) return marked;
  if (endpoint.videoRequestSpec) return "video";
  if (endpoint.imageRequestSpec) return "image";
  return "unclassified";
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** 规格的摘要只用来显示：字段缺了就少显示一项，不报错。 */
export function imageSpecSummary(spec: AiModelRequestSpec | null | undefined): string[] {
  if (!spec) return [];
  const out: string[] = [];
  const outputs = list(spec.outputs);
  if (outputs.length) out.push(`${outputs.length} 种尺寸`);
  if (typeof spec.maxReferenceImages === "number") out.push(spec.maxReferenceImages > 0 ? `最多 ${spec.maxReferenceImages} 张参考图` : "不支持参考图");
  return out;
}

export function videoSpecSummary(spec: AiModelRequestSpec | null | undefined): string[] {
  if (!spec) return [];
  const contract = record(spec.contract);
  const out: string[] = [];
  const modes = list(contract.modes);
  if (modes.length) out.push(`${modes.length} 种模式`);
  if (typeof contract.minSeconds === "number" && typeof contract.maxSeconds === "number") out.push(`${contract.minSeconds}–${contract.maxSeconds} 秒`);
  const tiers = list(contract.tiers).map((tier) => record(tier).tier).filter((tier): tier is string => typeof tier === "string");
  if (tiers.length) out.push(tiers.join(" / "));
  return out;
}

export function capabilityTags(endpoint: AiModelEndpoint): string[] {
  const tags = [...imageSpecSummary(endpoint.imageRequestSpec), ...videoSpecSummary(endpoint.videoRequestSpec)];
  if (endpoint.chatSupportsStreaming) tags.push("流式");
  if (endpoint.chatSupportsTools) tags.push("工具调用");
  if (endpoint.models?.some((model) => model.id === endpoint.model && model.supportsVision)) tags.push("看图");
  if (endpoint.models?.some((model) => model.id === endpoint.model && model.supportsVideo)) tags.push("看视频");
  return tags;
}

// ── 这个模型用在哪 ────────────────────────────────────────────────────────

export interface ModelUse {
  key: string;
  name: string;
  appCode: string;
  isDefault: boolean;
}

/** 按模型汇总功能。IP Studio 剧本和图片的真值是场景配置，不看共享候选。 */
export function modelUses(functions: ModelFunctionRow[], scenes: AiSceneCatalogRow[]): Map<string, ModelUse[]> {
  const out = new Map<string, ModelUse[]>();
  const add = (endpointId: string, use: ModelUse) => {
    const rows = out.get(endpointId);
    if (rows) rows.push(use); else out.set(endpointId, [use]);
  };
  for (const row of functions) {
    const key = `${row.appCode}.${row.feature}`;
    if (row.routingKind === "scene_policy") {
      const scene = scenes.find((item) => item.scene === (row.feature === "script" ? "script" : "image"));
      for (const candidate of scene?.policy?.candidates ?? [])
        add(candidate.endpointId, { key, name: row.name, appCode: row.appCode, isDefault: scene?.policy?.defaultEndpointId === candidate.endpointId });
      continue;
    }
    for (const candidate of row.candidates ?? []) {
      if (!candidate.enabled) continue;
      add(candidate.endpointId, { key, name: row.name, appCode: row.appCode, isDefault: candidate.isDefault });
    }
  }
  for (const rows of out.values()) rows.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return out;
}

// ── 编辑表单 ──────────────────────────────────────────────────────────────

export interface EndpointDraft {
  name: string;
  providerType: string;
  baseUrl: string;
  /** 空表示不改。 */
  apiKey: string;
  apiVersion: string;
  model: string;
  modelAlias: string;
  enabled: boolean;
  chatSupportsTemperature: boolean;
  chatSupportsTopP: boolean;
  chatSupportsResponseFormat: boolean;
  chatSupportsTools: boolean;
  chatSupportsStreaming: boolean;
  chatMaxOutputTokens: string;
  defaultMaxTokens: string;
  defaultTemperature: string;
  defaultTopP: string;
  imageSpecText: string;
  videoSpecText: string;
  concurrencyLimit: string;
  rpmLimit: string;
  tpmLimit: string;
  dailyTokenQuota: string;
  dailyCostQuotaYuan: string;
  alertFailureRatePct: string;
  billingMode: string;
  supplierBillingMode: string;
  promptPriceYuan: string;
  completionPriceYuan: string;
  unitPriceYuan: string;
  /** 刚从供应商读到的模型目录；没读过就是 null，不发。 */
  fetchedModels: AiModelEntry[] | null;
}

const MICROS = 1_000_000;
const text = (value: number | undefined | null) => (value === undefined || value === null ? "" : String(value));
const yuan = (micros: number | undefined | null) => (micros ? String(micros / MICROS) : "");
const specText = (spec: AiModelRequestSpec | null | undefined) => (spec ? JSON.stringify(spec, null, 2) : "");

export function blankDraft(): EndpointDraft {
  return {
    name: "", providerType: "OPENAI_COMPATIBLE", baseUrl: "", apiKey: "", apiVersion: "", model: "", modelAlias: "",
    // 新模型默认停用：开放范围一保存，启用的模型就会出现在产品的模型列表里，要等配完价再启用。
    enabled: false,
    chatSupportsTemperature: true, chatSupportsTopP: true, chatSupportsResponseFormat: true, chatSupportsTools: false, chatSupportsStreaming: false,
    chatMaxOutputTokens: "", defaultMaxTokens: "", defaultTemperature: "", defaultTopP: "",
    imageSpecText: "", videoSpecText: "",
    concurrencyLimit: "", rpmLimit: "", tpmLimit: "", dailyTokenQuota: "", dailyCostQuotaYuan: "", alertFailureRatePct: "",
    billingMode: "AUTO", supplierBillingMode: "AUTO", promptPriceYuan: "", completionPriceYuan: "", unitPriceYuan: "",
    fetchedModels: null,
  };
}

export function draftOf(endpoint: AiModelEndpoint): EndpointDraft {
  return {
    name: endpoint.name,
    providerType: endpoint.providerType,
    baseUrl: endpoint.baseUrl,
    apiKey: "",
    apiVersion: endpoint.apiVersion ?? "",
    model: endpoint.model ?? "",
    modelAlias: endpoint.modelAlias ?? "",
    enabled: endpoint.enabled,
    // 这三项没声明时服务端按支持处理，工具和流式没声明按不支持处理。
    chatSupportsTemperature: endpoint.chatSupportsTemperature ?? true,
    chatSupportsTopP: endpoint.chatSupportsTopP ?? true,
    chatSupportsResponseFormat: endpoint.chatSupportsResponseFormat ?? true,
    chatSupportsTools: endpoint.chatSupportsTools ?? false,
    chatSupportsStreaming: endpoint.chatSupportsStreaming ?? false,
    chatMaxOutputTokens: text(endpoint.chatMaxOutputTokens),
    defaultMaxTokens: text(endpoint.defaultMaxTokens),
    defaultTemperature: text(endpoint.defaultTemperature),
    defaultTopP: text(endpoint.defaultTopP),
    imageSpecText: specText(endpoint.imageRequestSpec),
    videoSpecText: specText(endpoint.videoRequestSpec),
    concurrencyLimit: text(endpoint.concurrencyLimit),
    rpmLimit: text(endpoint.rpmLimit),
    tpmLimit: text(endpoint.tpmLimit),
    dailyTokenQuota: text(endpoint.dailyTokenQuota),
    dailyCostQuotaYuan: yuan(endpoint.dailyCostQuotaMicros),
    alertFailureRatePct: text(endpoint.alertFailureRatePct),
    billingMode: endpoint.billingMode ?? "AUTO",
    supplierBillingMode: endpoint.supplierBillingMode ?? "AUTO",
    promptPriceYuan: yuan(endpoint.promptTokenPriceMicros),
    completionPriceYuan: yuan(endpoint.completionTokenPriceMicros),
    unitPriceYuan: yuan(endpoint.unitPriceMicros),
    fetchedModels: null,
  };
}

/**
 * rpm / tpm / 每日额度 / 成本额度 / 告警阈值：服务端保存时没传就清空（其余字段没传是不改）。
 * 所以任何一次保存都要带上，哪怕只是点启停。
 */
export function limitsOf(endpoint: AiModelEndpoint): Pick<AiModelEndpointSave, "rpmLimit" | "tpmLimit" | "dailyTokenQuota" | "dailyCostQuotaMicros" | "alertFailureRatePct"> {
  return {
    rpmLimit: endpoint.rpmLimit,
    tpmLimit: endpoint.tpmLimit,
    dailyTokenQuota: endpoint.dailyTokenQuota,
    dailyCostQuotaMicros: endpoint.dailyCostQuotaMicros,
    alertFailureRatePct: endpoint.alertFailureRatePct,
  };
}

export function toggleEnabled(endpoint: AiModelEndpoint, enabled: boolean): AiModelEndpointSave {
  return { enabled, ...limitsOf(endpoint) };
}

/** 换了协议、地址或模型标识：服务端默认清掉规格（规格是跟着模型走的），要保留得明确说。 */
export function supplierChanged(original: AiModelEndpoint, draft: EndpointDraft): boolean {
  return draft.providerType !== original.providerType
    || draft.baseUrl.trim() !== original.baseUrl
    || draft.model.trim() !== (original.model ?? "");
}

export type SpecChoice = "keep" | "clear";

export interface SaveProblem {
  tab: "basic" | "capability" | "limits" | "cost";
  message: string;
}

function integer(value: string, label: string, tab: SaveProblem["tab"], problems: SaveProblem[]): number | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) { problems.push({ tab, message: `${label}要填不小于 0 的整数` }); return undefined; }
  return parsed;
}

function decimal(value: string, label: string, tab: SaveProblem["tab"], problems: SaveProblem[]): number | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) { problems.push({ tab, message: `${label}要填不小于 0 的数字` }); return undefined; }
  return parsed;
}

const toMicros = (value: number | undefined) => (value === undefined ? undefined : Math.round(value * MICROS));

function parseSpec(value: string, label: string, problems: SaveProblem[]): AiModelRequestSpec | null | undefined {
  if (!value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as AiModelRequestSpec;
    problems.push({ tab: "capability", message: `${label}要是一个 JSON 对象` });
  } catch {
    problems.push({ tab: "capability", message: `${label}不是有效的 JSON` });
  }
  return undefined;
}

/** 键顺序不算改动。 */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => sameJson(item, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => key in right && sameJson(left[key], right[key]));
  }
  return false;
}

export interface EndpointSavePlan {
  /** 没有要改的就是 null。 */
  value: AiModelEndpointSave | null;
  problems: SaveProblem[];
}

/**
 * 只发改过的字段（再加限额，见 limitsOf）。规格没动就不发：
 * 编辑器不认识的字段（比如 wire.requireExactOutputSize）才不会有任何机会被丢掉。
 */
export function planEndpointUpdate(original: AiModelEndpoint, draft: EndpointDraft, specChoice: SpecChoice | null): EndpointSavePlan {
  const problems: SaveProblem[] = [];
  const value: AiModelEndpointSave = {};
  const setText = (key: "name" | "providerType" | "baseUrl" | "apiVersion" | "model" | "modelAlias", next: string, before: string | undefined) => {
    if (next.trim() !== (before ?? "")) value[key] = next.trim();
  };
  if (!draft.name.trim()) problems.push({ tab: "basic", message: "请填写模型名称" });
  if (!draft.baseUrl.trim()) problems.push({ tab: "basic", message: "请填写基础地址" });
  setText("name", draft.name, original.name);
  setText("providerType", draft.providerType, original.providerType);
  setText("baseUrl", draft.baseUrl, original.baseUrl);
  setText("apiVersion", draft.apiVersion, original.apiVersion);
  setText("model", draft.model, original.model);
  setText("modelAlias", draft.modelAlias, original.modelAlias);
  if (draft.apiKey.trim()) value.apiKey = draft.apiKey.trim();
  if (draft.enabled !== original.enabled) value.enabled = draft.enabled;
  if (draft.billingMode !== (original.billingMode ?? "AUTO")) value.billingMode = draft.billingMode;
  for (const [key, before] of [
    ["chatSupportsTemperature", original.chatSupportsTemperature ?? true],
    ["chatSupportsTopP", original.chatSupportsTopP ?? true],
    ["chatSupportsResponseFormat", original.chatSupportsResponseFormat ?? true],
    ["chatSupportsTools", original.chatSupportsTools ?? false],
    ["chatSupportsStreaming", original.chatSupportsStreaming ?? false],
  ] as const) if (draft[key] !== before) value[key] = draft[key];

  // 这两项和并发一样：0 表示清空，没传表示不改。
  const clearable = (next: number | undefined, before: number | undefined) => (next === before ? undefined : next ?? 0);
  const chatMax = clearable(integer(draft.chatMaxOutputTokens, "单次输出 Token 上限", "capability", problems), original.chatMaxOutputTokens);
  if (chatMax !== undefined) value.chatMaxOutputTokens = chatMax;
  const defaultMax = clearable(integer(draft.defaultMaxTokens, "默认输出 Token", "capability", problems), original.defaultMaxTokens);
  if (defaultMax !== undefined) value.defaultMaxTokens = defaultMax;
  const concurrency = clearable(integer(draft.concurrencyLimit, "并发上限", "limits", problems), original.concurrencyLimit);
  if (concurrency !== undefined) value.concurrencyLimit = concurrency;

  const temperature = decimal(draft.defaultTemperature, "默认温度", "capability", problems);
  if (temperature !== original.defaultTemperature) {
    if (temperature === undefined) problems.push({ tab: "capability", message: "默认温度保存后不能清空，请填写数值" });
    else value.defaultTemperature = temperature;
  }
  const topP = decimal(draft.defaultTopP, "默认 Top P", "capability", problems);
  if (topP !== original.defaultTopP) {
    if (topP === undefined) problems.push({ tab: "capability", message: "默认 Top P 保存后不能清空，请填写数值" });
    else value.defaultTopP = topP;
  }

  const imageSpec = parseSpec(draft.imageSpecText, "图片规格", problems);
  const videoSpec = parseSpec(draft.videoSpecText, "视频规格", problems);
  const imageChanged = imageSpec !== undefined && !sameJson(imageSpec, original.imageRequestSpec ?? null);
  const videoChanged = videoSpec !== undefined && !sameJson(videoSpec, original.videoRequestSpec ?? null);
  if (imageChanged) { if (imageSpec) value.imageRequestSpec = imageSpec; else value.clearImageRequestSpec = true; }
  if (videoChanged) { if (videoSpec) value.videoRequestSpec = videoSpec; else value.clearVideoRequestSpec = true; }
  if (supplierChanged(original, draft) && (original.imageRequestSpec || original.videoRequestSpec)) {
    if (!specChoice) problems.push({ tab: "basic", message: "地址或模型变了，请选择保留还是清除现有规格" });
    if (specChoice === "keep") {
      if (imageSpec) value.imageRequestSpec = imageSpec;
      if (videoSpec) value.videoRequestSpec = videoSpec;
    }
  }

  const rpm = integer(draft.rpmLimit, "每分钟请求数", "limits", problems);
  const tpm = integer(draft.tpmLimit, "每分钟 Token", "limits", problems);
  const dailyTokens = integer(draft.dailyTokenQuota, "每日 Token 额度", "limits", problems);
  const dailyCost = toMicros(decimal(draft.dailyCostQuotaYuan, "每日成本额度", "limits", problems));
  const alert = integer(draft.alertFailureRatePct, "失败率告警", "limits", problems);
  if (alert !== undefined && alert > 100) problems.push({ tab: "limits", message: "失败率告警不能超过 100" });
  if (draft.fetchedModels) value.models = draft.fetchedModels;

  const limitsChanged = rpm !== original.rpmLimit || tpm !== original.tpmLimit || dailyTokens !== original.dailyTokenQuota
    || dailyCost !== original.dailyCostQuotaMicros || alert !== original.alertFailureRatePct;
  if (problems.length) return { value: null, problems };
  if (!Object.keys(value).length && !limitsChanged) return { value: null, problems };
  return { value: { ...value, rpmLimit: rpm, tpmLimit: tpm, dailyTokenQuota: dailyTokens, dailyCostQuotaMicros: dailyCost, alertFailureRatePct: alert }, problems };
}

export function planEndpointCreate(draft: EndpointDraft): EndpointSavePlan {
  const problems: SaveProblem[] = [];
  if (!draft.name.trim()) problems.push({ tab: "basic", message: "请填写模型名称" });
  if (!draft.baseUrl.trim()) problems.push({ tab: "basic", message: "请填写基础地址" });
  if (!draft.apiKey.trim()) problems.push({ tab: "basic", message: "请填写密钥" });
  const imageSpec = parseSpec(draft.imageSpecText, "图片规格", problems);
  const videoSpec = parseSpec(draft.videoSpecText, "视频规格", problems);
  const value: AiModelEndpointSave = {
    name: draft.name.trim(),
    providerType: draft.providerType,
    baseUrl: draft.baseUrl.trim(),
    apiKey: draft.apiKey.trim(),
    enabled: draft.enabled,
    chatSupportsTemperature: draft.chatSupportsTemperature,
    chatSupportsTopP: draft.chatSupportsTopP,
    chatSupportsResponseFormat: draft.chatSupportsResponseFormat,
    chatSupportsTools: draft.chatSupportsTools,
    chatSupportsStreaming: draft.chatSupportsStreaming,
    billingMode: draft.billingMode,
    chatMaxOutputTokens: integer(draft.chatMaxOutputTokens, "单次输出 Token 上限", "capability", problems),
    defaultMaxTokens: integer(draft.defaultMaxTokens, "默认输出 Token", "capability", problems),
    defaultTemperature: decimal(draft.defaultTemperature, "默认温度", "capability", problems),
    defaultTopP: decimal(draft.defaultTopP, "默认 Top P", "capability", problems),
    concurrencyLimit: integer(draft.concurrencyLimit, "并发上限", "limits", problems),
    rpmLimit: integer(draft.rpmLimit, "每分钟请求数", "limits", problems),
    tpmLimit: integer(draft.tpmLimit, "每分钟 Token", "limits", problems),
    dailyTokenQuota: integer(draft.dailyTokenQuota, "每日 Token 额度", "limits", problems),
    dailyCostQuotaMicros: toMicros(decimal(draft.dailyCostQuotaYuan, "每日成本额度", "limits", problems)),
    alertFailureRatePct: integer(draft.alertFailureRatePct, "失败率告警", "limits", problems),
  };
  if (draft.apiVersion.trim()) value.apiVersion = draft.apiVersion.trim();
  if (draft.model.trim()) value.model = draft.model.trim();
  if (draft.modelAlias.trim()) value.modelAlias = draft.modelAlias.trim();
  if (imageSpec) value.imageRequestSpec = imageSpec;
  if (videoSpec) value.videoRequestSpec = videoSpec;
  if (draft.fetchedModels) value.models = draft.fetchedModels;
  return { value: problems.length ? null : value, problems };
}

/** 服务端要三项一起给。没改就是 null。 */
export function planCosts(original: AiModelEndpoint | null, draft: EndpointDraft): { value: AiModelCostSave | null; problems: SaveProblem[] } {
  const problems: SaveProblem[] = [];
  const prompt = toMicros(decimal(draft.promptPriceYuan, "输入成本", "cost", problems)) ?? 0;
  const completion = toMicros(decimal(draft.completionPriceYuan, "输出成本", "cost", problems)) ?? 0;
  const unit = toMicros(decimal(draft.unitPriceYuan, "按次或按秒成本", "cost", problems)) ?? 0;
  if (problems.length) return { value: null, problems };
  const unchanged = original
    ? draft.supplierBillingMode === (original.supplierBillingMode ?? "AUTO") && prompt === original.promptTokenPriceMicros
      && completion === original.completionTokenPriceMicros && unit === original.unitPriceMicros
    : draft.supplierBillingMode === "AUTO" && !prompt && !completion && !unit;
  if (unchanged) return { value: null, problems };
  return { value: { supplierBillingMode: draft.supplierBillingMode as AiModelCostSave["supplierBillingMode"], promptTokenPriceMicros: prompt, completionTokenPriceMicros: completion, unitPriceMicros: unit }, problems };
}

export function sameAccess(a: AiModelAccessPolicy, b: AiModelAccessPolicy): boolean {
  const norm = (policy: AiModelAccessPolicy) => ({ ...policy, categories: [...policy.categories].sort(), appCodes: [...policy.appCodes].sort() });
  return sameJson(norm(a), norm(b));
}

/** 服务端要求：开给 IP Studio 的视频模型如果还不是视频候选，会自动加入共享候选，要确认过影响范围。 */
export function opensStudioVideo(policy: AiModelAccessPolicy): boolean {
  return policy.categories.includes("video") && (policy.scope === "all" || policy.appCodes.includes("studio"));
}

/** 保存前给人看的改动清单：这些配置保存后立刻影响线上售价和默认模型。 */
export function scenePolicyChanges(
  before: { mode: string; defaultEndpointId: string; candidates: { endpointId: string; creditCost: number | null }[] } | null,
  after: { mode: string; defaultEndpointId: string; candidates: { endpointId: string; creditCost: number | null }[] },
  nameOf: (id: string) => string,
  unit: string,
): string[] {
  const out: string[] = [];
  const old = new Map((before?.candidates ?? []).map((row) => [row.endpointId, row.creditCost]));
  const next = new Set(after.candidates.map((row) => row.endpointId));
  if (before && before.mode !== after.mode) out.push(after.mode === "fixed" ? "改为固定一个模型" : "改为用户可选");
  if (before?.defaultEndpointId !== after.defaultEndpointId) out.push(`默认模型改为「${nameOf(after.defaultEndpointId)}」`);
  for (const row of after.candidates) {
    if (!old.has(row.endpointId)) out.push(`添加「${nameOf(row.endpointId)}」，${row.creditCost} 积分 / ${unit}`);
    else if (old.get(row.endpointId) !== row.creditCost) out.push(`「${nameOf(row.endpointId)}」的价格从 ${old.get(row.endpointId)} 改为 ${row.creditCost} 积分 / ${unit}`);
  }
  for (const id of old.keys()) if (!next.has(id)) out.push(`从列表移除「${nameOf(id)}」，模型本身不删除`);
  return out;
}
