// ============================================================
// aiavatar-ui.ts — UI 配置真源（色调 / 状态文案 / 引擎标注 / 能力标签）。
// 纯数据，无 React 依赖；primitives 与 screens 共享。
// ============================================================
import type {
  AiAvatarCapability,
  AiAvatarStatus,
  AiAvatarJobStatus,
  AiAvatarProviderMode,
} from "@ai-star-eco/types/ai-avatar";

// ── 色调 ────────────────────────────────────────────────────────────────────
export type Tone = "mute" | "signal" | "accent" | "ok" | "err";

export const TONE: Record<Tone, { c: string; b: string; bg: string }> = {
  mute: { c: "var(--ink-1)", b: "var(--line-2)", bg: "transparent" },
  signal: { c: "var(--signal)", b: "var(--signal-line)", bg: "var(--signal-soft)" },
  accent: { c: "var(--accent-hi)", b: "var(--accent-line)", bg: "var(--accent-soft)" },
  ok: { c: "var(--ok)", b: "rgba(86,214,160,0.3)", bg: "var(--ok-soft)" },
  err: { c: "var(--err)", b: "rgba(240,107,107,0.3)", bg: "var(--err-soft)" },
};

// ── 8 态资产状态机 + 版本阶段别名 ───────────────────────────────────────────
export interface StatusMeta {
  label: string;
  tone: Tone;
}

// 真实 wire 值（AiAvatarStatus）→ 文案 / 色调。
export const STATUS_META: Record<string, StatusMeta> = {
  // 资产状态机（8 态）
  draft: { label: "草稿新建", tone: "mute" },
  sampling: { label: "打样中", tone: "signal" },
  draft_iterating: { label: "草稿迭代中", tone: "signal" },
  refining: { label: "精调中", tone: "signal" },
  pending_finalize: { label: "待定稿", tone: "accent" },
  finalized_2d: { label: "已定稿", tone: "ok" },
  deriving: { label: "衍生生成中", tone: "signal" },
  archived: { label: "正式归档", tone: "ok" },
  // 版本阶段别名（时间线 / 历史用，对齐原型 VERSIONS.stage）
  drafting: { label: "草稿迭代", tone: "signal" },
  pending: { label: "待定稿", tone: "accent" },
  finalized: { label: "已定稿", tone: "ok" },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, tone: "mute" };
}

// ── 任务状态 ──────────────────────────────────────────────────────────────
export const JOB_STATUS_META: Record<AiAvatarJobStatus, StatusMeta> = {
  queued: { label: "待执行", tone: "mute" },
  running: { label: "生成中", tone: "signal" },
  succeeded: { label: "已完成", tone: "ok" },
  failed: { label: "已失败", tone: "err" },
  cancelled: { label: "已取消", tone: "mute" },
};

// ── 创建模式 ──────────────────────────────────────────────────────────────
export function modeLabel(mode: string): string {
  return mode === "real_clone" ? "真人复刻" : "AI 原创";
}

// ── 能力 → 真实引擎 / 开源 SDK 标注（任务书 §4） ─────────────────────────────
export const CAPABILITY_ENGINE: Record<AiAvatarCapability, string> = {
  faceClone: "InstantID · ID 保持生成",
  txt2img: "SDXL / FLUX · 文生图",
  img2img: "img2img + InstructPix2Pix · 指令编辑",
  faceWarp: "MediaPipe 478 关键点 · 网格液化形变",
  inpaint: "SD Inpainting · 局部重绘",
  makeup: "EleGANt 妆容迁移",
  hair: "HairCLIP / Barbershop",
  restore: "GFPGAN / CodeFormer · 人脸修复",
  img23d: "TripoSR · 单图三维重建",
  img2video: "Stable Video Diffusion · 图生视频",
  faceDetect: "InsightFace(RetinaFace) · 合规检测",
  nlu: "LLM 网关 · 人设解析",
  segment: "SAM · 局部分割",
};

export const CAPABILITY_LABEL: Record<AiAvatarCapability, string> = {
  faceClone: "真人复刻打样",
  txt2img: "AI 原创打样",
  img2img: "草稿指令调整",
  faceWarp: "几何微调",
  inpaint: "局部重绘",
  makeup: "妆容迁移",
  hair: "发型变换",
  restore: "美颜 / 质感",
  img23d: "2D → 3D",
  img2video: "图生视频",
  faceDetect: "人脸合规检测",
  nlu: "人设文案解析",
  segment: "局部分割",
};

