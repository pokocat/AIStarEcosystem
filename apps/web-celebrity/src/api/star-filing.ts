// ─────────────────────────────────────────────────────────────────────────────
// api/star-filing.ts — 商品报备（v0.60 · web-star 打通）。
// 把公共商品池商品报备给已授权明星 → 明星商务工作台「商品入库」6 步流程；
// 本端可回查报备单流转状态（已提交 → 平台初审 → 明星审核 → 寄样 → 入库）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, StarProductFiling } from "@ai-star-eco/types";
import { apiFetch, USE_MOCK, mockDelay, buildQuery } from "./_client";
import { MARKET_STARS } from "@/mocks/celebrity-zone";

// mock 模式：内存报备单（页面会话内联动）
let mockFilings: StarProductFiling[] = [];

/** 把商品报备给明星（重复报备同一明星会被后端 409 拒绝）。 */
export async function fileProductToStar(productId: ID, starId: ID): Promise<StarProductFiling> {
  if (USE_MOCK) {
    const exists = mockFilings.find(
      (f) => f.productId === productId && f.starId === starId && f.step !== 6,
    );
    if (exists) {
      throw new Error("该商品已报备给这位明星，请勿重复报备");
    }
    const star = MARKET_STARS.find((s) => s.id === starId);
    const filing: StarProductFiling = {
      id: `po-mock-${Date.now()}`,
      productId,
      starId,
      starName: star?.name ?? starId,
      step: 2,
      stepLabel: "明星审核",
      submittedAt: new Date().toISOString(),
    };
    mockFilings = [filing, ...mockFilings];
    return mockDelay(filing);
  }
  return apiFetch<StarProductFiling>(`/me/celebrity/products/${productId}/star-filings`, {
    method: "POST",
    body: { starId },
  });
}

/** 我的报备单（可按商品 / 明星过滤）。 */
export async function listStarFilings(filter?: { productId?: ID; starId?: ID }): Promise<StarProductFiling[]> {
  if (USE_MOCK) {
    return mockDelay(
      mockFilings
        .filter((f) => !filter?.productId || f.productId === filter.productId)
        .filter((f) => !filter?.starId || f.starId === filter.starId),
    );
  }
  const qs = buildQuery({ productId: filter?.productId, starId: filter?.starId });
  return apiFetch<StarProductFiling[]>(`/me/celebrity/star-filings${qs}`);
}
