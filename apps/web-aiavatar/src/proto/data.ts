// ============================================================
// 数字人资产平台 — 领域类型 + Mock 数据（移植自 Figma Make 原型 v3/data.jsx）
//
// 这是本 app 的「类型契约真源」。规格见根目录上传的《数字人资产平台 — 数据模型
// 与系统逻辑规格》。未来接 Spring Boot 后端时，后端 DTO 字段名应与此处对齐，
// 屏幕层（src/proto/*）继续读这些结构即可（mock → live 切换在 src/proto/api.ts）。
//
// 资产 = 数字人本体；图集 / 3D / 视频 皆为其衍生。
// 两条创建路径：real（真人授权复刻） / ai（纯 AI 原创）。
// ============================================================

// ── 枚举 ────────────────────────────────────────────────────

/** 创建路径。 */
export type AvatarPath = "real" | "ai";

/** 8 态资产状态机（规格 §1.2）。 */
export type AvatarStatus =
  | "draft"
  | "proofing"
  | "iterating"
  | "refining"
  | "pending"
  | "finalized"
  | "deriving"
  | "archived";

/** 衍生物状态（规格 §1.3）。 */
export type DerivStatus = "empty" | "draft" | "running" | "done" | "stale";

/** 衍生模块 key（规格 §1.4，6 类）。 */
export type DerivKey = "atlas" | "expr" | "scene" | "ward" | "d3" | "video";

/** 衍生分类（用于配色映射）。 */
export type DerivCat = "atlas" | "expr" | "scene" | "ward" | "3d" | "video" | "key";

/** 授权状态（规格 §1.6）。 */
export type LicenseStatus = "active" | "pending" | "expired";

/** 任务状态 / 执行模式（规格 §1.7）。 */
export type JobStatus = "running" | "done" | "failed";
export type JobMode = "mock" | "backend" | "selfhost" | "local"; // local = 端上处理（浏览器完成，server 仅登记）

/** UI 徽标语义色调。 */
export type Tone = "mute" | "primary" | "ok" | "warn" | "err" | "info";

// ── 实体接口 ────────────────────────────────────────────────

export interface StatusMeta {
  key: AvatarStatus;
  label: string;
  tone: Tone;
  step: number;
}

export interface PathMeta {
  key: AvatarPath;
  name: string;
  en: string;
  icon: string;
  desc: string;
  engine: string;
  tint: string;
  tintS: string;
}

export interface ShotMeta {
  key: string;
  name: string;
  spec: string;
}

export interface DerivMeta {
  key: DerivKey;
  cat: DerivCat;
  icon: string;
  name: string;
  unit: string;
  desc: string;
  engine: string;
}

export interface AvatarDef {
  年龄: string;
  气质: string;
  用途: string;
  性格: string[];
  服饰: string;
  形象来源: string;
  设定语: string;
}

export interface Palette {
  bg1: string;
  bg2: string;
  skin: string;
  hair: string;
  cloth: string;
  accent: string;
}

export interface Avatar {
  id: string;
  name: string;
  codename: string;
  path: AvatarPath;
  archetype: string;
  tagline: string;
  status: AvatarStatus;
  updated: string;
  fav: boolean;
  hue: number;
  hairStyle: string;
  license?: string | null;
  mock?: boolean;
  engine: string;
  palette: Palette;
  def: AvatarDef;
  deriv: Record<DerivKey, DerivStatus>;
  counts: Record<DerivKey, number>;
  versions: number;
  /** 绑定音色名（server 持久化；mock 下由本地状态兜底）。 */
  voiceName?: string | null;
  /** 当前定妆主图 URL（live 模式由 server 派生；为空时前端渲染占位画像）。 */
  imageUrl?: string | null;
  /** 形象生成候选（4 变体）URL。 */
  variantImages?: string[];
  /** 标准图集 {shotKey → URL}。 */
  shotImages?: Record<string, string>;
  /** 用户原始人设描述。 */
  descPrompt?: string | null;
  /** 创建向导用的临时草稿标记。 */
  _fresh?: boolean;
}

export interface TemplateMeta {
  id: string;
  name: string;
  sub: string;
  kind: "beauty" | "style" | "makeup";
  tags: string[];
  engine: string;
  hue: number;
}

export interface License {
  id: string;
  subject: string;
  char: string | null;
  scope: string;
  period: string;
  platforms: string[];
  status: LicenseStatus;
  signed: string;
  photos: number;
}

export interface Job {
  id: string;
  char: string;
  charName: string;
  kind: string;
  engine: string;
  mode: JobMode;
  status: JobStatus;
  pct: number;
  eta: string;
  stage?: string;
  stageUpdatedAt?: string;
  type?: string;
  error?: string;
  started: string;
}

