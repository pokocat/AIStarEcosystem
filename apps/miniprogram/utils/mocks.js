// utils/mocks.js — 字段名严格对齐 apps/web/src/types/celebrity-zone.ts。
// 仅作 useMock=true 时演示数据；接入 server 后由 utils/api.js 走 wx.request。

// 明星市场（CelebrityStar[] 子集）
const MARKET_STARS = [
  {
    id: "star-li",
    name: "李某某",
    avatar: "",
    category: "综艺",
    subCategories: ["美食", "日用"],
    tagline: "国民度高 · 适合食品/快消",
    startingPrice: "¥2,800/条",
    hotScore: 9.2,
    isHot: true,
    isFree: false,
    auth: { status: "authorized", scenes: ["带货", "种草"], expireDate: "2026-05-19", availableStyles: 4 }
  },
  {
    id: "star-wang",
    name: "王某某",
    avatar: "",
    category: "演员",
    subCategories: ["美妆", "时尚"],
    tagline: "时尚潮流 · 适合美妆/服饰",
    startingPrice: "¥3,500/条",
    hotScore: 9.4,
    isHot: true,
    isFree: true,
    auth: { status: "pending", scenes: [], availableStyles: 0, pendingNote: "48h 内审核" }
  },
  {
    id: "star-chen",
    name: "陈某某",
    avatar: "",
    category: "网红",
    subCategories: ["数码", "科技"],
    tagline: "测评专家 · 适合数码/家电",
    startingPrice: "¥2,200/条",
    hotScore: 8.7,
    isHot: false,
    isFree: false,
    auth: { status: "authorized", scenes: ["测评"], expireDate: "2026-06-23", availableStyles: 3 }
  },
  { id: "star-liu", name: "刘某某", avatar: "", category: "演员", subCategories: ["服饰"], tagline: "气质演员", startingPrice: "¥1,800/条", hotScore: 8.1, isHot: false, isFree: false, auth: { status: "unauthorized", scenes: [], availableStyles: 0 } },
  { id: "star-zhou", name: "周某某", avatar: "", category: "主持人", subCategories: ["母婴"], tagline: "母婴亲和", startingPrice: "¥2,400/条", hotScore: 8.9, isHot: false, isFree: false, auth: { status: "unauthorized", scenes: [], availableStyles: 0 } },
  { id: "star-wu", name: "吴某某", avatar: "", category: "网红", subCategories: ["家居"], tagline: "家居生活", startingPrice: "¥1,500/条", hotScore: 7.6, isHot: false, isFree: false, auth: { status: "unauthorized", scenes: [], availableStyles: 0 } },
  { id: "star-zhao", name: "赵某某", avatar: "", category: "运动员", subCategories: ["运动"], tagline: "运动户外", startingPrice: "¥2,000/条", hotScore: 8.3, isHot: false, isFree: true, auth: { status: "unauthorized", scenes: [], availableStyles: 0 } }
];

// 明星详情（含能力画像 / 适用品类 / 授权流程；CelebrityStarDetail 子集）
const STAR_DETAIL_MAP = {
  "star-li": {
    id: "star-li",
    name: "李某某",
    category: "综艺",
    profession: "美食综艺 · 主持人 · 1980年代",
    tags: ["美食综艺", "国民度", "亲和力", "口播力", "30+ 受众"],
    startingPrice: "¥2,800/条",
    sla: "48h 内审核",
    skills: [
      { name: "口播带货", val: 92 },
      { name: "情境演绎", val: 86 },
      { name: "多语言", val: 64 }
    ],
    cases: ["零食 · 坚果", "酱料 · 调味", "速食 · 方便", "饮品 · 茶饮"],
    authProgress: {
      percent: 50,
      steps: [
        { name: "提交申请", state: "done", time: "10/24 14:02" },
        { name: "资料审核", state: "done", time: "10/24 16:30" },
        { name: "经纪团队复核", state: "current", time: "进行中" },
        { name: "授权完成", state: "todo", time: "—" }
      ]
    }
  }
};

// 工作台 overview（CelebrityZoneOverview 子集）
const ZONE_OVERVIEW = {
  todayGmv: 48290.5,
  videoExposure: 284000,
  orderCount: 1284,
  conversionRateChange: 0.042,
  pipeline: [
    { num: "01", name: "选择明星", active: true },
    { num: "02", name: "AI生成", active: false },
    { num: "03", name: "发布投流", active: false },
    { num: "04", name: "数据复盘", active: false }
  ],
  shortcuts: [
    { icon: "🎬", label: "生成视频", sub: "AI 创作", accent: true, route: "/pages/generator/index" },
    { icon: "⭐", label: "我的明星", sub: "3 位已授权", route: "/pages/market/index" },
    { icon: "📦", label: "商品库", sub: "12 个 SKU", route: "" },
    { icon: "📊", label: "数据看板", sub: "今日 +12%", route: "/pages/dashboard/index" }
  ],
  myStars: [
    { id: "star-li", name: "李某某", category: "美食 · 日用", authState: "已授权", remainingDays: 12 },
    { id: "star-wang", name: "王某某", category: "美妆 · 服饰", authState: "审核中", remainingDays: null },
    { id: "star-chen", name: "陈某某", category: "数码 · 家居", authState: "已授权", remainingDays: 47 }
  ]
};

