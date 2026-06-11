// ─────────────────────────────────────────────────────────────────────────────
// star-workbench.ts — 明星商务工作台（web-star，第五子应用）域类型。
// 前端 TS 是契约真源；apps/server 的 Star*Dto.java 字段名必须与本文件 1:1 对齐。
//
// 业务：明星本人 / 经纪团队的审核与运营中枢 —— IP 资产托管、授权审核（报白 /
// 数字人 / AI 形象 / 带货授权）、内容把关、商品准入（6 步入库）、品牌合作、
// 收益结算、规则配置、侵权巡查、合同管理。
//
// 数值字段一律存原始整数（fans / priceCents / amountCents / durationSec…），
// 格式化在展示层（§4.5 硬规则）。状态机字符串与 Figma 原型保持 camelCase。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate, ISODateTime } from "./_shared";

// ── 通用 ─────────────────────────────────────────────────────────────────────

/** 短视频平台（报白 / 内容审核共用） */
export type StarPlatformName = "抖音" | "视频号" | "快手" | "小红书";

/** 风险分区（内容规则 / 审核分级统一语言） */
export type StarRiskZone = "green" | "yellow" | "orange" | "red";

/** 寄样状态（商品入库 / 品牌授权双路寄样共用） */
export type StarSampleStatus = "notSent" | "shipping" | "delivered" | "approved" | "rejected";

// ── 明星档案（工作台身份） ───────────────────────────────────────────────────

/**
 * 当前登录账号绑定的明星档案。
 * starId 即 celebrity 域 CelebrityStar.id —— 入驻后同一行数据在
 * web-celebrity 明星市场可见，这是两个子应用打通的根基。
 */
export interface StarProfile {
  starId: ID;
  name: string;
  avatar: string;
  category: string;          // 演员 / 歌手 / 主持人 / 运动员 / 网红 / 综艺
  tierLabel: string;         // 艺人分级展示，如 "S级"
  fans: number;              // 粉丝数（原始整数，展示层 formatCompactNumber）
  agentView: boolean;        // true = 经纪人视角（账号 role=agent）
  listedAt?: ISODateTime;    // 入驻（在 celebrity 市场可见）时间
}

/** 入驻申请（明星首次开通工作台 → 同步创建 celebrity 市场档案） */
export interface StarOnboardInput {
  name: string;
  category: string;
  description: string;       // 一句话定位（celebrity 市场卡片文案）
  bio?: string;              // 详情页长简介
  location?: string;
  fans: number;
  startingPriceCents: number; // 起价（分），celebrity 市场展示 "¥299起"
  agentView?: boolean;
}

// ── 总览 ─────────────────────────────────────────────────────────────────────

export interface StarOverview {
  ipActiveCount: number;       // 已激活 IP 资产数
  ipTotalCount: number;        // IP 资产总数（4 类）
  pendingTotal: number;        // 跨模块待办总数
  productLibraryCount: number; // 商品库可带货数量
  activeBrandDeals: number;    // 已激活品牌合作数
  monthGmvCents: number;       // 本月 GMV（分）
  monthGmvDeltaPercent: number; // GMV 环比（%）
  monthRevenueCents: number;   // 本月分成收益（分）
  pendingByModule: StarPendingModule[];
}

export interface StarPendingModule {
  module: "ipAuth" | "cooperation" | "whitelist" | "digitalHuman" | "aiLikeness" | "contentReview" | "productOnboard" | "brandAuth";
  count: number;
}

// ── IP 授权中心（4 类资产 × 6 状态机） ──────────────────────────────────────

export type StarIpAssetType = "portrait" | "clip" | "digitalHuman" | "documents";

/** notStarted → preparing → uploaded → techReceived → volcanoSync → active */
export type StarIpAssetStatus = "notStarted" | "preparing" | "uploaded" | "techReceived" | "volcanoSync" | "active";

export interface StarIpAsset {
  id: ID;
  type: StarIpAssetType;
  status: StarIpAssetStatus;
  techCompany: string;          // 对接技术公司
  volcanoProjectId?: string;    // 火山引擎项目号（techReceived 后回执）
  filesCount: number;
  requiredFiles: number;
  uploadedAt?: ISODate;
  activatedAt?: ISODate;
  note?: string;
}