export interface ChainStep {
  key: string;
  n: number;
  name: string;
  icon: string;
  short: string;
}

export interface CapMeta {
  key: string;
  cap: string;
  icon: string;
  name: string;
  desc: string;
  tint: string;
  tintS: string;
}

export interface WarpCtrl {
  key: string;
  name: string;
  min: number;
  max: number;
  val: number;
  real: boolean;
}

export interface AppearCtrl {
  key: string;
  name: string;
  engine: string;
}

export interface VoiceAsset {
  id: string;
  name: string;
  char: string;
  kind: "clone" | "design";
  gender: string;
  lang: string;
  tone: string;
  dur: string;
  wave: number[];
  fav: boolean;
}

/** 内置 AI 合成音色（prompt 驱动大模型）。 */
export interface BuiltinVoice {
  id: string;
  name: string;
  gender: "female" | "male";
  traits: string;
  scenes: string[];
  prompt: string;
}

// ── 枚举数据 ────────────────────────────────────────────────

export const STATUS: Record<AvatarStatus, StatusMeta> = {
  draft: { key: "draft", label: "草稿新建", tone: "mute", step: 0 },
  proofing: { key: "proofing", label: "生成中", tone: "info", step: 1 },
  iterating: { key: "iterating", label: "调整中", tone: "info", step: 2 },
  refining: { key: "refining", label: "调整中", tone: "primary", step: 2 },
  pending: { key: "pending", label: "待定稿", tone: "warn", step: 3 },
  finalized: { key: "finalized", label: "已定稿", tone: "ok", step: 4 },
  deriving: { key: "deriving", label: "衍生中", tone: "primary", step: 4 },
  archived: { key: "archived", label: "已就绪", tone: "ok", step: 5 },
};

export const PATHS: Record<AvatarPath, PathMeta> = {
  real: {
    key: "real",
    name: "真人授权复刻",
    en: "Clone a real person",
    icon: "person",
    desc: "上传真人多角度素材，签署电子肖像授权，AI 保持身份一致地复刻为数字人资产。",
    engine: "InstantID",
    tint: "var(--info)",
    tintS: "var(--info-s)",
  },
  ai: {
    key: "ai",
    name: "纯 AI 原创",
    en: "Create a virtual character",
    icon: "ai",
    desc: "用文字描述人设与风格，AI 从零原创一个虚构数字人，无需任何真人肖像。",
    engine: "SDXL / FLUX",
    tint: "var(--primary)",
    tintS: "var(--primary-soft)",
  },
};

export const SHOTS: ShotMeta[] = [
  { key: "front-half", name: "正面半身", spec: "1080×1440" },
  { key: "front-full", name: "正面全身", spec: "1080×1920" },
  { key: "left", name: "左侧脸", spec: "1080×1440" },
  { key: "right", name: "右侧脸", spec: "1080×1440" },
  { key: "expr", name: "表情集", spec: "1080×1080" },
];

export const DERIVS: DerivMeta[] = [
  { key: "atlas", cat: "atlas", icon: "images", name: "多角度图集", unit: "张", desc: "正面 / 侧面 / 四分之三 一致性图集", engine: "SDXL + ControlNet" },
  { key: "expr", cat: "expr", icon: "mask", name: "表情图集", unit: "张", desc: "喜怒哀乐情绪差分，保持身份一致", engine: "InstructPix2Pix" },
  { key: "scene", cat: "scene", icon: "image", name: "剧情场景图", unit: "图", desc: "角色置入不同场景 / 构图 / 光线", engine: "SDXL Inpaint" },
  { key: "ward", cat: "ward", icon: "shirt", name: "换装变体", unit: "套", desc: "服饰 / 风格换装，沿用同一张脸", engine: "SD Inpaint + SAM" },
  { key: "d3", cat: "3d", icon: "cube", name: "3D 模型", unit: "个", desc: "从定妆形象重建 GLB / FBX，可旋转预览", engine: "TripoSR" },
  { key: "video", cat: "video", icon: "film", name: "运镜短视频", unit: "条", desc: "环绕 / 推拉 运镜，导出 MP4（仅运镜无驱动）", engine: "SVD-XT" },
];

// ── 衍生生成配置（生成前可自定义；prompt 为英文，直接进图像/视频模型）────────
export interface DerivPresetItem { label: string; prompt: string }

