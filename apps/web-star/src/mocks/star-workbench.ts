// ─────────────────────────────────────────────────────────────────────────────
// mocks/star-workbench.ts — USE_MOCK=1 时的演示数据（与 Figma 原型同源）。
// 数值一律原始整数（fans / priceCents / amountCents / durationSec…）。
// 提供可变内存 store：mock 模式下审批 / 状态机操作可真实生效（页面内联动）。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  StarBrandAuthRequest, StarContentReview, StarContentRule, StarContract,
  StarCooperationRequest, StarDigitalHumanRequest, StarInfringementCase,
  StarIpAsset, StarAiLikenessRequest, StarOverview, StarProductLibItem,
  StarProductOnboard, StarProfile, StarRevenueSummary, StarWhitelistRequest,
} from "@ai-star-eco/types";

// ── 明星档案（Figma 原型人设：于震 · 经纪人视角） ────────────────────────────

export const MOCK_PROFILE: StarProfile = {
  starId: "star-mock-yuzhen",
  name: "于震",
  avatar: "https://picsum.photos/seed/star-yuzhen/200/200",
  category: "演员",
  tierLabel: "S级",
  fans: 45_300_000,
  agentView: true,
  listedAt: "2026-04-01T10:00:00+08:00",
  cover: "https://picsum.photos/seed/star-yuzhen-cover/600/800",
  description: "硬汉戏骨，正剧带货双栖，信任感拉满",
  bio: "代表作《五号特工组》《密查》等，深耕年代剧 / 谍战剧二十年；直播带货以真诚人设见长，粉丝画像 30-55 岁高净值家庭用户。",
  location: "北京",
};

// ── IP 授权（4 类资产） ──────────────────────────────────────────────────────

export const MOCK_IP_ASSETS: StarIpAsset[] = [
  { id: "ip-portrait", type: "portrait", status: "active", techCompany: "数字孪生科技（北京）", volcanoProjectId: "VK-PRT-2024-001", filesCount: 35, requiredFiles: 32, uploadedAt: "2026-04-10", activatedAt: "2026-04-15", note: "已含人脸扫描数据包及生物特征协议" },
  { id: "ip-clip", type: "clip", status: "active", techCompany: "数字孪生科技（北京）", volcanoProjectId: "VK-CLP-2024-001", filesCount: 120, requiredFiles: 50, uploadedAt: "2026-04-12", activatedAt: "2026-04-17" },
  { id: "ip-dh", type: "digitalHuman", status: "volcanoSync", techCompany: "灵镜AI Lab", volcanoProjectId: "VK-DH-2026-001", filesCount: 8, requiredFiles: 10, uploadedAt: "2026-05-01", note: "模型训练中，预计3-5个工作日完成" },
  { id: "ip-doc", type: "documents", status: "techReceived", techCompany: "法务合规中心", volcanoProjectId: "VK-DOC-2026-001", filesCount: 4, requiredFiles: 4, uploadedAt: "2026-04-20", note: "文件已由技术公司接收，待同步至火山引擎" },
];

// ── 带货授权（celebrity → 明星端） ───────────────────────────────────────────

export const MOCK_COOPERATIONS: StarCooperationRequest[] = [
  { id: "coop-1", applicantUserId: "u-starlight", applicantName: "星光工作室", scenes: ["带货", "种草"], note: "主打美妆 / 食品类目短视频带货，月产 30 条以上。", status: "pending", requestedAt: "2026-06-08T15:20:00+08:00" },
  { id: "coop-2", applicantUserId: "u-luna", applicantName: "Luna 个人工作室", scenes: ["测评"], note: "数码 3C 垂类测评号，粉丝 86 万。", status: "pending", requestedAt: "2026-06-09T09:45:00+08:00" },
  { id: "coop-3", applicantUserId: "u-moonrise", applicantName: "月升传媒", scenes: ["带货", "种草", "测评"], status: "authorized", requestedAt: "2026-05-12T11:00:00+08:00", decidedAt: "2026-05-13T10:00:00+08:00", expireDate: "2026-11-13", availableStyles: 4 },
];