// 能力归类（实现方式说明面板 / MOCK 角标语义）。
export const CAPABILITY_KIND: Record<AiAvatarCapability, string> = {
  faceClone: "扩散模型",
  txt2img: "扩散模型",
  img2img: "扩散模型",
  faceWarp: "关键点算法",
  inpaint: "扩散模型",
  makeup: "迁移模型",
  hair: "迁移模型",
  restore: "修复模型",
  img23d: "重建模型",
  img2video: "视频模型",
  faceDetect: "检测模型",
  nlu: "LLM",
  segment: "分割模型",
};

export const PROVIDER_MODE_LABEL: Record<AiAvatarProviderMode, string> = {
  mock: "MOCK",
  backend: "后端网关",
  selfhost: "自部署",
};

// ── 几何微调滑块定义（确定性形变，非大模型） ──────────────────────────────────
export interface GeoParamDef {
  key: "slim" | "jaw" | "eyes" | "nose" | "mouth" | "brow";
  /** 映射到 face-warp.ts 的 FaceSliders 字段（brow 暂记录不形变）。 */
  sliderKey: "slimFace" | "faceShape" | "eyeSize" | "noseBridge" | "mouthShape" | null;
  label: string;
  v: number;
}

export const GEO_PARAMS: GeoParamDef[] = [
  { key: "slim", sliderKey: "slimFace", label: "瘦脸", v: 50 },
  { key: "jaw", sliderKey: "faceShape", label: "下颌轮廓", v: 50 },
  { key: "eyes", sliderKey: "eyeSize", label: "眼睛大小", v: 50 },
  { key: "nose", sliderKey: "noseBridge", label: "鼻梁高度", v: 50 },
  { key: "mouth", sliderKey: "mouthShape", label: "嘴型", v: 50 },
  { key: "brow", sliderKey: null, label: "眉形 / 眉距", v: 50 },
];

// ── 外观编辑（需模型推理） ─────────────────────────────────────────────────
export interface AppearanceEditDef {
  key: "makeup" | "hair" | "restore" | "inpaint";
  capability: AiAvatarCapability;
  label: string;
  engine: string;
  desc: string;
}

export const APPEARANCE_EDITS: AppearanceEditDef[] = [
  { key: "makeup", capability: "makeup", label: "妆容", engine: "EleGANt 妆容迁移", desc: "迁移参考妆容，保留五官结构" },
  { key: "hair", capability: "hair", label: "发型", engine: "HairCLIP / Barbershop", desc: "文本或参考图改变发型" },
  { key: "restore", capability: "restore", label: "肤质 / 肤色", engine: "GFPGAN + 肤色映射", desc: "高清修复 + 肤色调整" },
  { key: "inpaint", capability: "inpaint", label: "服饰", engine: "SD Inpainting 局部重绘", desc: "框选区域重绘服饰" },
];

// ── 风格模板（创建分类） ───────────────────────────────────────────────────
export const STYLE_TEMPLATES = [
  { id: "st-anchor", name: "写实主播风", desc: "高清写实 · 适合带货直播", hue: 28 },
  { id: "st-lux", name: "轻奢风", desc: "质感妆容 · 时尚气质", hue: 12 },
  { id: "st-min", name: "简约风", desc: "干净通勤 · 职业感", hue: 200 },
  { id: "st-guo", name: "国风", desc: "东方韵味 · 古典妆造", hue: 340 },
  { id: "st-2d", name: "二次元", desc: "动漫渲染 · 大眼立体", hue: 268 },
  { id: "st-sci", name: "科幻", desc: "未来感 · 金属机能", hue: 174 },
] as const;

export function styleHue(id?: string | null): number {
  return STYLE_TEMPLATES.find((s) => s.id === id)?.hue ?? 28;
}

// ── 标准构图（2D 标准图集固定 4 张 + 表情图） ──────────────────────────────────
import type { AiAvatarStandardShot } from "@ai-star-eco/types/ai-avatar";

export interface CompositionDef {
  id: string;
  shot: AiAvatarStandardShot;
  name: string;
  sub: string;
  ratio: string;
  main?: boolean;
}

export const COMPOSITIONS: CompositionDef[] = [
  { id: "c1", shot: "front_bust", name: "正面半身像", sub: "主形象图", ratio: "3:4", main: true },
  { id: "c2", shot: "front_full", name: "正面全身像", sub: "全身", ratio: "9:16" },
  { id: "c3", shot: "left_profile", name: "左侧脸特写", sub: "特写", ratio: "1:1" },
  { id: "c4", shot: "right_profile", name: "右侧脸特写", sub: "特写", ratio: "1:1" },
  { id: "c5", shot: "expression", name: "微笑表情", sub: "表情", ratio: "1:1" },
  { id: "c6", shot: "expression", name: "平静表情", sub: "表情", ratio: "1:1" },
];

