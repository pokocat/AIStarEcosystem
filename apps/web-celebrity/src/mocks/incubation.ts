// AI 艺人孵化 · 路演演示数据。
// 纯前端演示，没有后端接口；类型只在本 demo 内使用，等真正接入时再迁到 @ai-star-eco/types。
// 全部是虚拟角色，不涉及真实艺人；形象图在 public/ai-stars/（2026-11-02 用 Codex 重出的写实时尚风）。数字是示例值，界面上标了「演示数据」。

export type IncubationStageId = "look" | "persona" | "content" | "matrix" | "commerce";

export type MatrixPlatform = "douyin" | "xhs" | "wechat" | "kuaishou" | "bilibili" | "weibo";

export type MatrixRole = "主号" | "剧情号" | "带货号" | "切片号" | "生活号";

export type AccountStatus = "active" | "growing" | "pending";

export interface MatrixAccount {
  id: string;
  platform: MatrixPlatform;
  name: string;
  handle: string;
  role: MatrixRole;
  followers: number;
  plays7d: number;
  posts30d: number;
  /** 互动率，0~1 */
  engagement: number;
  status: AccountStatus;
}

export type AssetKind = "person" | "ip" | "scene" | "product" | "voice" | "style";

export interface ArtistAsset {
  kind: AssetKind;
  code: string;
  name: string;
  version: string;
}

export type WorkKind = "drama" | "talk" | "commerce" | "story";

export interface ArtistWork {
  id: string;
  kind: WorkKind;
  title: string;
  /** 短剧才有集数 */
  episodes?: number;
  plays: number;
  status: "published" | "producing" | "planning";
}

export interface ArtistDeal {
  id: string;
  brand: string;
  type: string;
  amountCents: number;
  status: "signed" | "negotiating" | "delivered";
}

export interface IncubationArtist {
  id: string;
  name: string;
  /** 一句话定位 */
  tagline: string;
  category: string;
  imageUrl?: string;
  tags: string[];
  stage: IncubationStageId;
  /** 当前阶段完成度，0~100 */
  stageProgress: number;
  persona: {
    summary: string;
    traits: string[];
    catchphrase: string;
    audience: string;
    voice: string;
  };
  accounts: MatrixAccount[];
  assets: ArtistAsset[];
  works: ArtistWork[];
  deals: ArtistDeal[];
}