// 消息中心（NotificationItem 子集 + 待办卡）
const TODOS = [
  { title: "视频待审", sub: "AI生成视频", count: 4, accent: true, route: "/pages/videos/index" },
  { title: "授权进度", sub: "明星授权审核中", count: 2, accent: false, route: "/pages/celebrity-detail/index?id=star-wang" },
  { title: "数据日报", sub: "昨日 GMV 已结算", count: 1, accent: false, route: "/pages/dashboard/index" }
];
const BOT_MESSAGES = [
  { name: "片片", role: "创作官", color: "#0A0A0A", roleBg: "#C8FF00", roleColor: "#0A0A0A", text: "你的「李某某 · 30s 口播」生成完成，建议加个特写镜头。", time: "09:42", action: "查看视频", route: "/pages/videos/index", dot: 3, accent: true },
  { name: "审审", role: "合规官", color: "#FF7A1A", roleBg: "#FFE7D2", roleColor: "#FF7A1A", text: "已通过 1 项明星授权审核：王某某。请尽快开始第一条带货。", time: "09:15", action: "去授权", route: "/pages/celebrity-detail/index?id=star-wang", dot: 1 },
  { name: "数数", role: "数据官", color: "#2A6FDB", roleBg: "#E0EBFB", roleColor: "#2A6FDB", text: "昨日 12 条视频累计曝光 28.4w，转化率较前日 +12%。", time: "08:30", action: "查看日报", route: "/pages/dashboard/index", dot: 2 },
  { name: "Ada", role: "星探官", color: "#1F8A5B", roleBg: "#DCF1E5", roleColor: "#1F8A5B", text: "新增 3 位食品类明星可授权，与你的店铺品类相符。", time: "昨天", action: "去看看", route: "/pages/market/index", dot: 0 },
  { name: "长长", role: "成长教练", color: "#9D5BFF", roleBg: "#EFE2FF", roleColor: "#9D5BFF", text: "本周复盘已生成：建议提升 15s 短视频的占比。", time: "昨天", action: "查看复盘", route: "/pages/dashboard/index", dot: 0 }
];

// 视频资产（CelebrityProjectVideo 子集）
const VIDEO_ASSETS = [
  { id: "T-2024-1024-01", state: "draft", title: "王某某 · 玻尿酸面膜", celeb: "王某某", time: "今天 14:20", duration: 60, views: 0, gmv: 0, hot: false, selected: true },
  { id: "T-2024-1024-02", state: "pub", title: "李某某 · 每日坚果礼盒", celeb: "李某某", time: "今天 11:05", duration: 30, views: 82000, gmv: 4820, hot: false, selected: true },
  { id: "T-2024-1024-03", state: "pub", title: "陈某某 · 蓝牙降噪耳机", celeb: "陈某某", time: "今天 09:30", duration: 30, views: 31000, gmv: 2140, hot: false, selected: false },
  { id: "T-2024-1023-04", state: "draft", title: "王某某 · 玻尿酸面膜 v2", celeb: "王某某", time: "昨天 21:08", duration: 30, views: 0, gmv: 0, hot: false, selected: false },
  { id: "T-2024-1023-05", state: "pub", title: "李某某 · 即食燕窝大促", celeb: "李某某", time: "昨天 18:42", duration: 15, views: 56000, gmv: 3210, hot: true, selected: false },
  { id: "T-2024-1023-06", state: "fail", title: "李某某 · 速食面礼包", celeb: "李某某", time: "昨天 09:30", duration: 0, views: 0, gmv: 0, hot: false, selected: false }
];

const VIDEO_GENERATING = [
  { id: "G-001", title: "李某某 · 每日坚果", style: "口播种草 · 30s", pct: 42, etaSec: 108 },
  { id: "G-002", title: "陈某某 · 蓝牙耳机", style: "测评开箱 · 60s", pct: 18, etaSec: 192 }
];

// 钱包额度（Wallet 子集 + 业务约定 license/recharge/gift/pending）
const WALLET = {
  total: 50,        // 总额度
  used: 18,         // 已用
  generating: 4,    // 生成中（pending bucket）
  remaining: 32,    // 剩余
  resetAt: "11/01"
};

