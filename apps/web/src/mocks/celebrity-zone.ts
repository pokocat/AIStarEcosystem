// ─────────────────────────────────────────────────────────────────────────────
// mocks/celebrity-zone.ts — 明星专区：演示数据。
// ─────────────────────────────────────────────────────────────────────────────
//
// 内部演示用途：本文件中所有姓名、配图、视频、授权状态、价格均为前端原型
// 展示，不对外发布、不构成商业授权关系。明星头像 / 封面采用 Wikimedia
// Commons 公开图片热链接；视频片段来源于 Pexels 公开 portrait
// livestreaming-selling 库。生产环境替换为 AI 生成的静态资源。
//
// 接入后端真实接口时，整文件仅用作 USE_MOCK=1 模式下的回退数据。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CelebrityProject,
  CelebrityProjectVideo,
  CelebrityShowcase,
  CelebrityStar,
  CelebrityTemplate,
  CelebrityZoneOverview,
  ChannelStatus,
} from "@/types/celebrity-zone";
import type { ID } from "@/types/_shared";

// ── 公开图床工具函数 ────────────────────────────────────────────────────────
const cover = (seed: string) => `https://picsum.photos/seed/${seed}/600/800`;
const thumb = (seed: string) => `https://picsum.photos/seed/${seed}/360/640`;

/**
 * Pexels 公开 portrait livestreaming-selling 视频池，用于所有明星样片 /
 * 项目视频 / 模板预览的 mock。生产替换为 AI 生成静态资源。
 */
const PEXELS_PORTRAIT_VIDEOS = [
  // 用户原型校验通过的 URL
  "https://videos.pexels.com/video-files/7480485/7480485-uhd_2160_3840_25fps.mp4",
  // 以下来自 Pexels portrait 搜索结果（livestreaming/talking/unboxing/haul）
  "https://videos.pexels.com/video-files/7480844/7480844-hd_1080_1920_30fps.mp4",
  "https://videos.pexels.com/video-files/8048443/8048443-hd_1080_1920_30fps.mp4",
  "https://videos.pexels.com/video-files/9032398/9032398-hd_1080_1920_30fps.mp4",
  "https://videos.pexels.com/video-files/8124136/8124136-hd_1080_1920_30fps.mp4",
  "https://videos.pexels.com/video-files/8135877/8135877-hd_1080_1920_30fps.mp4",
  "https://videos.pexels.com/video-files/7262665/7262665-hd_1080_1920_30fps.mp4",
  "https://videos.pexels.com/video-files/9401763/9401763-hd_1080_1920_30fps.mp4",
  "https://videos.pexels.com/video-files/8848973/8848973-hd_1080_1920_30fps.mp4",
  "https://videos.pexels.com/video-files/4440948/4440948-hd_1080_1920_30fps.mp4",
];

/** 简单字符串 → 数字哈希，用于稳定地按 id 选视频，避免每次刷新顺序变。 */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const pickVideo = (seed: string): string =>
  PEXELS_PORTRAIT_VIDEOS[hash(seed) % PEXELS_PORTRAIT_VIDEOS.length];

/**
 * 明星头像 / 封面：来自 Wikimedia Commons 公开图片热链接（内部 Demo 用）。
 * 6/8 位有 Wikimedia 公开像，剩余 2 位（刘涛 / 贾玲）暂用 picsum 占位，
 * 后续可替换为商务团队提供的授权图片或自建 CDN。
 */