export const INCUBATION_ARTISTS: IncubationArtist[] = [
  {
    id: "shen-xinglan",
    name: "沈星澜",
    tagline: "高端美妆与生活方式",
    category: "美妆生活",
    imageUrl: "/ai-stars/shen-xinglan.jpg",
    tags: ["美妆", "护肤", "精致生活"],
    stage: "commerce",
    stageProgress: 72,
    persona: {
      summary: "28 岁的独立调香师，讲究但不端着，习惯把成分表讲成生活里的小事。",
      traits: ["温柔", "讲究", "爱分享"],
      catchphrase: "好东西，要用在每一天。",
      audience: "25–35 岁一二线城市女性",
      voice: "温润女声 · 语速偏慢",
    },
    accounts: [
      { id: "sx-dy-1", platform: "douyin", name: "沈星澜", handle: "shenxinglan", role: "主号", followers: 1_286_000, plays7d: 8_420_000, posts30d: 24, engagement: 0.064, status: "active" },
      { id: "sx-dy-2", platform: "douyin", name: "星澜的梳妆台", handle: "xinglan.daily", role: "带货号", followers: 412_000, plays7d: 2_310_000, posts30d: 46, engagement: 0.041, status: "active" },
      { id: "sx-xhs-1", platform: "xhs", name: "沈星澜 Stella", handle: "stella_shen", role: "生活号", followers: 538_000, plays7d: 1_860_000, posts30d: 18, engagement: 0.087, status: "active" },
      { id: "sx-wx-1", platform: "wechat", name: "沈星澜", handle: "沈星澜", role: "主号", followers: 236_000, plays7d: 960_000, posts30d: 15, engagement: 0.052, status: "active" },
      { id: "sx-dy-3", platform: "douyin", name: "星澜小剧场", handle: "xinglan.drama", role: "剧情号", followers: 168_000, plays7d: 1_420_000, posts30d: 12, engagement: 0.073, status: "growing" },
      { id: "sx-bili-1", platform: "bilibili", name: "星澜切片", handle: "xinglan_clip", role: "切片号", followers: 54_000, plays7d: 310_000, posts30d: 30, engagement: 0.038, status: "growing" },
      { id: "sx-wb-1", platform: "weibo", name: "沈星澜", handle: "沈星澜Stella", role: "主号", followers: 0, plays7d: 0, posts30d: 0, engagement: 0, status: "pending" },
    ],
    assets: [
      { kind: "person", code: "DH-0412", name: "沈星澜 · 标准形象", version: "v3" },
      { kind: "person", code: "DH-0413", name: "沈星澜 · 晚宴造型", version: "v1" },
      { kind: "ip", code: "IP-0088", name: "星澜梳妆台", version: "v2" },
      { kind: "scene", code: "SC-1201", name: "晨光梳妆间", version: "v2" },
      { kind: "scene", code: "SC-1202", name: "调香工作室", version: "v1" },
      { kind: "product", code: "PD-3307", name: "山茶花精华", version: "v1" },
      { kind: "voice", code: "VO-0210", name: "温润女声", version: "v2" },
      { kind: "style", code: "ST-0045", name: "暖调胶片质感", version: "v1" },
    ],
    works: [
      { id: "sx-w1", kind: "drama", title: "调香师的第七瓶", episodes: 12, plays: 18_600_000, status: "published" },
      { id: "sx-w2", kind: "drama", title: "梳妆台后的秘密", episodes: 8, plays: 0, status: "producing" },
      { id: "sx-w3", kind: "commerce", title: "山茶花精华 · 早晚用法", plays: 3_420_000, status: "published" },
      { id: "sx-w4", kind: "talk", title: "三分钟看懂成分表", plays: 1_980_000, status: "published" },
      { id: "sx-w5", kind: "story", title: "一瓶香水的旅行", plays: 860_000, status: "published" },
    ],
    deals: [
      { id: "sx-d1", brand: "某国货护肤品牌", type: "年度代言", amountCents: 120_000_000, status: "signed" },
      { id: "sx-d2", brand: "某香氛品牌", type: "短剧植入", amountCents: 38_000_000, status: "delivered" },
      { id: "sx-d3", brand: "某家居品牌", type: "直播带货", amountCents: 16_000_000, status: "negotiating" },
    ],
  },
  {
    id: "lin-lubai",
    name: "林鹿白",
    tagline: "健康家用与家庭场景",
    category: "健康生活",
    imageUrl: "/ai-stars/lin-lubai.jpg",
    tags: ["家居", "健康", "亲子"],
    stage: "matrix",
    stageProgress: 58,
    persona: {
      summary: "两个孩子的年轻爸爸，营养师出身，擅长把健康知识讲成一顿饭的事。",
      traits: ["靠谱", "细心", "有点冷幽默"],
      catchphrase: "先吃好，再说别的。",
      audience: "28–40 岁有孩家庭",
      voice: "清亮男声 · 语速适中",
    },
    accounts: [
      { id: "lb-dy-1", platform: "douyin", name: "林鹿白", handle: "linlubai", role: "主号", followers: 486_000, plays7d: 3_120_000, posts30d: 20, engagement: 0.058, status: "active" },
      { id: "lb-xhs-1", platform: "xhs", name: "鹿白的厨房", handle: "lubai_kitchen", role: "生活号", followers: 212_000, plays7d: 880_000, posts30d: 16, engagement: 0.092, status: "active" },
      { id: "lb-ks-1", platform: "kuaishou", name: "林鹿白好物", handle: "lubai.haowu", role: "带货号", followers: 96_000, plays7d: 640_000, posts30d: 28, engagement: 0.044, status: "growing" },
      { id: "lb-wx-1", platform: "wechat", name: "林鹿白", handle: "林鹿白", role: "主号", followers: 74_000, plays7d: 310_000, posts30d: 10, engagement: 0.049, status: "growing" },
      { id: "lb-dy-2", platform: "douyin", name: "鹿白家的日常", handle: "lubai.home", role: "剧情号", followers: 0, plays7d: 0, posts30d: 0, engagement: 0, status: "pending" },
    ],
    assets: [
      { kind: "person", code: "DH-0421", name: "林鹿白 · 居家形象", version: "v2" },
      { kind: "ip", code: "IP-0091", name: "鹿白的厨房", version: "v1" },
      { kind: "scene", code: "SC-1230", name: "开放式厨房", version: "v1" },
      { kind: "product", code: "PD-3352", name: "低温破壁机", version: "v1" },
      { kind: "voice", code: "VO-0218", name: "清亮男声", version: "v1" },
      { kind: "style", code: "ST-0051", name: "明亮家居光", version: "v1" },
    ],
    works: [
      { id: "lb-w1", kind: "drama", title: "爸爸的便当盒", episodes: 10, plays: 6_200_000, status: "published" },
      { id: "lb-w2", kind: "talk", title: "一周早餐不重样", plays: 1_240_000, status: "published" },
      { id: "lb-w3", kind: "commerce", title: "破壁机三种玩法", plays: 920_000, status: "published" },
    ],
    deals: [
      { id: "lb-d1", brand: "某厨电品牌", type: "内容合作", amountCents: 22_000_000, status: "signed" },
      { id: "lb-d2", brand: "某乳品品牌", type: "短剧植入", amountCents: 18_000_000, status: "negotiating" },
    ],
  },
  {
    id: "gu-ran",
    name: "顾燃",
    tagline: "潮流运动与户外装备",
    category: "潮流运动",
    imageUrl: "/ai-stars/gu-ran.jpg",
    tags: ["运动", "户外", "潮流"],
    stage: "content",
    stageProgress: 64,
    persona: {
      summary: "前街头篮球选手，现在是户外品牌主理人，说话直接，喜欢带人一起动起来。",
      traits: ["热血", "直接", "讲义气"],
      catchphrase: "别想了，先出门。",
      audience: "18–30 岁运动爱好者",
      voice: "低沉男声 · 语速偏快",
    },
    accounts: [
      { id: "gr-dy-1", platform: "douyin", name: "顾燃", handle: "guran", role: "主号", followers: 128_000, plays7d: 1_060_000, posts30d: 14, engagement: 0.071, status: "growing" },
      { id: "gr-bili-1", platform: "bilibili", name: "顾燃 Run", handle: "guran_run", role: "生活号", followers: 42_000, plays7d: 260_000, posts30d: 8, engagement: 0.066, status: "growing" },
      { id: "gr-xhs-1", platform: "xhs", name: "顾燃的装备库", handle: "guran_gear", role: "带货号", followers: 0, plays7d: 0, posts30d: 0, engagement: 0, status: "pending" },
    ],
    assets: [
      { kind: "person", code: "DH-0436", name: "顾燃 · 运动形象", version: "v2" },
      { kind: "scene", code: "SC-1260", name: "城市夜跑", version: "v1" },
      { kind: "scene", code: "SC-1261", name: "露天球场", version: "v1" },
      { kind: "voice", code: "VO-0225", name: "低沉男声", version: "v1" },
      { kind: "style", code: "ST-0058", name: "高对比街头", version: "v1" },
    ],
    works: [
      { id: "gr-w1", kind: "drama", title: "最后一场球", episodes: 6, plays: 0, status: "producing" },
      { id: "gr-w2", kind: "talk", title: "跑步装备怎么选", plays: 420_000, status: "published" },
      { id: "gr-w3", kind: "story", title: "凌晨五点的城市", plays: 0, status: "planning" },
    ],
    deals: [{ id: "gr-d1", brand: "某运动鞋服品牌", type: "新品种草", amountCents: 8_000_000, status: "negotiating" }],
  },
  {
    id: "chen-yu",
    name: "陈屿",
    tagline: "都市职场剧男主",
    category: "短剧演员",
    imageUrl: "/ai-stars/chen-yu.jpg",
    tags: ["短剧", "职场", "男主"],
    stage: "content",
    stageProgress: 35,
    persona: {
      summary: "外冷内热的投行分析师，专演都市职场剧里那个嘴硬心软的上司。",
      traits: ["克制", "理性", "反差萌"],
      catchphrase: "方案再改一版，我陪你。",
      audience: "22–35 岁短剧观众",
      voice: "磁性男声 · 语速偏慢",
    },
    accounts: [
      { id: "cy-dy-1", platform: "douyin", name: "陈屿", handle: "chenyu.drama", role: "剧情号", followers: 36_000, plays7d: 420_000, posts30d: 9, engagement: 0.081, status: "growing" },
      { id: "cy-ks-1", platform: "kuaishou", name: "陈屿短剧", handle: "chenyu_ks", role: "剧情号", followers: 0, plays7d: 0, posts30d: 0, engagement: 0, status: "pending" },
    ],
    assets: [
      { kind: "person", code: "DH-0450", name: "陈屿 · 西装造型", version: "v1" },
      { kind: "scene", code: "SC-1288", name: "顶层办公室", version: "v1" },
      { kind: "voice", code: "VO-0231", name: "磁性男声", version: "v1" },
    ],
    works: [{ id: "cy-w1", kind: "drama", title: "上司的第二份方案", episodes: 20, plays: 0, status: "producing" }],
    deals: [],
  },
  {
    id: "su-zhi",
    name: "苏枝",
    tagline: "国风古装剧女主",
    category: "短剧演员",
    imageUrl: "/ai-stars/su-zhi.jpg",
    tags: ["国风", "古装", "女主"],
    stage: "persona",
    stageProgress: 60,
    persona: {
      summary: "江南绣坊的小东家，看着柔，做事比谁都硬气，适合逆袭类古装剧。",
      traits: ["坚韧", "聪慧", "外柔内刚"],
      catchphrase: "针脚不会骗人。",
      audience: "18–30 岁女性古装剧观众",
      voice: "待定 · 试音中",
    },
    accounts: [],
    assets: [
      { kind: "person", code: "DH-0466", name: "苏枝 · 绣坊常服", version: "v1" },
      { kind: "style", code: "ST-0063", name: "宋画淡彩", version: "v1" },
    ],
    works: [{ id: "sz-w1", kind: "drama", title: "绣娘逆袭记", episodes: 24, plays: 0, status: "planning" }],
    deals: [],
  },
  {
    id: "a-nuo",
    name: "阿糯",
    tagline: "萌宠探店与城市漫游",
    category: "萌宠 IP",
    imageUrl: "/ai-stars/a-nuo.jpg",
    tags: ["萌宠", "探店", "治愈"],
    stage: "look",
    stageProgress: 40,
    persona: {
      summary: "一只会说话的柴犬，每周带大家逛一家城市里的小店。",
      traits: ["好奇", "贪吃", "治愈"],
      catchphrase: "这家，我先替你尝尝。",
      audience: "全年龄段",
      voice: "待定",
    },
    accounts: [],
    assets: [{ kind: "ip", code: "IP-0102", name: "阿糯 · 形象草图", version: "v0" }],
    works: [],
    deals: [],
  },
];