// ── 报白账号 ─────────────────────────────────────────────────────────────────

export const MOCK_WHITELIST: StarWhitelistRequest[] = [
  { id: "r1", mcnName: "AI Star MCN", accountHandle: "@neon_v_official", accountId: "neonv2024", phone: "138****8812", uid: "94728163501", platform: "抖音", fans: 1_284_000, accountAgeMonths: 27, mcnLevel: "金牌", requestedAt: "2026-05-06T14:30:00+08:00", status: "pending", whitelistStep: "received", recentVideos: 24, avgViews: 280_000, creditScore: 92 },
  { id: "r2", mcnName: "AI Star MCN", accountHandle: "@neon_v_channel", accountId: "neon_channel", phone: "138****8812", uid: "wx_82749163", platform: "视频号", fans: 436_000, accountAgeMonths: 13, mcnLevel: "金牌", requestedAt: "2026-05-06T14:32:00+08:00", status: "pending", whitelistStep: "contacting", recentVideos: 18, avgViews: 210_000, creditScore: 90 },
  { id: "r3", mcnName: "HypeStar Studio", accountHandle: "@luna_soft_ks", accountId: "lunasoft2023", phone: "156****2247", uid: "38821047295", platform: "快手", fans: 562_000, accountAgeMonths: 20, mcnLevel: "银牌", requestedAt: "2026-05-05T10:15:00+08:00", status: "pending", whitelistStep: "sms", recentVideos: 18, avgViews: 120_000, creditScore: 78 },
  { id: "r5", mcnName: "TopCreator MCN", accountHandle: "@topstar_douyin", accountId: "topstar_tc", phone: "139****0055", uid: "71039284651", platform: "抖音", fans: 3_420_000, accountAgeMonths: 41, mcnLevel: "钻石", requestedAt: "2026-04-28T09:00:00+08:00", status: "approved", whitelistStep: "authorized", recentVideos: 48, avgViews: 860_000, creditScore: 98 },
];

// ── 数字人授权 ───────────────────────────────────────────────────────────────

export const MOCK_DH_REQUESTS: StarDigitalHumanRequest[] = [
  { id: "dh1", mcnName: "AI Star MCN", usageType: "live", platforms: ["抖音", "淘宝直播"], purpose: "电商直播带货，AI数字人主播替换真人上播", durationMonths: 12, requestedAt: "2026-05-07T10:00:00+08:00", status: "pending" },
  { id: "dh2", mcnName: "TopCreator MCN", usageType: "shortVideo", platforms: ["抖音", "快手"], purpose: "短视频宣传片，艺人数字人口播介绍产品", durationMonths: 6, requestedAt: "2026-05-06T15:30:00+08:00", status: "pending", riskNote: "需确认数字人形象相似度合规，建议第三方鉴定" },
];

// ── AI 形象授权 ──────────────────────────────────────────────────────────────

export const MOCK_AI_REQUESTS: StarAiLikenessRequest[] = [
  { id: "ai1", mcnName: "AI Star MCN", modelType: "voice", riskLevel: "low", platforms: ["抖音"], purpose: "AI语音合成用于视频配音，相似度≤75%", requestedAt: "2026-05-07T11:00:00+08:00", status: "pending", aiVendor: "ElevenLabs" },
  { id: "ai2", mcnName: "CyberMCN", modelType: "face", riskLevel: "high", platforms: ["抖音", "微博"], purpose: "AI换脸用于品牌宣传短片", requestedAt: "2026-05-06T14:00:00+08:00", status: "pending", aiVendor: "FaceSwap Pro" },
];

// ── 内容审核 ─────────────────────────────────────────────────────────────────