const STAR_PORTRAITS: Record<string, { avatar: string; cover: string }> = {
  "star-li-dan": {
    avatar:
      "https://upload.wikimedia.org/wikipedia/commons/b/ba/Li_Dan%2C_Stand-up_comedian%2C_May_2021%2C_Shanghai.jpg",
    cover:
      "https://upload.wikimedia.org/wikipedia/commons/b/ba/Li_Dan%2C_Stand-up_comedian%2C_May_2021%2C_Shanghai.jpg",
  },
  "star-yi-nengjing": {
    avatar: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Annie_Yi.jpg",
    cover: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Annie_Yi.jpg",
  },
  "star-liu-tao": {
    avatar: cover("star-liu-tao-portrait"),
    cover: cover("star-liu-tao-cover"),
  },
  "star-shen-teng": {
    avatar:
      "https://upload.wikimedia.org/wikipedia/commons/d/d5/Shen_Teng-20190516.jpg",
    cover:
      "https://upload.wikimedia.org/wikipedia/commons/d/d5/Shen_Teng-20190516.jpg",
  },
  "star-na-ying": {
    avatar:
      "https://upload.wikimedia.org/wikipedia/commons/9/99/%E9%82%A3%E8%8B%B1_Na_Ying.jpg",
    cover:
      "https://upload.wikimedia.org/wikipedia/commons/9/99/%E9%82%A3%E8%8B%B1_Na_Ying.jpg",
  },
  "star-ning-zetao": {
    avatar:
      "https://upload.wikimedia.org/wikipedia/commons/6/61/Kazan_2015_-_Ning_Zetao_after_100_metres_frestyle_M_final.JPG",
    cover:
      "https://upload.wikimedia.org/wikipedia/commons/6/61/Kazan_2015_-_Ning_Zetao_after_100_metres_frestyle_M_final.JPG",
  },
  "star-li-yuchun": {
    avatar:
      "https://upload.wikimedia.org/wikipedia/commons/a/ab/Li_Yuchun_Cannes_2015.jpg",
    cover:
      "https://upload.wikimedia.org/wikipedia/commons/a/ab/Li_Yuchun_Cannes_2015.jpg",
  },
  "star-jia-ling": {
    avatar: cover("star-jia-ling-portrait"),
    cover: cover("star-jia-ling-cover"),
  },
};

// 生成示例视频集合（每条都补 videoUrl 以支持真实播放）
function makeSampleVideos(starId: string): CelebrityStar["sampleVideos"] {
  const items = [
    { label: "美妆种草", category: "美妆" },
    { label: "食品带货", category: "食品" },
    { label: "数码测评", category: "数码" },
    { label: "日用推荐", category: "日用" },
    { label: "服饰穿搭", category: "服饰" },
    { label: "旅行体验", category: "旅行" },
  ];
  return items.map((it, i) => {
    const id = `${starId}-sv-${i + 1}`;
    return {
      id,
      label: it.label,
      category: it.category,
      thumb: thumb(id),
      videoUrl: pickVideo(id),
    };
  });
}

// 标准三档套餐生成器
function makePricingTiers(): CelebrityStar["pricing"] {
  return [
    {
      id: "tier-trial",
      name: "体验版",
      price: "¥299/条",
      features: ["单条生成", "1 个分发渠道", "基础风格库"],
      recommended: false,
    },
    {
      id: "tier-standard",
      name: "标准版",
      price: "¥1,999/月",
      features: ["50 条/月", "3 个分发渠道", "全部风格库", "项目管理"],
      recommended: true,
    },
    {
      id: "tier-premium",
      name: "旗舰版",
      price: "¥9,999/月",
      features: ["无限生成", "全渠道分发", "定制风格", "专属客服", "API 接入"],
      recommended: false,
    },
  ];
}