/** 短剧创作知识库：选题、结构、人设这些可复用的经验 */
export const DRAMA_KNOWLEDGE = [
  { id: "k1", title: "前 3 秒钩子写法", category: "开场", count: 36, desc: "冲突前置、反常识一句话、悬念画面，三种开场各配示例。" },
  { id: "k2", title: "逆袭类题材结构", category: "结构", count: 18, desc: "压抑、转折、打脸、升级四段节奏，每集卡在哪里收尾。" },
  { id: "k3", title: "职场甜宠人设库", category: "人设", count: 42, desc: "嘴硬心软上司、反差实习生等常见搭配，附台词口吻。" },
  { id: "k4", title: "广告植入不出戏", category: "商业", count: 24, desc: "道具植入、剧情植入、片尾彩蛋，品牌方最常要的三种做法。" },
  { id: "k5", title: "本月题材热度", category: "趋势", count: 12, desc: "按平台统计的题材播放走势，看哪些题材还在涨。" },
  { id: "k6", title: "分镜与运镜手册", category: "制作", count: 30, desc: "对话正反打、情绪特写、转场常用镜头，给 AI 出片直接用。" },
];

export function artistTotals(a: IncubationArtist) {
  const live = a.accounts.filter((x) => x.status !== "pending");
  return {
    followers: live.reduce((s, x) => s + x.followers, 0),
    plays7d: live.reduce((s, x) => s + x.plays7d, 0),
    accounts: a.accounts.length,
    liveAccounts: live.length,
    platforms: new Set(a.accounts.map((x) => x.platform)).size,
    works: a.works.length,
    deals: a.deals.length,
  };
}

export function findArtist(id: string): IncubationArtist | undefined {
  return INCUBATION_ARTISTS.find((a) => a.id === id);
}
