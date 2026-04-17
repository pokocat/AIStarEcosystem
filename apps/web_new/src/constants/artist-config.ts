// ─────────────────────────────────────────────────────────────────────────────
// artist-config.ts — 艺人领域的前端静态常量（UI 配置）。
// 这些是"前端该写死的"：颜色、图标、文案、六维初始/上限分值、工坊内容格式等。
// 后端不应返回这些——它们属于产品设计。
// 已从 { zh, en } 结构折叠为纯中文字符串。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ArtistStatus,
  ArtistType,
  ArtistQuality,
  TalentKey,
  TalentProfile,
} from "@/types/artist";

// ── 单个艺人类型的完整配置 ────────────────────────────────────────────────────
export interface ArtistTypeConfig {
  icon: string;
  primaryTalents: TalentKey[];
  secondaryTalents: TalentKey[];
  initialTalents: TalentProfile;
  talentCaps: TalentProfile;
  color: string;       // Tailwind class
  bgColor: string;
  borderColor: string;
  workshop: string;
  templates: string[];
  contentFormats: string[];
  monetization: string[];
  primaryDomains: string[];
  previewScene: string;
  /** 某些类型额外的人设维度滑杆（如 actor 的"可塑性"） */
  extraPersona?: string;
}

export const ARTIST_TYPE_CONFIG: Record<ArtistType, ArtistTypeConfig> = {
  singer: {
    icon: "🎤",
    primaryTalents: ["singing"],
    secondaryTalents: ["dancing"],
    initialTalents: { singing: 50, acting: 15, dancing: 25, hosting: 10, comedy: 10, variety: 15 },
    talentCaps: { singing: 100, acting: 60, dancing: 80, hosting: 40, comedy: 40, variety: 60 },
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    workshop: "音乐工坊",
    templates: ["单曲发行", "EP专辑", "Live翻唱", "对唱合作", "OST影视歌"],
    contentFormats: ["单曲(MP3/FLAC)", "MV视频", "歌词海报", "音频可视化"],
    monetization: ["流媒体版税", "演唱会票务", "音乐NFT", "广告代言"],
    primaryDomains: ["音乐", "舞台表演", "综艺"],
    previewScene: "录音棚",
  },
  actor: {
    icon: "🎬",
    primaryTalents: ["acting"],
    secondaryTalents: ["comedy"],
    initialTalents: { singing: 15, acting: 50, dancing: 15, hosting: 20, comedy: 25, variety: 20 },
    talentCaps: { singing: 60, acting: 100, dancing: 60, hosting: 70, comedy: 80, variety: 70 },
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    workshop: "影视工坊",
    templates: ["短剧(竖屏)", "微电影", "情景剧", "广告片", "配音作品"],
    contentFormats: ["视频(MP4)", "剧本(PDF)", "角色海报", "幕后花絮"],
    monetization: ["短剧分账", "广告代言", "影视授权", "粉丝打赏"],
    primaryDomains: ["影视", "商业代言", "综艺"],
    previewScene: "片场",
    extraPersona: "可塑性",
  },
  entertainer: {
    icon: "🎪",
    primaryTalents: ["comedy", "variety"],
    secondaryTalents: ["hosting"],
    initialTalents: { singing: 15, acting: 25, dancing: 15, hosting: 30, comedy: 45, variety: 45 },
    talentCaps: { singing: 60, acting: 70, dancing: 60, hosting: 85, comedy: 100, variety: 100 },
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    workshop: "综艺工坊",
    templates: ["脱口秀", "整蛊挑战", "反应视频", "问答互动", "模仿秀"],
    contentFormats: ["短视频", "直播切片", "表情包GIF", "互动H5"],
    monetization: ["广告植入", "直播打赏", "品牌合作", "表情包授权"],
    primaryDomains: ["综艺", "曲艺表演", "游戏娱乐"],
    previewScene: "综艺舞台",
    extraPersona: "幽默值",
  },
  dancer: {
    icon: "💃",
    primaryTalents: ["dancing"],
    secondaryTalents: ["singing"],
    initialTalents: { singing: 25, acting: 15, dancing: 50, hosting: 10, comedy: 15, variety: 20 },
    talentCaps: { singing: 80, acting: 60, dancing: 100, hosting: 40, comedy: 50, variety: 70 },
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    workshop: "舞蹈工坊",
    templates: ["舞蹈翻跳", "原创编舞", "舞蹈教程", "舞台秀", "挑战赛"],
    contentFormats: ["舞蹈视频", "动作数据包", "教程分步图", "3D动作预览"],
    monetization: ["教程付费", "演出票务", "品牌代言", "动作包销售"],
    primaryDomains: ["舞台表演", "音乐", "教育培训"],
    previewScene: "舞蹈教室",
  },
  host: {
    icon: "🎙",
    primaryTalents: ["hosting"],
    secondaryTalents: ["variety", "comedy"],
    initialTalents: { singing: 15, acting: 20, dancing: 10, hosting: 50, comedy: 25, variety: 35 },
    talentCaps: { singing: 50, acting: 70, dancing: 40, hosting: 100, comedy: 80, variety: 90 },
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    workshop: "直播工坊",
    templates: ["直播带货", "访谈节目", "播客电台", "知识分享", "活动主持"],
    contentFormats: ["直播回放", "播客音频", "访谈文字稿", "金句卡片"],
    monetization: ["直播带货佣金", "节目冠名", "知识付费", "活动出场费"],
    primaryDomains: ["综艺", "教育培训", "商业代言"],
    previewScene: "直播间",
  },
  all_rounder: {
    icon: "⭐",
    primaryTalents: [],
    secondaryTalents: ["singing", "acting", "dancing", "hosting", "comedy", "variety"],
    initialTalents: { singing: 30, acting: 30, dancing: 30, hosting: 30, comedy: 25, variety: 30 },
    talentCaps: { singing: 85, acting: 85, dancing: 85, hosting: 85, comedy: 85, variety: 85 },
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    workshop: "全域工坊",
    templates: ["跨界联动", "多领域合辑", "全能挑战", "IP联名"],
    contentFormats: ["全格式支持", "跨域混合内容"],
    monetization: ["多元化组合收入", "跨界合作分成"],
    primaryDomains: ["全领域均衡"],
    previewScene: "多功能舞台",
  },
  idol: {
    icon: "💎",
    primaryTalents: ["singing", "dancing"],
    secondaryTalents: ["variety"],
    initialTalents: { singing: 40, acting: 20, dancing: 35, hosting: 20, comedy: 15, variety: 30 },
    talentCaps: { singing: 95, acting: 70, dancing: 90, hosting: 70, comedy: 60, variety: 85 },
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/20",
    workshop: "偶像运营坊",
    templates: ["粉丝见面会", "应援视频", "生日会", "出道舞台", "偶像Vlog"],
    contentFormats: ["Vlog视频", "写真照片集", "周边预览图", "限定NFT"],
    monetization: ["粉丝打赏/应援", "NFT限定", "周边商品", "代言", "演出"],
    primaryDomains: ["音乐", "综艺", "商业代言", "舞台"],
    previewScene: "偶像舞台",
    extraPersona: "亲和力",
  },
};