/** 多选条目预设（expr/scene/ward —— 选中项替换默认配方，每项一张图）。 */
export const DERIV_PRESETS: Record<string, DerivPresetItem[]> = {
  expr: [
    { label: "微笑", prompt: "bright warm smile expression" },
    { label: "严肃", prompt: "serious focused expression" },
    { label: "惊喜", prompt: "surprised delighted expression" },
    { label: "沉思", prompt: "thoughtful calm expression" },
    { label: "大笑", prompt: "joyful open-mouth laughing expression" },
    { label: "俏皮", prompt: "playful winking expression" },
  ],
  scene: [
    { label: "书房暖光", prompt: "cozy study room with warm bookshelf lighting" },
    { label: "咖啡馆", prompt: "sitting in a stylish cafe, soft daylight" },
    { label: "街头夜景", prompt: "city street at night, neon lights, cinematic" },
    { label: "海边日落", prompt: "seaside at golden sunset, gentle breeze" },
    { label: "舞台聚光", prompt: "on stage under a spotlight, dramatic lighting" },
    { label: "现代办公室", prompt: "modern bright office, professional ambience" },
  ],
  ward: [
    { label: "商务正装", prompt: "wearing an elegant tailored business suit" },
    { label: "街头潮流", prompt: "wearing trendy streetwear, casual style" },
    { label: "晚礼服", prompt: "wearing an elegant evening gown" },
    { label: "运动休闲", prompt: "wearing sporty athleisure outfit" },
    { label: "新中式", prompt: "wearing modern hanfu-inspired chinese attire" },
    { label: "赛博朋克", prompt: "wearing futuristic cyberpunk outfit with neon accents" },
  ],
};

/** 各类型默认选中数（与 server 默认配方张数一致）。 */
export const DERIV_DEFAULT_PICKS: Record<string, number> = { expr: 4, scene: 2, ward: 2 };

/** 3D 渲染风格（单选 → 并入补充描述）。 */
export const D3_STYLES: DerivPresetItem[] = [
  { label: "写实雕塑", prompt: "photorealistic sculpted 3d render" },
  { label: "手办质感", prompt: "collectible figurine style, glossy finish" },
  { label: "粘土风", prompt: "cute claymation style render" },
  { label: "低多边形", prompt: "stylized low-poly 3d render" },
];

/** 运镜方式（单选 → options.motion；orbit 的英文 prompt 在后台「Prompt 管理 · dap.video_orbit」可改）。 */
export const VIDEO_MOTIONS = [
  { key: "orbit", label: "环绕运镜", desc: "镜头绕人物缓慢环绕" },
  { key: "push_in", label: "缓慢推近", desc: "从半身推向面部特写" },
  { key: "pull_back", label: "缓慢拉远", desc: "由近及远展示全身" },
  { key: "pan", label: "左右摇移", desc: "镜头水平掠过人物" },
];