// ── 明星目录（8 位） ────────────────────────────────────────────────────────
export const MARKET_STARS: CelebrityStar[] = [
  {
    id: "star-li-dan",
    name: "李诞",
    avatar: STAR_PORTRAITS["star-li-dan"].avatar,
    cover: STAR_PORTRAITS["star-li-dan"].cover,
    category: "主持人",
    subCategories: ["综艺"],
    isHot: true,
    description:
      "脱口秀厂牌主理人 · 综艺常驻嘉宾。语言节奏明快、犀利幽默，擅长口播与剧情类带货脚本。",
    startingPrice: "¥299起",
    pricingTier: "标准版",
    quotaUsed: 27,
    quotaTotal: 50,
    authorization: {
      status: "authorized",
      scenes: ["带货", "种草", "测评"],
      expireDate: "2027-03-15",
      availableStyles: 5,
    },
    stats: {
      totalGenerated: 340,
      totalPlays: "2.1M",
      conversionRate: "3.2%",
      gmv: "¥89K",
    },
    sampleVideos: makeSampleVideos("star-li-dan"),
    pricing: makePricingTiers(),
  },
  {
    id: "star-yi-nengjing",
    name: "伊能静",
    avatar: STAR_PORTRAITS["star-yi-nengjing"].avatar,
    cover: STAR_PORTRAITS["star-yi-nengjing"].cover,
    category: "演员",
    subCategories: ["歌手", "综艺"],
    isHot: false,
    description:
      "知名影视演员 · 综艺嘉宾。亲和力强，擅长温馨家庭、女性向商品种草内容。",
    startingPrice: "¥499起",
    pricingTier: "体验版",
    quotaUsed: 3,
    quotaTotal: 10,
    authorization: {
      status: "authorized",
      scenes: ["带货", "种草"],
      expireDate: "2026-12-31",
      availableStyles: 4,
    },
    stats: {
      totalGenerated: 128,
      totalPlays: "860K",
      conversionRate: "2.8%",
      gmv: "¥34K",
    },
    sampleVideos: makeSampleVideos("star-yi-nengjing"),
    pricing: makePricingTiers(),
  },
  {
    id: "star-liu-tao",
    name: "刘涛",
    avatar: STAR_PORTRAITS["star-liu-tao"].avatar,
    cover: STAR_PORTRAITS["star-liu-tao"].cover,
    category: "演员",
    isHot: true,
    description:
      "实力派影视演员。形象大气端庄，适合美妆、家居、母婴等高客单类目种草。",
    startingPrice: "¥599起",
    authorization: {
      status: "pending",
      scenes: [],
      availableStyles: 0,
      pendingNote: "预计 3 个工作日内完成审核",
      applyUrl: "/producer/celebrity-zone/star/star-liu-tao/apply",
    },
    stats: {
      totalGenerated: 0,
      totalPlays: "—",
      conversionRate: "—",
      gmv: "—",
    },
    sampleVideos: makeSampleVideos("star-liu-tao"),
    pricing: makePricingTiers(),
  },
  {
    id: "star-shen-teng",
    name: "沈腾",
    avatar: STAR_PORTRAITS["star-shen-teng"].avatar,
    cover: STAR_PORTRAITS["star-shen-teng"].cover,
    category: "演员",
    subCategories: ["综艺"],
    isHot: true,
    description:
      "国民喜剧演员 · 票房号召力顶流。表情细腻、喜剧感强，适合搞笑反转、节庆大促类带货。",
    startingPrice: "¥699起",
    authorization: {
      status: "unauthorized",
      scenes: [],
      availableStyles: 0,
      applyUrl: "/producer/celebrity-zone/star/star-shen-teng/apply",
    },
    stats: {
      totalGenerated: 0,
      totalPlays: "—",
      conversionRate: "—",
      gmv: "—",
    },
    sampleVideos: makeSampleVideos("star-shen-teng"),
    pricing: makePricingTiers(),
  },
  {
    id: "star-na-ying",
    name: "那英",
    avatar: STAR_PORTRAITS["star-na-ying"].avatar,
    cover: STAR_PORTRAITS["star-na-ying"].cover,
    category: "歌手",
    subCategories: ["综艺"],
    isHot: false,
    description:
      "华语乐坛实力派歌手。声线辨识度高，适合品牌站台、节目植入、音乐主题带货。",
    startingPrice: "¥499起",
    pricingTier: "标准版",
    quotaUsed: 50,
    quotaTotal: 50,
    authorization: {
      status: "expired",
      scenes: ["带货"],
      expireDate: "2026-04-30",
      availableStyles: 3,
      applyUrl: "/producer/celebrity-zone/star/star-na-ying/apply",
    },
    stats: {
      totalGenerated: 96,
      totalPlays: "640K",
      conversionRate: "2.6%",
      gmv: "¥21K",
    },
    sampleVideos: makeSampleVideos("star-na-ying"),
    pricing: makePricingTiers(),
  },
  {
    id: "star-ning-zetao",
    name: "宁泽涛",
    avatar: STAR_PORTRAITS["star-ning-zetao"].avatar,
    cover: STAR_PORTRAITS["star-ning-zetao"].cover,
    category: "运动员",
    isHot: false,
    description:
      "前国家队游泳运动员。健康阳光形象，适合运动用品、男士护理、保健品类目。",
    startingPrice: "¥399起",
    pricingTier: "标准版",
    quotaUsed: 8,
    quotaTotal: 50,
    authorization: {
      status: "authorized",
      scenes: ["带货", "种草"],
      expireDate: "2027-06-30",
      availableStyles: 4,
    },
    stats: {
      totalGenerated: 54,
      totalPlays: "320K",
      conversionRate: "3.4%",
      gmv: "¥18K",
    },
    sampleVideos: makeSampleVideos("star-ning-zetao"),
    pricing: makePricingTiers(),
  },
  {
    id: "star-li-yuchun",
    name: "李宇春",
    avatar: STAR_PORTRAITS["star-li-yuchun"].avatar,
    cover: STAR_PORTRAITS["star-li-yuchun"].cover,
    category: "歌手",
    subCategories: ["演员"],
    isHot: true,
    description:
      "全能创作型歌手。中性时尚风格，粉丝粘性高，适合潮牌、3C、年轻向新消费品类。",
    startingPrice: "¥549起",
    pricingTier: "旗舰版",
    quotaUsed: 124,
    quotaTotal: 999,
    authorization: {
      status: "authorized",
      scenes: ["带货", "种草", "测评", "代言"],
      expireDate: "2027-09-30",
      availableStyles: 6,
    },
    stats: {
      totalGenerated: 412,
      totalPlays: "3.6M",
      conversionRate: "4.1%",
      gmv: "¥152K",
    },
    sampleVideos: makeSampleVideos("star-li-yuchun"),
    pricing: makePricingTiers(),
  },
  {
    id: "star-jia-ling",
    name: "贾玲",
    avatar: STAR_PORTRAITS["star-jia-ling"].avatar,
    cover: STAR_PORTRAITS["star-jia-ling"].cover,
    category: "演员",
    subCategories: ["综艺"],
    isHot: false,
    description:
      "知名喜剧演员 · 导演。亲切真诚，适合家庭类、节庆类、女性励志题材带货内容。",
    startingPrice: "¥549起",
    authorization: {
      status: "unauthorized",
      scenes: [],
      availableStyles: 0,
      applyUrl: "/producer/celebrity-zone/star/star-jia-ling/apply",
    },
    stats: {
      totalGenerated: 0,
      totalPlays: "—",
      conversionRate: "—",
      gmv: "—",
    },
    sampleVideos: makeSampleVideos("star-jia-ling"),
    pricing: makePricingTiers(),
  },
];