// ── 艺人类型中文标签 ──────────────────────────────────────────────────────────
export const ARTIST_TYPE_LABELS: Record<ArtistType, string> = {
  singer: "歌手",
  actor: "演员",
  entertainer: "综艺咖",
  dancer: "舞者",
  host: "主持人",
  all_rounder: "全能艺人",
  idol: "偶像",
};

// ── 品质样式 ──────────────────────────────────────────────────────────────────
export interface QualityStyle {
  label: string;
  color: string;
  border: string;
  bg: string;
}

export const QUALITY_CONFIG: Record<ArtistQuality, QualityStyle> = {
  common: { label: "普通", color: "text-gray-400", border: "border-gray-600", bg: "bg-gray-500/10" },
  rare: { label: "稀有", color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10" },
  epic: { label: "史诗", color: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10" },
  legendary: { label: "传说", color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10" },
};

// ── 状态样式 ──────────────────────────────────────────────────────────────────
export interface StatusStyle {
  label: string;
  color: string;
  dot: string;
}

export const STATUS_CONFIG: Record<ArtistStatus, StatusStyle> = {
  trainee: { label: "练习生", color: "text-gray-400", dot: "bg-gray-400" },
  debut: { label: "新人", color: "text-blue-400", dot: "bg-blue-400" },
  active: { label: "活跃", color: "text-green-400", dot: "bg-green-400" },
  rest: { label: "休息中", color: "text-amber-400", dot: "bg-amber-400" },
  retired: { label: "已退役", color: "text-red-400", dot: "bg-red-400" },
};

// ── 六维才艺标签 ──────────────────────────────────────────────────────────────
export interface TalentLabel {
  label: string;
  color: string; // hex for canvas
}

export const TALENT_LABELS: Record<TalentKey, TalentLabel> = {
  singing: { label: "唱功", color: "#06b6d4" },
  acting: { label: "演技", color: "#a855f7" },
  dancing: { label: "舞蹈", color: "#ec4899" },
  hosting: { label: "主持", color: "#f59e0b" },
  comedy: { label: "喜剧", color: "#22c55e" },
  variety: { label: "综艺感", color: "#ef4444" },
};

// ── 8 大娱乐领域 ─────────────────────────────────────────────────────────────
export interface DomainInfo {
  id: string;
  label: string;
  color: string;
  bg: string;
}

export const DOMAINS_8: DomainInfo[] = [
  { id: "music",       label: "音乐",     color: "text-cyan-400",   bg: "bg-cyan-500/10" },
  { id: "film",        label: "影视",     color: "text-purple-400", bg: "bg-purple-500/10" },
  { id: "endorsement", label: "商业代言", color: "text-pink-400",   bg: "bg-pink-500/10" },
  { id: "variety",     label: "综艺节目", color: "text-amber-400",  bg: "bg-amber-500/10" },
  { id: "performing",  label: "曲艺表演", color: "text-green-400",  bg: "bg-green-500/10" },
  { id: "stage",       label: "舞台表演", color: "text-red-400",    bg: "bg-red-500/10" },
  { id: "education",   label: "教育培训", color: "text-blue-400",   bg: "bg-blue-500/10" },
  { id: "gaming",      label: "游戏娱乐", color: "text-indigo-400", bg: "bg-indigo-500/10" },
];