export const CHARS: Avatar[] = [
  {
    id: "DH-2041", name: "林深 Lìn", codename: "lin-anchor", path: "real",
    archetype: "品牌虚拟主播", tagline: "科技品牌发布会数字主持人",
    status: "archived", updated: "2 小时前", fav: true, hue: 246, hairStyle: "short",
    license: "LIC-0098", mock: false, engine: "InstantID",
    palette: { bg1: "#6E78FF", bg2: "#23244F", skin: "#F2D6BE", hair: "#241F2E", cloth: "#E7E9FB", accent: "#9DA8FF" },
    def: { 年龄: "约 30 岁", 气质: "专业 · 沉稳 · 亲和", 用途: "发布会 / 产品讲解 / 培训", 性格: ["专业", "可信", "温和"], 服饰: "深蓝西装 · 商务", 形象来源: "真人模特授权", 设定语: "科技品牌的官方数字代言人，传递专业与温度。" },
    deriv: { atlas: "done", expr: "done", scene: "done", ward: "done", d3: "done", video: "done" },
    counts: { atlas: 24, expr: 16, scene: 9, ward: 5, d3: 1, video: 3 },
    versions: 12,
  },
  {
    id: "DH-2038", name: "星岚 Sēlan", codename: "selan-stellar", path: "ai",
    archetype: "二次元 · 星界少女", tagline: "银河旅人，命运观测者",
    status: "deriving", updated: "昨天", fav: true, hue: 268, hairStyle: "long",
    license: null, mock: false, engine: "SDXL",
    palette: { bg1: "#8B6BFF", bg2: "#2E2470", skin: "#F6DCC8", hair: "#3A2E66", cloth: "#D8CCFF", accent: "#FFD36B" },
    def: { 年龄: "约 17 岁", 气质: "清冷 · 神秘 · 治愈", 用途: "IP 衍生 / 立绘 / 周边", 性格: ["温柔", "疏离", "坚定"], 服饰: "星纱长裙 · 银河披帛", 形象来源: "AI 原创虚构", 设定语: "掌管星轨观测的少女，能听见星辰的低语。" },
    deriv: { atlas: "done", expr: "done", scene: "done", ward: "done", d3: "running", video: "draft" },
    counts: { atlas: 18, expr: 12, scene: 6, ward: 4, d3: 0, video: 1 },
    versions: 9,
  },
  {
    id: "DH-2035", name: "苏婉 Sūwǎn", codename: "suwan-edu", path: "real",
    archetype: "教育数字讲师", tagline: "在线课程虚拟讲师形象",
    status: "finalized", updated: "3 天前", fav: false, hue: 168, hairStyle: "bun",
    license: "LIC-0091", mock: false, engine: "InstantID",
    palette: { bg1: "#3FBE93", bg2: "#0E4D3C", skin: "#F3DAC0", hair: "#241C16", cloth: "#EAF5E8", accent: "#E6B34A" },
    def: { 年龄: "约 28 岁", 气质: "温润 · 清晰 · 耐心", 用途: "课程讲解 / 知识科普", 性格: ["知性", "从容", "亲切"], 服饰: "米色针织 · 简约", 形象来源: "真人讲师授权", 设定语: "把复杂讲简单，是每位学习者的耐心引路人。" },
    deriv: { atlas: "done", expr: "done", scene: "draft", ward: "done", d3: "empty", video: "empty" },
    counts: { atlas: 20, expr: 10, scene: 2, ward: 3, d3: 0, video: 0 },
    versions: 7,
  },
  {
    id: "DH-2030", name: "Vex-09", codename: "vex-mecha", path: "ai",
    archetype: "剧情角色 · 赛博机甲", tagline: "废土赏金猎人，义体改造者",
    status: "refining", updated: "5 天前", fav: true, hue: 18, hairStyle: "short",
    license: null, mock: true, engine: "SDXL",
    palette: { bg1: "#FF7A45", bg2: "#3A1606", skin: "#E8C3A6", hair: "#1A1410", cloth: "#2A2A33", accent: "#FF4D6D" },
    def: { 年龄: "外观 25 岁", 气质: "凌厉 · 危险 · 孤傲", 用途: "游戏 / 剧情 / 概念设计", 性格: ["寡言", "果决", "护短"], 服饰: "战术义体 · 霓虹回路", 形象来源: "AI 原创虚构", 设定语: "左臂是义体，右眼是瞄具，在霓虹废土上只为筹码扣动扳机。" },
    deriv: { atlas: "draft", expr: "empty", scene: "empty", ward: "empty", d3: "empty", video: "empty" },
    counts: { atlas: 5, expr: 0, scene: 0, ward: 0, d3: 0, video: 0 },
    versions: 4,
  },
  {
    id: "DH-2026", name: "阿茶 Āchá", codename: "acha-mascot", path: "ai",
    archetype: "品牌虚拟人 · 萌系吉祥物", tagline: "新茶饮品牌 IP 吉祥物",
    status: "pending", updated: "上周", fav: false, hue: 42, hairStyle: "short",
    license: null, mock: false, engine: "FLUX",
    palette: { bg1: "#FFC861", bg2: "#7A4A12", skin: "#FBE6C5", hair: "#6B4A24", cloth: "#FFF0D6", accent: "#5AD1FF" },
    def: { 年龄: "设定 ∞", 气质: "呆萌 · 机灵 · 暖心", 用途: "品牌 IP / 包装 / 表情包", 性格: ["好奇", "贴心", "话痨"], 服饰: "连帽卫衣 · 奶茶色", 形象来源: "AI 原创虚构", 设定语: "一杯茶的快乐传递员，会卖萌也会提醒你多喝水。" },
    deriv: { atlas: "done", expr: "draft", scene: "empty", ward: "empty", d3: "empty", video: "empty" },
    counts: { atlas: 12, expr: 0, scene: 0, ward: 0, d3: 0, video: 0 },
    versions: 6,
  },
  {
    id: "DH-2019", name: "周野 Zhōu", codename: "zhou-presenter", path: "real",
    archetype: "企业数字员工", tagline: "财报 / 内部公告播报形象",
    status: "proofing", updated: "刚刚", fav: false, hue: 210, hairStyle: "short",
    license: "LIC-0102", mock: false, engine: "InstantID",
    palette: { bg1: "#5AB8E8", bg2: "#15324D", skin: "#F2D6BE", hair: "#2A2A38", cloth: "#EAF3FA", accent: "#E6B34A" },
    def: { 年龄: "约 35 岁", 气质: "干练 · 可信 · 正式", 用途: "财报播报 / 内部沟通", 性格: ["严谨", "克制", "稳重"], 服饰: "灰蓝衬衫 · 正装", 形象来源: "真人高管授权", 设定语: "企业对内对外的统一数字面孔，让每次播报都专业一致。" },
    deriv: { atlas: "empty", expr: "empty", scene: "empty", ward: "empty", d3: "empty", video: "empty" },
    counts: { atlas: 0, expr: 0, scene: 0, ward: 0, d3: 0, video: 0 },
    versions: 2,
  },
];

