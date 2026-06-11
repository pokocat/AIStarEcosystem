// ─────────────────────────────────────────────────────────────────────────────
// api/star-workbench.ts — 明星商务工作台 API 调用层。
// USE_MOCK=1 → 内存 store（状态机操作真实生效，页面联动）；
// USE_MOCK=0 → apiFetch → Next rewrites → Spring Boot /api/star/*。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  StarBrandAuthRequest, StarContentReview, StarContentRule, StarContract,
  StarCooperationDecision, StarCooperationRequest, StarDigitalHumanRequest,
  StarInfringementAction, StarInfringementCase, StarIpAsset, StarIpAssetType,
  StarAiLikenessRequest, StarOnboardInput, StarOverview, StarProductLibItem,
  StarProductOnboard, StarProfile, StarRevenueSummary, StarSampleStatus,
  StarWhitelistRequest, StarWhitelistStep,
} from "@ai-star-eco/types";
import { apiFetch, USE_MOCK, mockDelay, buildQuery } from "./_client";
import { computeMockOverview, mockStore } from "@/mocks/star-workbench";

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

// ── 档案 / 入驻 ──────────────────────────────────────────────────────────────

export async function getProfile(): Promise<StarProfile | null> {
  if (USE_MOCK) {
    return mockDelay(mockStore().profile);
  }
  return apiFetch<StarProfile | null>("/star/profile");
}

export async function onboard(input: StarOnboardInput): Promise<StarProfile> {
  if (USE_MOCK) {
    const s = mockStore();
    s.profile = {
      starId: `star-mock-${Date.now()}`,
      name: input.name,
      avatar: `https://picsum.photos/seed/${encodeURIComponent(input.name)}/200/200`,
      category: input.category,
      tierLabel: "新晋",
      fans: input.fans,
      agentView: input.agentView ?? false,
      listedAt: nowIso(),
    };
    return mockDelay(s.profile);
  }
  return apiFetch<StarProfile>("/star/onboard", { method: "POST", body: input });
}

// ── 总览 ─────────────────────────────────────────────────────────────────────

export async function getOverview(): Promise<StarOverview> {
  if (USE_MOCK) {
    return mockDelay(computeMockOverview());
  }
  return apiFetch<StarOverview>("/star/overview");
}

// ── IP 授权中心 ──────────────────────────────────────────────────────────────

export async function listIpAssets(): Promise<StarIpAsset[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().ipAssets]);
  }
  return apiFetch<StarIpAsset[]>("/star/ip-assets");
}

export async function advanceIpAsset(type: StarIpAssetType): Promise<StarIpAsset> {
  if (USE_MOCK) {
    const s = mockStore();
    const asset = s.ipAssets.find((a) => a.type === type);
    if (!asset) throw new Error("IP 资产不存在");
    const order = ["notStarted", "preparing", "uploaded", "techReceived", "volcanoSync", "active"] as const;
    const idx = order.indexOf(asset.status);
    const next = order[Math.min(idx + 1, order.length - 1)];
    asset.status = next;
    if (next === "uploaded" && !asset.uploadedAt) asset.uploadedAt = today();
    if (next === "active" && !asset.activatedAt) asset.activatedAt = today();
    return mockDelay({ ...asset });
  }
  return apiFetch<StarIpAsset>(`/star/ip-assets/${type}/advance`, { method: "POST" });
}

// ── 带货授权（celebrity → 明星端审批） ───────────────────────────────────────

export async function listCooperations(status?: string): Promise<StarCooperationRequest[]> {
  if (USE_MOCK) {
    const all = [...mockStore().cooperations];
    return mockDelay(status ? all.filter((c) => c.status === status) : all);
  }
  const qs = buildQuery({ status });
  return apiFetch<StarCooperationRequest[]>(`/star/cooperations${qs}`);
}

export async function approveCooperation(id: string, decision: StarCooperationDecision): Promise<StarCooperationRequest> {
  if (USE_MOCK) {
    const s = mockStore();
    const req = s.cooperations.find((c) => c.id === id);
    if (!req) throw new Error("授权申请不存在");
    req.status = "authorized";
    req.decidedAt = nowIso();
    req.scenes = decision.scenes?.length ? decision.scenes : req.scenes;
    const months = decision.expireMonths ?? 6;
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    req.expireDate = d.toISOString().slice(0, 10);
    req.availableStyles = decision.availableStyles ?? 4;
    return mockDelay({ ...req });
  }
  return apiFetch<StarCooperationRequest>(`/star/cooperations/${id}/approve`, { method: "POST", body: decision });
}

