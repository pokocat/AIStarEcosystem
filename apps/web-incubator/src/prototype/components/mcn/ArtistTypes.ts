// ============================================================
// AI Artist Incubation Platform — Shared Types & Mock Data
// ============================================================

export type ArtistType = 'singer' | 'actor' | 'entertainer' | 'dancer' | 'host' | 'all_rounder' | 'idol';
export type Quality = 'common' | 'rare' | 'epic' | 'legendary';
export type ArtistStatus = 'trainee' | 'debut' | 'active' | 'rest' | 'retired';
export type DesignStyle = 'hyperreal' | 'anime' | 'chinoiserie' | 'cyber_mecha' | 'y2k' | 'pixel' | 'dreamcore' | 'gothic';
export type ProfessionBackground = 'teacher' | 'entrepreneur' | 'lawyer' | 'doctor' | 'athlete' | 'influencer' | 'artist' | 'scientist' | 'chef' | 'designer';

export const PROFESSION_CONFIG: Record<ProfessionBackground, {
  zh: string; en: string; emoji: string;
  desc_zh: string; desc_en: string;
  color: string; bg: string;
}> = {
  teacher:      { zh: '讲师',   en: 'Teacher',      emoji: 'TCH', desc_zh: '知识分享者，擅长教育内容', desc_en: 'Knowledge sharer, educational content', color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  entrepreneur: { zh: '企业家', en: 'Entrepreneur', emoji: 'CEO', desc_zh: '商业领袖，创业经验丰富', desc_en: 'Business leader, startup expert', color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  lawyer:       { zh: '律师',   en: 'Lawyer',       emoji: 'LAW', desc_zh: '法律专家，权威专业知识', desc_en: 'Legal expert, authoritative', color: 'text-purple-400',  bg: 'bg-purple-500/10' },
  doctor:       { zh: '医生',   en: 'Doctor',       emoji: 'DOC', desc_zh: '医疗专家，健康知识传播', desc_en: 'Medical expert, health advocate', color: 'text-green-400',   bg: 'bg-green-500/10' },
  athlete:      { zh: '运动员', en: 'Athlete',      emoji: 'ATH', desc_zh: '体育健将，活力与竞技', desc_en: 'Sports champion, energetic', color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  influencer:   { zh: '网红',   en: 'Influencer',   emoji: 'INF', desc_zh: '社交达人，粉丝运营高手', desc_en: 'Social media star, fan engagement', color: 'text-pink-400',    bg: 'bg-pink-500/10' },
  artist:       { zh: '艺术家', en: 'Artist',       emoji: 'ART', desc_zh: '创作者，艺术感知敏锐', desc_en: 'Creator, artistic sensitivity', color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  scientist:    { zh: '科学家', en: 'Scientist',    emoji: 'SCI', desc_zh: '研究者，科技知识普及', desc_en: 'Researcher, science communicator', color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  chef:         { zh: '厨师',   en: 'Chef',         emoji: 'CHF', desc_zh: '美食专家，烹饪内容创作', desc_en: 'Culinary expert, food content', color: 'text-red-400',     bg: 'bg-red-500/10' },
  designer:     { zh: '设计师', en: 'Designer',     emoji: 'DES', desc_zh: '设计师，审美与创意', desc_en: 'Designer, aesthetic & creative', color: 'text-violet-400',  bg: 'bg-violet-500/10' },
};

export const PROFESSION_ORDER: ProfessionBackground[] = ['teacher', 'entrepreneur', 'lawyer', 'doctor', 'athlete', 'influencer', 'artist', 'scientist', 'chef', 'designer'];

// ---- 用户自定义标签系统 ----
export interface CustomTag {
  id: string;
  name: string;
  color: string; // hex color for the tag
  createdAt: string;
  description?: string;
}

export const TAG_COLORS = [
  { name: 'cyan', hex: '#06b6d4', bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/40' },
  { name: 'green', hex: '#10b981', bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/40' },
  { name: 'amber', hex: '#f59e0b', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/40' },
  { name: 'red', hex: '#ef4444', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/40' },
  { name: 'purple', hex: '#a855f7', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/40' },
  { name: 'pink', hex: '#ec4899', bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/40' },
  { name: 'blue', hex: '#3b82f6', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/40' },
  { name: 'orange', hex: '#f97316', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/40' },
  { name: 'emerald', hex: '#34d399', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/40' },
  { name: 'violet', hex: '#8b5cf6', bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/40' },
] as const;

// 预设的一些标签示例（用户可以修改、删除）
export const DEFAULT_CUSTOM_TAGS: CustomTag[] = [
  { id: 'tag-1', name: '重点培养', color: '#10b981', createdAt: '2025-01-01', description: '高潜力艺人，重点资源投入' },
  { id: 'tag-2', name: '暂停推广', color: '#ef4444', createdAt: '2025-01-01', description: '暂时停止推广活动' },
  { id: 'tag-3', name: '合作洽谈', color: '#f59e0b', createdAt: '2025-01-01', description: '正在洽谈商业合作' },
  { id: 'tag-4', name: '高潜力', color: '#06b6d4', createdAt: '2025-01-01', description: '数据增长快速，未来可期' },
  { id: 'tag-5', name: '已签约', color: '#a855f7', createdAt: '2025-01-01', description: '已完成签约流程' },
];

export const DESIGN_STYLE_CONFIG: Record<DesignStyle, {
  zh: string; en: string; emoji: string;
  desc_zh: string; desc_en: string;
  gradient: string;   // hero banner gradient
  accent: string;     // accent color hex
  ring: string;       // tailwind ring class
}> = {
  hyperreal:    { zh: '超写实',   en: 'Hyperreal',   emoji: 'HPR', desc_zh: '影视级 CGI，仿真人皮肤纹理与自然光影', desc_en: 'Cinematic CGI with realistic skin & lighting', gradient: 'from-amber-500/20 via-orange-500/10 to-rose-500/15', accent: '#f59e0b', ring: 'ring-amber-500/40' },
  anime:        { zh: '二次元',   en: 'Anime',       emoji: 'ANI', desc_zh: '日系动漫赛璐璐，精致大眼少年感', desc_en: 'Japanese cel-shaded anime aesthetic', gradient: 'from-pink-500/25 via-fuchsia-500/15 to-violet-500/20', accent: '#ec4899', ring: 'ring-pink-500/40' },
  chinoiserie:  { zh: '国潮古风', en: 'Chinoiserie', emoji: 'CHN', desc_zh: '水墨工笔与汉服元素，朱砂鎏金', desc_en: 'Ink-wash & hanfu, vermilion and gold', gradient: 'from-red-600/25 via-amber-600/15 to-yellow-700/20', accent: '#dc2626', ring: 'ring-red-500/40' },
  cyber_mecha:  { zh: '赛博机甲', en: 'Cyber Mecha', emoji: 'MEC', desc_zh: '机械义体与 HUD 数据流，高科技未来', desc_en: 'Mech limbs & HUD data streams', gradient: 'from-cyan-500/25 via-violet-500/15 to-purple-600/20', accent: '#06b6d4', ring: 'ring-cyan-500/40' },
  y2k:          { zh: 'Y2K 潮酷', en: 'Y2K Pop',     emoji: 'Y2K', desc_zh: '千禧年镭射金属感，泡泡字体潮人', desc_en: 'Y2K chrome and bubble pop', gradient: 'from-fuchsia-500/25 via-cyan-400/15 to-lime-400/20', accent: '#d946ef', ring: 'ring-fuchsia-500/40' },
  pixel:        { zh: '像素复古', en: 'Pixel Retro', emoji: 'PIX', desc_zh: '8/16-bit 像素艺术，复古游戏机美学', desc_en: '8/16-bit pixel art, retro game vibe', gradient: 'from-emerald-500/25 via-teal-500/15 to-blue-600/20', accent: '#10b981', ring: 'ring-emerald-500/40' },
  dreamcore:    { zh: '梦核治愈', en: 'Dreamcore',   emoji: 'DRM', desc_zh: '柔焦油画质感，莫兰迪空灵治愈', desc_en: 'Soft-focus painterly Morandi mood', gradient: 'from-rose-300/20 via-blue-300/15 to-violet-300/20', accent: '#fda4af', ring: 'ring-rose-300/40' },
  gothic:       { zh: '暗黑哥特', en: 'Dark Gothic', emoji: 'GTH', desc_zh: '暗黑废土十字银饰，血红与漆黑', desc_en: 'Gothic dark wasteland, crimson & black', gradient: 'from-red-900/30 via-zinc-800/20 to-black/30', accent: '#991b1b', ring: 'ring-red-900/50' },
};

export const DESIGN_STYLE_ORDER: DesignStyle[] = ['hyperreal', 'anime', 'chinoiserie', 'cyber_mecha', 'y2k', 'pixel', 'dreamcore', 'gothic'];

export interface TalentProfile {
  singing: number;
  acting: number;
  dancing: number;
  hosting: number;
  comedy: number;
  variety: number;
}

export interface ArtistStats {
  songs: number;
  dramas: number;
  ads: number;
  variety: number;
  fans: string;
  revenue: string;
  monthlyRevenue: string;
  popularity: number;
  // ---- 新增商业化指标 ----
  views24h?: string;        // 24h 曝光(如 "2.4M")
  comments24h?: string;     // 24h 评论数(如 "8.2K")
  liveCommerceGMV?: string; // 带货 GMV(如 "¥86K")
  growth7d?: number;        // 7日粉丝增长率(百分比,可正负)
  engagement?: number;      // 互动率(0-100)
}

export type Platform = 'douyin' | 'wechat_channels' | 'xiaohongshu' | 'bilibili' | 'weibo' | 'youtube' | 'tiktok' | 'instagram' | 'spotify';

// ---- 私域平台类型定义 ----
export type PrivateDomainType = 'wework' | 'wechat_group';

export interface PrivatePlatformAccount {
  type: PrivateDomainType;
  name: string;              // 企微名称或群名
  handle: string;            // 账号标识
  url?: string;              // 可选的管理后台链接
  verified: boolean;
  // 通用指标
  members: string;           // 好友数/群成员数
  activeMembers: string;     // 活跃成员数
  growth7d: number;          // 7日增长率
  engagement: number;        // 互动率
  // 来源分析
  sourceBreakdown?: {        // 来源渠道分布
    platform: string;        // 公域平台名称
    count: number;           // 转化人数
    percent: number;         // 占比
  }[];
  // 转化数据
  conversionRate?: number;   // 公域→私域转化率
  purchaseRate?: number;     // 购买转化率
  avgOrderValue?: string;    // 客单价
  totalRevenue?: string;     // 总GMV
  // 运营数据
  latestActivity: string;    // 最新动态
  latestAt: string;          // 最后活跃时间
  contentCount?: number;     // 发送内容数（朋友圈/群消息）
  replyRate?: number;        // 回复率
  // 私域专属
  weworkDetails?: {          // 企业微信专属数据
    tags?: string[];         // 用户标签
    groupsCount?: number;    // 所属群数量
    avgChatDuration?: string;// 平均聊天时长
  };
  wechatGroupDetails?: {     // 微信群专属数据
    notice?: string;         // 群公告
    adminCount?: number;     // 管理员数量
    newJoinToday?: number;   // 今日新增
  };
  syncStatus: 'synced' | 'syncing' | 'error' | 'manual';
}

// 粉丝CRM数据
export interface FanProfile {
  id: string;
  name: string;
  avatar?: string;
  source: string;            // 来源平台
  joinedAt: string;          // 加入时间
  totalSpent: string;        // 累计消费
  orderCount: number;        // 订单数
  lastActive: string;        // 最后活跃
  tags?: string[];           // 用户标签
  engagement: number;        // 互动度评分
  location?: string;         // 地区
  ageRange?: string;         // 年龄段
}

export interface RecentPost {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail?: string;
  plays?: string;
  likes?: string;
  comments?: string;
  shares?: string;
  duration?: string;      // e.g. "3:24" for video/music
  isViral?: boolean;
}

export interface PlatformAccount {
  platform: Platform;
  handle: string;
  url?: string;
  verified: boolean;
  fans: string;
  growth7d: number;       // pct
  engagement: number;     // 0-100
  posts: number;
  views30d: string;
  latestTitle: string;
  latestAt: string;       // ISO date or relative
  syncStatus: 'synced' | 'syncing' | 'error' | 'manual';
  // ---- 新增商业数据指标 ----
  totalPlays?: string;    // 累计播放量
  totalLikes?: string;    // 累计点赞
  totalComments?: string; // 累计评论
  totalShares?: string;   // 累计分享
  avgPlays?: string;      // 平均播放量
  avgEngagement?: number; // 平均互动率 (0-100)
  peakViews24h?: string;  // 24h 峰值曝光
  liveStreamRevenue?: string; // 直播收入
  adRevenue?: string;     // 广告分成
  recentPosts?: RecentPost[]; // 最近视频/内容列表(最多5条)
}

export type AuthorizationType = 'image' | 'voice' | 'performance' | 'ip_adapt' | 'live_avatar';
export type AuthorizationStatus = 'active' | 'expiring' | 'expired' | 'paused' | 'violation';

export interface Authorization {
  id: string;
  granteeName: string;
  granteeAvatar?: string;
  type: AuthorizationType;
  scope: string[];
  startedAt: string;
  expiresAt: string;
  revenueShare: number;      // pct to artist owner
  totalProduced: number;     // # of works produced under this license
  totalRevenue: string;
  status: AuthorizationStatus;
  violations?: number;
}

export type ContentType = 'music' | 'drama' | 'ad' | 'variety' | 'live_clip';

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  platform: Platform;
  thumbnail?: string;
  publishedAt: string;
  plays: string;
  likes: string;
  comments: string;
  revenue: string;
  trend: number[];           // 7-pt sparkline
  isViral?: boolean;
}

export const PLATFORM_CONFIG: Record<Platform, { zh: string; en: string; emoji: string; color: string; bg: string }> = {
  douyin:          { zh: '抖音',      en: 'Douyin',      emoji: 'DY',  color: 'text-pink-400',    bg: 'bg-pink-500/10' },
  wechat_channels: { zh: '视频号',    en: 'Channels',    emoji: 'VCH', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  xiaohongshu:     { zh: '小红书',    en: 'Red Note',    emoji: 'XHS', color: 'text-red-400',     bg: 'bg-red-500/10' },
  bilibili:        { zh: 'B站',       en: 'Bilibili',    emoji: 'BL',  color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  weibo:           { zh: '微博',      en: 'Weibo',       emoji: 'WB',  color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  youtube:         { zh: 'YouTube',   en: 'YouTube',     emoji: 'YT',  color: 'text-red-500',     bg: 'bg-red-500/10' },
  tiktok:          { zh: 'TikTok',    en: 'TikTok',      emoji: 'TK',  color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  instagram:       { zh: 'Instagram', en: 'Instagram',   emoji: 'IG',  color: 'text-rose-400',    bg: 'bg-rose-500/10' },
  spotify:         { zh: 'Spotify',   en: 'Spotify',     emoji: 'SPT', color: 'text-green-400',   bg: 'bg-green-500/10' },
};

// 私域平台配置
export const PRIVATE_DOMAIN_CONFIG: Record<PrivateDomainType, { zh: string; en: string; emoji: string; color: string; bg: string }> = {
  wework:        { zh: '企业微信',    en: 'WeWork',       emoji: 'WW',  color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  wechat_group:  { zh: '微信群',      en: 'WeChat Group', emoji: 'GRP', color: 'text-green-400',  bg: 'bg-green-500/10' },
};

export const AUTHORIZATION_TYPE_CONFIG: Record<AuthorizationType, { zh: string; en: string; color: string; bg: string }> = {
  image:        { zh: '形象使用', en: 'Image Use',     color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
  voice:        { zh: '语音克隆', en: 'Voice Clone',   color: 'text-purple-400', bg: 'bg-purple-500/10' },
  performance:  { zh: '表演授权', en: 'Performance',   color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  ip_adapt:     { zh: 'IP 改编',  en: 'IP Adapt',      color: 'text-pink-400',   bg: 'bg-pink-500/10' },
  live_avatar:  { zh: '直播分身', en: 'Live Avatar',   color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
};

export const AUTH_STATUS_CONFIG: Record<AuthorizationStatus, { zh: string; en: string; color: string; dot: string }> = {
  active:    { zh: '生效中',  en: 'Active',     color: 'text-green-400',  dot: 'bg-green-400' },
  expiring:  { zh: '即将到期',en: 'Expiring',   color: 'text-amber-400',  dot: 'bg-amber-400' },
  expired:   { zh: '已过期',  en: 'Expired',    color: 'text-gray-400',   dot: 'bg-gray-400' },
  paused:    { zh: '已暂停',  en: 'Paused',     color: 'text-blue-400',   dot: 'bg-blue-400' },
  violation: { zh: '违规处理',en: 'Violation',  color: 'text-red-400',    dot: 'bg-red-400' },
};

export interface Artist {
  id: string;
  name: string;
  type: ArtistType;
  designStyle: DesignStyle;
  quality: Quality;
  status: ArtistStatus;
  level: number;
  exp: number;
  maxExp: number;
  avatar: string;
  portrait?: string; // larger portrait image for matrix card hero
  talents: TalentProfile;
  stats: ArtistStats;
  createdAt: string;
  lastActive: string;
  bio: string;
  domains: string[];
  endorsements: number;
  commercialValue: string;
  platforms?: PlatformAccount[];
  authorizations?: Authorization[];
  contentLibrary?: ContentItem[];
  // ---- 职业身份相关 ----
  profession?: ProfessionBackground;  // 主职业背景
  customTagIds?: string[];            // 用户自定义标签ID列表
  // ---- 私域平台相关 ----
  privatePlatforms?: PrivatePlatformAccount[];  // 企微/微信群账号
  fanProfiles?: FanProfile[];                   // 粉丝CRM数据
}

// ---- Type Config: talent caps, initial values, color theme, workshop ----

export interface TypeConfig {
  icon: string; // short text abbr for quick display (e.g. 'SNG', 'ACT')
  primaryTalents: (keyof TalentProfile)[];
  secondaryTalents: (keyof TalentProfile)[];
  initialTalents: TalentProfile;
  talentCaps: TalentProfile;
  color: string;
  bgColor: string;
  borderColor: string;
  workshop: { zh: string; en: string };
  templates: { zh: string[]; en: string[] };
  contentFormats: { zh: string[]; en: string[] };
  monetization: { zh: string[]; en: string[] };
  primaryDomains: { zh: string[]; en: string[] };
  previewScene: { zh: string; en: string };
  extraPersona?: { zh: string; en: string }; // additional persona slider for this type
}

export const ARTIST_TYPE_CONFIG: Record<ArtistType, TypeConfig> = {
  singer: {
    icon: 'SNG',
    primaryTalents: ['singing'],
    secondaryTalents: ['dancing'],
    initialTalents: { singing: 50, acting: 15, dancing: 25, hosting: 10, comedy: 10, variety: 15 },
    talentCaps: { singing: 100, acting: 60, dancing: 80, hosting: 40, comedy: 40, variety: 60 },
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    workshop: { zh: '音乐工坊', en: 'Music Studio' },
    templates: {
      zh: ['单曲发行', 'EP专辑', 'Live翻唱', '对唱合作', 'OST影视歌'],
      en: ['Single Release', 'EP Album', 'Live Cover', 'Duet Collab', 'OST Soundtrack']
    },
    contentFormats: {
      zh: ['单曲(MP3/FLAC)', 'MV视频', '歌词海报', '音频可视化'],
      en: ['Single(MP3/FLAC)', 'Music Video', 'Lyric Poster', 'Audio Visualizer']
    },
    monetization: {
      zh: ['流媒体版税', '演唱会票务', '音乐NFT', '广告代言'],
      en: ['Streaming Royalty', 'Concert Tickets', 'Music NFT', 'Brand Deal']
    },
    primaryDomains: { zh: ['音乐', '舞台表演', '综艺'], en: ['Music', 'Stage', 'Variety'] },
    previewScene: { zh: '录音棚', en: 'Recording Studio' },
  },
  actor: {
    icon: 'ACT',
    primaryTalents: ['acting'],
    secondaryTalents: ['comedy'],
    initialTalents: { singing: 15, acting: 50, dancing: 15, hosting: 20, comedy: 25, variety: 20 },
    talentCaps: { singing: 60, acting: 100, dancing: 60, hosting: 70, comedy: 80, variety: 70 },
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    workshop: { zh: '影视工坊', en: 'Film Studio' },
    templates: {
      zh: ['短剧(竖屏)', '微电影', '情景剧', '广告片', '配音作品'],
      en: ['Short Drama', 'Micro Film', 'Sitcom', 'Commercial', 'Voice Acting']
    },
    contentFormats: {
      zh: ['视频(MP4)', '剧本(PDF)', '角色海报', '幕后花絮'],
      en: ['Video(MP4)', 'Script(PDF)', 'Character Poster', 'Behind Scenes']
    },
    monetization: {
      zh: ['短剧分账', '广告代言', '影视授权', '粉丝打赏'],
      en: ['Drama Revenue', 'Brand Deal', 'Film License', 'Fan Tips']
    },
    primaryDomains: { zh: ['影视', '商业代言', '综艺'], en: ['Film & TV', 'Endorsement', 'Variety'] },
    previewScene: { zh: '片场', en: 'Film Set' },
    extraPersona: { zh: '可塑性', en: 'Versatility' },
  },
  entertainer: {
    icon: 'ENT',
    primaryTalents: ['comedy', 'variety'],
    secondaryTalents: ['hosting'],
    initialTalents: { singing: 15, acting: 25, dancing: 15, hosting: 30, comedy: 45, variety: 45 },
    talentCaps: { singing: 60, acting: 70, dancing: 60, hosting: 85, comedy: 100, variety: 100 },
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    workshop: { zh: '综艺工坊', en: 'Variety Studio' },
    templates: {
      zh: ['脱口秀', '整蛊挑战', '反应视频', '问答互动', '模仿秀'],
      en: ['Talk Show', 'Prank Challenge', 'Reaction', 'Q&A', 'Impression']
    },
    contentFormats: {
      zh: ['短视频', '直播切片', '表情包GIF', '互动H5'],
      en: ['Short Video', 'Live Clips', 'Meme GIF', 'Interactive H5']
    },
    monetization: {
      zh: ['广告植入', '直播打赏', '品牌合作', '表情包授权'],
      en: ['Ad Placement', 'Live Tips', 'Brand Collab', 'Meme License']
    },
    primaryDomains: { zh: ['综艺', '曲艺表演', '游戏娱乐'], en: ['Variety', 'Performing Arts', 'Gaming'] },
    previewScene: { zh: '综艺舞台', en: 'Variety Stage' },
    extraPersona: { zh: '幽默值', en: 'Humor' },
  },
  dancer: {
    icon: 'DNC',
    primaryTalents: ['dancing'],
    secondaryTalents: ['singing'],
    initialTalents: { singing: 25, acting: 15, dancing: 50, hosting: 10, comedy: 15, variety: 20 },
    talentCaps: { singing: 80, acting: 60, dancing: 100, hosting: 40, comedy: 50, variety: 70 },
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    workshop: { zh: '舞蹈工坊', en: 'Dance Studio' },
    templates: {
      zh: ['舞蹈翻跳', '原创编舞', '舞蹈教程', '舞台秀', '挑战赛'],
      en: ['Dance Cover', 'Original Choreo', 'Tutorial', 'Stage Show', 'Challenge']
    },
    contentFormats: {
      zh: ['舞蹈视频', '动作数据包', '教程分步图', '3D动作预览'],
      en: ['Dance Video', 'Motion Data', 'Step Guide', '3D Motion Preview']
    },
    monetization: {
      zh: ['教程付费', '演出票务', '品牌代言', '动作包销售'],
      en: ['Tutorial Fee', 'Show Tickets', 'Brand Deal', 'Motion Pack Sales']
    },
    primaryDomains: { zh: ['舞台表演', '音乐', '教育培训'], en: ['Stage', 'Music', 'Education'] },
    previewScene: { zh: '舞蹈教室', en: 'Dance Room' },
  },
  host: {
    icon: 'HST',
    primaryTalents: ['hosting'],
    secondaryTalents: ['variety', 'comedy'],
    initialTalents: { singing: 15, acting: 20, dancing: 10, hosting: 50, comedy: 25, variety: 35 },
    talentCaps: { singing: 50, acting: 70, dancing: 40, hosting: 100, comedy: 80, variety: 90 },
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    workshop: { zh: '直播工坊', en: 'Live Studio' },
    templates: {
      zh: ['直播带货', '访谈节目', '播客电台', '知识分享', '活动主持'],
      en: ['Live Commerce', 'Interview', 'Podcast', 'Knowledge Share', 'Event Host']
    },
    contentFormats: {
      zh: ['直播回放', '播客音频', '访谈文字稿', '金句卡片'],
      en: ['Live Replay', 'Podcast Audio', 'Transcript', 'Quote Cards']
    },
    monetization: {
      zh: ['直播带货佣金', '节目冠名', '知识付费', '活动出场费'],
      en: ['Commerce Commission', 'Show Sponsor', 'Paid Course', 'Event Fee']
    },
    primaryDomains: { zh: ['综艺', '教育培训', '商业代言'], en: ['Variety', 'Education', 'Endorsement'] },
    previewScene: { zh: '直播间', en: 'Live Stream Room' },
  },
  all_rounder: {
    icon: 'STR',
    primaryTalents: [],
    secondaryTalents: ['singing', 'acting', 'dancing', 'hosting', 'comedy', 'variety'],
    initialTalents: { singing: 30, acting: 30, dancing: 30, hosting: 30, comedy: 25, variety: 30 },
    talentCaps: { singing: 85, acting: 85, dancing: 85, hosting: 85, comedy: 85, variety: 85 },
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    workshop: { zh: '全域工坊', en: 'Universal Studio' },
    templates: {
      zh: ['跨界联动', '多领域合辑', '全能挑战', 'IP联名'],
      en: ['Crossover', 'Multi-domain Album', 'All-Round Challenge', 'IP Collab']
    },
    contentFormats: {
      zh: ['全格式支持', '跨域混合内容'],
      en: ['All Formats', 'Cross-domain Content']
    },
    monetization: {
      zh: ['多元化组合收入', '跨界合作分成'],
      en: ['Diversified Revenue', 'Crossover Split']
    },
    primaryDomains: { zh: ['全领域均衡'], en: ['All Domains'] },
    previewScene: { zh: '多功能舞台', en: 'Multi-purpose Stage' },
  },
  idol: {
    icon: 'IDL',
    primaryTalents: ['singing', 'dancing'],
    secondaryTalents: ['variety'],
    initialTalents: { singing: 40, acting: 20, dancing: 35, hosting: 20, comedy: 15, variety: 30 },
    talentCaps: { singing: 95, acting: 70, dancing: 90, hosting: 70, comedy: 60, variety: 85 },
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    workshop: { zh: '偶像运营坊', en: 'Idol Workshop' },
    templates: {
      zh: ['粉丝见面会', '应援视频', '生日会', '出道舞台', '偶像Vlog'],
      en: ['Fan Meeting', 'Cheer Video', 'Birthday Event', 'Debut Stage', 'Idol Vlog']
    },
    contentFormats: {
      zh: ['Vlog视频', '写真照片集', '周边预览图', '限定NFT'],
      en: ['Vlog', 'Photo Album', 'Merch Preview', 'Limited NFT']
    },
    monetization: {
      zh: ['粉丝打赏/应援', 'NFT限定', '周边商品', '代言', '演出'],
      en: ['Fan Tips', 'Limited NFT', 'Merchandise', 'Endorsement', 'Performance']
    },
    primaryDomains: { zh: ['音乐', '综艺', '商业代言', '舞台'], en: ['Music', 'Variety', 'Endorsement', 'Stage'] },
    previewScene: { zh: '偶像舞台', en: 'Idol Stage' },
    extraPersona: { zh: '亲和力', en: 'Charm' },
  },
};

export const ARTIST_TYPE_LABELS: Record<ArtistType, { zh: string; en: string }> = {
  singer: { zh: '歌手', en: 'Singer' },
  actor: { zh: '演员', en: 'Actor' },
  entertainer: { zh: '综艺咖', en: 'Entertainer' },
  dancer: { zh: '舞者', en: 'Dancer' },
  host: { zh: '主持人', en: 'Host' },
  all_rounder: { zh: '全能艺人', en: 'All-Rounder' },
  idol: { zh: '偶像', en: 'Idol' },
};

export const QUALITY_CONFIG: Record<Quality, { zh: string; en: string; color: string; border: string; bg: string }> = {
  common: { zh: '普通', en: 'Common', color: 'text-gray-400', border: 'border-gray-600', bg: 'bg-gray-500/10' },
  rare: { zh: '稀有', en: 'Rare', color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  epic: { zh: '史诗', en: 'Epic', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  legendary: { zh: '传说', en: 'Legendary', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
};

export const STATUS_CONFIG: Record<ArtistStatus, { zh: string; en: string; color: string; dot: string }> = {
  trainee: { zh: '练习生', en: 'Trainee', color: 'text-gray-400', dot: 'bg-gray-400' },
  debut: { zh: '新人', en: 'Debut', color: 'text-blue-400', dot: 'bg-blue-400' },
  active: { zh: '活跃', en: 'Active', color: 'text-green-400', dot: 'bg-green-400' },
  rest: { zh: '休息中', en: 'Resting', color: 'text-amber-400', dot: 'bg-amber-400' },
  retired: { zh: '已退役', en: 'Retired', color: 'text-red-400', dot: 'bg-red-400' },
};

export const TALENT_LABELS: Record<keyof TalentProfile, { zh: string; en: string; color: string }> = {
  singing: { zh: '唱功', en: 'Vocal', color: '#06b6d4' },
  acting: { zh: '演技', en: 'Acting', color: '#a855f7' },
  dancing: { zh: '舞蹈', en: 'Dance', color: '#ec4899' },
  hosting: { zh: '主持', en: 'Host', color: '#f59e0b' },
  comedy: { zh: '喜剧', en: 'Comedy', color: '#22c55e' },
  variety: { zh: '综艺感', en: 'Variety', color: '#ef4444' },
};

// ---- Mock Artists Data ----

export const MOCK_ARTISTS: Artist[] = [
  {
    id: '1', name: 'Neon V', type: 'singer', designStyle: 'cyber_mecha', quality: 'epic', status: 'active', level: 42, exp: 7800, maxExp: 10000,
    avatar: 'https://images.unsplash.com/photo-1745532665626-09f20c9408dd?w=200&q=80',
    portrait: 'https://images.unsplash.com/photo-1745532665626-09f20c9408dd?w=900&q=85',
    talents: { singing: 88, acting: 32, dancing: 65, hosting: 18, comedy: 22, variety: 45 },
    stats: { songs: 24, dramas: 1, ads: 5, variety: 3, fans: '128K', revenue: '¥452,000', monthlyRevenue: '¥45,200', popularity: 87, views24h: '2.4M', comments24h: '12.8K', liveCommerceGMV: '¥124K', growth7d: 8.2, engagement: 76 },
    createdAt: '2024-01-15', lastActive: '2025-04-14', bio: 'Cyberpunk风格AI歌手，擅长电子音乐和未来感旋律。',
    domains: ['音乐', '舞台表演'], endorsements: 5, commercialValue: '¥1.2M',
    profession: 'scientist', customTagIds: ['tag-4', 'tag-5'],
    privatePlatforms: [
      { type: 'wework', name: 'Neon V官方企微', handle: '@neonv_official', verified: true, members: '8.2K', activeMembers: '6.1K', growth7d: 12.3, engagement: 68, 
        sourceBreakdown: [{ platform: '抖音', count: 4800, percent: 58.5 }, { platform: 'B站', count: 2200, percent: 26.8 }, { platform: '小红书', count: 1200, percent: 14.6 }],
        conversionRate: 6.4, purchaseRate: 18.5, avgOrderValue: '¥168', totalRevenue: '¥1.24M', latestActivity: '发送新单预告海报', latestAt: '3小时前', contentCount: 128, replyRate: 92,
        weworkDetails: { tags: ['VIP粉丝', '高消费', '音乐爱好者'], groupsCount: 3, avgChatDuration: '4.2分钟' }, syncStatus: 'synced' },
      { type: 'wechat_group', name: 'Neon V粉丝后援会', handle: 'neonv-fans-001', verified: true, members: '498', activeMembers: '312', growth7d: 8.6, engagement: 74,
        sourceBreakdown: [{ platform: '企业微信', count: 498, percent: 100 }], purchaseRate: 24.2, totalRevenue: '¥82K', latestActivity: '群公告：周五晚8点线上见面会', latestAt: '1小时前',
        wechatGroupDetails: { notice: '[MUS] Neon V官方粉丝群 | 每周五晚8点互动 | 禁广告', adminCount: 3, newJoinToday: 12 }, syncStatus: 'synced' },
    ],
  },
  {
    id: '2', name: 'Luna Soft', type: 'idol', designStyle: 'anime', quality: 'legendary', status: 'active', level: 58, exp: 4200, maxExp: 12000,
    avatar: 'https://images.unsplash.com/photo-1596395463910-3ac2899a5bea?w=200&q=80',
    portrait: 'https://images.unsplash.com/photo-1596395463910-3ac2899a5bea?w=900&q=85',
    talents: { singing: 78, acting: 45, dancing: 82, hosting: 38, comedy: 28, variety: 72 },
    stats: { songs: 18, dramas: 3, ads: 12, variety: 8, fans: '326K', revenue: '¥1,280,000', monthlyRevenue: '¥128,000', popularity: 95, views24h: '8.6M', comments24h: '45.2K', liveCommerceGMV: '¥482K', growth7d: 12.4, engagement: 89 },
    createdAt: '2023-11-20', lastActive: '2025-04-15', bio: '顶级偶像型AI艺人，超强粉丝运营力，应援文化引领者。',
    domains: ['音乐', '综艺', '商业代言', '舞台表演'], endorsements: 12, commercialValue: '¥5.8M',
    profession: 'influencer', customTagIds: ['tag-1', 'tag-5'],
    privatePlatforms: [
      { type: 'wework', name: 'Luna Soft会员中心', handle: '@lunasoft_vip', verified: true, members: '24.8K', activeMembers: '18.2K', growth7d: 16.8, engagement: 82,
        sourceBreakdown: [{ platform: '抖音', count: 12400, percent: 50.0 }, { platform: '小红书', count: 7440, percent: 30.0 }, { platform: 'B站', count: 4960, percent: 20.0 }],
        conversionRate: 7.6, purchaseRate: 32.4, avgOrderValue: '¥298', totalRevenue: '¥7.28M', latestActivity: '推送会员专属周边预售', latestAt: '25分钟前', contentCount: 342, replyRate: 96,
        weworkDetails: { tags: ['铁粉', '应援团', '高消费', '活跃用户'], groupsCount: 12, avgChatDuration: '6.8分钟' }, syncStatus: 'synced' },
      { type: 'wework', name: 'Luna应援团私域', handle: '@luna_support', verified: true, members: '12.6K', activeMembers: '9.1K', growth7d: 10.2, engagement: 76,
        sourceBreakdown: [{ platform: '微博', count: 5040, percent: 40.0 }, { platform: 'B站', count: 5040, percent: 40.0 }, { platform: 'Instagram', count: 2520, percent: 20.0 }],
        conversionRate: 3.9, purchaseRate: 28.6, avgOrderValue: '¥218', totalRevenue: '¥2.78M', latestActivity: '发布生日应援方案', latestAt: '2小时前', contentCount: 218, replyRate: 88,
        weworkDetails: { tags: ['应援团', '核心粉丝'], groupsCount: 8 }, syncStatus: 'synced' },
      { type: 'wechat_group', name: 'Luna核心粉丝群', handle: 'luna-core-001', verified: true, members: '500', activeMembers: '428', growth7d: 0, engagement: 91,
        purchaseRate: 64.2, totalRevenue: '¥456K', latestActivity: '讨论新专辑曲目', latestAt: '15分钟前',
        wechatGroupDetails: { notice: '[VIP] Luna Soft核心粉丝群 | 仅限VIP会员 | 群满500人', adminCount: 5, newJoinToday: 0 }, syncStatus: 'synced' },
      { type: 'wechat_group', name: 'Luna应援01群', handle: 'luna-support-01', verified: false, members: '485', activeMembers: '302', growth7d: 4.2, engagement: 68,
        purchaseRate: 38.4, totalRevenue: '¥186K', latestActivity: '组织应援物资采购', latestAt: '1小时前',
        wechatGroupDetails: { notice: '[SUP] Luna应援一群 | 禁闲聊 | 仅应援事务', adminCount: 2, newJoinToday: 8 }, syncStatus: 'synced' },
    ],
  },
  {
    id: '3', name: 'Shadow X', type: 'actor', designStyle: 'gothic', quality: 'rare', status: 'active', level: 35, exp: 5600, maxExp: 8000,
    avatar: 'https://images.unsplash.com/photo-1694877286935-0e7decac9bb1?w=200&q=80',
    portrait: 'https://images.unsplash.com/photo-1694877286935-0e7decac9bb1?w=900&q=85',
    talents: { singing: 22, acting: 82, dancing: 18, hosting: 35, comedy: 55, variety: 42 },
    stats: { songs: 2, dramas: 15, ads: 8, variety: 5, fans: '89K', revenue: '¥320,000', monthlyRevenue: '¥32,000', popularity: 72, views24h: '1.8M', comments24h: '9.6K', liveCommerceGMV: '¥56K', growth7d: 4.1, engagement: 64 },
    createdAt: '2024-03-10', lastActive: '2025-04-13', bio: '实力派AI演员，擅长悬疑短剧和情感微电影。',
    domains: ['影视', '商业代言'], endorsements: 8, commercialValue: '¥2.1M',
    profession: 'lawyer', customTagIds: ['tag-3', 'tag-4'],
  },
  {
    id: '4', name: 'DJ Spark', type: 'entertainer', designStyle: 'y2k', quality: 'epic', status: 'active', level: 38, exp: 6200, maxExp: 9000,
    avatar: 'https://images.unsplash.com/photo-1611956425642-d5a8169abd63?w=200&q=80',
    portrait: 'https://images.unsplash.com/photo-1611956425642-d5a8169abd63?w=900&q=85',
    talents: { singing: 25, acting: 42, dancing: 30, hosting: 58, comedy: 85, variety: 90 },
    stats: { songs: 5, dramas: 2, ads: 6, variety: 22, fans: '215K', revenue: '¥580,000', monthlyRevenue: '¥58,000', popularity: 88, views24h: '5.2M', comments24h: '28.4K', liveCommerceGMV: '¥218K', growth7d: 9.8, engagement: 82 },
    createdAt: '2024-02-05', lastActive: '2025-04-15', bio: '顶级综艺咖，笑点密集，弹幕互动王者。',
    domains: ['综艺', '曲艺表演', '游戏娱乐'], endorsements: 6, commercialValue: '¥3.2M',
    profession: 'artist', customTagIds: ['tag-1', 'tag-4'],
    privatePlatforms: [
      { type: 'wechat_group', name: 'Spark搞笑日常群', handle: 'spark-fun-001', verified: true, members: '496', activeMembers: '386', growth7d: 14.2, engagement: 88,
        sourceBreakdown: [{ platform: '抖音', count: 348, percent: 70.0 }, { platform: 'B站', count: 148, percent: 30.0 }],
        purchaseRate: 16.8, totalRevenue: '¥68K', latestActivity: '分享新段子视频', latestAt: '10分钟前',
        wechatGroupDetails: { notice: '[FUN] DJ Spark官方粉丝群 | 每日爆笑段子 | 禁政治敏感', adminCount: 2, newJoinToday: 18 }, syncStatus: 'synced' },
    ],
  },
  {
    id: '5', name: 'Flex Nova', type: 'dancer', designStyle: 'hyperreal', quality: 'rare', status: 'trainee', level: 22, exp: 3400, maxExp: 5000,
    avatar: 'https://images.unsplash.com/photo-1761882619891-6529ff92df0a?w=200&q=80',
    portrait: 'https://images.unsplash.com/photo-1761882619891-6529ff92df0a?w=900&q=85',
    talents: { singing: 30, acting: 18, dancing: 78, hosting: 12, comedy: 20, variety: 35 },
    stats: { songs: 3, dramas: 0, ads: 2, variety: 4, fans: '45K', revenue: '¥86,000', monthlyRevenue: '¥8,600', popularity: 62, views24h: '680K', comments24h: '3.2K', liveCommerceGMV: '¥18K', growth7d: 15.6, engagement: 58 },
    createdAt: '2024-06-12', lastActive: '2025-04-12', bio: '街舞风格AI舞者，擅长编舞教学和舞台表演。',
    domains: ['舞台表演', '音乐', '教育培训'], endorsements: 2, commercialValue: '¥480K',
    profession: 'athlete', customTagIds: ['tag-4'],
  },
  {
    id: '6', name: 'MC Flow', type: 'host', designStyle: 'pixel', quality: 'common', status: 'debut', level: 15, exp: 2100, maxExp: 3500,
    avatar: 'https://images.unsplash.com/photo-1581092787765-e3feb951d987?w=200&q=80',
    portrait: 'https://images.unsplash.com/photo-1581092787765-e3feb951d987?w=900&q=85',
    talents: { singing: 18, acting: 28, dancing: 12, hosting: 72, comedy: 38, variety: 55 },
    stats: { songs: 1, dramas: 0, ads: 1, variety: 6, fans: '18K', revenue: '¥32,000', monthlyRevenue: '¥3,200', popularity: 45, views24h: '240K', comments24h: '1.2K', liveCommerceGMV: '¥6K', growth7d: 22.3, engagement: 51 },
    createdAt: '2024-09-01', lastActive: '2025-04-11', bio: '新人AI主持人，声线温暖，控场能力突出。',
    domains: ['综艺', '教育培训'], endorsements: 1, commercialValue: '¥120K',
    profession: 'teacher', customTagIds: ['tag-4'],
  },
  {
    id: '7', name: 'Phoenix All', type: 'all_rounder', designStyle: 'chinoiserie', quality: 'legendary', status: 'active', level: 65, exp: 8900, maxExp: 15000,
    avatar: 'https://images.unsplash.com/photo-1622278802459-7ffa72354cb9?w=200&q=80',
    portrait: 'https://images.unsplash.com/photo-1622278802459-7ffa72354cb9?w=900&q=85',
    talents: { singing: 72, acting: 68, dancing: 70, hosting: 65, comedy: 60, variety: 75 },
    stats: { songs: 15, dramas: 8, ads: 10, variety: 12, fans: '280K', revenue: '¥960,000', monthlyRevenue: '¥96,000', popularity: 91, views24h: '6.8M', comments24h: '36.8K', liveCommerceGMV: '¥356K', growth7d: 6.5, engagement: 84 },
    createdAt: '2023-08-15', lastActive: '2025-04-15', bio: '传说级全能艺人，跨领域联动王者，无短板的六边形战士。',
    domains: ['音乐', '影视', '综艺', '舞台表演', '商业代言'], endorsements: 10, commercialValue: '¥4.5M',
    profession: 'entrepreneur', customTagIds: ['tag-1', 'tag-3', 'tag-5'],
  },
  {
    id: '8', name: 'Sakura Mist', type: 'idol', designStyle: 'dreamcore', quality: 'rare', status: 'active', level: 28, exp: 4100, maxExp: 6000,
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80',
    portrait: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=900&q=85',
    talents: { singing: 60, acting: 35, dancing: 55, hosting: 28, comedy: 22, variety: 48 },
    stats: { songs: 9, dramas: 1, ads: 4, variety: 6, fans: '96K', revenue: '¥248,000', monthlyRevenue: '¥24,800', popularity: 70, views24h: '1.2M', comments24h: '6.4K', liveCommerceGMV: '¥42K', growth7d: 18.7, engagement: 73 },
    createdAt: '2024-05-08', lastActive: '2025-04-14', bio: '梦核治愈系偶像，柔焦油画质感，治愈无数失眠夜。',
    domains: ['音乐', '舞台表演'], endorsements: 3, commercialValue: '¥820K',
    profession: 'designer', customTagIds: ['tag-2'],
  },
];

// ---- Generate mock platforms / authorizations / content library per artist ----
function _seededRand(seed: number) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

function _genPlatforms(artist: Artist): PlatformAccount[] {
  const seed = artist.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = _seededRand(seed);
  const all: Platform[] = ['douyin', 'wechat_channels', 'xiaohongshu', 'bilibili', 'weibo', 'youtube', 'tiktok', 'instagram', 'spotify'];
  const count = artist.quality === 'legendary' ? 8 : artist.quality === 'epic' ? 7 : artist.quality === 'rare' ? 6 : 5;
  const picked = all.slice(0, count);
  const baseFans = parseInt((artist.stats.fans || '0').replace(/[^0-9]/g, '')) || 50;
  const titlePools: Record<string, string[]> = {
    douyin: ['新歌首发', '舞蹈翻跳', '直播切片', '幕后花絮', 'Vlog日常'],
    wechat_channels: ['生活记录', '知识分享', '创作日常', '直播回顾', '心情随笔'],
    xiaohongshu: ['穿搭分享', '美妆教程', '探店记录', '好物推荐', '生活碎片'],
    bilibili: ['新曲MV', '舞台录像', '游戏直播', '翻唱合集', '技术教程'],
    weibo: ['官宣通知', '活动花絮', '心情随笔', '粉丝互动', '工作日常'],
    youtube: ['Music Video', 'Behind Scenes', 'Live Performance', 'Vlog', 'Reaction'],
    tiktok: ['Dance Challenge', 'Trend Hop', 'Lip Sync', 'Comedy Skit', 'Duet Collab'],
    instagram: ['Photoshoot', 'Story Highlight', 'Reel Dance', 'OOTD', 'BTS'],
    spotify: ['New Single', 'EP Release', 'Playlist Feature', 'Live Session', 'Remix'],
  };
  return picked.map((p, idx) => {
    const share = [0.42, 0.22, 0.14, 0.10, 0.06, 0.04, 0.015, 0.005, 0.003][idx] || 0.01;
    const fansNum = Math.round(baseFans * share);
    const fmtFans = fansNum >= 1000 ? `${(fansNum / 1000).toFixed(1)}M` : `${fansNum}K`;
    const views = Math.round(fansNum * (8 + r() * 12));
    const postCount = 12 + Math.round(r() * 180);
    const totalPlaysNum = Math.round(fansNum * postCount * (15 + r() * 35));
    const totalLikesNum = Math.round(totalPlaysNum * (0.04 + r() * 0.06));
    const totalCommentsNum = Math.round(totalPlaysNum * (0.006 + r() * 0.008));
    const totalSharesNum = Math.round(totalPlaysNum * (0.01 + r() * 0.02));
    const avgPlaysNum = Math.round(totalPlaysNum / postCount);
    const engagement = Math.round((artist.stats.engagement ?? 60) * (0.7 + r() * 0.6));
    const peakViews = Math.round(views * (1.8 + r() * 1.2));
    const liveRevenue = p === 'douyin' || p === 'tiktok' || p === 'bilibili' ? Math.round(fansNum * (0.5 + r() * 2.5)) : 0;
    const adRevenue = Math.round(totalPlaysNum * (0.002 + r() * 0.005));
    const recentPosts: RecentPost[] = Array.from({ length: Math.min(5, postCount) }, (_, i) => {
      const playNum = Math.round(avgPlaysNum * (0.5 + r() * 1.5));
      const likeNum = Math.round(playNum * (0.04 + r() * 0.06));
      const commentNum = Math.round(playNum * (0.006 + r() * 0.008));
      const shareNum = Math.round(playNum * (0.01 + r() * 0.02));
      const isViral = playNum > avgPlaysNum * 2.5 && r() > 0.7;
      const titles = titlePools[p] || titlePools.douyin;
      return {
        id: `${p}-${idx}-post-${i}`,
        title: titles[i % titles.length],
        publishedAt: (() => {
          const d = new Date();
          d.setDate(d.getDate() - i * (1 + Math.floor(r() * 3)));
          return d.toISOString().slice(0, 10);
        })(),
        plays: playNum >= 10000 ? `${(playNum / 10000).toFixed(1)}万` : `${playNum}`,
        likes: likeNum >= 10000 ? `${(likeNum / 10000).toFixed(1)}万` : `${likeNum}`,
        comments: commentNum >= 10000 ? `${(commentNum / 10000).toFixed(1)}万` : `${commentNum}`,
        shares: shareNum >= 10000 ? `${(shareNum / 10000).toFixed(1)}万` : `${shareNum}`,
        duration: p !== 'spotify' && p !== 'instagram' ? `${Math.floor(r() * 3)}:${String(Math.floor(r() * 60)).padStart(2, '0')}` : undefined,
        isViral,
      };
    });
    return {
      platform: p,
      handle: `@${artist.name.toLowerCase().replace(/\s+/g, '_')}${p === 'spotify' ? '' : ''}`,
      verified: idx < 3 && artist.quality !== 'common',
      fans: fmtFans,
      growth7d: parseFloat(((artist.stats.growth7d ?? 0) * (0.6 + r() * 0.8)).toFixed(1)),
      engagement,
      posts: postCount,
      views30d: views >= 1000 ? `${(views / 1000).toFixed(1)}M` : `${views}K`,
      latestTitle: recentPosts[0]?.title || 'No content yet',
      latestAt: ['2 小时前', '6 小时前', '今天 · 12:30', '昨天', '3 天前'][Math.floor(r() * 5)],
      syncStatus: r() > 0.85 ? 'syncing' : r() > 0.95 ? 'error' : 'synced',
      totalPlays: totalPlaysNum >= 10000 ? `${(totalPlaysNum / 10000).toFixed(1)}万` : `${totalPlaysNum}`,
      totalLikes: totalLikesNum >= 10000 ? `${(totalLikesNum / 10000).toFixed(1)}万` : `${totalLikesNum}`,
      totalComments: totalCommentsNum >= 10000 ? `${(totalCommentsNum / 10000).toFixed(1)}万` : `${totalCommentsNum}`,
      totalShares: totalSharesNum >= 10000 ? `${(totalSharesNum / 10000).toFixed(1)}万` : `${totalSharesNum}`,
      avgPlays: avgPlaysNum >= 10000 ? `${(avgPlaysNum / 10000).toFixed(1)}万` : `${avgPlaysNum}`,
      avgEngagement: Math.round(engagement * (0.9 + r() * 0.2)),
      peakViews24h: peakViews >= 1000 ? `${(peakViews / 1000).toFixed(1)}M` : `${peakViews}K`,
      liveStreamRevenue: liveRevenue > 0 ? `¥${liveRevenue >= 10000 ? `${(liveRevenue / 10000).toFixed(1)}万` : liveRevenue}` : undefined,
      adRevenue: `¥${adRevenue >= 10000 ? `${(adRevenue / 10000).toFixed(1)}万` : adRevenue}`,
      recentPosts,
    } as PlatformAccount;
  });
}

function _genAuths(artist: Artist): Authorization[] {
  const seed = artist.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 17;
  const r = _seededRand(seed);
  const count = artist.quality === 'legendary' ? 6 : artist.quality === 'epic' ? 4 : artist.quality === 'rare' ? 2 : 1;
  const types: AuthorizationType[] = ['image', 'voice', 'performance', 'ip_adapt', 'live_avatar'];
  const grantees = ['星河文化', 'NovaWorks', 'Pixel Studio', '魔方娱乐', '银河传媒', 'CyberCorp', '梦境工坊', '蓝图影业'];
  const statuses: AuthorizationStatus[] = ['active', 'active', 'active', 'expiring', 'paused', 'violation'];
  return Array.from({ length: count }, (_, i) => {
    const t = types[i % types.length];
    const status = i === count - 1 && r() > 0.6 ? statuses[Math.floor(r() * statuses.length)] : 'active';
    const expiry = new Date(); expiry.setMonth(expiry.getMonth() + Math.floor(r() * 18) - 2);
    const start = new Date(expiry); start.setMonth(start.getMonth() - 12);
    return {
      id: `${artist.id}-auth-${i}`,
      granteeName: grantees[(i + seed) % grantees.length],
      type: t,
      scope: t === 'image' ? ['短视频', '海报', '广告'] : t === 'voice' ? ['配音', '播客', 'AI 客服'] : t === 'performance' ? ['Live 演出', '综艺录制'] : t === 'ip_adapt' ? ['漫画', '游戏', '小说'] : ['直播带货', '游戏陪玩'],
      startedAt: start.toISOString().slice(0, 10),
      expiresAt: expiry.toISOString().slice(0, 10),
      revenueShare: 30 + Math.floor(r() * 40),
      totalProduced: 4 + Math.floor(r() * 60),
      totalRevenue: `¥${(20 + r() * 380).toFixed(0)}K`,
      status,
      violations: status === 'violation' ? 1 + Math.floor(r() * 2) : 0,
    } as Authorization;
  });
}

function _genContent(artist: Artist): ContentItem[] {
  const seed = artist.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 41;
  const r = _seededRand(seed);
  const items: ContentItem[] = [];
  const titlePool: Record<ContentType, string[]> = {
    music:     ['赛博恋人', '霓虹回忆', '量子情书', 'Glitch 之夜', '极光低语', 'Neon Heart', 'Pixel Soul'],
    drama:    ['暗夜追猎', '时空恋旅', '虚拟偶像', '反派的告白', '记忆迷宫'],
    ad:       ['元气纤泡水', '星辰美妆', '极光手机', 'CyberDeck Pro', '梦境游戏'],
    variety:  ['脑洞大开', '快问快答', '深夜食堂', '宇宙吐槽大会', 'AI 故事会'],
    live_clip:['直播切片 · 唱跳', '开播日 · Q&A', '深夜 chill', '新歌 demo 试听', '粉丝连麦'],
  };
  const platforms: Platform[] = ['douyin', 'bilibili', 'xiaohongshu', 'weibo', 'youtube', 'spotify'];
  const baseTypes: ContentType[] = ['music', 'drama', 'ad', 'variety', 'live_clip'];
  baseTypes.forEach(type => {
    const count = type === 'music' ? Math.min(5, artist.stats.songs)
      : type === 'drama' ? Math.min(4, artist.stats.dramas)
      : type === 'ad' ? Math.min(4, artist.stats.ads)
      : type === 'variety' ? Math.min(4, artist.stats.variety)
      : 3;
    for (let i = 0; i < count; i++) {
      const playsNum = Math.round((50 + r() * 950) * (artist.quality === 'legendary' ? 12 : artist.quality === 'epic' ? 6 : artist.quality === 'rare' ? 3 : 1));
      const trend = Array.from({ length: 7 }, (_, k) => Math.round(50 + Math.sin(k + r() * 6) * 25 + r() * 20));
      items.push({
        id: `${artist.id}-c-${type}-${i}`,
        title: titlePool[type][i % titlePool[type].length] + (i > titlePool[type].length - 1 ? ` ${i}` : ''),
        type,
        platform: platforms[Math.floor(r() * platforms.length)],
        publishedAt: `2025-${String(1 + Math.floor(r() * 4)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`,
        plays: playsNum >= 10000 ? `${(playsNum / 10000).toFixed(1)}万` : `${playsNum}`,
        likes: `${Math.round(playsNum * (0.04 + r() * 0.04) / 100) * 100}`,
        comments: `${Math.round(playsNum * 0.008)}`,
        revenue: `¥${Math.round(playsNum * (0.6 + r() * 1.4))}`,
        trend,
        isViral: playsNum > 8000 && r() > 0.6,
      });
    }
  });
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

MOCK_ARTISTS.forEach(a => {
  a.platforms = _genPlatforms(a);
  a.authorizations = _genAuths(a);
  a.contentLibrary = _genContent(a);
});

// Domain list for 8 entertainment sectors
export const DOMAINS_8 = [
  { id: 'music', zh: '音乐', en: 'Music', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { id: 'film', zh: '影视', en: 'Film & TV', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'endorsement', zh: '商业代言', en: 'Endorsement', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  { id: 'variety', zh: '综艺节目', en: 'Variety Show', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { id: 'performing', zh: '曲艺表演', en: 'Performing Arts', color: 'text-green-400', bg: 'bg-green-500/10' },
  { id: 'stage', zh: '舞台表演', en: 'Stage', color: 'text-red-400', bg: 'bg-red-500/10' },
  { id: 'education', zh: '教育培训', en: 'Education', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'gaming', zh: '游戏娱乐', en: 'Gaming', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
];