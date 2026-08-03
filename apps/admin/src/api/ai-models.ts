// ─────────────────────────────────────────────────────────────────────────────
// api/ai-models.ts: Admin AI 模型接入端点 + AI 应用绑定。
// 对应 AdminAiModelEndpointController + AdminAiAppBindingController。
//   端点 = 固定 {上游密钥 + 单模型 + 地址}，仅供平台内部 AI 应用绑定调用。
//   AI 应用（用途）经「应用绑定」固定指向一个端点。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from "./_client";

export type AiModelProviderType =
  | "OPENAI"
  | "ANTHROPIC"
  | "AZURE_OPENAI"
  | "MOONSHOT"
  | "DEEPSEEK"
  | "BAIDU"
  | "ALIYUN"
  | "TENCENT"
  | "VOLCENGINE"
  | "OPENAI_COMPATIBLE"
  | "CUSTOM";

export type AiModelPurpose =
  | "SCRIPT_DRAFT"
  | "SELLING_POINTS"
  | "VARIABLE_EXTRACT"
  | "IMAGE_GENERATION"
  | "VIDEO_GENERATION"
  | "SAFETY_REVIEW"
  | "VIDEO_REF_ANALYSIS"
  | "TEMPLATE_REWRITE"
  | "APPEARANCE_FORGE"
  | "DRAMA_SCRIPT_DRAFT"
  | "DAP_PERSONA"
  | "DAP_IMAGE"
  | "DAP_VIDEO"
  | "DAP_REAL_AVATAR"
  | "GENERAL";

export type AiModelBillingMode = "TOKENS" | "PER_CALL" | "PER_SECOND";

/** 单个可用模型条目（通常由 discover/fetch-models 拉取后写入配置）。 */
export interface AiModelEntry {
  id: string;
  label?: string;
  contextWindow?: number;
  supportsVision?: boolean;
}