// 视频详情（08b）
const VIDEO_DETAIL = {
  id: "T-2024-1024-07",
  title: "王某某 · 玻尿酸面膜",
  subtitle: "直播价 ¥139 · 首单立减 30",
  state: "pub",
  style: "情景剧",
  duration: 60,
  language: "普通话",
  position: 18,
  tags: ["已发布", "情景剧 · 60s", "普通话"],
  meta: "T-2024-1024-07 · 14:20 生成 · 14:35 发布 · 已运行 6h12m",
  performance: {
    gmv: 4820,
    roi: 3.2,
    trend: [12, 24, 38, 52, 78, 95, 88, 76],
    metrics: [
      { name: "曝光", val: "8.2w" },
      { name: "完播率", val: "62%" },
      { name: "点击", val: "1.2w" },
      { name: "订单", val: "284" }
    ]
  },
  channels: [
    { name: "抖音", state: "pub", views: "5.2w", time: "已发 6h" },
    { name: "视频号", state: "pub", views: "2.4w", time: "已发 6h" },
    { name: "快手", state: "todo", views: null, time: "未发布" },
    { name: "小红书", state: "todo", views: null, time: "未发布" }
  ],
  recipe: [
    { k: "明星", v: "王某某 · 美妆" },
    { k: "商品", v: "玻尿酸面膜礼盒 · SKU#B1102" },
    { k: "脚本风格", v: "情景剧 · 母女对话" },
    { k: "时长 / 语种", v: "60s · 普通话" },
    { k: "关键卖点", v: "舒缓修护 · 24h保湿 · 限时直降" },
    { k: "AI 模型", v: "video-gen-v3 · 配音 voice-pro" }
  ],
  script: [
    { t: "00:00", text: "妈，你最近皮肤怎么这么好？" },
    { t: "00:08", text: "（特写）就是这盒面膜，王某某代言的玻尿酸款。" },
    { t: "00:24", text: "敷完第一片就能看到光泽，30 天打卡完，你也是水光肌。" }
  ],
  coachTip: '这条视频前 3 秒留存只有 48%，建议复制并改：把"妈，你最近"前置为产品特写镜头。'
};

// 数据看板
const DASHBOARD = {
  range: "7日",
  gmv7d: 284290,
  gmvChange: 0.184,
  bars: [42, 56, 38, 78, 65, 88, 95, 72, 80, 110, 92, 124, 105],
  kpis: [
    { name: "视频曝光", val: "284k", chg: "+12%", up: true, accent: false },
    { name: "完播率", val: "62.4%", chg: "+3.1%", up: true, accent: false },
    { name: "点击率", val: "14.8%", chg: "-1.2%", up: false, accent: false },
    { name: "ROI", val: "3.2x", chg: "+0.4", up: true, accent: true }
  ],
  funnel: [
    { name: "曝光", val: "284,210", pct: 100 },
    { name: "点击", val: "42,180", pct: 14.8 },
    { name: "进店", val: "18,540", pct: 6.5 },
    { name: "下单", val: "1,284", pct: 0.45 }
  ],
  topVideos: [
    { rank: 1, name: "玻尿酸面膜大促", celeb: "王某某", gmv: 4820, roi: "3.2x" },
    { rank: 2, name: "每日坚果礼盒", celeb: "李某某", gmv: 3210, roi: "2.8x" },
    { rank: 3, name: "蓝牙降噪耳机", celeb: "陈某某", gmv: 2140, roi: "2.1x" }
  ],
  coachReview: "15s 短视频的完播率比 60s 高 28%，建议下周提升 15s 占比至 60%；王某某适配美妆品类，可加大授权时长。"
};

// 生成器 — 模板 / 时长 / 语种
const TEMPLATE_STYLES = [
  { id: "broadcast", name: "口播种草", desc: "镜头直给 · 信息密度高" },
  { id: "scene", name: "情景剧", desc: "短剧情 · 适合食品/日用" },
  { id: "review", name: "测评开箱", desc: "对比+实物 · 适合数码" },
  { id: "vlog", name: "VLOG", desc: "生活化 · 适合美妆/服饰" }
];
const DURATIONS = [15, 30, 60];
const LANGUAGES = ["普通话", "粤语", "英语"];

// 生成 Pipeline (4 步)
const GEN_PIPELINE_STEPS = [
  { name: "脚本撰写", sub: "AI 正在打磨 4 个分镜的台词…" },
  { name: "分镜画面生成", sub: "渲染 12 帧关键画面" },
  { name: "AI 配音合成", sub: "等待中" },
  { name: "视频合成与渲染", sub: "等待中" }
];

module.exports = {
  MARKET_STARS,
  STAR_DETAIL_MAP,
  ZONE_OVERVIEW,
  TODOS,
  BOT_MESSAGES,
  VIDEO_ASSETS,
  VIDEO_GENERATING,
  WALLET,
  VIDEO_DETAIL,
  DASHBOARD,
  TEMPLATE_STYLES,
  DURATIONS,
  LANGUAGES,
  GEN_PIPELINE_STEPS
};