export const MOCK_CONTENT_REVIEWS: StarContentReview[] = [
  { id: "cv1", title: "于震×泡泡玛特联名开箱视频", type: "clip", uploader: "@neon_v_official", mcnName: "AI Star MCN", durationSec: 208, submittedAt: "2026-05-07T09:00:00+08:00", status: "pending", platform: "抖音" },
  { id: "cv2", title: "AI数字人带货直播高光片段", type: "digitalHuman", uploader: "@topstar_douyin", mcnName: "TopCreator MCN", durationSec: 75, submittedAt: "2026-05-07T11:30:00+08:00", status: "pending", platform: "抖音" },
  { id: "cv3", title: "于震AI声音配音护肤品种草", type: "aiLikeness", uploader: "@luna_soft_ks", mcnName: "HypeStar Studio", durationSec: 58, submittedAt: "2026-05-06T20:00:00+08:00", status: "revision", platform: "快手", revisionNote: "AI 声音相似度超出协议上限，请替换配音轨后重新提交" },
  { id: "cv4", title: "演唱会回顾混剪合集", type: "clip", uploader: "@neon_v_channel", mcnName: "AI Star MCN", durationSec: 340, submittedAt: "2026-05-06T15:00:00+08:00", status: "approved", platform: "视频号", views: 243_000 },
];

// ── 商品入库 ─────────────────────────────────────────────────────────────────

export const MOCK_PRODUCT_ONBOARDS: StarProductOnboard[] = [
  { id: "po1", productName: "次世代智能护肤精华", brand: "CyberGlow", category: "美妆护肤", priceCents: 39_800, source: "platform", submittedBy: "平台运营组", step: 2, platformSample: "notSent", celebSample: "notSent", submittedAt: "2026-05-07T10:00:00+08:00", platformNote: "平台已审核，适合AI带货场景" },
  { id: "po2", productName: "赛博朋克联名耳机", brand: "NeonSound", category: "数码配件", priceCents: 129_900, source: "creator", submittedBy: "@neon_v_official", mcnName: "AI Star MCN", step: 4, platformSample: "delivered", celebSample: "shipping", submittedAt: "2026-05-05T10:00:00+08:00", trackingPlatform: "SF1234567890", trackingCeleb: "JD9876543210" },
  { id: "po3", productName: "智能健康监测手环", brand: "VitalTech", category: "智能穿戴", priceCents: 59_900, source: "creator", submittedBy: "@topstar_douyin", mcnName: "TopCreator MCN", step: 2, platformSample: "notSent", celebSample: "notSent", submittedAt: "2026-05-06T10:00:00+08:00", platformNote: "平台已通过初审，待明星确认" },
  { id: "po4", productName: "限量版联名运动鞋", brand: "HyperStep", category: "运动服饰", priceCents: 219_900, source: "brand", submittedBy: "HyperStep官方", step: 1, platformSample: "notSent", celebSample: "notSent", submittedAt: "2026-05-07T10:00:00+08:00" },
  { id: "po5", productName: "AI香薰智能音箱", brand: "ScentAI", category: "家居生活", priceCents: 89_900, source: "platform", submittedBy: "平台运营组", step: 5, platformSample: "approved", celebSample: "approved", submittedAt: "2026-04-28T10:00:00+08:00" },
  { id: "po6", productName: "数字游民背包", brand: "NomadGear", category: "箱包", priceCents: 78_900, source: "creator", submittedBy: "@luna_soft_ks", mcnName: "HypeStar Studio", step: 3, platformSample: "shipping", celebSample: "notSent", submittedAt: "2026-05-04T10:00:00+08:00", trackingPlatform: "YT5566778899" },
];

// ── 商品库（已入库可带货） ───────────────────────────────────────────────────

