// ─────────────────────────────────────────────────────────────────────────────
// constants/star-ui.ts — 明星商务工作台 UI 配置（图标 / 颜色 / 文案）。
// 浅色主题：模块 accent 彩色保留原型 500 系 hex，文本/背景由组件按
// `${color}` / `${color}14` 透明度派生（白底 pastel）。
// ─────────────────────────────────────────────────────────────────────────────

import {
  AlertCircle, BadgeCheck, Bot, Building2, Camera, CheckCheck, CheckCircle2,
  Clock, CloudUpload, Coins, Database, FileText, Film, Filter, Handshake, Key,
  Layers, LayoutDashboard, Lock, Package, Scissors, Server, Shield, Sparkles,
  Truck, Upload, XCircle, Zap, type LucideIcon,
} from "lucide-react";
import type {
  StarBrandAuthStatus, StarContentStatus, StarContentType, StarContractStatus,
  StarContractType, StarDigitalHumanUsage, StarInfringementSeverity,
  StarInfringementStatus, StarIpAssetStatus, StarIpAssetType, StarAiModelType,
  StarPlatformName, StarProductSource, StarRiskLevel, StarRiskZone,
  StarSampleStatus, StarWhitelistStatus, StarWhitelistStep,
} from "@ai-star-eco/types";

// ── 导航 ─────────────────────────────────────────────────────────────────────

export interface StarNavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
  /** 待办 badge 的取数 key（StarOverview.pendingByModule.module） */
  badgeKey?: string;
}

export interface StarNavGroup {
  label: string;
  items: StarNavItem[];
}

export const STAR_NAV_GROUPS: StarNavGroup[] = [
  {
    label: "IP授权",
    items: [
      { id: "overview", href: "/dashboard", label: "工作台总览", icon: LayoutDashboard, color: "#f59e0b" },
      { id: "ipAuth", href: "/ip-auth", label: "IP授权中心", icon: Key, color: "#6366f1", badgeKey: "ipAuth" },
    ],
  },
  {
    label: "账号授权",
    items: [
      { id: "cooperation", href: "/cooperation", label: "带货授权", icon: Handshake, color: "#f43f5e", badgeKey: "cooperation" },
      { id: "whitelist", href: "/whitelist", label: "报白账号", icon: BadgeCheck, color: "#06b6d4", badgeKey: "whitelist" },
      { id: "digitalHuman", href: "/digital-human", label: "数字人授权", icon: Bot, color: "#a855f7", badgeKey: "digitalHuman" },
      { id: "aiLikeness", href: "/ai-likeness", label: "AI形象授权", icon: Sparkles, color: "#ec4899", badgeKey: "aiLikeness" },
    ],
  },
  {
    label: "内容管理",
    items: [
      { id: "contentReview", href: "/content-review", label: "内容审核", icon: Film, color: "#f97316", badgeKey: "contentReview" },
    ],
  },
  {
    label: "商品管理",
    items: [
      { id: "productOnboard", href: "/product-onboard", label: "商品入库", icon: Layers, color: "#22c55e", badgeKey: "productOnboard" },
      { id: "productLib", href: "/product-library", label: "商品库", icon: Database, color: "#14b8a6" },
    ],
  },
  {
    label: "品牌合作",
    items: [
      { id: "brandAuth", href: "/brand-auth", label: "品牌授权", icon: Building2, color: "#3b82f6", badgeKey: "brandAuth" },
    ],
  },
  {
    label: "财务设置",
    items: [
      { id: "revenue", href: "/revenue", label: "分成收益", icon: Coins, color: "#eab308" },
      { id: "rules", href: "/rules", label: "授权规则", icon: Shield, color: "#6b7280" },
    ],
  },
  {
    label: "法务管理",
    items: [
      { id: "infringement", href: "/infringement", label: "侵权巡查", icon: AlertCircle, color: "#ef4444" },
      { id: "contracts", href: "/contracts", label: "合同中心", icon: FileText, color: "#10b981" },
    ],
  },
];