export async function rejectCooperation(id: string, reason?: string): Promise<StarCooperationRequest> {
  if (USE_MOCK) {
    const s = mockStore();
    const req = s.cooperations.find((c) => c.id === id);
    if (!req) throw new Error("授权申请不存在");
    req.status = "unauthorized";
    req.decidedAt = nowIso();
    req.note = reason || req.note;
    return mockDelay({ ...req });
  }
  return apiFetch<StarCooperationRequest>(`/star/cooperations/${id}/reject`, { method: "POST", body: { reason } });
}

// ── 报白账号 ─────────────────────────────────────────────────────────────────

export async function listWhitelistRequests(): Promise<StarWhitelistRequest[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().whitelist]);
  }
  return apiFetch<StarWhitelistRequest[]>("/star/whitelist-requests");
}

export async function advanceWhitelistRequest(id: string): Promise<StarWhitelistRequest> {
  if (USE_MOCK) {
    const s = mockStore();
    const req = s.whitelist.find((r) => r.id === id);
    if (!req) throw new Error("报白申请不存在");
    const order: StarWhitelistStep[] = ["received", "contacting", "sms", "processing", "authorized"];
    const next = order[Math.min(order.indexOf(req.whitelistStep) + 1, order.length - 1)];
    req.whitelistStep = next;
    if (next === "authorized") req.status = "approved";
    return mockDelay({ ...req });
  }
  return apiFetch<StarWhitelistRequest>(`/star/whitelist-requests/${id}/advance`, { method: "POST" });
}

export async function rejectWhitelistRequest(id: string): Promise<StarWhitelistRequest> {
  if (USE_MOCK) {
    const s = mockStore();
    const req = s.whitelist.find((r) => r.id === id);
    if (!req) throw new Error("报白申请不存在");
    req.status = "rejected";
    return mockDelay({ ...req });
  }
  return apiFetch<StarWhitelistRequest>(`/star/whitelist-requests/${id}/reject`, { method: "POST" });
}

// ── 数字人授权 ───────────────────────────────────────────────────────────────

export async function listDigitalHumanRequests(): Promise<StarDigitalHumanRequest[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().dhRequests]);
  }
  return apiFetch<StarDigitalHumanRequest[]>("/star/digital-human-requests");
}

export async function approveDigitalHuman(id: string): Promise<StarDigitalHumanRequest> {
  if (USE_MOCK) {
    const req = mockStore().dhRequests.find((r) => r.id === id);
    if (!req) throw new Error("数字人申请不存在");
    req.status = "approved";
    return mockDelay({ ...req });
  }
  return apiFetch<StarDigitalHumanRequest>(`/star/digital-human-requests/${id}/approve`, { method: "POST" });
}

export async function rejectDigitalHuman(id: string): Promise<StarDigitalHumanRequest> {
  if (USE_MOCK) {
    const req = mockStore().dhRequests.find((r) => r.id === id);
    if (!req) throw new Error("数字人申请不存在");
    req.status = "rejected";
    return mockDelay({ ...req });
  }
  return apiFetch<StarDigitalHumanRequest>(`/star/digital-human-requests/${id}/reject`, { method: "POST" });
}

// ── AI 形象授权 ──────────────────────────────────────────────────────────────

export async function listAiLikenessRequests(): Promise<StarAiLikenessRequest[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().aiRequests]);
  }
  return apiFetch<StarAiLikenessRequest[]>("/star/ai-likeness-requests");
}

export async function approveAiLikeness(id: string): Promise<StarAiLikenessRequest> {
  if (USE_MOCK) {
    const req = mockStore().aiRequests.find((r) => r.id === id);
    if (!req) throw new Error("AI形象申请不存在");
    req.status = "approved";
    return mockDelay({ ...req });
  }
  return apiFetch<StarAiLikenessRequest>(`/star/ai-likeness-requests/${id}/approve`, { method: "POST" });
}

export async function rejectAiLikeness(id: string): Promise<StarAiLikenessRequest> {
  if (USE_MOCK) {
    const req = mockStore().aiRequests.find((r) => r.id === id);
    if (!req) throw new Error("AI形象申请不存在");
    req.status = "rejected";
    return mockDelay({ ...req });
  }
  return apiFetch<StarAiLikenessRequest>(`/star/ai-likeness-requests/${id}/reject`, { method: "POST" });
}

// ── 内容审核 ─────────────────────────────────────────────────────────────────

export async function listContentReviews(): Promise<StarContentReview[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().contentReviews]);
  }
  return apiFetch<StarContentReview[]>("/star/content-reviews");
}

