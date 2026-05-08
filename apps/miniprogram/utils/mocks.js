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
    bio: "国民度高，亲和力强，长期主持美食综艺；曾代言食品/快消品类多款爆品。粉丝画像偏 30+ 家庭主理人。",
    location: "上海 / 北京",
    fans: 8_240_000,
    cooperationCount: 32,
    avgGmv: 4820,
    tags: ["美食综艺", "国民度", "亲和力", "口播力", "30+ 受众"],
    startingPrice: "¥2,800/条",
    sla: "48h 内审核",
    photos: [
      { id: "p1", url: "", caption: "形象照 · 演播厅" },
      { id: "p2", url: "", caption: "形象照 · 户外" },
      { id: "p3", url: "", caption: "活动现场" },
      { id: "p4", url: "", caption: "代言海报 · 坚果" },
      { id: "p5", url: "", caption: "代言海报 · 速食" },
      { id: "p6", url: "", caption: "节目剧照" }
    ],
    videos: [
      { id: "v1", title: "代言案例 · 每日坚果", durationSec: 30, coverUrl: "", playUrl: "", tag: "代言" },
      { id: "v2", title: "节目片段 · 试吃测评", durationSec: 45, coverUrl: "", playUrl: "", tag: "综艺" },
      { id: "v3", title: "形象介绍片", durationSec: 20, coverUrl: "", playUrl: "", tag: "介绍" }
    ],
    skills: [
      { name: "口播带货", val: 92 },
      { name: "情境演绎", val: 86 },
      { name: "多语言", val: 64 }
    ],
    cases: ["零食 · 坚果", "酱料 · 调味", "速食 · 方便", "饮品 · 茶饮"],
    auth: { status: "authorized", scenes: ["带货", "种草"], expireDate: "2026-05-19", availableStyles: 4, remainingDays: 12 },
    authProgress: {
      percent: 100,
      steps: [
        { name: "提交申请", state: "done", time: "10/24 14:02" },
        { name: "资料审核", state: "done", time: "10/24 16:30" },
        { name: "经纪团队复核", state: "done", time: "10/24 22:18" },
        { name: "授权完成", state: "done", time: "10/25 09:00" }
      ]
    }
  },
  "star-wang": {
    id: "star-wang",
    name: "王某某",
    category: "演员",
    profession: "时尚演员 · 影视&代言",
    bio: "时尚潮流代表，影视演员出身，活跃于美妆/服饰品类。粉丝画像偏 20-35 女性。",
    location: "上海",
    fans: 12_400_000,
    cooperationCount: 18,
    avgGmv: 6210,
    tags: ["时尚潮流", "美妆", "服饰", "20-35 受众"],
    startingPrice: "¥3,500/条",
    sla: "48h 内审核",
    photos: [
      { id: "p1", url: "", caption: "形象照 · 时尚大片" },
      { id: "p2", url: "", caption: "代言海报 · 美妆" },
      { id: "p3", url: "", caption: "代言海报 · 服饰" },
      { id: "p4", url: "", caption: "活动现场" }
    ],
    videos: [
      { id: "v1", title: "代言案例 · 玻尿酸面膜", durationSec: 60, coverUrl: "", playUrl: "", tag: "代言" },
      { id: "v2", title: "形象介绍片", durationSec: 25, coverUrl: "", playUrl: "", tag: "介绍" }
    ],
    skills: [
      { name: "口播带货", val: 88 },
      { name: "情境演绎", val: 90 },
      { name: "多语言", val: 72 }
    ],
    cases: ["美妆 · 护肤", "美妆 · 彩妆", "服饰 · 女装", "配饰 · 包袋"],
    auth: { status: "pending", scenes: [], availableStyles: 0, pendingNote: "经纪团队复核中（48h SLA）" },
    authProgress: {
      percent: 50,
      steps: [
        { name: "提交申请", state: "done", time: "10/26 11:20" },
        { name: "资料审核", state: "done", time: "10/26 14:50" },
        { name: "经纪团队复核", state: "current", time: "进行中" },
        { name: "授权完成", state: "todo", time: "—" }
      ]
    }
  },
  "star-chen": {
    id: "star-chen",
    name: "陈某某",
    category: "网红",
    profession: "数码评测博主",
    bio: "硬核数码评测博主，长期独立测评手机/电脑/耳机/智能家居，理性专业。",
    location: "深圳",
    fans: 3_650_000,
    cooperationCount: 47,
    avgGmv: 2140,
    tags: ["数码", "硬核测评", "理性"],
    startingPrice: "¥2,200/条",
    sla: "48h 内审核",
    photos: [
      { id: "p1", url: "", caption: "工作室形象" },
      { id: "p2", url: "", caption: "测评现场 · 耳机" },
      { id: "p3", url: "", caption: "测评现场 · 手机" }
    ],
    videos: [
      { id: "v1", title: "代言案例 · 蓝牙耳机", durationSec: 60, coverUrl: "", playUrl: "", tag: "测评" },
      { id: "v2", title: "形象介绍片", durationSec: 22, coverUrl: "", playUrl: "", tag: "介绍" }
    ],
    skills: [
      { name: "口播带货", val: 80 },
      { name: "情境演绎", val: 70 },
      { name: "测评深度", val: 95 }
    ],
    cases: ["数码 · 手机", "数码 · 耳机", "数码 · 智能家居"],
    auth: { status: "authorized", scenes: ["测评", "种草"], expireDate: "2026-06-23", availableStyles: 3, remainingDays: 47 },
    authProgress: { percent: 100, steps: [
      { name: "提交申请", state: "done", time: "09/05 10:00" },
      { name: "资料审核", state: "done", time: "09/05 12:30" },
      { name: "经纪团队复核", state: "done", time: "09/05 18:00" },
      { name: "授权完成", state: "done", time: "09/06 09:00" }
    ] }
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
  { botId: "pian", name: "片片", role: "创作官", color: "#0A0A0A", roleBg: "#C8FF00", roleColor: "#0A0A0A", avatarIcon: "✦", preview: "你的「李某某 · 30s 口播」生成完成，建议加个特写镜头。", time: "09:42", dot: 3, accent: true },
  { botId: "shen", name: "审审", role: "合规官", color: "#FF7A1A", roleBg: "#FFE7D2", roleColor: "#FF7A1A", avatarIcon: "✓", preview: "已通过 1 项明星授权审核：王某某。请尽快开始第一条带货。", time: "09:15", dot: 1 },
  { botId: "shu",  name: "数数", role: "数据官", color: "#2A6FDB", roleBg: "#E0EBFB", roleColor: "#2A6FDB", avatarIcon: "📊", preview: "昨日 12 条视频累计曝光 28.4w，转化率较前日 +12%。", time: "08:30", dot: 2 },
  { botId: "ada",  name: "Ada", role: "星探官", color: "#1F8A5B", roleBg: "#DCF1E5", roleColor: "#1F8A5B", avatarIcon: "★", preview: "新增 3 位食品类明星可授权，与你的店铺品类相符。", time: "昨天", dot: 0 },
  { botId: "zhang",name: "长长", role: "成长教练", color: "#9D5BFF", roleBg: "#EFE2FF", roleColor: "#9D5BFF", avatarIcon: "◯", preview: "本周复盘已生成：建议提升 15s 短视频的占比。", time: "昨天", dot: 0 }
];