// ── 带货授权（celebrity 子应用 → 明星端，跨应用打通核心） ────────────────────

/**
 * web-celebrity 创作者对本明星发起的 AI 复刻带货授权申请。
 * 后端即 celebrity 域 CelebrityStarAuthorization（status=pending 进入待审）。
 */
export interface StarCooperationRequest {
  id: ID;
  applicantUserId: ID;
  applicantName: string;       // 申请方工作室 / 创作者名称
  scenes: string[];            // 申请场景：带货 / 种草 / 测评
  note?: string;               // 申请留言
  status: "pending" | "authorized" | "unauthorized" | "expired";
  requestedAt: ISODateTime;
  decidedAt?: ISODateTime;
  expireDate?: ISODate;        // 批准后授权到期日
  availableStyles?: number;    // 批准后开放的风格数
}

export interface StarCooperationDecision {
  scenes?: string[];           // 批准时最终授权场景（默认沿用申请值）
  expireMonths?: number;       // 批准时授权时长（月），默认 6
  availableStyles?: number;    // 批准时开放风格数，默认 4
  reason?: string;             // 驳回理由（驳回时必填）
}

// ── 账号报白（5 步流程） ─────────────────────────────────────────────────────

export type StarWhitelistStatus = "pending" | "approved" | "rejected" | "info_required";

/** received → contacting → sms → processing → authorized */
export type StarWhitelistStep = "received" | "contacting" | "sms" | "processing" | "authorized";

export interface StarWhitelistRequest {
  id: ID;
  mcnName: string;
  accountHandle: string;       // @neon_v_official
  accountId: string;
  phone: string;               // 已脱敏：138****8812
  uid: string;
  platform: StarPlatformName;
  fans: number;
  accountAgeMonths: number;
  mcnLevel: string;            // 金牌 / 银牌 / 钻石
  requestedAt: ISODateTime;
  status: StarWhitelistStatus;
  whitelistStep: StarWhitelistStep;
  message?: string;
  recentVideos: number;        // 近 30 天视频数
  avgViews: number;            // 平均播放（原始整数）
  creditScore: number;         // 信用分 0-100
}

// ── 数字人授权 ───────────────────────────────────────────────────────────────

export type StarDigitalHumanUsage = "live" | "shortVideo" | "ads";
export type StarReviewStatus = "pending" | "approved" | "rejected";

export interface StarDigitalHumanRequest {
  id: ID;
  mcnName: string;
  usageType: StarDigitalHumanUsage;
  platforms: string[];
  purpose: string;
  durationMonths: number;
  requestedAt: ISODateTime;
  status: StarReviewStatus;
  riskNote?: string;
}

// ── AI 形象授权 ──────────────────────────────────────────────────────────────

export type StarAiModelType = "voice" | "face" | "fullBody";
export type StarRiskLevel = "low" | "medium" | "high";

export interface StarAiLikenessRequest {
  id: ID;
  mcnName: string;
  modelType: StarAiModelType;
  riskLevel: StarRiskLevel;
  platforms: string[];
  purpose: string;
  requestedAt: ISODateTime;
  status: StarReviewStatus;
  aiVendor: string;            // AI 厂商（ElevenLabs 等）
}

// ── 内容审核 ─────────────────────────────────────────────────────────────────

export type StarContentType = "clip" | "digitalHuman" | "aiLikeness";
export type StarContentStatus = "pending" | "approved" | "revision" | "rejected";

export interface StarContentReview {
  id: ID;
  title: string;
  type: StarContentType;
  uploader: string;            // @handle
  mcnName: string;
  durationSec: number;
  submittedAt: ISODateTime;
  status: StarContentStatus;
  platform: StarPlatformName;
  views?: number;              // 已发布内容的播放量
  revisionNote?: string;       // 要求修改时的意见
}

// ── 商品入库（6 步流程 + 双路寄样） ──────────────────────────────────────────

/** platform=平台严选 creator=达人选品（celebrity 报备） brand=品牌直供 */
export type StarProductSource = "platform" | "creator" | "brand";

/**
 * step: 0=已提交 1=平台初审 2=明星审核 3=样品寄送 4=样品确认 5=已入库 6=已驳回。
 * productId 关联 celebrity 公共商品池（products 表）—— creator 报备时必填，
 * 这是「celebrity 商品源 ↔ 明星端商品」打通的外键。
 */