export async function approveContent(id: string): Promise<StarContentReview> {
  if (USE_MOCK) {
    const item = mockStore().contentReviews.find((r) => r.id === id);
    if (!item) throw new Error("内容不存在");
    item.status = "approved";
    return mockDelay({ ...item });
  }
  return apiFetch<StarContentReview>(`/star/content-reviews/${id}/approve`, { method: "POST" });
}

export async function reviseContent(id: string, note?: string): Promise<StarContentReview> {
  if (USE_MOCK) {
    const item = mockStore().contentReviews.find((r) => r.id === id);
    if (!item) throw new Error("内容不存在");
    item.status = "revision";
    item.revisionNote = note || "请按授权规则调整后重新提交";
    return mockDelay({ ...item });
  }
  return apiFetch<StarContentReview>(`/star/content-reviews/${id}/revision`, { method: "POST", body: { note } });
}

export async function rejectContent(id: string): Promise<StarContentReview> {
  if (USE_MOCK) {
    const item = mockStore().contentReviews.find((r) => r.id === id);
    if (!item) throw new Error("内容不存在");
    item.status = "rejected";
    return mockDelay({ ...item });
  }
  return apiFetch<StarContentReview>(`/star/content-reviews/${id}/reject`, { method: "POST" });
}

// ── 商品入库 ─────────────────────────────────────────────────────────────────

export async function listProductOnboards(): Promise<StarProductOnboard[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().productOnboards]);
  }
  return apiFetch<StarProductOnboard[]>("/star/product-onboards");
}

/** 明星审核通过（step 2 → 3）：开始双路寄样。 */
export async function approveProductOnboard(id: string): Promise<StarProductOnboard> {
  if (USE_MOCK) {
    const item = mockStore().productOnboards.find((p) => p.id === id);
    if (!item) throw new Error("入库单不存在");
    if (item.step === 2) {
      item.step = 3;
      if (item.platformSample === "notSent") item.platformSample = "approved";
      if (item.celebSample === "notSent") {
        item.celebSample = "shipping";
        item.trackingCeleb = `SF${Math.floor(Math.random() * 9_000_000_000 + 1_000_000_000)}`;
      }
    }
    return mockDelay({ ...item });
  }
  return apiFetch<StarProductOnboard>(`/star/product-onboards/${id}/approve`, { method: "POST" });
}

export async function rejectProductOnboard(id: string): Promise<StarProductOnboard> {
  if (USE_MOCK) {
    const item = mockStore().productOnboards.find((p) => p.id === id);
    if (!item) throw new Error("入库单不存在");
    item.step = 6;
    return mockDelay({ ...item });
  }
  return apiFetch<StarProductOnboard>(`/star/product-onboards/${id}/reject`, { method: "POST" });
}

/** 明星样品签收（shipping → delivered；step 3 → 4）。 */
export async function receiveProductSample(id: string): Promise<StarProductOnboard> {
  if (USE_MOCK) {
    const item = mockStore().productOnboards.find((p) => p.id === id);
    if (!item) throw new Error("入库单不存在");
    if (item.celebSample === "shipping") item.celebSample = "delivered";
    if (item.step === 3) item.step = 4;
    return mockDelay({ ...item });
  }
  return apiFetch<StarProductOnboard>(`/star/product-onboards/${id}/receive-sample`, { method: "POST" });
}

/** 明星样品确认（delivered → approved；双路通过 → step 5 入库）。 */
export async function confirmProductSample(id: string): Promise<StarProductOnboard> {
  if (USE_MOCK) {
    const s = mockStore();
    const item = s.productOnboards.find((p) => p.id === id);
    if (!item) throw new Error("入库单不存在");
    item.celebSample = "approved";
    if (item.platformSample === "approved") {
      item.step = 5;
      s.productLib.unshift({
        id: `pl-${item.id}`,
        productId: item.productId,
        productName: item.productName,
        brand: item.brand,
        category: item.category,
        approvedAt: today(),
        priceCents: item.priceCents,
        mcnName: item.mcnName ?? item.submittedBy,
        salesCount: 0,
      });
    }
    return mockDelay({ ...item });
  }
  return apiFetch<StarProductOnboard>(`/star/product-onboards/${id}/confirm-sample`, { method: "POST" });
}

// ── 商品库 ───────────────────────────────────────────────────────────────────

export async function listProductLibrary(): Promise<StarProductLibItem[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().productLib]);
  }
  return apiFetch<StarProductLibItem[]>("/star/product-library");
}

// ── 品牌授权 ─────────────────────────────────────────────────────────────────

