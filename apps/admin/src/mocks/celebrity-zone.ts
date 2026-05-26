// ─────────────────────────────────────────────────────────────────────────────
// mocks/celebrity-zone.ts — Admin AI 明星专区样本数据。
// 与服务端 CelebrityZoneDataInitializer + 前端 web mocks 保持一致。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CelebrityProject,
  CelebrityProjectVideo,
  CelebrityStar,
  CelebrityTemplate,
} from "@/types/celebrity-zone";

const today = new Date().toISOString().slice(0, 10);
const minusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const placeholderThumb = (seed: number) => `https://picsum.photos/seed/cz-${seed}/360/640`;
const placeholderVideo = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export const ADMIN_CELEBRITY_STARS: CelebrityStar[] = [
  {
    id: "star-li-dan",
    name: "李诞",
    avatar: "https://i.pravatar.cc/200?u=star-li-dan",
    cover: "https://picsum.photos/seed/star-li-dan/600/800",
    category: "演员",
    isHot: true,
    description: "脱口秀厂牌创始人，善于将商品融入轻松幽默的语境。",
    startingPrice: "¥299起",
    pricingTier: "标准版",
    quotaUsed: 12,
    quotaTotal: 50,
    authorization: {
      status: "authorized",
      scenes: ["带货", "种草"],
      expireDate: today,
      availableStyles: 5,
    },
    stats: {
      totalGenerated: 48,
      totalPlays: "12.4M",
      conversionRate: "8.2%",
      gmv: "¥1.8M",
    },
    sampleVideos: [
      { id: "sv1", label: "口红种草", category: "美妆", thumb: placeholderThumb(1), videoUrl: placeholderVideo },
    ],
    pricing: [],
  },
  {
    id: "star-yi-nengjing",
    name: "伊能静",
    avatar: "https://i.pravatar.cc/200?u=star-yi-nengjing",
    cover: "https://picsum.photos/seed/star-yi-nengjing/600/800",
    category: "歌手",
    isHot: true,
    description: "气质温婉的资深艺人，适合美妆 / 母婴品类的温情种草。",
    startingPrice: "¥499起",
    pricingTier: "标准版",
    quotaUsed: 8,
    quotaTotal: 30,
    authorization: {
      status: "authorized",
      scenes: ["带货", "种草", "测评"],
      expireDate: today,
      availableStyles: 4,
    },
    stats: {
      totalGenerated: 32,
      totalPlays: "8.7M",
      conversionRate: "9.5%",
      gmv: "¥2.3M",
    },
    sampleVideos: [],
    pricing: [],
  },
  {
    id: "star-shen-teng",
    name: "沈腾",
    avatar: "https://i.pravatar.cc/200?u=star-shen-teng",
    cover: "https://picsum.photos/seed/star-shen-teng/600/800",
    category: "演员",
    isHot: false,
    description: "喜剧风格突出，适合搞笑类轻量植入。当前未对您授权，可申请。",
    startingPrice: "¥899起",
    authorization: {
      status: "unauthorized",
      scenes: [],
      availableStyles: 6,
    },
    stats: {
      totalGenerated: 0,
      totalPlays: "—",
      conversionRate: "—",
      gmv: "—",
    },
    sampleVideos: [],
    pricing: [],
  },
];

export const ADMIN_CELEBRITY_PROJECTS: CelebrityProject[] = [
  {
    id: "proj-001",
    name: "Q3 新品种草季",
    starId: "star-li-dan",
    starName: "李诞",
    starAvatar: "https://i.pravatar.cc/200?u=star-li-dan",
    status: "进行中",
    videoCount: 6,
    totalPlays: "3.2M",
    totalInteractions: "180K",
    conversions: 420,
    gmv: "¥320K",
    createdAt: minusDays(20),
    pricingTier: "标准版",
    channels: [
      { id: "ch-douyin", name: "抖音", connected: true, publishedCount: 4 },
      { id: "ch-xhs", name: "小红书", connected: true, publishedCount: 2 },
    ],
    quota: { used: 6, total: 50 },
  },
  {
    id: "proj-002",
    name: "双 11 大促",
    starId: "star-li-dan",
    starName: "李诞",
    starAvatar: "https://i.pravatar.cc/200?u=star-li-dan",
    status: "筹备中",
    videoCount: 0,
    totalPlays: "—",
    totalInteractions: "—",
    conversions: 0,
    gmv: "—",
    createdAt: minusDays(3),
    pricingTier: "标准版",
    channels: [],
    quota: { used: 0, total: 50 },
  },
];

export const ADMIN_CELEBRITY_VIDEOS: CelebrityProjectVideo[] = [
  {
    id: "vid-001", projectId: "proj-001", projectName: "Q3 新品种草季",
    starId: "star-li-dan", starName: "李诞", productName: "玻尿酸口红",
    status: "已发布", plays: "1.2M", durationSec: 30, engine: "HiGen",
    thumb: placeholderThumb(11), videoUrl: placeholderVideo,
    createdAt: minusDays(15),
  },
  {
    id: "vid-002", projectId: "proj-001", projectName: "Q3 新品种草季",
    starId: "star-li-dan", starName: "李诞", productName: "葡萄气泡苏打",
    status: "已发布", plays: "850K", durationSec: 15, engine: "KeLing",
    thumb: placeholderThumb(12), videoUrl: placeholderVideo,
    createdAt: minusDays(12),
  },
  {
    id: "vid-003", projectId: "proj-001", projectName: "Q3 新品种草季",
    starId: "star-li-dan", starName: "李诞", productName: "压缩长袖速干衣",
    status: "生成中", durationSec: 30, engine: "MiniMax",
    thumb: placeholderThumb(13), videoUrl: placeholderVideo,
    createdAt: minusDays(1),
  },
];

export const ADMIN_CELEBRITY_TEMPLATES: CelebrityTemplate[] = [
  {
    id: "tpl-001", name: "种草日常 Vlog", style: "种草安利",
    description: "轻松日常感，自然推荐商品。",
    recommendedEngine: "HiGen", recommendedPrice: "标准",
    isHot: true, plays: "120K", conversionRate: "8.2%",
    fitHint: "适合美妆 / 食品类",
    previews: [{ thumb: placeholderThumb(21), videoUrl: placeholderVideo }],
    isFactory: true, ownerScope: "factory",
  },
  {
    id: "tpl-002", name: "硬核测评", style: "硬核测评",
    description: "专业拆解 + 数据对比，理性人群转化高。",
    recommendedEngine: "MiniMax", recommendedPrice: "高级",
    isHot: true, plays: "98K", conversionRate: "11.5%",
    fitHint: "适合数码 3C / 家电",
    previews: [{ thumb: placeholderThumb(22), videoUrl: placeholderVideo }],
    isFactory: true, ownerScope: "factory",
  },
];