export const TEMPLATES: TemplateMeta[] = [
  { id: "t1", name: "影棚柔光", sub: "商务证件 · 均匀布光", kind: "beauty", tags: ["磨皮", "提亮", "商务"], engine: "GFPGAN", hue: 246 },
  { id: "t2", name: "电影质感", sub: "叙事氛围 · 暖调", kind: "style", tags: ["电影感", "暖光", "颗粒"], engine: "调色 LUT", hue: 18 },
  { id: "t3", name: "日系赛璐璐", sub: "ACG 立绘 · 通透", kind: "style", tags: ["日系", "通透", "大眼"], engine: "Style LoRA", hue: 330 },
  { id: "t4", name: "清透妆容", sub: "自然底妆 · 裸感", kind: "makeup", tags: ["裸妆", "气色", "清透"], engine: "EleGANt", hue: 12 },
  { id: "t5", name: "新中式", sub: "东方美学 · 水墨", kind: "style", tags: ["国风", "水墨", "雅致"], engine: "Style LoRA", hue: 158 },
  { id: "t6", name: "高清修复", sub: "细节增强 · 4K", kind: "beauty", tags: ["超分", "锐化", "4K"], engine: "CodeFormer", hue: 200 },
];

export const LICENSES: License[] = [
  { id: "LIC-0102", subject: "周野（高管）", char: "DH-2019", scope: "对内播报 / 官方对外", period: "2026-01 ~ 2028-01", platforms: ["官网", "视频号", "培训"], status: "active", signed: "2026-05-20", photos: 8 },
  { id: "LIC-0098", subject: "林深（签约模特）", char: "DH-2041", scope: "品牌商用 / 全平台", period: "2025-09 ~ 2027-09", platforms: ["全平台"], status: "active", signed: "2025-09-02", photos: 12 },
  { id: "LIC-0091", subject: "苏婉（合作讲师）", char: "DH-2035", scope: "教育内容 / 课程平台", period: "2026-03 ~ 2027-03", platforms: ["课程App", "官网"], status: "active", signed: "2026-03-11", photos: 10 },
  { id: "LIC-0087", subject: "陈曦（前代言人）", char: null, scope: "品牌商用", period: "2024-06 ~ 2025-06", platforms: ["全平台"], status: "expired", signed: "2024-06-01", photos: 9 },
  { id: "LIC-0110", subject: "待签 · 新模特 K", char: null, scope: "草案审核中", period: "—", platforms: ["—"], status: "pending", signed: "—", photos: 6 },
];

export const TASKS: Job[] = [
  { id: "JOB-7741", char: "DH-2038", charName: "星岚 Sēlan", kind: "3D 模型重建", engine: "TripoSR", mode: "selfhost", status: "running", pct: 62, eta: "约 2 分钟", started: "14:22" },
  { id: "JOB-7740", char: "DH-2030", charName: "Vex-09", kind: "精调 · 妆容迁移", engine: "EleGANt", mode: "mock", status: "running", pct: 28, eta: "约 4 分钟", started: "14:21" },
  { id: "JOB-7738", char: "DH-2019", charName: "周野 Zhōu", kind: "真人复刻生成", engine: "InstantID", mode: "backend", status: "running", pct: 84, eta: "约 40 秒", started: "14:19" },
  { id: "JOB-7735", char: "DH-2041", charName: "林深 Lìn", kind: "运镜短视频", engine: "SVD-XT", mode: "selfhost", status: "done", pct: 100, eta: "已完成", started: "14:02" },
  { id: "JOB-7731", char: "DH-2026", charName: "阿茶 Āchá", kind: "标准图集出图", engine: "SDXL", mode: "backend", status: "done", pct: 100, eta: "已完成", started: "13:48" },
  { id: "JOB-7728", char: "DH-2035", charName: "苏婉 Sūwǎn", kind: "剧情场景图", engine: "SDXL Inpaint", mode: "backend", status: "failed", pct: 0, eta: "生成失败", started: "13:30" },
];

// 创建链路 3 步：素材 → 生成挑选 → 调整后直接保存（标准图集 / 衍生在资产详情里随时做）。
export const CHAIN: ChainStep[] = [
  { key: "source", n: 1, name: "素材 & 授权", icon: "idcard", short: "素材" },
  { key: "proof", n: 2, name: "形象生成", icon: "sparkle", short: "生成" },
  { key: "adjust", n: 3, name: "调整 & 保存", icon: "sliders", short: "调整" },
];