/** 当前用户「正在使用」的明星（旧 API 兼容）：取第一位已授权的明星。 */
export const ACTIVE_STAR: CelebrityStar = MARKET_STARS[0];

export const STAR_DETAIL_MAP: Record<ID, CelebrityStar> = MARKET_STARS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<ID, CelebrityStar>,
);

// ── 模板 ─────────────────────────────────────────────────────────────────────
export const CELEBRITY_TEMPLATES: CelebrityTemplate[] = [
  {
    id: "tpl-bff-recommend",
    name: "闺蜜种草",
    style: "种草安利",
    description: "闺蜜对话场景，自然推荐商品，亲和力强，适合美妆/日用品。",
    recommendedEngine: "HiGen",
    recommendedPrice: "标准",
    isHot: true,
    plays: "12.5K",
    conversionRate: "3.8%",
    fitHint: "口型匹配度 92%",
    previews: [
      { thumb: thumb("tpl-bff-1"), videoUrl: pickVideo("tpl-bff-1") },
      { thumb: thumb("tpl-bff-2"), videoUrl: pickVideo("tpl-bff-2") },
    ],
  },
  {
    id: "tpl-pro-review",
    name: "专业测评",
    style: "硬核测评",
    description: "正面镜头 + 产品特写，逐项分析产品优缺点，适合数码/家电。",
    recommendedEngine: "HiGen",
    recommendedPrice: "标准",
    isHot: false,
    plays: "8.2K",
    conversionRate: "4.1%",
    previews: [
      { thumb: thumb("tpl-review-1"), videoUrl: pickVideo("tpl-review-1") },
      { thumb: thumb("tpl-review-2"), videoUrl: pickVideo("tpl-review-2") },
    ],
  },
  {
    id: "tpl-unbox",
    name: "开箱惊喜",
    style: "轻松开箱",
    description: "拆包裹 + 第一反应，悬念感强，适合新品/礼盒。",
    recommendedEngine: "MiniMax",
    recommendedPrice: "高级",
    isHot: true,
    plays: "15.1K",
    conversionRate: "2.9%",
    previews: [
      { thumb: thumb("tpl-unbox-1"), videoUrl: pickVideo("tpl-unbox-1") },
      { thumb: thumb("tpl-unbox-2"), videoUrl: pickVideo("tpl-unbox-2") },
    ],
  },
  {
    id: "tpl-live-clip",
    name: "直播片段",
    style: "直播切片",
    description: "模拟直播间风格，紧迫感强的口播带货，适合限时促销。",
    recommendedEngine: "HiGen",
    recommendedPrice: "标准",
    isHot: false,
    plays: "20.3K",
    conversionRate: "5.2%",
    previews: [
      { thumb: thumb("tpl-live-1"), videoUrl: pickVideo("tpl-live-1") },
      { thumb: thumb("tpl-live-2"), videoUrl: pickVideo("tpl-live-2") },
    ],
  },
  {
    id: "tpl-vlog",
    name: "日常 Vlog",
    style: "种草安利",
    description: "日常场景中自然露出商品，生活化表达，适合食品/饮品。",
    recommendedEngine: "KeLing",
    recommendedPrice: "经济",
    isHot: false,
    plays: "6.8K",
    conversionRate: "2.4%",
    previews: [
      { thumb: thumb("tpl-vlog-1"), videoUrl: pickVideo("tpl-vlog-1") },
      { thumb: thumb("tpl-vlog-2"), videoUrl: pickVideo("tpl-vlog-2") },
    ],
  },
  {
    id: "tpl-plot-twist",
    name: "剧情反转",
    style: "剧情植入",
    description: "15 秒小剧场 + 产品解决问题的反转，适合功效型产品。",
    recommendedEngine: "MiniMax",
    recommendedPrice: "高级",
    isHot: true,
    plays: "18.7K",
    conversionRate: "3.5%",
    previews: [
      { thumb: thumb("tpl-twist-1"), videoUrl: pickVideo("tpl-twist-1") },
      { thumb: thumb("tpl-twist-2"), videoUrl: pickVideo("tpl-twist-2") },
    ],
  },
];

