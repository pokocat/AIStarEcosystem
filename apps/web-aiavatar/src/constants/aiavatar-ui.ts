// UI 配置：状态 / 任务态 / 能力 / 模板分类的中文标签 + 颜色（Tailwind utility，经主题映射到深色琥珀）。

import type {
  AiAvatarStatus, AiAvatarCapability, AiAvatarJobStatus, AiAvatarTemplateCategory, AiAvatarCreationMode, AiAvatarStandardShot,
} from "@ai-star-eco/types/ai-avatar";

export const STATUS_META: Record<AiAvatarStatus, { label: string; cls: string; step: number }> = {
  draft: { label: "草稿新建", cls: "bg-zinc-700 text-zinc-100", step: 0 },
  sampling: { label: "打样中", cls: "bg-violet-500/20 text-violet-300", step: 1 },
  draft_iterating: { label: "草稿迭代中", cls: "bg-blue-500/20 text-blue-400", step: 2 },
  refining: { label: "精调中", cls: "bg-amber-500/20 text-amber-400", step: 3 },
  pending_finalize: { label: "待定稿", cls: "bg-orange-500/20 text-orange-400", step: 4 },
  finalized_2d: { label: "已定稿", cls: "bg-emerald-500/20 text-emerald-400", step: 5 },
  deriving: { label: "衍生生成中", cls: "bg-violet-500/20 text-violet-300", step: 6 },
  archived: { label: "正式归档", cls: "bg-zinc-600 text-zinc-200", step: 7 },
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

export const JOB_STATUS_META: Record<AiAvatarJobStatus, { label: string; cls: string }> = {
  queued: { label: "排队中", cls: "bg-zinc-700 text-zinc-200" },
  running: { label: "生成中", cls: "bg-amber-500/20 text-amber-400" },
  succeeded: { label: "已完成", cls: "bg-emerald-500/20 text-emerald-400" },
  failed: { label: "失败", cls: "bg-rose-500/20 text-rose-400" },
  cancelled: { label: "已取消", cls: "bg-zinc-600 text-zinc-300" },
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
  front_bust: "正面半身", front_full: "正面全身", left_profile: "左侧脸", right_profile: "右侧脸", expression: "表情图",
};

/** 精调-外观编辑的可选能力。 */
export const APPEARANCE_CAPS: { cap: AiAvatarCapability; label: string; hint: string }[] = [
  { cap: "makeup", label: "妆容迁移", hint: "保留五官，迁移参考妆容（EleGANt）" },
  { cap: "hair", label: "发型变换", hint: "文本或参考图换发型（HairCLIP）" },
  { cap: "restore", label: "肤质美颜", hint: "高清修复 + 美白磨皮（GFPGAN）" },
  { cap: "img2img", label: "服饰/整体", hint: "图生图整体微调（InstructPix2Pix）" },
];

export const STYLE_PRESETS = ["未来机能", "国风古典", "赛博朋克", "甜美日常", "高冷御姐", "都市商务", "二次元", "复古胶片"];