export const CAPS: CapMeta[] = [
  { key: "adjust", cap: "adjust", icon: "sliders", name: "调整形象", desc: "自然语言迭代 + 几何 / 外观精调", tint: "var(--primary)", tintS: "var(--primary-soft)" },
  { key: "output", cap: "output", icon: "images", name: "重新出图", desc: "换美化模板、重出标准图集并定稿", tint: "var(--c-atlas)", tintS: "var(--c-atlas-s)" },
  { key: "ward", cap: "derive", icon: "shirt", name: "换装变体", desc: "沿用同一张脸，生成服饰 / 风格变体", tint: "var(--c-ward)", tintS: "var(--c-ward-s)" },
  { key: "d3", cap: "derive", icon: "cube", name: "3D 模型", desc: "从定妆形象重建 GLB / FBX", tint: "var(--c-3d)", tintS: "var(--c-3d-s)" },
  { key: "video", cap: "derive", icon: "film", name: "运镜视频", desc: "环绕 / 推拉运镜导出 MP4", tint: "var(--c-video)", tintS: "var(--c-video-s)" },
  { key: "derive", cap: "derive", icon: "layers", name: "全部衍生", desc: "图集 / 场景 / 3D / 视频 一览生成", tint: "var(--c-scene)", tintS: "var(--c-scene-s)" },
];

export const WARP_CTRLS: WarpCtrl[] = [
  { key: "face", name: "脸型", min: -50, max: 50, val: 0, real: true },
  { key: "eye", name: "眼睛", min: -50, max: 50, val: 0, real: true },
  { key: "nose", name: "鼻梁", min: -50, max: 50, val: 0, real: true },
  { key: "mouth", name: "嘴型", min: -50, max: 50, val: 0, real: true },
  { key: "chin", name: "下巴", min: -50, max: 50, val: 0, real: true },
];

export const APPEAR_CTRLS: AppearCtrl[] = [
  { key: "makeup", name: "妆容迁移", engine: "EleGANt" },
  { key: "hair", name: "发型变换", engine: "HairCLIP" },
  { key: "skin", name: "肤质美颜", engine: "GFPGAN" },
  { key: "cloth", name: "服饰编辑", engine: "SD Inpaint" },
];

export const VOICES: VoiceAsset[] = [
  { id: "VC-12", name: "林深 · 标准音", char: "DH-2041", kind: "clone", gender: "男", lang: "中文 · 普通话", tone: "专业沉稳", dur: "00:42", wave: [4, 9, 14, 7, 18, 11, 22, 8, 15, 6, 19, 10, 5, 13, 8, 16, 9, 20, 7, 12], fav: true },
  { id: "VC-09", name: "星岚 · 少女音", char: "DH-2038", kind: "design", gender: "女", lang: "中文 · 普通话", tone: "清冷治愈", dur: "00:38", wave: [6, 12, 8, 17, 10, 21, 9, 14, 7, 19, 11, 16, 6, 13, 20, 8, 15, 10, 18, 7], fav: true },
  { id: "VC-07", name: "苏婉 · 讲师音", char: "DH-2035", kind: "clone", gender: "女", lang: "中文 · 普通话", tone: "温润清晰", dur: "00:51", wave: [5, 10, 15, 9, 19, 12, 7, 17, 11, 21, 8, 14, 6, 16, 10, 18, 9, 13, 7, 20], fav: false },
  { id: "VC-05", name: "周野 · 播报音", char: "DH-2019", kind: "clone", gender: "男", lang: "中文 · 普通话", tone: "干练正式", dur: "00:34", wave: [7, 13, 9, 18, 11, 6, 16, 10, 20, 8, 14, 5, 17, 12, 9, 19, 7, 15, 11, 6], fav: false },
  { id: "VC-03", name: "阿茶 · 萌系音", char: "DH-2026", kind: "design", gender: "女", lang: "中文 · 普通话", tone: "呆萌机灵", dur: "00:29", wave: [9, 15, 7, 12, 18, 10, 6, 16, 21, 8, 13, 19, 7, 11, 17, 9, 14, 6, 20, 10], fav: false },
];

/**
 * 内置 AI 合成音色（规格 §6.2）—— prompt 驱动大模型实时合成，全局只读，7 款。
 * 女声 4 + 男声 3。详情 / 声音工作室 / AI 保存形象页三处共用同一份列表。
 */