// ── 项目 ────────────────────────────────────────────────────────────────────
function makeChannels(
  publishedDouyin: number,
  publishedKuaishou: number,
  redConnected: boolean,
): ChannelStatus[] {
  return [
    { id: "ch-douyin", name: "抖音", connected: true, publishedCount: publishedDouyin },
    { id: "ch-kuaishou", name: "快手", connected: true, publishedCount: publishedKuaishou },
    { id: "ch-red", name: "小红书", connected: redConnected, publishedCount: 0 },
    { id: "ch-shipinhao", name: "视频号", connected: false, publishedCount: 0 },
    { id: "ch-bilibili", name: "B站", connected: false, publishedCount: 0 },
  ];
}

export const CELEBRITY_PROJECTS: CelebrityProject[] = [
  {
    id: "proj-618-beauty",
    name: "618大促 · 美妆专场",
    starId: "star-li-dan",
    starName: "李诞",
    starAvatar: MARKET_STARS[0].avatar,
    status: "进行中",
    videoCount: 12,
    totalPlays: "444K",
    totalInteractions: "12.3K",
    conversions: 890,
    gmv: "¥67.8K",
    createdAt: "2026-04-01",
    pricingTier: "标准版",
    channels: makeChannels(8, 6, false),
    quota: { used: 12, total: 50 },
  },
  {
    id: "proj-summer-drink",
    name: "夏季新品 · 饮料推广",
    starId: "star-li-yuchun",
    starName: "李宇春",
    starAvatar: MARKET_STARS[6].avatar,
    status: "进行中",
    videoCount: 8,
    totalPlays: "210K",
    totalInteractions: "5.6K",
    conversions: 312,
    gmv: "¥32.1K",
    createdAt: "2026-04-22",
    pricingTier: "旗舰版",
    channels: makeChannels(5, 3, true),
    quota: { used: 8, total: 999 },
  },
  {
    id: "proj-sport-series",
    name: "品牌联名 · 运动系列",
    starId: "star-ning-zetao",
    starName: "宁泽涛",
    starAvatar: MARKET_STARS[5].avatar,
    status: "筹备中",
    videoCount: 3,
    totalPlays: "—",
    totalInteractions: "—",
    conversions: 0,
    gmv: "—",
    createdAt: "2026-05-02",
    pricingTier: "标准版",
    channels: makeChannels(0, 0, false),
    quota: { used: 3, total: 50 },
  },
  {
    id: "proj-spring-festival",
    name: "春节年货 · 食品带货",
    starId: "star-yi-nengjing",
    starName: "伊能静",
    starAvatar: MARKET_STARS[1].avatar,
    status: "已完成",
    videoCount: 24,
    totalPlays: "1.2M",
    totalInteractions: "32.4K",
    conversions: 2415,
    gmv: "¥180K",
    createdAt: "2026-01-10",
    pricingTier: "标准版",
    channels: makeChannels(15, 9, true),
    quota: { used: 24, total: 50 },
  },
];