// 资产状态 → 推荐继续的流程步骤（深链）。
export const STATUS_NEXT_STEP: Partial<Record<AiAvatarStatus, string>> = {
  draft: "material",
  sampling: "sampling",
  draft_iterating: "drafting",
  refining: "studio",
  pending_finalize: "finalize",
  finalized_2d: "derive",
  deriving: "derive",
};

// ── 精调「模版套用」模式：美颜模板（真实 canvas beauty）+ 风格妆造模板（样片→图生图）──────
import type { BeautyParams } from "@/lib/beauty";

/** 美颜 / 美化模板 → 真实 beauty 参数（warmth 可负=偏冷）。从原 output 步迁入精调。 */
export interface BeautyTemplateDef {
  id: string;
  name: string;
  tag: string;
  hue: number;
  params: BeautyParams;
}
export const BEAUTY_TEMPLATES: BeautyTemplateDef[] = [
  { id: "b1", name: "主播美颜", tag: "通用", hue: 28, params: { smooth: 55, whiten: 30, warmth: 12, brightness: 56 } },
  { id: "b2", name: "高清质感", tag: "细节", hue: 200, params: { smooth: 30, whiten: 8, warmth: 0, brightness: 54 } },
  { id: "b3", name: "冷白皮", tag: "肤色", hue: 220, params: { smooth: 42, whiten: 70, warmth: -22, brightness: 60 } },
  { id: "b4", name: "复古滤镜", tag: "色调", hue: 38, params: { smooth: 35, whiten: 12, warmth: 38, brightness: 48 } },
  { id: "b5", name: "奶油雾面", tag: "色调", hue: 18, params: { smooth: 60, whiten: 30, warmth: 18, brightness: 58 } },
  { id: "b6", name: "通透裸妆", tag: "妆容", hue: 340, params: { smooth: 38, whiten: 22, warmth: 6, brightness: 55 } },
];
export const BEAUTY_PRESET_MAP: Record<string, BeautyParams> = Object.fromEntries(BEAUTY_TEMPLATES.map((b) => [b.id, b.params]));

export function combineBeauty(ids: string[]): BeautyParams {
  const ps = ids.map((id) => BEAUTY_PRESET_MAP[id]).filter(Boolean);
  if (!ps.length) return { smooth: 0, whiten: 0, warmth: 0, brightness: 50 };
  const avg = (k: keyof BeautyParams) => ps.reduce((s, p) => s + p[k], 0) / ps.length;
  return { smooth: avg("smooth"), whiten: avg("whiten"), warmth: avg("warmth"), brightness: avg("brightness") };
}

/** 风格 / 妆造模板：带「样片」让 AI 做图生图（img2img + 参考）。如职业妆容 / 国风古韵等。 */
export interface StyleLookTemplateDef {
  id: string;
  name: string;
  desc: string;
  prompt: string;
  hue: number;
}
export const STYLE_LOOK_TEMPLATES: StyleLookTemplateDef[] = [
  { id: "look-pro", name: "职业妆容", desc: "干练通勤 · 自然底妆", prompt: "职业通勤妆容，自然底妆，知性干练气质，保留五官结构", hue: 200 },
  { id: "look-guofeng", name: "国风古韵", desc: "古典发饰 · 东方妆造", prompt: "国风古典妆造，古典发饰与服饰，东方韵味，保留五官结构", hue: 340 },
  { id: "look-lux", name: "轻奢氛围", desc: "高级感 · 质感妆容", prompt: "轻奢高级感妆容，质感光影，时尚氛围，保留五官结构", hue: 38 },
  { id: "look-2d", name: "二次元渲染", desc: "动漫风 · 通透大眼", prompt: "二次元动漫渲染风格，通透大眼，干净光影，保留五官结构", hue: 268 },
  { id: "look-gangfeng", name: "港风复古", desc: "复古胶片 · 浓颜", prompt: "港风复古妆容，胶片质感，浓颜立体，保留五官结构", hue: 12 },
  { id: "look-fresh", name: "校园清新", desc: "清透裸妆 · 元气", prompt: "校园清新风，清透裸妆，元气自然，保留五官结构", hue: 88 },
];
