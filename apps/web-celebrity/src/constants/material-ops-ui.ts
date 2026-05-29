// ─────────────────────────────────────────────────────────────────────────────
// 素材运营 UI 字典 —— 分级/镜头/变量轴的 creator 配色映射 + 平台规则/违禁词/
// 视频结构化配置等领域字典。颜色全部用 celebrity creator token（CSS 变量），
// 不再用原型的深蓝仪表台硬编码 hex。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AssetKind,
  BannedWord,
  PlatformId,
  PlatformRule,
  ShotKind,
  Tier,
  VariantAxis,
  VariantAxisKey,
  VideoConfigGroupDef,
} from "@/components/material-ops/types";

// creator 调色板（= tokens.css 同值 hex）。数据驱动的强调色需要做 `${color}22`
// 透明度拼接（渐变/浅底），故用 hex 而非 CSS 变量，与 ENGINE_META 内联 hex 一致。
export const PALETTE = {
  violet: "#7c5cff",
  violetDeep: "#5b3fe0",
  teal: "#22b59a",
  amber: "#f0a83a",
  rose: "#ff5b8a",
  peach: "#ff8a5b",
  lime: "#c4e34a",
  muted: "#7a6f5d",
  faint: "#a89e88",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Restrained 配色策略：单一主强调（violet）+ 中性灰，语义色（teal/amber/rose）
// 只保留给「真正的状态」（通过 / 告警 / 违禁）。分类标签（镜头类型 / 素材类型 /
// 参数分组 / 变量轴）一律走中性或主强调，不再各自一种饱和色 —— 避免彩虹噪声，
// 贴合「沉稳、克制、专业」品牌定位。语义状态色由各组件直接用 CSS 变量。
// ─────────────────────────────────────────────────────────────────────────────
const ACCENT = PALETTE.violet; // 选中 / 主操作 / 最高分级
const NEUTRAL = PALETTE.muted; // 次要分类标签
const NEUTRAL_FAINT = PALETTE.faint; // 最弱（草稿 / 失活）
const SEVERITY_HIGH = PALETTE.rose; // 仅：高风险 / 违禁强阻断
const SEVERITY_MID = PALETTE.amber; // 仅：中风险 / 告警

// 分级元数据：S 爆款 / A 优质 / B 普通 / D 草稿。
// 仅最高级「爆款」用主强调吸睛，其余走中性灰阶（字母本身承载排序）。
export const TIER_META: Record<Tier, { label: string; toneVar: string }> = {
  S: { label: "爆款", toneVar: ACCENT },
  A: { label: "优质", toneVar: NEUTRAL },
  B: { label: "普通", toneVar: NEUTRAL },
  D: { label: "草稿", toneVar: NEUTRAL_FAINT },
};

// 素材类型：图标承载区分，颜色统一中性（不再四色）。
export const ASSET_KIND_META: Record<AssetKind, { label: string; icon: string; toneVar: string }> = {
  my_script: { label: "我的脚本", icon: "ScrollText", toneVar: NEUTRAL },
  template: { label: "官方模板", icon: "LayoutTemplate", toneVar: NEUTRAL },
  viral_clone: { label: "爆款同款", icon: "Flame", toneVar: NEUTRAL },
  ai_seed: { label: "AI 起稿", icon: "Wand2", toneVar: NEUTRAL },
};

// 镜头类型：标签即信息，统一中性（取消 6 色彩虹）。
export const SHOT_KIND_META: Record<ShotKind, { label: string; toneVar: string }> = {
  hook: { label: "钩子", toneVar: NEUTRAL },
  scene: { label: "场景", toneVar: NEUTRAL },
  emotion: { label: "情感", toneVar: NEUTRAL },
  product: { label: "产品", toneVar: NEUTRAL },
  effect: { label: "效果", toneVar: NEUTRAL },
  cta: { label: "CTA", toneVar: NEUTRAL },
};

// 平台规则（品牌色保留 hex 作点缀；其余文案为运营词典）
export const PLATFORM_RULES: Record<PlatformId, PlatformRule> = {
  douyin: {
    name: "抖音",
    icon: "Music2",
    color: "#fe2c55",
    duration_sweet: "15-30s",
    hook_window: 3,
    topics: ["#爆款好物", "#平价好物", "#dou+小助手"],
    notes: "完播率 > 互动率 > 转发率 · 钩子前置 3s",
  },
  xhs: {
    name: "小红书",
    icon: "BookHeart",
    color: "#ff2442",
    duration_sweet: "30-60s",
    hook_window: 5,
    topics: ["#好物分享", "#平价种草", "#真实测评"],
    notes: "封面 + 标题决定 70% 流量 · 慎重挂车",
  },
  wechat: {
    name: "视频号",
    icon: "MessageCircle",
    color: "#1aad19",
    duration_sweet: "20-45s",
    hook_window: 5,
    topics: ["#好物推荐", "#生活分享"],
    notes: "社交分发 · 情感故事更易爆 · 风控严",
  },
  kuaishou: {
    name: "快手",
    icon: "Zap",
    color: "#ff7700",
    duration_sweet: "20-45s",
    hook_window: 4,
    topics: ["#快手好物", "#老铁推荐"],
    notes: "老铁文化 · 真人出镜更好",
  },
};

export const BANNED_WORDS: BannedWord[] = [
  { word: "最", tier: "hard", count: 4 },
  { word: "第一", tier: "hard", count: 2 },
  { word: "永久", tier: "hard", count: 0 },
  { word: "治愈", tier: "medical", count: 1 },
  { word: "根治", tier: "medical", count: 0 },
  { word: "抗衰老", tier: "medical", count: 3 },
  { word: "减肥", tier: "medical", count: 6 },
  { word: "神器", tier: "soft", count: 2 },
  { word: "一辈子", tier: "soft", count: 1 },
];

// 违禁词严重度是「真正的状态」，保留语义色（高=红 / 中=琥珀 / 低=中性）。
export const BANNED_TIER_META: Record<BannedWord["tier"], { label: string; toneVar: string }> = {
  hard: { label: "HARD", toneVar: SEVERITY_HIGH },
  medical: { label: "MED", toneVar: SEVERITY_MID },
  soft: { label: "SOFT", toneVar: NEUTRAL },
};

// 违禁词替换建议（脚本编辑器内点击违禁词后弹出）
export const WORD_SUGGESTIONS: Record<string, string[]> = {
  最: ["更", "相当", "十分"],
  第一: ["头部", "排名靠前", "热门"],
  永久: ["长效", "持久", "长期"],
  治愈: ["舒缓", "改善", "帮助"],
  根治: ["有效缓解", "深入改善", "针对性改善"],
  抗衰老: ["紧致", "焕活", "弹润"],
  减肥: ["身材管理", "体重管理", "轻盈感"],
  神器: ["好物", "心头好", "日常单品"],
  一辈子: ["长长久久", "日日陪伴", "细水长流"],
};

// 变量轴（派生变体的 6 个可变维度）
export const VARIANT_AXES: Record<VariantAxisKey, VariantAxis & { icon: string }> = {
  character: {
    label: "人物",
    icon: "Users",
    toneVar: ACCENT,
    options: [
      { id: "human-001", label: "蓝领大哥 · 老李", sub: "40+ 男 · 沉稳", tags: ["蓝领", "中年"] },
      { id: "human-002", label: "中年大叔 · 老王", sub: "45+ 男 · 微胖", tags: ["中年", "居家"] },
      { id: "human-003", label: "年轻爸爸 · 小陈", sub: "30+ 男 · 文艺", tags: ["年轻", "宠妻"] },
      { id: "human-004", label: "闺女小七", sub: "14 女 · 学生", tags: ["学生", "父女"] },
      { id: "human-005", label: "微胖姐姐 · 阿欧", sub: "28 女 · 通勤", tags: ["微胖", "通勤"] },
      { id: "human-006", label: "妈妈级 · 阿芬", sub: "50+ 女 · 慈祥", tags: ["银发", "妈妈"] },
      { id: "human-007", label: "都市精英 · Lina", sub: "30 女 · 干练", tags: ["白领", "精英"] },
      { id: "human-008", label: "健身教练 · Coach", sub: "32 男 · 健硕", tags: ["运动", "健硕"] },
    ],
  },
  scene: {
    label: "场景",
    icon: "Globe",
    toneVar: ACCENT,
    options: [
      { id: "auto-shop", label: "修车铺", sub: "油污 · 工具墙", tags: ["工作"] },
      { id: "home-livingroom", label: "家庭客厅", sub: "沙发 · 暖色调", tags: ["居家"] },
      { id: "home-kitchen", label: "家庭厨房", sub: "vlog 视角", tags: ["居家", "日常"] },
      { id: "home-dresser", label: "化妆台", sub: "镜面反光", tags: ["居家", "美妆"] },
      { id: "dressing-room", label: "试衣间", sub: "镜面 + 衣架", tags: ["购物"] },
      { id: "subway-station", label: "地铁站", sub: "通勤 · 都市", tags: ["通勤"] },
      { id: "office-meeting", label: "办公会议室", sub: "工位 · 冷色", tags: ["办公"] },
      { id: "street-cafe", label: "街边咖啡店", sub: "阳光 + 玻璃", tags: ["户外"] },
      { id: "gym", label: "健身房", sub: "器械 · 暖光", tags: ["运动"] },
      { id: "park-jogging", label: "公园跑道", sub: "自然光 · 绿植", tags: ["户外", "运动"] },
    ],
  },
  weather: {
    label: "天气",
    icon: "CloudSun",
    toneVar: ACCENT,
    options: [
      { id: "sunny", label: "晴天", sub: "高光照度" },
      { id: "cloudy", label: "阴天", sub: "柔和漫射" },
      { id: "rainy", label: "雨天", sub: "湿润 · 反光" },
      { id: "snowy", label: "雪天", sub: "冷色 · 静谧" },
      { id: "sunset", label: "黄昏", sub: "金色暖调" },
      { id: "night", label: "夜晚", sub: "霓虹 · 暗调" },
    ],
  },
  lighting: {
    label: "光线",
    icon: "Sun",
    toneVar: ACCENT,
    options: [
      { id: "natural", label: "自然光", sub: "日光偏色温" },
      { id: "warm", label: "暖光", sub: "暖黄 · 居家感" },
      { id: "cool", label: "冷光", sub: "冷蓝 · 科技感" },
      { id: "soft", label: "柔光", sub: "漫射柔焦" },
      { id: "dramatic", label: "戏剧光", sub: "强对比侧逆光" },
    ],
  },
  role_relation: {
    label: "角色关系",
    icon: "UsersRound",
    toneVar: ACCENT,
    options: [
      { id: "夫妻", label: "夫妻", sub: "伴侣视角" },
      { id: "父女", label: "父女", sub: "父亲送女儿视角" },
      { id: "母女", label: "母女", sub: "母女互动" },
      { id: "同事", label: "同事", sub: "职场场景" },
      { id: "闺蜜", label: "闺蜜", sub: "姐妹推荐" },
      { id: "个人", label: "个人", sub: "独白 / 测评" },
      { id: "医患", label: "医患", sub: "专业建议" },
    ],
  },
  voice: {
    label: "配音",
    icon: "Mic",
    toneVar: ACCENT,
    options: [
      { id: "voice-male-01", label: "低沉男声", sub: "40+ 沉稳" },
      { id: "voice-male-02", label: "中年男声", sub: "45+ 朴实" },
      { id: "voice-male-03", label: "年轻男声", sub: "25+ 清爽" },
      { id: "voice-fem-01", label: "温柔女声", sub: "28 柔和" },
      { id: "voice-fem-02", label: "少女声", sub: "16 灵动" },
      { id: "voice-fem-03", label: "妈妈女声", sub: "50+ 慈祥" },
      { id: "voice-fem-04", label: "都市女声", sub: "32 干练" },
    ],
  },
};

export const VARIANT_AXIS_ORDER: VariantAxisKey[] = [
  "character",
  "scene",
  "weather",
  "lighting",
  "role_relation",
  "voice",
];

// 视频生成流水线（流式进度 7 阶段）
export const VIDEO_GEN_STAGES = [
  { id: "plan", label: "镜头规划", sub: "解析脚本结构 · 分配镜头", icon: "ScrollText", duration: 4 },
  { id: "character", label: "人物调度", sub: "加载数字人 · 表情绑定", icon: "Users", duration: 6 },
  { id: "scene", label: "场景合成", sub: "生成背景 · 物体放置", icon: "Globe", duration: 14 },
  { id: "shot", label: "逐镜渲染", sub: "5 镜头 · 60fps · 1080p", icon: "Image", duration: 32 },
  { id: "voice", label: "配音 + 口型", sub: "TTS · 对齐口型", icon: "Mic", duration: 10 },
  { id: "subtitle", label: "字幕 + 转场", sub: "智能体写字幕 + 配 BGM", icon: "Music", duration: 6 },
  { id: "compose", label: "合成出片", sub: "剪辑 · 调色 · 输出", icon: "Workflow", duration: 4 },
] as const;

// 视频结构化生成参数（5 组 18 字段）
export const VIDEO_CONFIG_FIELDS: Record<string, VideoConfigGroupDef> = {
  basic: {
    label: "基础信息",
    icon: "Settings2",
    toneVar: NEUTRAL,
    fields: {
      duration: { label: "视频时长", options: ["5s", "10s", "15s", "30s", "60s"], default: "30s" },
      ratio: { label: "视频比例", options: ["9:16", "16:9", "1:1", "4:3"], default: "9:16" },
      style: { label: "视频风格", options: ["写实", "动漫", "电影感", "清新", "复古", "商务"], default: "写实" },
      resolution: { label: "分辨率", options: ["720P", "1080P", "2K", "4K"], default: "1080P" },
      fps: { label: "帧率", options: ["24fps", "30fps", "60fps"], default: "30fps" },
    },
  },
  subject: {
    label: "画面主体",
    icon: "Users",
    toneVar: NEUTRAL,
    fields: {
      subject_type: { label: "主体类型", options: ["人物", "产品", "风景", "数字人"], default: "人物" },
      scene: { label: "场景环境", options: ["室内", "户外", "城市", "居家", "工作室"], default: "居家" },
      background_light: { label: "背景光影", options: ["自然光", "暖光", "冷光", "虚化背景", "柔光"], default: "自然光" },
    },
  },
  camera: {
    label: "镜头语言",
    icon: "Clapperboard",
    toneVar: NEUTRAL,
    fields: {
      shot_size: { label: "景别", options: ["全景", "中景", "近景", "特写"], default: "中景" },
      movement: { label: "运镜", options: ["固定", "推拉", "平移", "环绕", "跟随", "慢动作"], default: "固定" },
      transition: { label: "转场效果", options: ["淡入淡出", "闪切", "滑动", "硬切", "叠化"], default: "硬切" },
    },
  },
  audio: {
    label: "音频",
    icon: "Music",
    toneVar: NEUTRAL,
    fields: {
      bgm: { label: "BGM", options: ["轻快", "动感", "舒缓", "商务", "无 BGM"], default: "动感" },
      voice: { label: "语音类型", options: ["男声", "女声", "少女声", "情感男声", "主播女声"], default: "女声" },
      tts_speed: { label: "语速", options: ["慢", "正常", "快"], default: "正常" },
    },
  },
  advanced: {
    label: "高级控制",
    icon: "ShieldCheck",
    toneVar: NEUTRAL,
    fields: {
      consistency: { label: "画面一致性", options: ["锁定人物", "锁定场景", "不锁定"], default: "锁定人物" },
      color_tone: { label: "色调", options: ["明亮", "电影色", "暖色", "冷色", "自然"], default: "自然" },
      forbidden: { label: "禁止内容", options: ["无水印", "禁模糊", "禁变形", "全部"], default: "全部" },
      effects: { label: "特效", options: ["无", "光影", "粒子", "滤镜", "光影+粒子"], default: "无" },
    },
  },
};

// 镜头级片段库（套模板抽屉用）
export const BLOCK_SNIPPETS: Record<ShotKind, { id: string; text: string; type: string; perf: number; tier: Tier }[]> = {
  hook: [
    { id: "bh1", text: "我妈用了这瓶精华，被亲戚以为是我姐", type: "反差", perf: 8.4, tier: "S" },
    { id: "bh2", text: "修了 30 年车，第一次给老婆买这个", type: "情感", perf: 9.2, tier: "S" },
    { id: "bh3", text: "160 微胖姐妹，这件打底救我一命", type: "身份", perf: 7.8, tier: "A" },
    { id: "bh4", text: "你是不是也吃完早餐 11 点就饿？", type: "提问", perf: 6.8, tier: "A" },
    { id: "bh5", text: "99 块钱，让我妈每天早上多睡 20 分钟", type: "数字", perf: 5.9, tier: "B" },
  ],
  emotion: [
    { id: "be1", text: "镜头切到收摊回家，老婆在沙发上揉脖子", type: "场景", perf: 8.2, tier: "S" },
    { id: "be2", text: "加班到 11 点的电梯镜头，肩膀僵到抬不起", type: "场景", perf: 7.6, tier: "A" },
    { id: "be3", text: "镜头跟拍：奶奶在阳台晒衣服，慢动作回眸", type: "场景", perf: 7.1, tier: "A" },
  ],
  product: [
    { id: "bp1", text: "从口袋掏出产品 · 老婆惊讶反应 + 弹幕“哎哟”", type: "揭示", perf: 8.5, tier: "S" },
    { id: "bp2", text: "镜头怼瓶身 30 帧 · 强调成分标签", type: "怼镜", perf: 7.4, tier: "A" },
    { id: "bp3", text: "产品袋特写 4 次 · 强调价格 / 卖点", type: "特写", perf: 7.0, tier: "A" },
  ],
  effect: [
    { id: "bf1", text: "使用 + “舒服死了” / “真的有用” + 笑场", type: "体感", perf: 8.7, tier: "S" },
    { id: "bf2", text: "使用前后对比 · 时间轴三周", type: "对比", perf: 8.2, tier: "S" },
    { id: "bf3", text: "展示效果 · 字幕标注关键指标", type: "量化", perf: 7.0, tier: "A" },
  ],
  cta: [
    { id: "bc1", text: "“姐妹有需要的评论区扣 1，链接放购物车”", type: "评论", perf: 8.1, tier: "S" },
    { id: "bc2", text: "小黄车自取 + 字幕飘屏 + 价格弹窗", type: "挂车", perf: 7.6, tier: "A" },
    { id: "bc3", text: "“今天直播间还有 50 单，错过等下周”", type: "紧迫", perf: 7.2, tier: "A" },
  ],
  scene: [
    { id: "bs1", text: "厨房 vlog 视角 · 烧水 · 倒燕麦", type: "场景", perf: 7.4, tier: "A" },
    { id: "bs2", text: "试衣镜 360 度展示 · 弹幕“绝”", type: "展示", perf: 7.0, tier: "A" },
  ],
};