export const BUILTIN_VOICES: BuiltinVoice[] = [
  // —— 女声 ——
  { id: "warm_f", name: "亲和邻家女声", gender: "female", traits: "中频柔和 · 尾音轻扬 · 语速舒缓", scenes: ["电商导购", "美妆", "母婴科普", "短视频口播"], prompt: "请以 25–30 岁年轻女性声线合成：中频柔和温暖，尾音轻微上扬，语速舒缓亲切，如邻家姐姐般自然不做作，带轻微微笑感、适度口语化。" },
  { id: "news_f", name: "新闻播报女声", gender: "female", traits: "声线厚重 · 吐字规整 · 语调平稳", scenes: ["财经播报", "政务科普", "知识资讯", "企业解说"], prompt: "请以成熟女性播音声线合成：声线厚重沉稳，吐字规整清晰，语调平稳有权威感，节奏匀速，专业客观。" },
  { id: "elegant_f", name: "御姐优雅女声", gender: "female", traits: "低频饱满 · 语速偏慢 · 发音圆润", scenes: ["奢侈品", "文旅", "品牌宣传片", "高端课程"], prompt: "请以 30+ 成熟女性声线合成：低频饱满，语速偏慢，发音圆润，气质优雅从容，尾音略带磁性。" },
  { id: "sweet_f", name: "少女甜嗓", gender: "female", traits: "高频清亮 · 气息轻快", scenes: ["游戏虚拟形象", "早教", "零食带货"], prompt: "请以 18–22 岁少女声线合成：高频清亮，气息轻快灵动，语调上扬俏皮，充满活力与亲和力。" },
  // —— 男声 ——
  { id: "deep_m", name: "沉稳大叔低音", gender: "male", traits: "胸腔共鸣强 · 轻微颗粒感", scenes: ["金融理财", "房产", "法律科普", "企业旁白"], prompt: "请以 40+ 成熟男性声线合成：胸腔共鸣强，低音浑厚，带轻微颗粒质感，语速从容，沉稳可信。" },
  { id: "fresh_m", name: "青年清爽男声", gender: "male", traits: "中音通透 · 自然口语", scenes: ["数码测评", "职场课程", "日常探店"], prompt: "请以 25 岁年轻男性声线合成：中音通透干净，自然口语化，语速适中，亲切阳光，不做作。" },
  { id: "anchor_m", name: "播音正经男声", gender: "male", traits: "字正腔圆 · 节奏规整", scenes: ["新闻", "公考教学", "官方公告播报"], prompt: "请以专业男性播音声线合成：字正腔圆，节奏规整，语调端正有公信力，吐字铿锵，权威庄重。" },
];

/** 按音色名查找内置音色。 */
export const voiceByName = (nm: string): BuiltinVoice | undefined =>
  BUILTIN_VOICES.find((v) => v.name === nm);

// ── 配色映射 ────────────────────────────────────────────────

export function catColor(cat: string): string {
  return (
    ({ atlas: "var(--c-atlas)", expr: "var(--c-expr)", scene: "var(--c-scene)", ward: "var(--c-ward)", "3d": "var(--c-3d)", video: "var(--c-video)", key: "var(--c-key)" } as Record<string, string>)[cat] || "var(--primary)"
  );
}
export function catSoft(cat: string): string {
  return (
    ({ atlas: "var(--c-atlas-s)", expr: "var(--c-expr-s)", scene: "var(--c-scene-s)", ward: "var(--c-ward-s)", "3d": "var(--c-3d-s)", video: "var(--c-video-s)", key: "var(--c-key-s)" } as Record<string, string>)[cat] || "var(--primary-soft)"
  );
}

/** 与原型 window.DATA 等价的聚合导出（屏幕层统一从这里取）。 */
export const DATA = {
  STATUS,
  PATHS,
  SHOTS,
  DERIVS,
  CHARS,
  TEMPLATES,
  LICENSES,
  TASKS,
  CHAIN,
  CAPS,
  WARP_CTRLS,
  APPEAR_CTRLS,
  VOICES,
  catColor,
  catSoft,
};

// ── 公开数字人 / 应用中心 / 场景库 / 账户（原先内联在屏幕里的 mock，统一收口为数据源）──

/** 公开（只读复用）数字人。字段较精简，用于库的 public 网格。 */
export const PUBLIC_AVATARS: any[] = [
  { id: "PA-01", name: "Annie", archetype: "商务职业", hue: 28, cat: "pro", fav: false, path: "ai", status: "archived", counts: {}, deriv: {}, def: {} },
  { id: "PA-02", name: "Christina", archetype: "居家生活", hue: 168, cat: "life", fav: true, path: "ai", status: "archived", counts: {}, deriv: {}, def: {} },
  { id: "PA-03", name: "Terry", archetype: "播客主播", hue: 248, cat: "ugc", fav: false, path: "ai", status: "archived", counts: {}, deriv: {}, def: {} },
  { id: "PA-04", name: "Pamela", archetype: "社媒口播", hue: 8, cat: "community", fav: false, path: "ai", status: "archived", counts: {}, deriv: {}, def: {} },
  { id: "PA-05", name: "Marcus", archetype: "专业讲解", hue: 200, cat: "pro", fav: false, path: "ai", status: "archived", counts: {}, deriv: {}, def: {} },
  { id: "PA-06", name: "Yuki", archetype: "生活方式", hue: 320, cat: "life", fav: true, path: "ai", status: "archived", counts: {}, deriv: {}, def: {} },
];