// ── 项目视频 ─────────────────────────────────────────────────────────────────
function makeVideos(
  projectId: ID,
  projectName: string,
  starId: ID,
  starName: string,
  rows: Array<{
    product: string;
    status: CelebrityProjectVideo["status"];
    plays?: string;
    durationSec?: 15 | 30 | 60;
    engine?: CelebrityProjectVideo["engine"];
    daysAgo?: number;
  }>,
): CelebrityProjectVideo[] {
  const today = new Date("2026-05-06T00:00:00Z");
  return rows.map((r, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (r.daysAgo ?? i + 1));
    const vid = `${projectId}-v-${i + 1}`;
    return {
      id: vid,
      projectId,
      projectName,
      starId,
      starName,
      productName: r.product,
      status: r.status,
      plays: r.plays,
      durationSec: r.durationSec ?? 30,
      engine: r.engine ?? "HiGen",
      thumb: thumb(vid),
      videoUrl: pickVideo(vid),
      createdAt: d.toISOString().slice(0, 10),
    };
  });
}

export const PROJECT_VIDEOS_MAP: Record<ID, CelebrityProjectVideo[]> = {
  "proj-618-beauty": makeVideos(
    "proj-618-beauty",
    "618大促 · 美妆专场",
    "star-li-dan",
    "李诞",
    [
      { product: "玻尿酸口红 · 樱花粉", status: "已发布", plays: "62K", durationSec: 30, engine: "HiGen" },
      { product: "陶瓷烫睫毛膏", status: "已发布", plays: "48K", durationSec: 15, engine: "HiGen" },
      { product: "氨基酸洁面慕斯", status: "已发布", plays: "35K", durationSec: 30, engine: "MiniMax" },
      { product: "玻尿酸修护精华", status: "已发布", plays: "28K", durationSec: 60, engine: "MiniMax" },
      { product: "雾面唇釉 4 色礼盒", status: "已发布", plays: "21K", durationSec: 30, engine: "HiGen" },
      { product: "抗皱面霜 · 升级款", status: "已发布", plays: "18K", durationSec: 30, engine: "HiGen" },
      { product: "卸妆水 500ml", status: "已发布", plays: "14K", durationSec: 15, engine: "KeLing" },
      { product: "美白防晒霜 SPF50", status: "已发布", plays: "11K", durationSec: 30, engine: "HiGen" },
      { product: "夜间修护安瓶", status: "待审核", durationSec: 30, engine: "HiGen" },
      { product: "持妆粉饼", status: "待审核", durationSec: 30, engine: "MiniMax" },
      { product: "深层清洁泥膜", status: "生成中", durationSec: 30, engine: "HiGen" },
      { product: "玻尿酸面膜 8 片装", status: "已驳回", durationSec: 15, engine: "KeLing" },
    ],
  ),
  "proj-summer-drink": makeVideos(
    "proj-summer-drink",
    "夏季新品 · 饮料推广",
    "star-li-yuchun",
    "李宇春",
    [
      { product: "气泡水 · 青提白桃", status: "已发布", plays: "44K", durationSec: 15, engine: "HiGen" },
      { product: "0 糖燕麦奶", status: "已发布", plays: "38K", durationSec: 30, engine: "MiniMax" },
      { product: "椰子水 1L", status: "已发布", plays: "29K", durationSec: 30, engine: "HiGen" },
      { product: "现磨拿铁 · 冷萃", status: "已发布", plays: "22K", durationSec: 15, engine: "KeLing" },
      { product: "蓝莓益生菌饮", status: "已发布", plays: "18K", durationSec: 30, engine: "HiGen" },
      { product: "无糖乌龙茶", status: "待审核", durationSec: 30, engine: "MiniMax" },
      { product: "运动电解质水", status: "生成中", durationSec: 15, engine: "HiGen" },
      { product: "葡萄气泡苏打", status: "生成中", durationSec: 30, engine: "MiniMax" },
    ],
  ),
  "proj-sport-series": makeVideos(
    "proj-sport-series",
    "品牌联名 · 运动系列",
    "star-ning-zetao",
    "宁泽涛",
    [
      { product: "压缩长袖速干衣", status: "生成中", durationSec: 30, engine: "MiniMax" },
      { product: "缓震慢跑鞋", status: "生成中", durationSec: 60, engine: "HiGen" },
      { product: "轻量泳镜套装", status: "生成中", durationSec: 30, engine: "HiGen" },
    ],
  ),
  "proj-spring-festival": makeVideos(
    "proj-spring-festival",
    "春节年货 · 食品带货",
    "star-yi-nengjing",
    "伊能静",
    [
      { product: "新春礼盒 · 坚果八味", status: "已发布", plays: "180K", durationSec: 30, engine: "MiniMax", daysAgo: 90 },
      { product: "老字号牛肉干", status: "已发布", plays: "150K", durationSec: 30, engine: "HiGen", daysAgo: 92 },
      { product: "广式腊肠组合", status: "已发布", plays: "120K", durationSec: 60, engine: "MiniMax", daysAgo: 95 },
      { product: "茶礼 · 大红袍", status: "已发布", plays: "95K", durationSec: 30, engine: "HiGen", daysAgo: 98 },
      { product: "糕点 · 玫瑰鲜花饼", status: "已发布", plays: "76K", durationSec: 15, engine: "KeLing", daysAgo: 100 },
      { product: "冷链海鲜礼包", status: "已发布", plays: "61K", durationSec: 30, engine: "HiGen", daysAgo: 102 },
    ],
  ),
};