// 对话详情（按 botId 索引）
// 消息块类型：
//   - time:       居中时间分隔条
//   - text:       纯文本（左对齐 · 卡片式）
//   - card-cta:   富卡片（标题 + 描述 + 高亮内嵌块 + 主 CTA）
//   - card-form:  表单卡片（标题 + 状态 chip + 字段行 + CTA）
//   - card-grid:  2×N 权益/数据网格（标题 + 子标题 + items + CTA）
const CONVERSATIONS = {
  pian: {
    bot: { id: "pian", name: "片片", subtitle: "创作官 · 在线", avatarColor: "#0A0A0A", avatarIcon: "✦", iconColor: "#C8FF00" },
    messages: [
      { type: "time", text: "上午 09:42" },
      { type: "text", text: "老板早～你的「李某某 · 30s 口播」刚刚生成完成 🎬" },
      {
        type: "card-cta",
        accent: true,
        title: "生成完成 · 待发布",
        body: "建议加个产品特写镜头会更出片，复制并改只需 30 秒。",
        highlight: { icon: "▶", title: "T-2024-1024-02", sub: "李某某 · 每日坚果礼盒" },
        cta: { text: "去查看 / 发布", route: "/pages/video-detail/index?id=T-2024-1024-02" }
      },
      { type: "text", text: "另外还有 2 条草稿待发布、1 条失败可重试，需要一起处理吗？" },
      {
        type: "card-cta",
        title: "草稿管理",
        body: "当前共 2 条草稿、1 条生成失败、4 条生成中。",
        cta: { text: "前往视频中心", route: "/pages/videos/index" }
      }
    ]
  },
  shen: {
    bot: { id: "shen", name: "审审", subtitle: "合规官 · 在线", avatarColor: "#FF7A1A", avatarIcon: "✓", iconColor: "#fff" },
    messages: [
      { type: "time", text: "上午 09:15" },
      { type: "text", text: "王某某授权审核已通过 ✓ 但还差一些资质材料没补齐。" },
      {
        type: "card-form",
        title: "资质材料",
        tag: { text: "待完善", tone: "warn" },
        fields: [
          { label: "营业执照", value: "已上传" },
          { label: "品类经营许可", value: "未上传" },
          { label: "法人手机号", value: "138****8888" }
        ],
        cta: { text: "上传剩余资质", route: "/pages/celebrity-detail/index?id=star-wang" }
      },
      { type: "text", text: "SLA：补齐后 48h 内复核完成。如果超时我会再 ping 你一次。" }
    ]
  },
  shu: {
    bot: { id: "shu", name: "数数", subtitle: "数据官 · 在线", avatarColor: "#2A6FDB", avatarIcon: "📊", iconColor: "#fff" },
    messages: [
      { type: "time", text: "上午 08:30" },
      { type: "text", text: "昨日 12 条视频累计曝光 28.4w，转化率较前日 +12% 👏" },
      {
        type: "card-grid",
        title: "昨日数据快报",
        sub: "7 日环比向好 · 数据已落账",
        items: [
          { icon: "👁", label: "曝光", sub: "28.4w" },
          { icon: "🛒", label: "订单", sub: "1,284" },
          { icon: "¥", label: "GMV", sub: "4.8w" },
          { icon: "↑", label: "转化", sub: "+12%" }
        ],
        cta: { text: "查看完整看板", route: "/pages/dashboard/index" }
      },
      { type: "text", text: "异常提醒：陈某某的视频 ROI 跌到 1.8x，建议复盘改脚本。" }
    ]
  },
  ada: {
    bot: { id: "ada", name: "Ada", subtitle: "星探官 · 在线", avatarColor: "#1F8A5B", avatarIcon: "★", iconColor: "#C8FF00" },
    messages: [
      { type: "time", text: "上午 10:23" },
      { type: "text", text: "AI 供应链助手为你匹配到一批新明星，与你的店铺品类相符。" },
      {
        type: "card-cta",
        accent: true,
        title: "明星授权邀请",
        body: "诚邀您与「李某某 · 美食综艺」开启首条带货合作，本周通道免审核保证金、极速过审。",
        highlight: { icon: "👑", title: "本周限时通道", sub: "免保证金 · 极速审核" },
        cta: { text: "查看明星详情", route: "/pages/celebrity-detail/index?id=star-li" }
      },
      { type: "time", text: "上午 10:25" },
      { type: "text", text: "另外还有 4 位刚开放授权的明星可以扫一眼：" },
      {
        type: "card-grid",
        title: "本周明星上新",
        sub: "成为核心带货方可解锁以下 4 位",
        items: [
          { icon: "★", label: "王某某", sub: "美妆 · 时尚" },
          { icon: "★", label: "陈某某", sub: "数码 · 科技" },
          { icon: "★", label: "刘某某", sub: "服饰 · 配饰" },
          { icon: "★", label: "周某某", sub: "母婴 · 教育" }
        ],
        cta: { text: "去市场看看", route: "/pages/market/index" }
      }
    ]
  },
  zhang: {
    bot: { id: "zhang", name: "长长", subtitle: "成长教练 · 在线", avatarColor: "#9D5BFF", avatarIcon: "◯", iconColor: "#fff" },
    messages: [
      { type: "time", text: "昨天 21:00" },
      { type: "text", text: "本周复盘已生成。基于过去 7 日数据，给你 3 条最有价值的建议：" },
      {
        type: "card-grid",
        title: "本周成长建议",
        sub: "按预期收益排序",
        items: [
          { icon: "①", label: "提升 15s 占比", sub: "完播率高 28%" },
          { icon: "②", label: "加大美妆品类", sub: "王某某适配度 9.4" },
          { icon: "③", label: "调整发布时段", sub: "20:00 流量更佳" },
          { icon: "④", label: "延长授权时长", sub: "30 天 → 60 天" }
        ],
        cta: { text: "查看完整复盘", route: "/pages/dashboard/index" }
      },
      { type: "text", text: "下周一早上 9 点我会再推一次进度对比 📈" }
    ]
  }
};

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
// 每个模板都有运营后台上传的 previewVideoUrl，点击可预览效果。
const TEMPLATE_STYLES = [
  {
    id: "broadcast",
    name: "口播种草",
    desc: "镜头直给 · 信息密度高",
    previewCover: "",
    previewVideoUrl: "https://cdn.aistareco.example/templates/broadcast-30s.mp4",
    durationSec: 30
  },
  {
    id: "scene",
    name: "情景剧",
    desc: "短剧情 · 适合食品/日用",
    previewCover: "",
    previewVideoUrl: "https://cdn.aistareco.example/templates/scene-60s.mp4",
    durationSec: 60
  },
  {
    id: "review",
    name: "测评开箱",
    desc: "对比+实物 · 适合数码",
    previewCover: "",
    previewVideoUrl: "https://cdn.aistareco.example/templates/review-60s.mp4",
    durationSec: 60
  },
  {
    id: "vlog",
    name: "VLOG",
    desc: "生活化 · 适合美妆/服饰",
    previewCover: "",
    previewVideoUrl: "https://cdn.aistareco.example/templates/vlog-30s.mp4",
    durationSec: 30
  }
];