export const MOCK_PRODUCT_LIB: StarProductLibItem[] = [
  { id: "pl1", productName: "AI香薰智能音箱", brand: "ScentAI", category: "家居生活", approvedAt: "2026-05-06", priceCents: 89_900, mcnName: "AI Star MCN", salesCount: 342 },
  { id: "pl2", productName: "次世代护肤套装", brand: "CyberGlow", category: "美妆护肤", approvedAt: "2026-04-20", priceCents: 118_000, mcnName: "AI Star MCN", salesCount: 891 },
  { id: "pl3", productName: "赤红联名手表", brand: "CrimsonTime", category: "配饰", approvedAt: "2026-04-15", priceCents: 329_900, mcnName: "TopCreator MCN", salesCount: 128 },
  { id: "pl4", productName: "轻薄防晒外套", brand: "CoolShade", category: "运动服饰", approvedAt: "2026-03-30", priceCents: 45_900, mcnName: "AI Star MCN", salesCount: 2341 },
];

// ── 品牌授权 ─────────────────────────────────────────────────────────────────

export const MOCK_BRAND_AUTHS: StarBrandAuthRequest[] = [
  { id: "ba1", brandName: "安踏运动", authTypes: ["人像授权", "代言授权"], purpose: "2026秋冬系列运动服装代言，线上线下全渠道", durationMonths: 24, amountCents: 580_000_000, platforms: ["抖音", "微博", "小红书", "线下广告"], status: "sampleStage", platformSample: "approved", celebSample: "shipping", submittedAt: "2026-05-02T10:00:00+08:00" },
  { id: "ba2", brandName: "CyberGlow护肤", authTypes: ["人像授权", "联名授权"], purpose: "与艺人共同推出限量联名护肤产品线", durationMonths: 12, amountCents: 120_000_000, platforms: ["抖音", "小红书", "天猫"], status: "celebReview", platformSample: "approved", celebSample: "notSent", submittedAt: "2026-05-05T10:00:00+08:00", platformNote: "平台已审核合规，建议明星同意，品牌调性匹配" },
  { id: "ba3", brandName: "NeonSound音频", authTypes: ["AI声音授权"], purpose: "AI语音合成用于品牌广告音频", durationMonths: 6, amountCents: 45_000_000, platforms: ["抖音", "网易云音乐"], status: "approved", platformSample: "approved", celebSample: "approved", submittedAt: "2026-04-20T10:00:00+08:00" },
];

// ── 收益分成 ─────────────────────────────────────────────────────────────────

export const MOCK_REVENUE: StarRevenueSummary = {
  totalGmvCents: 46_400_000,
  monthGmvCents: 16_200_000,
  pendingAmountCents: 1_620_000,
  paidAmountCents: 3_020_000,
  months: [
    { id: "rev-2026-01", month: "2026-01", gmvCents: 0, sharePercent: 10, amountCents: 0, status: "paid" },
    { id: "rev-2026-02", month: "2026-02", gmvCents: 0, sharePercent: 10, amountCents: 0, status: "paid" },
    { id: "rev-2026-03", month: "2026-03", gmvCents: 8_400_000, sharePercent: 10, amountCents: 840_000, status: "paid" },
    { id: "rev-2026-04", month: "2026-04", gmvCents: 21_800_000, sharePercent: 10, amountCents: 2_180_000, status: "paid" },
    { id: "rev-2026-05", month: "2026-05", gmvCents: 16_200_000, sharePercent: 10, amountCents: 1_620_000, status: "processing" },
  ],
};

// ── 内容规则 ─────────────────────────────────────────────────────────────────

export const MOCK_RULES: StarContentRule[] = [
  { id: "cr1", name: "官方切片直接使用", zone: "green", enabled: true, description: "经纪方认证的官方切片素材可直接使用，无需额外申请" },
  { id: "cr2", name: "允许AI字幕与剪辑重组", zone: "yellow", enabled: true, description: "可对视频添加AI字幕、合规剪辑，发布时须声明AI辅助" },
  { id: "cr3", name: "AI语音合成（有限制）", zone: "orange", enabled: false, description: "需另签AI声音授权协议，相似度须控制在80%以下" },
  { id: "cr4", name: "AI形象虚拟创作", zone: "red", enabled: false, description: "完全禁用，需持有专属AI形象授权包方可开启" },
];