export const PROJECT_CHANNELS_MAP: Record<ID, ChannelStatus[]> =
  CELEBRITY_PROJECTS.reduce(
    (acc, p) => {
      acc[p.id] = p.channels;
      return acc;
    },
    {} as Record<ID, ChannelStatus[]>,
  );

// ── 模板模式：往期生成案例 ──────────────────────────────────────────────────
export const TEMPLATE_SHOWCASES: CelebrityShowcase[] = [
  { id: "case-1", caption: "口红 · 樱花粉", engine: "HiGen", plays: "3.2K", thumb: thumb("case-1"), videoUrl: pickVideo("case-1") },
  { id: "case-2", caption: "面霜 · 抗皱", engine: "MiniMax", plays: "5.8K", thumb: thumb("case-2"), videoUrl: pickVideo("case-2") },
  { id: "case-3", caption: "香水 · 木质调", engine: "KeLing", plays: "1.9K", thumb: thumb("case-3"), videoUrl: pickVideo("case-3") },
];

// ── 盲盒模式：往期作品 ──────────────────────────────────────────────────────
export const BLINDBOX_SHOWCASES: CelebrityShowcase[] = [
  {
    id: "bb-1",
    caption: "AI 选了种草风格",
    engine: "HiGen",
    plays: "2.1K",
    approval: "👍 88%好评",
    thumb: thumb("bb-1"),
    videoUrl: pickVideo("bb-1"),
  },
  {
    id: "bb-2",
    caption: "AI 选了剧情反转",
    engine: "MiniMax",
    plays: "4.6K",
    approval: "👍 95%好评",
    thumb: thumb("bb-2"),
    videoUrl: pickVideo("bb-2"),
  },
  {
    id: "bb-3",
    caption: "AI 选了 Vlog 风格",
    engine: "KeLing",
    plays: "1.2K",
    approval: "👍 72%好评",
    thumb: thumb("bb-3"),
    videoUrl: pickVideo("bb-3"),
  },
];

