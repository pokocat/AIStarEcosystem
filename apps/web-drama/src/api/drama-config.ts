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
  },
};

let cache: Promise<DramaCreditConfig> | null = null;

export function getDramaConfig(): Promise<DramaCreditConfig> {
  if (!cache) {
    cache = (USE_MOCK
      ? mockDelay(DRAMA_CONFIG_DEFAULTS, 80)
      : apiFetch<DramaCreditConfig>("/me/drama/config")
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