// ── 侵权巡查 ─────────────────────────────────────────────────────────────────

export const MOCK_INFRINGEMENTS: StarInfringementCase[] = [
  { id: "INF-001", platform: "YouTube", url: "https://youtube.com/watch?v=xxxxx", ipName: "于震声线", severity: "high", status: "pending", reportedBy: "粉丝举报", reportedAt: "2026-06-05T14:30:00+08:00", description: "发现未经授权使用于震声线制作翻唱视频，已获得大量播放" },
  { id: "INF-002", platform: "Bilibili", url: "https://bilibili.com/video/xxxxx", ipName: "于震形象", severity: "medium", status: "investigating", reportedBy: "自动监测", reportedAt: "2026-06-04T09:15:00+08:00", description: "疑似使用于震数字形象进行商业直播" },
  { id: "INF-003", platform: "TikTok", url: "https://tiktok.com/@xxxxx", ipName: "于震声线", severity: "low", status: "confirmed", reportedBy: "用户投诉", reportedAt: "2026-06-03T16:45:00+08:00", description: "使用于震声线制作短视频片段" },
  { id: "INF-004", platform: "抖音", url: "https://douyin.com/xxxxx", ipName: "于震形象", severity: "high", status: "resolved", reportedBy: "粉丝举报", reportedAt: "2026-06-02T11:20:00+08:00", description: "未经授权使用于震数字人形象带货，已下架处理" },
  { id: "INF-005", platform: "微博", url: "https://weibo.com/xxxxx", ipName: "于震形象", severity: "medium", status: "investigating", reportedBy: "自动监测", reportedAt: "2026-06-01T08:00:00+08:00", description: "疑似盗用官方宣传图片用于商业推广" },
];

// ── 合同中心 ─────────────────────────────────────────────────────────────────

export const MOCK_CONTRACTS: StarContract[] = [
  { id: "CON-2026-001", title: "切片素材授权合同", type: "authorization", mcnName: "AI Star MCN", ipName: "于震切片库", signDate: "2026-01-15", startDate: "2026-01-20", endDate: "2027-01-19", amountCents: 50_000_000, status: "active" },
  { id: "CON-2026-002", title: "数字人形象授权合同", type: "authorization", mcnName: "TopCreator MCN", ipName: "于震数字人", signDate: "2026-02-10", startDate: "2026-02-15", endDate: "2027-02-14", amountCents: 80_000_000, status: "active" },
  { id: "AMD-2026-001", title: "切片授权范围补充协议", type: "amendment", mcnName: "AI Star MCN", ipName: "于震切片库", signDate: "2026-03-01", startDate: "2026-03-01", endDate: "2027-01-19", amountCents: 15_000_000, status: "active" },
  { id: "SET-2026-001", title: "2026年Q1结算单", type: "settlement", mcnName: "AI Star MCN", ipName: "于震切片库", signDate: "2026-04-05", startDate: "2026-01-01", endDate: "2026-03-31", amountCents: 12_560_000, status: "active" },
  { id: "CON-2025-005", title: "AI声音授权合同", type: "authorization", mcnName: "HypeStar Studio", ipName: "于震声线", signDate: "2025-06-10", startDate: "2025-06-15", endDate: "2026-06-14", amountCents: 60_000_000, status: "expired" },
  { id: "CON-2026-003", title: "全身形象授权合同", type: "authorization", mcnName: "CyberMCN", ipName: "于震形象", signDate: "2026-03-20", startDate: "2026-04-01", endDate: "2027-03-31", amountCents: 70_000_000, status: "pending" },
];