// ── 数据中心 ────────────────────────────────────────────────────────────────
export const ZONE_OVERVIEW: CelebrityZoneOverview = {
  hero: {
    totalPlays: "2.1M",
    totalConversions: "890",
    activeStars: 8,
  },
  starLeaderboard: MARKET_STARS.map((s) => ({
    starId: s.id,
    name: s.name,
    avatar: s.avatar,
    plays: s.stats.totalPlays,
    gmv: s.stats.gmv,
    videoCount: s.stats.totalGenerated,
  })).sort((a, b) => b.videoCount - a.videoCount),
  weeklyTrend: [
    { date: "2026-04-30", plays: 32100, conversions: 96 },
    { date: "2026-05-01", plays: 41200, conversions: 132 },
    { date: "2026-05-02", plays: 38800, conversions: 121 },
    { date: "2026-05-03", plays: 47500, conversions: 158 },
    { date: "2026-05-04", plays: 52300, conversions: 174 },
    { date: "2026-05-05", plays: 49600, conversions: 161 },
    { date: "2026-05-06", plays: 56400, conversions: 198 },
  ],
  channelMix: [
    { channel: "抖音", share: 0.48 },
    { channel: "快手", share: 0.22 },
    { channel: "小红书", share: 0.18 },
    { channel: "视频号", share: 0.08 },
    { channel: "B站", share: 0.04 },
  ],
};