export interface StarProductOnboard {
  id: ID;
  productId?: ID;
  productName: string;
  brand: string;
  category: string;
  priceCents: number;
  source: StarProductSource;
  submittedBy: string;
  mcnName?: string;
  step: number;
  platformSample: StarSampleStatus;
  celebSample: StarSampleStatus;
  submittedAt: ISODateTime;
  trackingPlatform?: string;   // 平台路样品快递单号
  trackingCeleb?: string;      // 明星路样品快递单号
  platformNote?: string;
}

/** 商品库条目（已入库可带货，由 step=5 的入库单派生） */
export interface StarProductLibItem {
  id: ID;
  productId?: ID;
  productName: string;
  brand: string;
  category: string;
  approvedAt: ISODate;
  priceCents: number;
  mcnName: string;
  salesCount: number;
}

// ── 品牌授权 ─────────────────────────────────────────────────────────────────

export type StarBrandAuthStatus = "pending" | "platformReview" | "celebReview" | "sampleStage" | "approved" | "rejected";

export interface StarBrandAuthRequest {
  id: ID;
  brandName: string;
  authTypes: string[];         // 人像授权 / 代言授权 / 联名授权 / AI声音授权…
  purpose: string;
  durationMonths: number;
  amountCents: number;         // 合同金额（分）
  platforms: string[];
  status: StarBrandAuthStatus;
  platformSample: StarSampleStatus;
  celebSample: StarSampleStatus;
  submittedAt: ISODateTime;
  platformNote?: string;
}

// ── 收益分成 ─────────────────────────────────────────────────────────────────

export interface StarRevenueMonth {
  id: ID;
  month: string;               // "2026-05"
  gmvCents: number;
  sharePercent: number;        // 分成比例（0-100 整数）
  amountCents: number;         // 应得分成（分）
  status: "processing" | "paid";
}

export interface StarRevenueSummary {
  totalGmvCents: number;
  monthGmvCents: number;
  pendingAmountCents: number;  // 待结算
  paidAmountCents: number;     // 已结算
  months: StarRevenueMonth[];  // 按月明细（含趋势图数据，月份升序）
}

// ── 内容规则 ─────────────────────────────────────────────────────────────────

export interface StarContentRule {
  id: ID;
  name: string;
  zone: StarRiskZone;
  enabled: boolean;
  description: string;
}

// ── 侵权巡查 ─────────────────────────────────────────────────────────────────

export type StarInfringementSeverity = "high" | "medium" | "low";
export type StarInfringementStatus = "pending" | "investigating" | "confirmed" | "resolved";

export interface StarInfringementCase {
  id: ID;
  platform: string;            // 全网平台（YouTube / Bilibili / 抖音…）
  url: string;
  ipName: string;              // 被侵权 IP 名（声线 / 形象）
  severity: StarInfringementSeverity;
  status: StarInfringementStatus;
  reportedBy: string;          // 粉丝举报 / 自动监测 / 用户投诉
  reportedAt: ISODateTime;
  description: string;
  actionNote?: string;         // 处置备注
}

export type StarInfringementAction = "investigate" | "confirm" | "resolve" | "dismiss";

// ── 合同中心 ─────────────────────────────────────────────────────────────────

export type StarContractType = "authorization" | "amendment" | "settlement";
export type StarContractStatus = "active" | "expired" | "pending" | "terminated";

export interface StarContract {
  id: ID;
  title: string;
  type: StarContractType;
  mcnName: string;
  ipName: string;
  signDate: ISODate;
  startDate: ISODate;
  endDate: ISODate;
  amountCents: number;
  status: StarContractStatus;
}

// ── celebrity 端商品报备（web-celebrity 调用） ───────────────────────────────

/** celebrity 创作者把公共商品池商品报备给某明星后的回执 / 状态视图 */
export interface StarProductFiling {
  id: ID;                      // 即 StarProductOnboard.id
  productId: ID;
  starId: ID;
  starName: string;
  step: number;                // 同 StarProductOnboard.step
  stepLabel: string;           // 服务端给出的当前节点中文名（展示用）
  submittedAt: ISODateTime;
}

export interface StarProductFilingInput {
  starId: ID;
}