// ── 可变内存 store（mock 模式下页面操作真实生效） ────────────────────────────

interface MockStore {
  profile: StarProfile | null;
  ipAssets: StarIpAsset[];
  cooperations: StarCooperationRequest[];
  whitelist: StarWhitelistRequest[];
  dhRequests: StarDigitalHumanRequest[];
  aiRequests: StarAiLikenessRequest[];
  contentReviews: StarContentReview[];
  productOnboards: StarProductOnboard[];
  productLib: StarProductLibItem[];
  brandAuths: StarBrandAuthRequest[];
  rules: StarContentRule[];
  infringements: StarInfringementCase[];
  contracts: StarContract[];
  revenue: StarRevenueSummary;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

let store: MockStore | null = null;

export function mockStore(): MockStore {
  if (!store) {
    store = {
      profile: clone(MOCK_PROFILE),
      ipAssets: clone(MOCK_IP_ASSETS),
      cooperations: clone(MOCK_COOPERATIONS),
      whitelist: clone(MOCK_WHITELIST),
      dhRequests: clone(MOCK_DH_REQUESTS),
      aiRequests: clone(MOCK_AI_REQUESTS),
      contentReviews: clone(MOCK_CONTENT_REVIEWS),
      productOnboards: clone(MOCK_PRODUCT_ONBOARDS),
      productLib: clone(MOCK_PRODUCT_LIB),
      brandAuths: clone(MOCK_BRAND_AUTHS),
      rules: clone(MOCK_RULES),
      infringements: clone(MOCK_INFRINGEMENTS),
      contracts: clone(MOCK_CONTRACTS),
      revenue: clone(MOCK_REVENUE),
    };
  }
  return store;
}

/** 计算总览（mock 模式由前端按当前 store 派生，与后端口径一致）。 */
export function computeMockOverview(): StarOverview {
  const s = mockStore();
  const ipActive = s.ipAssets.filter((a) => a.status === "active").length;
  const pendingIp = s.ipAssets.filter((a) => a.status !== "active").length;
  const pendingCoop = s.cooperations.filter((c) => c.status === "pending").length;
  const pendingWl = s.whitelist.filter((r) => r.status === "pending").length;
  const pendingDh = s.dhRequests.filter((r) => r.status === "pending").length;
  const pendingAi = s.aiRequests.filter((r) => r.status === "pending").length;
  const pendingContent = s.contentReviews.filter((r) => r.status === "pending").length;
  const pendingProduct = s.productOnboards.filter(
    (p) => p.step === 2 || (p.step === 3 && p.celebSample === "shipping") || (p.step === 4 && p.celebSample === "delivered"),
  ).length;
  const pendingBrand = s.brandAuths.filter(
    (b) => b.status === "celebReview" || (b.status === "sampleStage" && b.celebSample === "delivered"),
  ).length;
  return {
    ipActiveCount: ipActive,
    ipTotalCount: s.ipAssets.length,
    pendingTotal: pendingIp + pendingCoop + pendingWl + pendingDh + pendingAi + pendingContent + pendingProduct + pendingBrand,
    productLibraryCount: s.productLib.length,
    activeBrandDeals: s.brandAuths.filter((b) => b.status === "approved").length,
    monthGmvCents: s.revenue.monthGmvCents,
    monthGmvDeltaPercent: 18,
    monthRevenueCents: s.revenue.months.find((m) => m.status === "processing")?.amountCents ?? 0,
    pendingByModule: [
      { module: "ipAuth", count: pendingIp },
      { module: "cooperation", count: pendingCoop },
      { module: "whitelist", count: pendingWl },
      { module: "digitalHuman", count: pendingDh },
      { module: "aiLikeness", count: pendingAi },
      { module: "contentReview", count: pendingContent },
      { module: "productOnboard", count: pendingProduct },
      { module: "brandAuth", count: pendingBrand },
    ],
  };
}
