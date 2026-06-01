// UI 配置：状态 / 任务态 / 能力 / 模板分类的中文标签 + 语义 tone。
// 重设计：状态色与品牌琥珀解耦 —— 蓝=进行中 · 绿=完成 · 橙=待你处理 · 红=失败 · 灰=草稿/归档。
// 琥珀(brand)只留给主操作、当前选中、当前链路步，不进状态色表。

import type {
  AiAvatarStatus, AiAvatarCapability, AiAvatarJobStatus, AiAvatarTemplateCategory, AiAvatarCreationMode, AiAvatarStandardShot,
} from "@ai-star-eco/types/ai-avatar";

/** 语义 tone（驱动 token 化的 pill / dot 配色）。 */
export type Tone = "neutral" | "muted" | "info" | "success" | "warning" | "danger" | "brand" | "violet";

export const STATUS_META: Record<AiAvatarStatus, { label: string; tone: Tone; step: number }> = {
  draft: { label: "草稿新建", tone: "neutral", step: 0 },
  sampling: { label: "打样中", tone: "info", step: 1 },
  draft_iterating: { label: "草稿迭代中", tone: "info", step: 2 },
  refining: { label: "精调中", tone: "info", step: 3 },
  pending_finalize: { label: "待定稿", tone: "warning", step: 4 },
  finalized_2d: { label: "已定稿", tone: "success", step: 5 },
  deriving: { label: "衍生生成中", tone: "info", step: 6 },
  archived: { label: "正式归档", tone: "muted", step: 7 },
};

export const PIPELINE_STEPS: { status: AiAvatarStatus; label: string }[] = [
  { status: "draft", label: "新建" },
  { status: "sampling", label: "打样" },
  { status: "draft_iterating", label: "草稿迭代" },
  { status: "refining", label: "精调" },
  { status: "pending_finalize", label: "待定稿" },
  { status: "finalized_2d", label: "定稿" },
  { status: "deriving", label: "衍生" },
  { status: "archived", label: "归档" },
];

export const JOB_STATUS_META: Record<AiAvatarJobStatus, { label: string; tone: Tone }> = {
  queued: { label: "排队中", tone: "neutral" },
  running: { label: "生成中", tone: "info" },
  succeeded: { label: "已完成", tone: "success" },
  failed: { label: "失败", tone: "danger" },
  cancelled: { label: "已取消", tone: "muted" },
};

export const CAPABILITY_LABEL: Record<AiAvatarCapability, string> = {
  faceClone: "真人复刻打样", txt2img: "AI 原创打样", img2img: "草稿指令调整", faceWarp: "几何微调",
  inpaint: "局部重绘", makeup: "妆容迁移", hair: "发型变换", restore: "美颜/质感",
  img23d: "2D→3D", img2video: "图生视频", faceDetect: "人脸合规检测", nlu: "人设文案解析", segment: "局部分割",
};

export const TEMPLATE_CATEGORY_LABEL: Record<AiAvatarTemplateCategory, string> = {
  beauty: "美颜", style: "风格", retouch: "质感修复", composition: "标准构图",
};

export const MODE_META: Record<AiAvatarCreationMode, { label: string; desc: string }> = {
  real_clone: { label: "真人授权复刻", desc: "多图上传 + 人脸合规 + 电子肖像授权 + InstantID 复刻打样" },
  ai_original: { label: "纯 AI 原创", desc: "人设文案（LLM 解析）+ 可选风格参考 + SDXL/FLUX 文生图打样" },
};

export const STANDARD_SHOT_LABEL: Record<AiAvatarStandardShot, string> = {
  full_body: "全景远景",
  half_body: "半身中景",
  bust_closeup: "胸像近景",
  detail_closeup: "细节特写",
  three_quarter_profile: "45°侧颜",
  overhead: "俯拍视角",
  front_bust: "正面半身",
  front_full: "正面全身",
  left_profile: "左侧脸",
  right_profile: "右侧脸",
  expression: "表情图",
};

/** 精调-外观编辑的可选能力。 */
export const APPEARANCE_CAPS: { cap: AiAvatarCapability; label: string; hint: string }[] = [
  { cap: "makeup", label: "妆容迁移", hint: "保留五官，迁移参考妆容（EleGANt）" },
  { cap: "hair", label: "发型变换", hint: "文本或参考图换发型（HairCLIP）" },
  { cap: "restore", label: "肤质美颜", hint: "高清修复 + 美白磨皮（GFPGAN）" },
  { cap: "img2img", label: "服饰/整体", hint: "图生图整体微调（InstructPix2Pix）" },
];

export const STYLE_PRESETS = ["未来机能", "国风古典", "赛博朋克", "甜美日常", "高冷御姐", "都市商务", "二次元", "复古胶片"];
