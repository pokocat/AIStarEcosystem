/**
 * Studio 后台「模型配置」页读写的数据（/api/admin/studio/model-config/command）。
 * 字段照服务端 DTO：AiModelEndpointDto、AiAppEndpointCandidateDto、AiAppSceneModelPolicyDto、ModelFeatureManagementService。
 */

/**
 * 图片 / 视频请求规格。前端整份当 JSON 处理，**不要在这里列字段、也不要按字段校验**：
 * 规格的真值和校验在服务端（AiImageRequestSpec / AiVideoRequestSpec），新字段经常先上服务端。
 * 统一后台按契约严格解析，线上加了新字段后整张模型表都读不出来；只列一部分字段的编辑器，保存时还会把没列的字段丢掉。
 */
export type AiModelRequestSpec = Record<string, unknown>;

export interface AiModelEntry {
  id: string;
  label?: string;
  contextWindow?: number;
  supportsVision?: boolean;
}

/** 用户计费口径和供应商成本口径；AUTO 表示文本按 Token、图片按次、视频按秒。 */
export type AiModelBillingMode = "AUTO" | "TOKENS" | "PER_CALL" | "PER_SECOND";

export interface AiModelEndpoint {
  id: string;
  name: string;
  providerType: string;
  baseUrl: string;
  upstreamApiKeyMasked?: string;
  apiVersion?: string;
  model?: string;
  modelAlias?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTopP?: number;
  chatSupportsTemperature?: boolean;
  chatSupportsTopP?: boolean;
  chatSupportsResponseFormat?: boolean;
  chatMaxOutputTokens?: number;
  chatSupportsTools?: boolean;
  chatSupportsStreaming?: boolean;
  imageRequestSpec?: AiModelRequestSpec | null;
  videoRequestSpec?: AiModelRequestSpec | null;
  rpmLimit?: number;
  concurrencyLimit?: number;
  tpmLimit?: number;
  dailyTokenQuota?: number;
  dailyCostQuotaMicros?: number;
  alertFailureRatePct?: number;
  models?: AiModelEntry[];
  ownerUserId?: string;
  billingMode?: string;
  supplierBillingMode?: string;
  promptTokenPriceMicros: number;
  completionTokenPriceMicros: number;
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

/** endpointSave 的 value。除五个限额外，没传的字段不改；五个限额见 model-config.ts 的 limitsOf。 */
export interface AiModelEndpointSave {
  id?: string;
  name?: string;
  providerType?: string;
  baseUrl?: string;
  apiKey?: string;
  apiVersion?: string;
  model?: string;
  modelAlias?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTopP?: number;
  chatSupportsTemperature?: boolean;
  chatSupportsTopP?: boolean;
  chatSupportsResponseFormat?: boolean;
  chatMaxOutputTokens?: number;
  chatSupportsTools?: boolean;
  chatSupportsStreaming?: boolean;
  imageRequestSpec?: AiModelRequestSpec;
  clearImageRequestSpec?: boolean;
  videoRequestSpec?: AiModelRequestSpec;
  clearVideoRequestSpec?: boolean;
  rpmLimit?: number;
  concurrencyLimit?: number;
  tpmLimit?: number;
  dailyTokenQuota?: number;
  dailyCostQuotaMicros?: number;
  alertFailureRatePct?: number;
  models?: AiModelEntry[];
  ownerUserId?: string;
  billingMode?: string;
  enabled?: boolean;
}

export interface AiModelCostSave {
  supplierBillingMode: AiModelBillingMode;
  promptTokenPriceMicros: number;
  completionTokenPriceMicros: number;
  unitPriceMicros: number;
}

export interface AiModelProviderPreset {
  code: string;
  name: string;
  providerType: string;
  baseUrl: string;
  suggestedModel?: string;
  docsUrl?: string;
  apiKeyHint?: string;
}

export interface AiModelAccessPolicy {
  categories: string[];
  scope: "all" | "selected";
  appCodes: string[];
}

export interface AiModelAccessRow {
  endpointId: string;
  name: string;
  policy: AiModelAccessPolicy;
}

export interface AiModelTestResult {
  ok: boolean;
  statusCode?: number;
  models?: AiModelEntry[];
  error?: string;
}

export interface AiEndpointCapability {
  maxRefImages?: number;
  supportsFirstLastFrame?: boolean;
  supportsSubjectReference?: boolean;
  maxDurationSec?: number;
  minImagePixels?: number;
}

export interface AiAppEndpointCandidate {
  purpose: string;
  purposeLabel: string;
  endpointId: string;
  endpointName?: string;
  endpointEnabled?: boolean;
  isDefault: boolean;
  sortOrder: number;
  enabled: boolean;
  capability?: AiEndpointCapability;
  creditCostOverride?: number | null;
  updatedAt?: string;
  /** 只有视频组的候选带：模型现在能不能真的出现在 IP Studio。 */
  available?: boolean;
}

export interface AiSceneModelCandidate {
  endpointId: string;
  creditCost: number;
  billingUnit: string;
}

export interface AiSceneModelPolicy {
  appCode: string;
  scene: string;
  mode: "fixed" | "selectable";
  defaultEndpointId: string;
  candidates: AiSceneModelCandidate[];
}

export interface AiSceneCatalogRow {
  appCode: string;
  scene: "script" | "image";
  purpose: string;
  billingUnit: string;
  policy: AiSceneModelPolicy | null;
  status: string;
  candidates: AiAppEndpointCandidate[];
  endpoints: AiModelEndpoint[];
}

export interface AiStudioVideoGroup {
  defaultEndpointId: string;
  endpointIds: string[];
}

export type ModelFunctionRouting = "shared_purpose" | "scene_policy" | "video_group" | "external_engine" | "none";
export type ModelFunctionStatus = "configured" | "unconfigured" | "unavailable" | "external" | "not_required";

export interface ModelFunctionRow {
  appCode: string;
  feature: string;
  name: string;
  purpose: string | null;
  routingKind: ModelFunctionRouting;
  pricingKind: string;
  priceKey: string;
  billingUnit: string;
  priceSemantics: string;
  /** 共享同一配置的全部功能：appCode.feature。保存时要原样回传，表示确认过影响范围。 */
  affectedFeatures: string[];
  priceAffectedFeatures: string[];
  binding: { endpointId?: string; endpointName?: string; endpointEnabled?: boolean } | null;
  candidates: AiAppEndpointCandidate[];
  status: ModelFunctionStatus;
}

export interface ModelFunctionPricing {
  appCode: string;
  feature: string;
  pricingKind: string;
  priceSemantics: string;
  billingUnit: string;
  /** 按 pricingKind 不同：action 是 {creditPrice, useEnginePricing}，config 是数字，其余见 function-models.tsx。 */
  value?: unknown;
  fallback?: number | null;
  videoDimensions?: { modes: { mode: string; label: string }[]; tiers: string[] };
  candidatePrices?: { endpointId: string; endpointName?: string; creditCostOverride?: number | null; available: boolean; billingUnit: string }[];
}

export interface ModelFunctionPricingRow extends Omit<ModelFunctionRow, "binding" | "candidates"> {
  pricing: ModelFunctionPricing;
}

export interface VideoStudioPricingConfig {
  perSecond: Record<string, Record<string, number | null>>;
  freeRefImages?: number;
  extraRefImagePerSecond?: number;
  promptOptimizationPerCall?: number;
}