// 模型引擎（与 apps/web/src/constants/celebrity-zone-ui.ts ENGINE_META 完全对齐）
const ENGINES = [
  { name: "KeLing",  level: "经济", cost: 1, creditPrice: 50,  speed: "~5分钟", quality: 3, desc: "性价比高，适合日常内容批量生成。", color: "#22c55e" },
  { name: "HiGen",   level: "标准", cost: 2, creditPrice: 120, speed: "~3分钟", quality: 4, desc: "效果稳定，口型同步好，推荐大多数场景。", color: "#06b6d4" },
  { name: "MiniMax", level: "高级", cost: 3, creditPrice: 300, speed: "~4分钟", quality: 5, desc: "最佳画质和表现力，适合重要投放内容。", color: "#fbbf24" }
];

// 充值套餐（与 ledger 的 recharge bucket 对应）
// v0.4：字段名与 apps/web/src/types/wallet.ts RechargePackage 对齐（priceCents/bonusCredits/sortOrder）
const WALLET_PACKAGES = [
  { id: "pkg-300",   credits: 300,   priceCents: 9900,   tag: "体验包",  recommended: false, bonusCredits: 0,    sortOrder: 10 },
  { id: "pkg-1000",  credits: 1000,  priceCents: 29900,  tag: "标准包",  recommended: true,  bonusCredits: 100,  sortOrder: 20 },
  { id: "pkg-3000",  credits: 3000,  priceCents: 79900,  tag: "热门包",  recommended: false, bonusCredits: 500,  sortOrder: 30 },
  { id: "pkg-10000", credits: 10000, priceCents: 239900, tag: "企业包",  recommended: false, bonusCredits: 2000, sortOrder: 40 }
];