export async function listBrandAuths(): Promise<StarBrandAuthRequest[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().brandAuths]);
  }
  return apiFetch<StarBrandAuthRequest[]>("/star/brand-auths");
}

/** 明星批准（celebReview → sampleStage）：进入寄样验收。 */
export async function approveBrandAuth(id: string): Promise<StarBrandAuthRequest> {
  if (USE_MOCK) {
    const item = mockStore().brandAuths.find((b) => b.id === id);
    if (!item) throw new Error("品牌授权不存在");
    if (item.status === "celebReview") {
      item.status = "sampleStage";
      if (item.celebSample === "notSent") item.celebSample = "shipping";
    }
    return mockDelay({ ...item });
  }
  return apiFetch<StarBrandAuthRequest>(`/star/brand-auths/${id}/approve`, { method: "POST" });
}

export async function rejectBrandAuth(id: string): Promise<StarBrandAuthRequest> {
  if (USE_MOCK) {
    const item = mockStore().brandAuths.find((b) => b.id === id);
    if (!item) throw new Error("品牌授权不存在");
    item.status = "rejected";
    return mockDelay({ ...item });
  }
  return apiFetch<StarBrandAuthRequest>(`/star/brand-auths/${id}/reject`, { method: "POST" });
}

export async function receiveBrandSample(id: string): Promise<StarBrandAuthRequest> {
  if (USE_MOCK) {
    const item = mockStore().brandAuths.find((b) => b.id === id);
    if (!item) throw new Error("品牌授权不存在");
    if (item.celebSample === "shipping") item.celebSample = "delivered";
    return mockDelay({ ...item });
  }
  return apiFetch<StarBrandAuthRequest>(`/star/brand-auths/${id}/receive-sample`, { method: "POST" });
}

/** 样品确认（双路通过 → 授权激活 approved）。 */
export async function confirmBrandSample(id: string): Promise<StarBrandAuthRequest> {
  if (USE_MOCK) {
    const item = mockStore().brandAuths.find((b) => b.id === id);
    if (!item) throw new Error("品牌授权不存在");
    item.celebSample = "approved";
    if (item.platformSample === "approved") item.status = "approved";
    return mockDelay({ ...item });
  }
  return apiFetch<StarBrandAuthRequest>(`/star/brand-auths/${id}/confirm-sample`, { method: "POST" });
}

// ── 收益分成 ─────────────────────────────────────────────────────────────────

export async function getRevenue(): Promise<StarRevenueSummary> {
  if (USE_MOCK) {
    return mockDelay(JSON.parse(JSON.stringify(mockStore().revenue)) as StarRevenueSummary);
  }
  return apiFetch<StarRevenueSummary>("/star/revenue");
}

// ── 内容规则 ─────────────────────────────────────────────────────────────────

export async function listContentRules(): Promise<StarContentRule[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().rules]);
  }
  return apiFetch<StarContentRule[]>("/star/content-rules");
}

export async function toggleContentRule(id: string): Promise<StarContentRule> {
  if (USE_MOCK) {
    const rule = mockStore().rules.find((r) => r.id === id);
    if (!rule) throw new Error("规则不存在");
    rule.enabled = !rule.enabled;
    return mockDelay({ ...rule });
  }
  return apiFetch<StarContentRule>(`/star/content-rules/${id}/toggle`, { method: "POST" });
}

// ── 侵权巡查 ─────────────────────────────────────────────────────────────────

export async function listInfringements(): Promise<StarInfringementCase[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().infringements]);
  }
  return apiFetch<StarInfringementCase[]>("/star/infringements");
}

export async function transitionInfringement(
  id: string,
  action: StarInfringementAction,
  note?: string,
): Promise<StarInfringementCase> {
  if (USE_MOCK) {
    const item = mockStore().infringements.find((c) => c.id === id);
    if (!item) throw new Error("侵权案例不存在");
    if (action === "investigate") item.status = "investigating";
    if (action === "confirm") item.status = "confirmed";
    if (action === "resolve") item.status = "resolved";
    if (action === "dismiss") {
      item.status = "resolved";
      item.actionNote = note || "经核实为误报，已驳回";
    }
    if (note) item.actionNote = note;
    return mockDelay({ ...item });
  }
  return apiFetch<StarInfringementCase>(`/star/infringements/${id}/transition`, { method: "POST", body: { action, note } });
}

// ── 合同中心 ─────────────────────────────────────────────────────────────────

export async function listContracts(): Promise<StarContract[]> {
  if (USE_MOCK) {
    return mockDelay([...mockStore().contracts]);
  }
  return apiFetch<StarContract[]>("/star/contracts");
}

export type { StarSampleStatus };