// ── 风险分区 ─────────────────────────────────────────────────────────────────

export const ZONE_COLORS: Record<StarRiskZone, string> = {
  green: "#16a34a",
  yellow: "#ca8a04",
  orange: "#ea580c",
  red: "#dc2626",
};
export const ZONE_LABELS: Record<StarRiskZone, string> = {
  green: "绿区",
  yellow: "黄区",
  orange: "橙区",
  red: "红区",
};

// ── 平台 ─────────────────────────────────────────────────────────────────────

export const PLATFORM_FILTERS: { id: "all" | StarPlatformName; label: string; color: string }[] = [
  { id: "all", label: "全部", color: "#78716c" },
  { id: "抖音", label: "抖音", color: "#fe2c55" },
  { id: "视频号", label: "视频号", color: "#07c160" },
  { id: "快手", label: "快手", color: "#ff6200" },
  { id: "小红书", label: "小红书", color: "#ff2442" },
];

export const getPlatformAbbr = (p: string) =>
  p === "抖音" ? "DY" : p === "视频号" ? "VCH" : p === "快手" ? "KS" : p === "小红书" ? "XHS" : p.slice(0, 3).toUpperCase();

export const getPlatformColor = (p: string) =>
  p === "抖音" ? "#fe2c55" : p === "视频号" ? "#07c160" : p === "快手" ? "#ff6200" : p === "小红书" ? "#ff2442" : "#78716c";

// ── 报白 ─────────────────────────────────────────────────────────────────────

export const WL_STATUS: Record<StarWhitelistStatus, { label: string; color: string; icon: LucideIcon }> = {
  pending: { label: "待审核", color: "#d97706", icon: Clock },
  approved: { label: "已通过", color: "#16a34a", icon: CheckCircle2 },
  rejected: { label: "已驳回", color: "#dc2626", icon: XCircle },
  info_required: { label: "需补材料", color: "#ea580c", icon: AlertCircle },
};

export const WL_STATUS_FILTERS: { id: "all" | StarWhitelistStatus; label: string; color: string; icon: LucideIcon }[] = [
  { id: "all", label: "全部状态", color: "#78716c", icon: Filter },
  { id: "pending", label: "待审核", color: "#d97706", icon: Clock },
  { id: "approved", label: "已通过", color: "#16a34a", icon: CheckCircle2 },
  { id: "rejected", label: "已驳回", color: "#dc2626", icon: XCircle },
  { id: "info_required", label: "需补材料", color: "#ea580c", icon: AlertCircle },
];

export const WL_STEPS: { id: StarWhitelistStep; label: string; color: string; action: string }[] = [
  { id: "received", label: "收到申请", color: "#78716c", action: "开始联系平台" },
  { id: "contacting", label: "联系平台", color: "#0891b2", action: "等待验证码" },
  { id: "sms", label: "验证码确认", color: "#9333ea", action: "达人已确认" },
  { id: "processing", label: "报白进行中", color: "#d97706", action: "确认授权成功" },
  { id: "authorized", label: "授权成功", color: "#16a34a", action: "已完成" },
];

// ── IP 授权中心 ──────────────────────────────────────────────────────────────

export const IP_AUTH_META: Record<StarIpAssetType, { label: string; color: string; icon: LucideIcon; desc: string; files: string[] }> = {
  portrait: {
    label: "人像授权", color: "#f59e0b", icon: Camera,
    desc: "高清人像照片 + 人脸特征数据，AI形象训练全套",
    files: ["授权协议.pdf", "正面照片×20", "侧面照片×10", "全身照片×5", "人脸扫描数据包", "生物特征协议.pdf", "表情数据集"],
  },
  clip: {
    label: "切片授权", color: "#06b6d4", icon: Scissors,
    desc: "视频素材授权，用于AI切片生成",
    files: ["切片使用协议.pdf", "视频素材包×50+"],
  },
  digitalHuman: {
    label: "数字人授权", color: "#a855f7", icon: Bot,
    desc: "数字人形象数据，用于虚拟主播直播",
    files: ["数字人协议.pdf", "360°扫描数据", "语音样本×30分钟", "动作捕捉数据"],
  },
  documents: {
    label: "授权文件", color: "#22c55e", icon: FileText,
    desc: "法律授权文件和知情同意书",
    files: ["总授权协议.pdf", "隐私政策同意书.pdf", "商业使用授权书.pdf", "技术许可证.pdf"],
  },
};