export interface ApplicationTool {
  name: string;
  desc: string;
  icon: string;
}
export interface Application {
  key: "music" | "drama" | "live";
  name: string;
  code: string;
  icon: string;
  blurb: string;
  g1: string;
  g2: string;
  accent: string;
  tools: ApplicationTool[];
}

/** 下游子应用（复用已定稿 Avatar）。 */
// 与平台三个子应用一一对应：AI 歌手（web-music）/ AI 短视频带货（web-celebrity）/ AI 短剧（web-drama）
export const APPLICATIONS: Application[] = [
  { key: "music", name: "AI 歌手", code: "APP-MUS", icon: "music", blurb: "数字人化身虚拟歌手：发单曲、出 MV、开虚拟演出", g1: "#7C5CE6", g2: "#2E2270", accent: "#C9B8FF",
    tools: [{ name: "单曲 MV", desc: "一首歌一键生成数字人 MV", icon: "clapper" }, { name: "虚拟歌手演出", desc: "数字人演唱与舞台呈现", icon: "music" }, { name: "音乐短片", desc: "氛围配乐 + 角色叙事短片", icon: "play" }] },
  { key: "live", name: "AI 短视频带货", code: "APP-LIV", icon: "cart", blurb: "数字人口播带货：短视频混剪、商品挂载、矩阵分发", g1: "#E8884A", g2: "#6E3214", accent: "#FFD0A6",
    tools: [{ name: "口播带货视频", desc: "商品脚本一键口播成片", icon: "mic" }, { name: "商品讲解", desc: "卖点拆解与讲解视频", icon: "doc" }, { name: "矩阵分发", desc: "多账号定时分发到抖音等平台", icon: "bolt" }] },
  { key: "drama", name: "AI 短剧", code: "APP-DRA", icon: "clapper", blurb: "数字人出演剧情短剧，从剧本到成片多角色演绎", g1: "#3E63C8", g2: "#16224C", accent: "#9DB8FF",
    tools: [{ name: "剧情短剧", desc: "剧本到成片的短剧制作", icon: "clapper" }, { name: "多角色对戏", desc: "多个数字人同场演绎", icon: "users" }, { name: "分镜成片", desc: "自动分镜与剪辑合成", icon: "layers" }] },
];

export interface Scene {
  id: string;
  name: string;
  variant: string;
  expr: string;
}

/** 平台预置场景库（设计新造型 → 选择场景替换）。 */
export const SCENES: Scene[] = [
  { id: "s1", name: "办公玻璃幕墙", variant: "key", expr: "calm" },
  { id: "s2", name: "书架暖光", variant: "threeq", expr: "smile" },
  { id: "s3", name: "米色针织", variant: "side", expr: "calm" },
  { id: "s4", name: "彩色背景墙", variant: "look", expr: "smile" },
  { id: "s5", name: "直播间", variant: "key", expr: "serious" },
  { id: "s6", name: "咖啡馆", variant: "threeq", expr: "calm" },
];

export interface StorageSlice {
  name: string;
  size: number;
  color: string;
  icon: string;
}
export interface Account {
  plan: "FREE" | "PRO" | "STUDIO";
  planLabel: string;
  credits: number;
  monthlyGrant: number;
  creditsUsed: number;
  refreshDate: string;
  generatableEstimate: number;
  storageUsedGB: number;
  storageQuotaGB: number;
  storageBreakdown: StorageSlice[];
}

/** 账户 / 算力 / 存储（规格 §2.9）。 */
export const ACCOUNT: Account = {
  plan: "PRO",
  planLabel: "PRO",
  credits: 1240,
  monthlyGrant: 1500,
  creditsUsed: 860,
  refreshDate: "6 月 30 日",
  generatableEstimate: 28,
  storageUsedGB: 68,
  storageQuotaGB: 200,
  storageBreakdown: [
    { name: "形象图集", size: 28.4, color: "var(--primary)", icon: "image" },
    { name: "衍生视频", size: 19.2, color: "#1AA06E", icon: "film" },
    { name: "3D 资产", size: 11.6, color: "#D9920E", icon: "cube" },
    { name: "声音文件", size: 5.3, color: "#8A6BFF", icon: "mic" },
    { name: "授权素材", size: 3.5, color: "var(--ink-3)", icon: "shield" },
  ],
};