/** 模型接入端点读 DTO（上游 apiKey 不返回明文）。 */
export interface AiModelEndpoint {
  id: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  upstreamApiKeyMasked: string;
  apiVersion?: string;
  model?: string;
  modelAlias?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTopP?: number;
  rpmLimit?: number;
  tpmLimit?: number;
  dailyTokenQuota?: number;
  dailyCostQuotaMicros?: number;
  alertFailureRatePct?: number;
  models?: AiModelEntry[];
  ownerUserId?: string;
  /** 成本估算口径；为空表示自动：文本 token / 图片按次 / 视频按秒。 */
  billingMode?: AiModelBillingMode | null;
  /** 输入 token 单价，人民币微元 / 1K Token。0 = 未配置成本价。 */
  promptTokenPriceMicros: number;
  /** 输出 token 单价，人民币微元 / 1K Token。0 = 未配置成本价。 */
  completionTokenPriceMicros: number;
  /** 按次/按秒单价，人民币微元 / 次 或 / 秒。 */
  unitPriceMicros: number;
  totalTokens: number;
  totalBillableUnits: number;
  totalBillableSeconds: number;
  totalCalls: number;
  lastUsedAt?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 写请求（上游 apiKey 走明文，service 端加密落库；PUT 时省略表示不修改）。 */
export interface AdminAiModelEndpointUpsert {
  id?: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  apiKey?: string;
  apiVersion?: string;
  model?: string;
  modelAlias?: string;
  defaultTemperature?: number | null;
  defaultMaxTokens?: number | null;
  defaultTopP?: number | null;
  rpmLimit?: number | null;
  tpmLimit?: number | null;
  dailyTokenQuota?: number | null;
  dailyCostQuotaMicros?: number | null;
  alertFailureRatePct?: number | null;
  models?: AiModelEntry[];
  /** 计费归属用户；"" 清空为平台级（不计费）；省略 = 不修改。 */
  ownerUserId?: string;
  /** null/"AUTO" = 自动；TOKENS / PER_CALL / PER_SECOND = 强制口径。 */
  billingMode?: AiModelBillingMode | "AUTO" | null;
  /** 输入 token 单价，人民币微元 / 1K Token。 */
  promptTokenPriceMicros?: number;
  /** 输出 token 单价，人民币微元 / 1K Token。 */
  completionTokenPriceMicros?: number;
  /** 按次/按秒单价，人民币微元 / 次 或 / 秒。 */
  unitPriceMicros?: number;
  enabled?: boolean;
}

/** AI 应用绑定（用途 → 端点）。 */
export interface AiAppBinding {
  purpose: AiModelPurpose;
  purposeLabel: string;
  endpointId?: string;
  endpointName?: string;
  endpointEnabled?: boolean;
  updatedAt?: string;
}

/** D-11：端点能力画像（null=未知，消费方按 legacy 兼容默认：参考图上限 6 / 首尾帧协议静态判定）。 */
export interface EndpointCapability {
  maxRefImages?: number | null;
  supportsFirstLastFrame?: boolean | null;
  supportsSubjectReference?: boolean | null;
  maxDurationSec?: number | null;
}

/** D-11：某用途的候选端点（含 capability + 默认标记 + 单价 override）。 */
export interface AiAppEndpointCandidate {
  purpose: AiModelPurpose;
  purposeLabel: string;
  endpointId: string;
  endpointName?: string;
  endpointEnabled?: boolean;
  isDefault: boolean;
  sortOrder: number;
  enabled: boolean;
  capability: EndpointCapability;
  /** 本端点在该用途下的积分单价 override（null=用用途默认单价）。 */
  creditCostOverride?: number | null;
  updatedAt?: string;
}

/** 候选端点写请求（POST endpointId 必填；PUT 走 path endpointId，body 只带 capability/override/enabled/sortOrder）。 */
export interface AiAppEndpointCandidateUpsert {
  endpointId?: string;
  sortOrder?: number | null;
  enabled?: boolean | null;
  maxRefImages?: number | null;
  supportsFirstLastFrame?: boolean | null;
  supportsSubjectReference?: boolean | null;
  maxDurationSec?: number | null;
  creditCostOverride?: number | null;
}

/** 内置服务商预设（仅模板，不落库）。 */
export interface AiModelProviderPreset {
  code: string;
  name: string;
  providerType: AiModelProviderType;
  baseUrl: string;
  suggestedModel?: string;
  docsUrl?: string;
  apiKeyHint?: string;
}

/** 模型发现结果。 */
export interface ModelDiscoveryResult {
  ok: boolean;
  statusCode?: number;
  models: AiModelEntry[];
  error?: string;
}

/** 用量聚合行（按服务商或模型分组）。v0.41 新增。 */
export interface AiModelUsageStat {
  key: string;
  label: string;
  calls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  billableUnits: number;
  billableSeconds: number;
  estimatedCostMicros: number;
}

/** 用量「按天」聚合行（仅成功调用，date = Asia/Shanghai 自然日）。 */
export interface AiModelUsageDaily {
  date: string;
  calls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  billableUnits: number;
  billableSeconds: number;
  estimatedCostMicros: number;
}

export interface AiModelAlert {
  id: string;
  severity: "warning" | "critical";
  type: string;
  providerId: string;
  providerName: string;
  title: string;
  message: string;
  metricValue: number;
  threshold: number;
  createdAt: string;
}

export interface AiModelFailureStat {
  category: string;
  label: string;
  calls: number;
}

/** 用量报表（最近 windowDays 天）。v0.41 新增；用途 / 按天 / 失败维度补全。 */
export interface AiModelUsageReport {
  windowDays: number;
  since: string;
  totalCalls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalBillableUnits: number;
  totalBillableSeconds: number;
  estimatedCostMicros: number;
  failedCalls: number;
  alerts: AiModelAlert[];
  byFailureCategory: AiModelFailureStat[];
  byProvider: AiModelUsageStat[];
  byModel: AiModelUsageStat[];
  byPurpose: AiModelUsageStat[];
  byUser: AiModelUsageStat[];
  byTenant: AiModelUsageStat[];
  byAppCode: AiModelUsageStat[];
  byDay: AiModelUsageDaily[];
}

export interface AiModelUsageRecord {
  id: string;
  createdAt: string;
  providerId?: string;
  providerName?: string;
  model?: string;
  purpose?: AiModelPurpose;
  purposeLabel: string;
  userId?: string;
  userLabel: string;
  tenantId?: string;
  tenantLabel: string;
  appCode: string;
  appLabel: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  billingMode: AiModelBillingMode;
  billableUnits: number;
  billableSeconds: number;
  unitPriceMicros: number;
  success: boolean;
  estimatedCostMicros: number;
  requestId?: string;
  upstreamId?: string;
  latencyMs?: number;
  errorCode?: string;
  errorCategory?: string;
  errorCategoryLabel?: string;
  errorMessage?: string;
  requestBodyJson?: string;
  responseBodyJson?: string;
  replayOfRecordId?: string;
  qualityScore?: number;
  qualityLabel?: string;
  qualityNote?: string;
}

export interface AiModelReplayResult {
  sourceRecordId: string;
  output: string;
  finishReason?: string;
  tokensUsed?: number;
  endpointUsed?: string;
  modelUsed?: string;
}

const BASE = "/admin/ai-models";
const BINDINGS = "/admin/ai-app-bindings";

// ── 端点 CRUD ────────────────────────────────────────────────────────────────
export async function list(): Promise<AiModelEndpoint[]> {
  return apiFetch<AiModelEndpoint[]>(BASE);
}
export async function get(id: string): Promise<AiModelEndpoint> {
  return apiFetch<AiModelEndpoint>(`${BASE}/${encodeURIComponent(id)}`);
}
export async function create(body: AdminAiModelEndpointUpsert): Promise<AiModelEndpoint> {
  return apiFetch<AiModelEndpoint>(BASE, { method: "POST", body });
}
export async function update(id: string, body: AdminAiModelEndpointUpsert): Promise<AiModelEndpoint> {
  return apiFetch<AiModelEndpoint>(`${BASE}/${encodeURIComponent(id)}`, { method: "PUT", body });
}
export async function remove(id: string): Promise<void> {
  await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function testConnection(id: string): Promise<{ ok: boolean; statusCode?: number; error?: string; snippet?: string }> {
  return apiFetch(`${BASE}/${encodeURIComponent(id)}/test`, { method: "POST" });
}

// ── 模型发现 ──────────────────────────────────────────────────────────────────
/** 内置常见服务商预设（火山方舟 / Kimi / DeepSeek / 千问 / OpenAI）。 */
export async function listPresets(): Promise<AiModelProviderPreset[]> {
  return apiFetch<AiModelProviderPreset[]>(`${BASE}/presets`);
}
/** 新建前：用表单的 baseUrl + apiKey 调服务商 GET /models 拉取可用模型。 */
export async function discoverModels(body: {
  providerType?: AiModelProviderType;
  baseUrl: string;
  apiKey: string;
}): Promise<ModelDiscoveryResult> {
  return apiFetch<ModelDiscoveryResult>(`${BASE}/discover-models`, { method: "POST", body });
}
/** 已存端点：用落库的 apiKey 重新拉取可用模型（拉回后由保存写入配置）。 */
export async function fetchModels(id: string): Promise<ModelDiscoveryResult> {
  return apiFetch<ModelDiscoveryResult>(`${BASE}/${encodeURIComponent(id)}/fetch-models`, { method: "POST" });
}

// ── LLM 用量统计（v0.41） ───────────────────────────────────────────────────────
/** 全局大模型用量报表（days：统计窗口天数，缺省 30，封顶 365）。 */
export async function getUsage(days?: number): Promise<AiModelUsageReport> {
  return apiFetch<AiModelUsageReport>(BASE + "/usage", { query: { days } });
}
export async function getUsageRecords(params?: {
  days?: number;
  appCode?: string;
  userId?: string;
  tenantId?: string;
  purpose?: AiModelPurpose;
  providerId?: string;
  success?: boolean;
  q?: string;
  size?: number;
}): Promise<AiModelUsageRecord[]> {
  return apiFetch<AiModelUsageRecord[]>(BASE + "/usage-records", { query: params });
}
export async function replayUsageRecord(id: string): Promise<AiModelReplayResult> {
  return apiFetch<AiModelReplayResult>(`${BASE}/usage-records/${encodeURIComponent(id)}/replay`, { method: "POST" });
}
export async function updateUsageRecordQuality(
  id: string,
  body: { score?: number | null; label?: string | null; note?: string | null },
): Promise<AiModelUsageRecord> {
  return apiFetch<AiModelUsageRecord>(`${BASE}/usage-records/${encodeURIComponent(id)}/quality`, {
    method: "PUT",
    body,
  });
}
/** 单端点用量报表。 */
export async function getProviderUsage(id: string, days?: number): Promise<AiModelUsageReport> {
  return apiFetch<AiModelUsageReport>(`${BASE}/${encodeURIComponent(id)}/usage`, { query: { days } });
}

// ── AI 应用绑定 ────────────────────────────────────────────────────────────────
/** 列出全部用途（含未绑定）及其绑定端点。 */
export async function listBindings(): Promise<AiAppBinding[]> {
  return apiFetch<AiAppBinding[]>(BINDINGS);
}
/** 把某用途绑定到一个启用端点。 */
export async function bind(purpose: AiModelPurpose, endpointId: string): Promise<AiAppBinding> {
  return apiFetch<AiAppBinding>(`${BINDINGS}/${encodeURIComponent(purpose)}`, {
    method: "PUT",
    body: { endpointId },
  });
}
/** 解绑某用途。 */
export async function unbind(purpose: AiModelPurpose): Promise<void> {
  await apiFetch<void>(`${BINDINGS}/${encodeURIComponent(purpose)}`, { method: "DELETE" });
}

// ── D-11 候选端点（一用途多候选 + capability） ─────────────────────────────────
/** 列出某用途的全部候选端点（含 capability + 默认标记）。 */
export async function listCandidates(purpose: AiModelPurpose): Promise<AiAppEndpointCandidate[]> {
  return apiFetch<AiAppEndpointCandidate[]>(`${BINDINGS}/${encodeURIComponent(purpose)}/candidates`);
}
/** 新增一个候选端点（endpointId 必填，可带 capability）。 */
export async function addCandidate(
  purpose: AiModelPurpose,
  body: AiAppEndpointCandidateUpsert,
): Promise<AiAppEndpointCandidate> {
  return apiFetch<AiAppEndpointCandidate>(`${BINDINGS}/${encodeURIComponent(purpose)}/candidates`, {
    method: "POST",
    body,
  });
}
/** 更新候选端点的 capability / 单价 override / 启用 / 排序。 */
export async function updateCandidate(
  purpose: AiModelPurpose,
  endpointId: string,
  body: AiAppEndpointCandidateUpsert,
): Promise<AiAppEndpointCandidate> {
  return apiFetch<AiAppEndpointCandidate>(
    `${BINDINGS}/${encodeURIComponent(purpose)}/candidates/${encodeURIComponent(endpointId)}`,
    { method: "PUT", body },
  );
}
/** 删除一个候选端点（默认端点不允许删）。 */
export async function removeCandidate(purpose: AiModelPurpose, endpointId: string): Promise<void> {
  await apiFetch<void>(
    `${BINDINGS}/${encodeURIComponent(purpose)}/candidates/${encodeURIComponent(endpointId)}`,
    { method: "DELETE" },
  );
}