export const IP_ASSET_TYPES: StarIpAssetType[] = ["portrait", "clip", "digitalHuman", "documents"];

export const IP_STATUS_CFG: Record<StarIpAssetStatus, { label: string; color: string; icon: LucideIcon }> = {
  notStarted: { label: "未开始", color: "#a8a29e", icon: Lock },
  preparing: { label: "准备中", color: "#6366f1", icon: Upload },
  uploaded: { label: "已上传", color: "#0891b2", icon: CheckCircle2 },
  techReceived: { label: "技术公司已收", color: "#9333ea", icon: Server },
  volcanoSync: { label: "火山引擎同步中", color: "#d97706", icon: CloudUpload },
  active: { label: "已激活", color: "#16a34a", icon: Zap },
};

export const IP_STATUS_ORDER: StarIpAssetStatus[] = ["notStarted", "preparing", "uploaded", "techReceived", "volcanoSync", "active"];

export const IP_STEP_COLORS = ["#a8a29e", "#6366f1", "#06b6d4", "#a855f7", "#f59e0b", "#22c55e"];

export const IP_NEXT_ACTION: Record<StarIpAssetStatus, string> = {
  notStarted: "开始准备文件",
  preparing: "上传授权文件",
  uploaded: "通知技术公司",
  techReceived: "推送至火山引擎",
  volcanoSync: "确认部署完成",
  active: "已激活",
};

// ── 商品入库 ─────────────────────────────────────────────────────────────────

export const PRODUCT_STEPS: { label: string; color: string }[] = [
  { label: "已提交", color: "#78716c" },
  { label: "平台初审", color: "#0891b2" },
  { label: "明星审核", color: "#d97706" },
  { label: "样品寄送", color: "#9333ea" },
  { label: "样品确认", color: "#db2777" },
  { label: "已入库", color: "#16a34a" },
];

export const PRODUCT_SOURCE_CFG: Record<StarProductSource, { label: string; color: string }> = {
  platform: { label: "平台发起", color: "#0891b2" },
  creator: { label: "达人选品", color: "#9333ea" },
  brand: { label: "品牌申请", color: "#2563eb" },
};

export const PRODUCT_SOURCE_FILTERS: { id: "all" | StarProductSource; label: string; color: string }[] = [
  { id: "all", label: "全部来源", color: "#78716c" },
  { id: "platform", label: "平台发起", color: "#0891b2" },
  { id: "creator", label: "达人选品", color: "#9333ea" },
  { id: "brand", label: "品牌申请", color: "#2563eb" },
];

export const SAMPLE_STATUS_CFG: Record<StarSampleStatus, { label: string; color: string; icon: LucideIcon }> = {
  notSent: { label: "待寄送", color: "#78716c", icon: Package },
  shipping: { label: "运输中", color: "#0891b2", icon: Truck },
  delivered: { label: "已签收", color: "#d97706", icon: CheckCircle2 },
  approved: { label: "审核通过", color: "#16a34a", icon: CheckCheck },
  rejected: { label: "已驳回", color: "#dc2626", icon: XCircle },
};

// ── 数字人 / AI 形象 ─────────────────────────────────────────────────────────

export const DH_USAGE_CFG: Record<StarDigitalHumanUsage, { label: string; color: string }> = {
  live: { label: "直播带货", color: "#fe2c55" },
  shortVideo: { label: "短视频", color: "#a855f7" },
  ads: { label: "广告", color: "#f59e0b" },
};

