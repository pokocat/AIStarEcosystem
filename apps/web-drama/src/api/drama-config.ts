// ─────────────────────────────────────────────────────────────────────────────
// api/drama-config.ts — 短剧个性化配置（v0.66）。
// 真值在 server PlatformConfig（admin「短剧专区」可改）：扣费确认阈值 + 各 AI 动作单价。
// 模块级缓存：一次会话只拉一次；USE_MOCK=1 返回默认值（与 server seeder 默认一致）。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export interface DramaCreditPrices {
  outlineTrial: number;
  outlineFull: number;
  epscript: number;
  splitScene: number;
  cast: number;
  frame: number;
  clip: number;
  /** v0.97 P2：镜头分解（首/末帧 + 运动 + 变化等级）单次积分。 */
  decompose: number;
  /** v0.97 P5：行级就地改写本镜单次积分。 */
  shotRewrite: number;
  /** v0.78：进短视频工作台开拍（新建草稿 = AI 出口播脚本与分镜）单次积分。 */
  shortEntry: number;
  /** v0.197：互动剧 AI 起草分支图单次积分（服务端 KEY_INTERACTIVE_DRAFT，默认 18）。 */
  interactiveDraft: number;
  /** v0.198 画布：由想法写故事大纲（默认 2）。 */
  canvasScriptSetting: number;
  /** v0.198 画布：由故事大纲写 N 集分集剧情（默认 6）。 */
  canvasScriptOutline: number;
  /** v0.198 画布：写（或重写）一集剧本（默认 4，按集计）。 */
  canvasScriptEpisode: number;
  /** v0.198 画布：从分集剧本拆出角色和场景（默认 4）。 */
  canvasExtract: number;
  /** v0.198 画布：生成一集的分镜脚本（默认 4，按集计）。 */
  canvasStoryboard: number;
}

export interface DramaCreditConfig {
  /** 消耗 ≥ 该值才弹确认框；小额免打扰直接执行 */
  confirmThreshold: number;
  prices: DramaCreditPrices;
}

export const DRAMA_CONFIG_DEFAULTS: DramaCreditConfig = {
  confirmThreshold: 10,
  prices: {
    outlineTrial: 6,
    outlineFull: 18,
    epscript: 10,
    splitScene: 6,
    cast: 5,
    frame: 2,
    clip: 30,
    decompose: 3,
    shotRewrite: 2,
    shortEntry: 10,
    interactiveDraft: 18,
    canvasScriptSetting: 2,
    canvasScriptOutline: 6,
    canvasScriptEpisode: 4,
    canvasExtract: 4,
    canvasStoryboard: 4,
  },
};

/** 服务端少给了某个单价（如新字段上线前的旧版本）时按默认值补齐，确认框里不会出现「undefined 积分」。
 *  只用于展示报价，真实扣费以服务端为准。 */
function withDefaults(c: Partial<DramaCreditConfig> | null | undefined): DramaCreditConfig {
  const prices = { ...DRAMA_CONFIG_DEFAULTS.prices };
  for (const k of Object.keys(prices) as (keyof DramaCreditPrices)[]) {
    const v = c?.prices?.[k];
    if (typeof v === "number" && Number.isFinite(v)) prices[k] = v;
  }
  const t = c?.confirmThreshold;
  return {
    confirmThreshold: typeof t === "number" && Number.isFinite(t) ? t : DRAMA_CONFIG_DEFAULTS.confirmThreshold,
    prices,
  };
}

let cache: Promise<DramaCreditConfig> | null = null;

export function getDramaConfig(): Promise<DramaCreditConfig> {
  if (!cache) {
    cache = (USE_MOCK
      ? mockDelay(DRAMA_CONFIG_DEFAULTS, 80)
      : apiFetch<DramaCreditConfig>("/me/drama/config").then(withDefaults)
    ).catch((e) => {
      cache = null; // 失败不缓存，下次重试
      throw e;
    });
  }
  return cache;
}

/** admin 改完配置后强制重新拉取（一般用不到，留给调试）。 */
export function invalidateDramaConfig(): void {
  cache = null;
}