// v0.4：字段名与 apps/web/src/types/wallet.ts Wallet 对齐（totalBalance/licenseBalance/...）
const WALLET_CREDITS = {
  id: "wallet-mock-1",
  userId: "demo-user",
  totalBalance: 1280,
  licenseBalance: 500,
  rechargeBalance: 680,
  giftBalance: 100,
  pendingBalance: 60,
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-07T09:00:00Z"
};
const DURATIONS = [15, 30, 60];
const LANGUAGES = ["普通话", "粤语", "英语"];

// 生成 Pipeline (4 步)
const GEN_PIPELINE_STEPS = [
  { name: "脚本撰写", sub: "AI 正在打磨 4 个分镜的台词…" },
  { name: "分镜画面生成", sub: "渲染 12 帧关键画面" },
  { name: "AI 配音合成", sub: "等待中" },
  { name: "视频合成与渲染", sub: "等待中" }
];

// ── v0.5.1：UI 字典（与 server CelebrityDictionariesDto 对齐） ─────────────
const CELEBRITY_DICTIONARIES = {
  durations: [15, 30, 60],
  languages: ["普通话", "粤语", "英语"],
  categories: ["全部", "美食", "美妆", "数码", "服饰", "母婴", "家居"],
  keypointSuggestions: ["原料溯源", "无添加", "送礼场景", "性价比", "限时优惠", "工厂直供"]
};