export const AI_MODEL_CFG: Record<StarAiModelType, { label: string; abbr: string; color: string }> = {
  voice: { label: "声音合成", abbr: "MIC", color: "#a855f7" },
  face: { label: "人脸换脸", abbr: "FAC", color: "#ec4899" },
  fullBody: { label: "全身形象", abbr: "BDY", color: "#f97316" },
};

export const RISK_LEVEL_CFG: Record<StarRiskLevel, { label: string; color: string }> = {
  low: { label: "低风险", color: "#16a34a" },
  medium: { label: "中风险", color: "#d97706" },
  high: { label: "高风险", color: "#dc2626" },
};

// ── 内容审核 ─────────────────────────────────────────────────────────────────

export const CONTENT_TYPE_CFG: Record<StarContentType, { label: string; color: string; icon: LucideIcon }> = {
  clip: { label: "切片", color: "#06b6d4", icon: Scissors },
  digitalHuman: { label: "数字人", color: "#a855f7", icon: Bot },
  aiLikeness: { label: "AI形象", color: "#ec4899", icon: Sparkles },
};

export const CONTENT_STATUS_CFG: Record<StarContentStatus, { label: string; color: string }> = {
  pending: { label: "待审核", color: "#d97706" },
  approved: { label: "已通过", color: "#16a34a" },
  revision: { label: "需修改", color: "#ea580c" },
  rejected: { label: "已驳回", color: "#dc2626" },
};

// ── 品牌授权 ─────────────────────────────────────────────────────────────────

export const BRAND_STATUS_CFG: Record<StarBrandAuthStatus, { label: string; color: string }> = {
  pending: { label: "待受理", color: "#78716c" },
  platformReview: { label: "平台预审", color: "#0891b2" },
  celebReview: { label: "明星审核", color: "#d97706" },
  sampleStage: { label: "寄样验收", color: "#9333ea" },
  approved: { label: "已授权", color: "#16a34a" },
  rejected: { label: "已驳回", color: "#dc2626" },
};

// ── 侵权巡查 ─────────────────────────────────────────────────────────────────

export const INFRINGEMENT_SEVERITY_CFG: Record<StarInfringementSeverity, { label: string; color: string }> = {
  high: { label: "高危", color: "#dc2626" },
  medium: { label: "中危", color: "#d97706" },
  low: { label: "低危", color: "#0891b2" },
};

export const INFRINGEMENT_STATUS_CFG: Record<StarInfringementStatus, { label: string; color: string }> = {
  pending: { label: "待处理", color: "#d97706" },
  investigating: { label: "调查中", color: "#0891b2" },
  confirmed: { label: "已确认", color: "#dc2626" },
  resolved: { label: "已解决", color: "#16a34a" },
};

// ── 合同中心 ─────────────────────────────────────────────────────────────────

export const CONTRACT_TYPE_CFG: Record<StarContractType, { label: string; color: string; icon: LucideIcon }> = {
  authorization: { label: "授权合同", color: "#9333ea", icon: FileText },
  amendment: { label: "补充协议", color: "#0891b2", icon: FileText },
  settlement: { label: "结算单", color: "#16a34a", icon: Coins },
};

export const CONTRACT_STATUS_CFG: Record<StarContractStatus, { label: string; color: string }> = {
  active: { label: "生效中", color: "#16a34a" },
  expired: { label: "已过期", color: "#78716c" },
  pending: { label: "待签署", color: "#d97706" },
  terminated: { label: "已终止", color: "#dc2626" },
};

// ── 带货授权（cooperation） ──────────────────────────────────────────────────

export const COOPERATION_STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending: { label: "待审批", color: "#d97706" },
  authorized: { label: "已授权", color: "#16a34a" },
  unauthorized: { label: "已驳回", color: "#dc2626" },
  expired: { label: "已到期", color: "#78716c" },
};

export const COOPERATION_SCENES = ["带货", "种草", "测评"] as const;
