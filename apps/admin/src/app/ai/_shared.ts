import type { AiModelProviderType, AiModelPurpose } from "@/api/ai-models";
import { APP_CODE_KEYS, appCodeLabel } from "@/types/audit";
import { formatCountCN } from "@/lib/utils";

export const AI_APP_CODES = APP_CODE_KEYS;

export const PROVIDER_LABEL: Record<AiModelProviderType, string> = {
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

export const PURPOSE_LABEL: Record<AiModelPurpose, string> = {
  SCRIPT_DRAFT: "模板脚本起草",
  SELLING_POINTS: "商品卖点提取",
  VARIABLE_EXTRACT: "变量抽取",
  IMAGE_GENERATION: "图像生成",
  VIDEO_GENERATION: "视频生成",
  SAFETY_REVIEW: "安全复检",
  VIDEO_REF_ANALYSIS: "视频参考分析",
  TEMPLATE_REWRITE: "模板改写",
  APPEARANCE_FORGE: "形象锻造",
  DRAMA_SCRIPT_DRAFT: "短剧脚本起草",
  DAP_PERSONA: "数字人人设解析",
  DAP_IMAGE: "数字人图片生成",
  DAP_VIDEO: "数字人视频生成",
  DAP_REAL_AVATAR: "真人素材与授权",
  GENERAL: "通用兜底",
};

export const PURPOSE_PRODUCT_LABEL: Record<AiModelPurpose, string> = {
  SCRIPT_DRAFT: "AI 明星带货",
  SELLING_POINTS: "AI 明星带货",
  VARIABLE_EXTRACT: "AI 明星带货",
  IMAGE_GENERATION: "跨产品",
  VIDEO_GENERATION: "跨产品",
  SAFETY_REVIEW: "平台通用",
  VIDEO_REF_ANALYSIS: "AI 明星带货",
  TEMPLATE_REWRITE: "AI 明星带货",
  APPEARANCE_FORGE: "AI 音乐人 / 短剧",
  DRAMA_SCRIPT_DRAFT: "AI 短剧",
  DAP_PERSONA: "AiAvatar",
  DAP_IMAGE: "AiAvatar",
  DAP_VIDEO: "AiAvatar",
  DAP_REAL_AVATAR: "AiAvatar",
  GENERAL: "平台通用",
};

export const USAGE_WINDOW_OPTIONS = [
  { value: 7, label: "近 7 天" },
  { value: 14, label: "近 14 天" },
  { value: 30, label: "近 30 天" },
  { value: 60, label: "近 60 天" },
  { value: 90, label: "近 90 天" },
  { value: 180, label: "近 180 天" },
  { value: 365, label: "近 365 天" },
] as const;

export function formatTokens(value: number | null | undefined): string {
  return formatCountCN(value ?? 0);
}

export function formatRate(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function compactId(value: string | null | undefined): string {
  if (!value) return "无";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...`;
}

export function latestIso(values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  let latestTs = 0;
  for (const value of values) {
    if (!value) continue;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts > latestTs) {
      latestTs = ts;
      latest = value;
    }
  }
  return latest;
}

export function sourceLabel(code: string | null | undefined): string {
  return appCodeLabel(code);
}

export function unwrapSettled<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
  warnings: string[],
): T {
  if (result.status === "fulfilled") return result.value;
  warnings.push(`${label} 加载失败：${result.reason instanceof Error ? result.reason.message : "未知错误"}`);
  return fallback;
}