// ── v0.5.1：消息首页聚合 mock ─────────────────────────────────────────────
const MESSAGES_OVERVIEW = {
  todos: [
    { title: "视频待审", sub: "AI 生成视频", count: 4, accent: true,  route: "/pages/videos/index" },
    { title: "授权进度", sub: "明星授权审核中", count: 1, accent: false, route: "/pages/celebrity-detail/index" },
    { title: "数据日报", sub: "昨日 GMV 已结算", count: 1, accent: false, route: "/pages/dashboard/index" }
  ],
  conversations: [
    { botId: "pian",  name: "片片", role: "创作官",   color: "#0A0A0A", roleBg: "#C8FF00", roleColor: "#0A0A0A", avatarIcon: "✦", preview: "你的「李某某 · 30s 口播」生成完成，建议加个特写镜头", time: "2min", dot: 3, accent: true },
    { botId: "shen",  name: "审审", role: "合规官",   color: "#FF7A1A", roleBg: "#FFE7D2", roleColor: "#FF7A1A", avatarIcon: "✓", preview: "已通过 1 项明星授权审核：王某某", time: "15min", dot: 1, accent: true },
    { botId: "shu",   name: "数数", role: "数据官",   color: "#2A6FDB", roleBg: "#E0EBFB", roleColor: "#2A6FDB", avatarIcon: "📊", preview: "昨日 12 条视频累计曝光 28.4w，转化率较前日 +12%", time: "30min", dot: 2, accent: true },
    { botId: "ada",   name: "Ada",  role: "星探官",   color: "#1F8A5B", roleBg: "#DCF1E5", roleColor: "#1F8A5B", avatarIcon: "★", preview: "新增 3 位食品类明星可授权，与你的店铺品类相符", time: "1d",   dot: 0, accent: false },
    { botId: "zhang", name: "长长", role: "成长教练", color: "#9D5BFF", roleBg: "#EFE2FF", roleColor: "#9D5BFF", avatarIcon: "◯", preview: "本周复盘已生成：建议提升 15s 短视频的占比",       time: "1d",   dot: 0, accent: false }
  ]
};

// ── v0.5.1：生成任务进度 mock（基于 Date.now() 起算的简易递增） ─────────────
let MOCK_JOB_STARTED_AT = null;
function buildJobProgress(jobId) {
  if (!MOCK_JOB_STARTED_AT) MOCK_JOB_STARTED_AT = Date.now();
  const elapsed = Math.floor((Date.now() - MOCK_JOB_STARTED_AT) / 1000);
  const total = 12;
  const progress = Math.min(100, Math.max(0, Math.floor(elapsed * 100 / total)));
  const stepCount = 4;
  const currentStep = Math.min(stepCount - 1, Math.floor(progress * stepCount / 100));
  const stepMeta = [
    ["脚本撰写", "AI 正在打磨分镜的台词"],
    ["分镜画面生成", "渲染关键画面"],
    ["AI 配音合成", "对齐口型 / 情感"],
    ["视频合成与渲染", "最终输出"]
  ];
  const steps = stepMeta.map((m, i) => {
    let state, time;
    if (i < currentStep || progress >= 100) { state = "done"; time = "已完成"; }
    else if (i === currentStep && progress < 100) { state = "current"; time = "进行中"; }
    else { state = "todo"; time = "—"; }
    return { name: m[0], sub: m[1], state, time };
  });
  const etaSec = Math.max(0, total - elapsed);
  const state = progress >= 100 ? "done" : (progress > 0 ? "running" : "queued");
  return { jobId: jobId || "mock-job", progress, currentStep, etaSec, state, steps };
}

module.exports = {
  MARKET_STARS,
  STAR_DETAIL_MAP,
  ZONE_OVERVIEW,
  TODOS,
  BOT_MESSAGES,
  CONVERSATIONS,
  VIDEO_ASSETS,
  VIDEO_GENERATING,
  WALLET,
  VIDEO_DETAIL,
  DASHBOARD,
  TEMPLATE_STYLES,
  DURATIONS,
  LANGUAGES,
  GEN_PIPELINE_STEPS,
  ENGINES,
  WALLET_PACKAGES,
  WALLET_CREDITS,
  CELEBRITY_DICTIONARIES,
  MESSAGES_OVERVIEW,
  buildJobProgress
};
