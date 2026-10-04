// ─────────────────────────────────────────────────────────────────────────────
// lib/video-studio.ts：「AI 创作 → 视频生成」的纯逻辑。
//
//   · quote() / optimizationPrice()  报价（docs/video-studio-plan.md §3：我们自己定、后台可配，
//                        与服务端冻结金额同一套数；某格没定价就不报价、不许提交）
//   · referenceLabels()  全能参考的编号（图1、图2…、视频1、音频1…，同类按顺序）
//   · preflight()        提交前预检（数量 / 大小 / 时长 / 提示词 / 规格 / 种子；模板素材不判大小时长）
//   · buildJobRequest() / buildOptimizationRequest()  组请求体（同一处挑当前模式要的素材）
//   · defaultSelection() / reconcileSelection() / aspectForTier()  规格的默认值与联动
//   · planTemplateApply() / validateTemplateDraft()  做同款怎么填表、存模板的标题说明（§10）
//
// 服务端是最后裁决；这里只挡明显的错，让用户不用等一次往返才知道缺了首帧。
// 所有限制都从模型合同（GET …/models）读，这里不写死任何厂商数值。
//
// ⚠️ 这个文件会被 `node --test` 直接加载（Node 的 TS 类型擦除）：
//   · 只能 `import type`，不能有运行期 import（`@/` 别名 Node 不认识）；
//   · 只能写可擦除的 TS 语法（不用 enum / namespace / 构造参数属性）。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VideoStudioCanvas,
  VideoStudioContract,
  VideoStudioJobRequest,
  VideoStudioMediaLimit,
  VideoStudioMediaType,
  VideoStudioMode,
  VideoStudioModeSpec,
  VideoStudioModel,
  VideoStudioOptimizationRequest,
  VideoStudioPricing,
  VideoStudioReferenceInput,
  VideoStudioReferenceRules,
  VideoStudioTemplate,
  VideoStudioTemplateMaterial,
  VideoStudioTier,
  VideoStudioUpload,
} from "@ai-star-eco/types/video-studio";

const MIB = 1024 * 1024;

/** 素材类型的中文名（页签、提示、报错共用一份）。 */
export const MEDIA_TYPE_NAME: Record<VideoStudioMediaType, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
};

/** 量词：图片论张、视频论个、音频论段。 */
export const MEDIA_TYPE_UNIT: Record<VideoStudioMediaType, string> = {
  image: "张",
  video: "个",
  audio: "段",
};

/** 参考素材编号前缀：图1 / 视频1 / 音频1。与服务端回显的 `VideoStudioJobInput.label` 同一套叫法。 */
export const REFERENCE_LABEL_PREFIX: Record<VideoStudioMediaType, string> = {
  image: "图",
  video: "视频",
  audio: "音频",
};

/** 全能参考里三类素材的展示与提交顺序。 */
export const REFERENCE_MEDIA_ORDER: readonly VideoStudioMediaType[] = ["image", "video", "audio"];

// ── 报价 ─────────────────────────────────────────────────────────────────────

export interface VideoStudioQuote {
  /** 本条生成的总价（积分，整数）。 */
  total: number;
  seconds: number;
  /** 这个模式、这个清晰度的每秒价。 */
  basePerSecond: number;
  /** 全能参考里超出免费张数的图片张数；其他模式恒为 0。 */
  extraImages: number;
  /** 超出的图片每张每秒加价（0 = 不加）。 */
  extraPerImagePerSecond: number;
  /** 前几张参考图不加价（照下发的配置）。 */
  freeRefImages: number;
  /** 含加价后的每秒价。 */
  perSecond: number;
}

function isNonNegativeInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

/** 某个模式、某档清晰度的每秒价；没定价（null / 缺这一格）返回 null。 */
export function perSecondPrice(pricing: VideoStudioPricing, mode: VideoStudioMode, tier: string): number | null {
  const cell = pricing.perSecond?.[mode]?.[tier];
  return isNonNegativeInt(cell) ? cell : null;
}

/**
 * 按服务端下发的计价参数算本条生成的报价。算不出来（这一格没定价、秒数不是正整数）返回 null：
 * 调用方此时写「这个规格还没定价」、不许提交，**绝不回落任何写死的价**（报价必须与服务端冻结的金额同源）。
 *
 *   总价 = (perSecond[模式][清晰度] + 超出张数 × extraRefImagePerSecond) × 秒数
 *   超出张数 = max(0, 全能参考的图片张数 − freeRefImages)，其他模式为 0
 */
export function quote(
  pricing: VideoStudioPricing,
  tier: string,
  seconds: number,
  mode: VideoStudioMode,
  refImageCount: number,
): VideoStudioQuote | null {
  const base = perSecondPrice(pricing, mode, tier);
  if (base === null) return null;
  if (!Number.isInteger(seconds) || seconds <= 0) return null;

  const free = isNonNegativeInt(pricing.freeRefImages) ? pricing.freeRefImages : 0;
  const count = Number.isFinite(refImageCount) ? Math.max(0, Math.trunc(refImageCount)) : 0;
  const extraImages = mode === "universal_reference_video" ? Math.max(0, count - free) : 0;
  const extraPer = isNonNegativeInt(pricing.extraRefImagePerSecond) ? pricing.extraRefImagePerSecond : 0;
  const perSecond = base + extraImages * extraPer;
  const total = perSecond * seconds;
  if (!Number.isSafeInteger(total)) return null;
  return {
    total,
    seconds,
    basePerSecond: base,
    extraImages,
    extraPerImagePerSecond: extraPer,
    freeRefImages: free,
    perSecond,
  };
}

/** 智能优化每次多少积分（0 = 不收费）；配置读不出来返回 null（此时不许发起优化）。与生成分开扣。 */
export function optimizationPrice(pricing: VideoStudioPricing): number | null {
  return isNonNegativeInt(pricing.promptOptimizationPerCall) ? pricing.promptOptimizationPerCall : null;
}

// ── 参考素材编号 ─────────────────────────────────────────────────────────────

/** 第 index（从 0 起）个同类素材的编号，如 ("image", 0) → "图1"。 */
export function referenceLabel(mediaType: VideoStudioMediaType, index: number): string {
  return `${REFERENCE_LABEL_PREFIX[mediaType]}${index + 1}`;
}

/** 给一组有序素材编号：同类按出现顺序数，如 [图, 音, 图, 视] → [图1, 音频1, 图2, 视频1]。 */
export function referenceLabels(refs: readonly { mediaType: VideoStudioMediaType }[]): string[] {
  const seen: Record<VideoStudioMediaType, number> = { image: 0, video: 0, audio: 0 };
  return refs.map((r) => {
    seen[r.mediaType] += 1;
    return `${REFERENCE_LABEL_PREFIX[r.mediaType]}${seen[r.mediaType]}`;
  });
}

// ── 提示词 ───────────────────────────────────────────────────────────────────

/** 提示词字数：去掉首尾空白后按 Unicode 字符（码点）数，与厂商口径一致（一个 emoji 算 1 个字）。 */
export function countPromptChars(prompt: string): number {
  return Array.from(prompt.trim()).length;
}

/**
 * 智能优化的结果是不是以英文为主。聚算 H3 的优化目前一律回英文的分镜描述（2026-10-03 线上实测，
 * docs/video-studio-plan.md §9），用户写的是中文，突然看到一大段英文会以为出了错，面板据此加一句说明。
 * 按「英文单词数 > 汉字数」判：英文描述里夹几句中文台词仍算英文，中文里夹几个英文词不算。
 * 先去掉厂商固定的结构字段（`integrated_multimodal_description:` 这类）、镜头标记和 N/A，
 * 否则「字段名是英文、正文是中文」的短结果会被字段名算成英文。
 */
export function isMostlyEnglish(text: string): boolean {
  const body = text.replace(OPTIMIZED_PROMPT_SCAFFOLD, " ");
  const han = (body.match(/\p{Script=Han}/gu) ?? []).length;
  const words = (body.match(/[A-Za-z]+/g) ?? []).length;
  return words > han;
}

/** 厂商优化结果里固定的结构字段（蛇形命名 + 冒号）、`[Shot 1]` 这样的镜头标记、`N/A`。 */
const OPTIMIZED_PROMPT_SCAFFOLD = /\b[a-z]+(?:_[a-z]+)+\s*:|\[\s*shot\s*\d+\s*\]|\bN\/A\b/gi;

// ── 规格：默认值与联动 ───────────────────────────────────────────────────────

export interface VideoStudioSelection {
  mode: VideoStudioMode;
  resolutionTier: string;
  aspectRatio: string;
  seconds: number;
}

/** 默认值偏好：带货以竖屏为主（厂商默认 16:9，这里改 9:16），见 plan §1。 */
export const PREFERRED_MODE: VideoStudioMode = "t2v";
export const PREFERRED_TIER = "768p";
export const PREFERRED_ASPECT = "9:16";
export const PREFERRED_SECONDS = 5;

export function findModeSpec(contract: VideoStudioContract, mode: VideoStudioMode): VideoStudioModeSpec | null {
  return contract.modes.find((m) => m.mode === mode) ?? null;
}

export function findTier(contract: VideoStudioContract, tier: string): VideoStudioTier | null {
  return contract.tiers.find((t) => t.tier === tier) ?? null;
}

export function findCanvas(contract: VideoStudioContract, tier: string, aspectRatio: string): VideoStudioCanvas | null {
  return findTier(contract, tier)?.canvases.find((c) => c.aspectRatio === aspectRatio) ?? null;
}

function preferredAspect(tier: VideoStudioTier | null): string {
  if (!tier) return "";
  return tier.canvases.some((c) => c.aspectRatio === PREFERRED_ASPECT)
    ? PREFERRED_ASPECT
    : (tier.canvases[0]?.aspectRatio ?? "");
}

/** 把秒数收进合同区间（整数）。 */
export function clampSeconds(contract: VideoStudioContract, seconds: number): number {
  const lo = Math.ceil(contract.minSeconds);
  const hi = Math.floor(contract.maxSeconds);
  if (hi < lo) return lo;
  const s = Number.isFinite(seconds) ? Math.round(seconds) : lo;
  return Math.min(hi, Math.max(lo, s));
}

/** 进页面时的默认规格：文生视频 · 768p · 9:16 · max(最短时长, 5) 秒；合同里没有的就取第一个。 */
export function defaultSelection(contract: VideoStudioContract): VideoStudioSelection {
  const mode = contract.modes.some((m) => m.mode === PREFERRED_MODE)
    ? PREFERRED_MODE
    : (contract.modes[0]?.mode ?? PREFERRED_MODE);
  const resolutionTier = contract.tiers.some((t) => t.tier === PREFERRED_TIER)
    ? PREFERRED_TIER
    : (contract.tiers[0]?.tier ?? "");
  return {
    mode,
    resolutionTier,
    aspectRatio: preferredAspect(findTier(contract, resolutionTier)),
    seconds: clampSeconds(contract, Math.max(contract.minSeconds, PREFERRED_SECONDS)),
  };
}

/** 换清晰度时的画面比例：新档位里还有这个比例就保留，没有就取该档第一个。 */
export function aspectForTier(contract: VideoStudioContract, tier: string, currentAspect: string): string {
  const t = findTier(contract, tier);
  if (!t) return currentAspect;
  return t.canvases.some((c) => c.aspectRatio === currentAspect)
    ? currentAspect
    : (t.canvases[0]?.aspectRatio ?? currentAspect);
}

/** 换模型时把当前规格对齐到新合同：还合法的保留，不合法的回到默认值，秒数收进区间。 */
export function reconcileSelection(
  contract: VideoStudioContract,
  current: VideoStudioSelection | null,
): VideoStudioSelection {
  const fallback = defaultSelection(contract);
  if (!current) return fallback;
  const mode = contract.modes.some((m) => m.mode === current.mode) ? current.mode : fallback.mode;
  const resolutionTier = findTier(contract, current.resolutionTier) ? current.resolutionTier : fallback.resolutionTier;
  const aspectRatio = findCanvas(contract, resolutionTier, current.aspectRatio)
    ? current.aspectRatio
    : preferredAspect(findTier(contract, resolutionTier));
  return { mode, resolutionTier, aspectRatio, seconds: clampSeconds(contract, current.seconds) };
}

// ── 随机种子 ─────────────────────────────────────────────────────────────────

/**
 * 解析「随机种子」输入框：空 → null（随机）；纯数字 → 数字；其他 → NaN（交给 preflight 报错）。
 * 范围（0 ~ seedMax）由 preflight 判。
 */
export function parseSeedInput(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return Number.NaN;
  return Number(t);
}

// ── 大小 / 时长的展示 ────────────────────────────────────────────────────────

function trimDecimal(n: number, digits: number): string {
  return String(Number(n.toFixed(digits)));
}

/** 按位数向下 / 向上取整；先抹掉乘法带来的浮点尾巴（15.2 × 100 = 1519.9999999999998）。 */
function roundTo(n: number, digits: number, direction: "floor" | "ceil"): number {
  const f = 10 ** digits;
  const scaled = Number((n * f).toFixed(6));
  return (direction === "floor" ? Math.floor(scaled) : Math.ceil(scaled)) / f;
}

/** 文件大小：356 KB / 2.4 MB（1 MB = 1024 × 1024 字节，与服务端上限同一口径）。 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < MIB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${trimDecimal(bytes / MIB, 1)} MB`;
}

/** 上限文案：16777216 → "16 MB"。 */
export function formatSizeLimit(bytes: number): string {
  if (bytes < MIB) return `${trimDecimal(bytes / 1024, 1)} KB`;
  return `${trimDecimal(bytes / MIB, 1)} MB`;
}

/** 超限时说「这个多大」：向上取到 0.1 MB，避免把 16.02 MB 显示成「16 MB」却说超了 16 MB。 */
export function formatSizeCeil(bytes: number): string {
  return `${trimDecimal(roundTo(bytes / MIB, 1, "ceil"), 1)} MB`;
}

/** 时长：2.5 秒 / 15 秒（列表里用，保留 1 位小数）。 */
export function formatSeconds(sec: number): string {
  return `${trimDecimal(sec, 1)} 秒`;
}

/** 超限时说「现在多长」：短于下限向下取、长于上限向上取（2 位小数），不会把 1.996 秒说成 2 秒。 */
function formatSecondsBelow(sec: number): string {
  return `${trimDecimal(roundTo(sec, 2, "floor"), 2)} 秒`;
}
function formatSecondsAbove(sec: number): string {
  return `${trimDecimal(roundTo(sec, 2, "ceil"), 2)} 秒`;
}

/** 素材限制的一句话说明，如「PNG / JPEG / WEBP，不超过 16 MB」「…，每段 2 到 15 秒」。 */
export function limitHint(limit: VideoStudioMediaLimit): string {
  const parts: string[] = [];
  if (limit.formats.length > 0) parts.push(limit.formats.join(" / "));
  parts.push(`不超过 ${formatSizeLimit(limit.maxBytes)}`);
  const { minDurationSec: min, maxDurationSec: max } = limit;
  if (min != null && max != null) parts.push(`每段 ${min} 到 ${max} 秒`);
  else if (min != null) parts.push(`每段至少 ${min} 秒`);
  else if (max != null) parts.push(`每段最长 ${max} 秒`);
  return parts.join("，");
}

const FORMAT_ACCEPT: Record<string, readonly string[]> = {
  PNG: ["image/png", ".png"],
  JPEG: ["image/jpeg", ".jpg", ".jpeg"],
  JPG: ["image/jpeg", ".jpg", ".jpeg"],
  WEBP: ["image/webp", ".webp"],
  MP4: ["video/mp4", ".mp4"],
  WAV: ["audio/wav", "audio/x-wav", ".wav"],
  MP3: ["audio/mpeg", ".mp3"],
  FLAC: ["audio/flac", ".flac"],
  AAC: ["audio/aac", ".aac"],
  OGG: ["audio/ogg", ".ogg", ".oga"],
  M4A: ["audio/mp4", "audio/x-m4a", ".m4a"],
  MOV: ["video/quicktime", ".mov"],
};

/** 文件选择框的 accept：按合同里的格式名拼；遇到不认识的格式名就放宽到 `<类型>/*`（服务端按字节判）。 */
export function mediaAccept(limit: VideoStudioMediaLimit): string {
  const parts = new Set<string>();
  let unknown = false;
  for (const f of limit.formats) {
    const known = FORMAT_ACCEPT[f.trim().toUpperCase()];
    if (known) known.forEach((p) => parts.add(p));
    else unknown = true;
  }
  if (unknown || parts.size === 0) parts.add(`${limit.mediaType}/*`);
  return Array.from(parts).join(",");
}

// ── 预检 ─────────────────────────────────────────────────────────────────────

/**
 * 一个素材里预检需要的事实（`VideoStudioUpload` 结构上就满足）。
 * 做同款带来的模板素材不知道大小和时长（bytes / durationSec 为 null），这两项就不判，交给服务端。
 */
export interface VideoStudioMediaFacts {
  mediaType: VideoStudioMediaType;
  key: string;
  /** 字节数；不知道（模板素材）为 null，不判大小。 */
  bytes: number | null;
  /** 时长（秒）；图片或不知道为 null，不判时长。 */
  durationSec: number | null;
  /** 模板里的这个素材已经删掉了（预览地址为 null），不能再用。 */
  unavailable?: boolean;
}

export interface VideoStudioPreflightInput extends VideoStudioSelection {
  prompt: string;
  /** null = 随机；NaN = 输入框里填的不是数字（见 parseSeedInput）。 */
  seed: number | null;
  firstFrame: VideoStudioMediaFacts | null;
  lastFrame: VideoStudioMediaFacts | null;
  /** 全能参考的素材（有序）；其他模式忽略。 */
  references: readonly VideoStudioMediaFacts[];
}

/**
 * missing：还没填（缺提示词、缺首帧…），用户点「生成」之后才提示，免得一进页面就满屏红字；
 * invalid：填错了（超长、超大、超数量…），实时提示。
 */
export type VideoStudioProblemKind = "missing" | "invalid";

export interface VideoStudioProblem {
  /** 服务端对同一问题会回的错误码（docs/video-studio-plan.md §4），演示模式照此抛错。 */
  code: string;
  kind: VideoStudioProblemKind;
  /** 直接给用户看的话。 */
  message: string;
}

const CODE_MODE = "VIDEO_STUDIO_MODE_INVALID";
const CODE_PROMPT_REQUIRED = "VIDEO_STUDIO_PROMPT_REQUIRED";
const CODE_PROMPT_TOO_LONG = "VIDEO_STUDIO_PROMPT_TOO_LONG";
const CODE_SPEC = "VIDEO_STUDIO_SPEC_INVALID";
const CODE_INPUT = "VIDEO_STUDIO_INPUT_INVALID";

// 音频时长来自 ffprobe 的小数，几段相加会有浮点误差（5.1 + 4.9 + 5 = 15.000000000000002），留一点余量
const DURATION_EPSILON = 1e-6;

/** 提交前预检。返回空数组 = 可以提交（服务端仍会再判一遍）。 */
export function preflight(contract: VideoStudioContract, input: VideoStudioPreflightInput): VideoStudioProblem[] {
  const problems: VideoStudioProblem[] = [];
  const push = (code: string, kind: VideoStudioProblemKind, message: string) => {
    problems.push({ code, kind, message });
  };

  const spec = findModeSpec(contract, input.mode);
  if (!spec) push(CODE_MODE, "invalid", "当前模型不支持这种生成模式，请换一种");

  const chars = countPromptChars(input.prompt);
  if (chars === 0) push(CODE_PROMPT_REQUIRED, "missing", "请填写提示词");
  else if (chars > contract.promptMaxChars) {
    push(CODE_PROMPT_TOO_LONG, "invalid", `提示词最多 ${contract.promptMaxChars} 字，现在 ${chars} 字`);
  }

  const tier = findTier(contract, input.resolutionTier);
  if (!tier) push(CODE_SPEC, "invalid", "请选择清晰度");
  else if (!tier.canvases.some((c) => c.aspectRatio === input.aspectRatio)) push(CODE_SPEC, "invalid", "请选择画面比例");
  if (!Number.isInteger(input.seconds) || input.seconds < contract.minSeconds || input.seconds > contract.maxSeconds) {
    push(CODE_SPEC, "invalid", `时长要在 ${contract.minSeconds} 到 ${contract.maxSeconds} 秒之间`);
  }
  if (input.seed !== null && (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > contract.seedMax)) {
    push(CODE_SPEC, "invalid", `随机种子要填 0 到 ${contract.seedMax} 之间的整数，留空就是随机`);
  }

  if (spec) {
    if (spec.needsFirstFrame) checkFrame("首帧", input.firstFrame, spec.frameImage, push);
    if (spec.needsLastFrame) checkFrame("尾帧", input.lastFrame, spec.frameImage, push);
    if (spec.references) checkReferences(spec.references, input.references, push);
  }
  return problems;
}

type Push = (code: string, kind: VideoStudioProblemKind, message: string) => void;

function checkFrame(
  label: string,
  facts: VideoStudioMediaFacts | null,
  limit: VideoStudioMediaLimit | null,
  push: Push,
) {
  if (!facts) {
    push(CODE_INPUT, "missing", `请上传${label}图`);
    return;
  }
  if (facts.mediaType !== "image") {
    push(CODE_INPUT, "invalid", `${label}只能用图片`);
    return;
  }
  if (facts.unavailable) {
    push(CODE_INPUT, "invalid", `模板里的${label}图已经删掉了，请换一张`);
    return;
  }
  if (limit && facts.bytes != null && facts.bytes > limit.maxBytes) {
    push(CODE_INPUT, "invalid", `${label}图不能超过 ${formatSizeLimit(limit.maxBytes)}（这张 ${formatSizeCeil(facts.bytes)}）`);
  }
}

function checkReferences(rules: VideoStudioReferenceRules, refs: readonly VideoStudioMediaFacts[], push: Push) {
  const labels = referenceLabels(refs);
  const count: Record<VideoStudioMediaType, number> = { image: 0, video: 0, audio: 0 };
  for (const r of refs) count[r.mediaType] += 1;

  for (const t of REFERENCE_MEDIA_ORDER) {
    const lim = rules[t];
    if (count[t] <= lim.maxCount) continue;
    push(
      CODE_INPUT,
      "invalid",
      lim.maxCount === 0
        ? `这个模式不能用${MEDIA_TYPE_NAME[t]}素材`
        : `${MEDIA_TYPE_NAME[t]}最多 ${lim.maxCount} ${MEDIA_TYPE_UNIT[t]}（现在 ${count[t]} ${MEDIA_TYPE_UNIT[t]}）`,
    );
  }
  if (count.video > 0 && count.image > rules.maxImagesWithVideo) {
    push(CODE_INPUT, "invalid", `带视频时图片最多 ${rules.maxImagesWithVideo} 张（现在 ${count.image} 张）`);
  }
  if (refs.length > rules.maxTotal) {
    push(CODE_INPUT, "invalid", `参考素材最多 ${rules.maxTotal} 个（现在 ${refs.length} 个）`);
  }
  if (count.image + count.video < rules.minVisual) {
    push(
      CODE_INPUT,
      "missing",
      rules.minVisual === 1 ? "至少放 1 张图片或 1 个视频" : `图片和视频加起来至少要 ${rules.minVisual} 个`,
    );
  }

  refs.forEach((r, i) => {
    const lim = rules[r.mediaType];
    if (r.unavailable) {
      push(CODE_INPUT, "invalid", `${labels[i]} 是模板里的素材，已经删掉了，换一个或者删掉它`);
      return;
    }
    if (r.bytes != null && r.bytes > lim.maxBytes) {
      push(CODE_INPUT, "invalid", `${labels[i]} 不能超过 ${formatSizeLimit(lim.maxBytes)}（这个 ${formatSizeCeil(r.bytes)}）`);
    }
    const d = r.durationSec;
    if (d == null) return;
    const { minDurationSec: min, maxDurationSec: max } = lim;
    const tooShort = min != null && d < min - DURATION_EPSILON;
    const tooLong = max != null && d > max + DURATION_EPSILON;
    if (!tooShort && !tooLong) return;
    const now = tooShort ? formatSecondsBelow(d) : formatSecondsAbove(d);
    const range =
      min != null && max != null ? `要在 ${min} 到 ${max} 秒之间` : min != null ? `至少 ${min} 秒` : `最长 ${max} 秒`;
    push(CODE_INPUT, "invalid", `${labels[i]} ${range}（现在 ${now}）`);
  });

  // 时长读不到的段不计入（服务端上传时已按 ffprobe 判过单段），只要已知的加起来超了就提示
  const audioTotal = refs
    .filter((r) => r.mediaType === "audio" && r.durationSec != null)
    .reduce((sum, r) => sum + (r.durationSec ?? 0), 0);
  if (audioTotal > rules.maxAudioTotalSec + DURATION_EPSILON) {
    push(CODE_INPUT, "invalid", `音频加起来最长 ${rules.maxAudioTotalSec} 秒（现在 ${formatSecondsAbove(audioTotal)}）`);
  }

  const firstIndexByKey = new Map<string, number>();
  refs.forEach((r, i) => {
    const prev = firstIndexByKey.get(r.key);
    if (prev === undefined) firstIndexByKey.set(r.key, i);
    else push(CODE_INPUT, "invalid", `${labels[i]} 和 ${labels[prev]} 是同一个素材，删掉一个`);
  });
}

// ── 组请求体 ─────────────────────────────────────────────────────────────────

export interface VideoStudioDraft extends VideoStudioSelection {
  prompt: string;
  seed: number | null;
  firstFrameKey: string | null;
  lastFrameKey: string | null;
  /** 全能参考的素材（有序）。 */
  references: readonly VideoStudioReferenceInput[];
  /** 正在做同款时的模板 id；不是做同款为 null。 */
  templateId?: string | null;
  /** 用的是智能优化那一版提示词时的优化记录 id；否则为 null。 */
  optimizationId?: string | null;
}

type ModeInputs = Pick<VideoStudioJobRequest, "firstFrameKey" | "lastFrameKey" | "references">;

/**
 * 当前模式要带的素材（生成与智能优化共用这一处）：切模式时已上传的素材留在页面上，
 * 但只把这个模式要的发出去。
 */
function modeInputs(model: VideoStudioModel, draft: VideoStudioDraft): ModeInputs {
  const spec = findModeSpec(model.contract, draft.mode);
  const out: ModeInputs = {};
  if (spec?.needsFirstFrame && draft.firstFrameKey) out.firstFrameKey = draft.firstFrameKey;
  if (spec?.needsLastFrame && draft.lastFrameKey) out.lastFrameKey = draft.lastFrameKey;
  if (spec?.references) out.references = draft.references.map((r) => ({ mediaType: r.mediaType, key: r.key }));
  return out;
}

/**
 * 组生成请求体。模型是合成的默认项（selectableById=false）时不带 endpointId；
 * 做同款带 templateId，用了优化那一版带 optimizationId（两者都是空就不带这个字段）。
 */
export function buildJobRequest(model: VideoStudioModel, draft: VideoStudioDraft): VideoStudioJobRequest {
  const req: VideoStudioJobRequest = {
    ...(model.selectableById ? { endpointId: model.endpointId } : {}),
    mode: draft.mode,
    prompt: draft.prompt.trim(),
    resolutionTier: draft.resolutionTier,
    aspectRatio: draft.aspectRatio,
    seconds: draft.seconds,
  };
  if (draft.seed !== null && Number.isInteger(draft.seed)) req.seed = draft.seed;
  Object.assign(req, modeInputs(model, draft));
  if (draft.templateId) req.templateId = draft.templateId;
  if (draft.optimizationId) req.optimizationId = draft.optimizationId;
  return req;
}

/**
 * 组智能优化请求体：字段与生成同一套（优化要按模式和素材改写），不带种子；
 * clientRequestId 防重复点击，同一次点击重试时不变。
 */
export function buildOptimizationRequest(
  model: VideoStudioModel,
  draft: VideoStudioDraft,
  clientRequestId: string,
): VideoStudioOptimizationRequest {
  const req: VideoStudioOptimizationRequest = {
    clientRequestId,
    ...(model.selectableById ? { endpointId: model.endpointId } : {}),
    mode: draft.mode,
    prompt: draft.prompt.trim(),
    resolutionTier: draft.resolutionTier,
    aspectRatio: draft.aspectRatio,
    seconds: draft.seconds,
  };
  Object.assign(req, modeInputs(model, draft));
  if (draft.templateId) req.templateId = draft.templateId;
  return req;
}

/** clientRequestId 的格式：8–128 个可见 ASCII（与服务端 VIDEO_STUDIO_REQUEST_ID_INVALID 同一条）。 */
export function isValidClientRequestId(id: string): boolean {
  return /^[\x21-\x7e]{8,128}$/.test(id);
}

/**
 * 每次点「优化并继续」/「重新优化」生成一个新的 clientRequestId。
 * crypto.randomUUID 只在 https / localhost 下有（用局域网 IP 打开开发页时没有），退到 getRandomValues。
 */
export function newClientRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return `vs-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  return `vs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ── 表单里的素材（自己上传的 + 做同款带来的模板素材）─────────────────────────

/** 表单里一个已经就位的素材。 */
export interface VideoStudioFormMaterial {
  key: string;
  /** 预览地址；模板素材已删除时为 null。 */
  url: string | null;
  mediaType: VideoStudioMediaType;
  /** 展示名：上传的是文件名，模板素材是「图1」这类原编号。 */
  name: string;
  /** 不知道（模板素材）为 null。 */
  bytes: number | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  /** 做同款带来的原素材（标「模板素材」，退出做同款时一起清掉）。 */
  fromTemplate: boolean;
}

export function materialFromUpload(upload: VideoStudioUpload): VideoStudioFormMaterial {
  return {
    key: upload.key,
    url: upload.url,
    mediaType: upload.mediaType,
    name: upload.name,
    bytes: upload.bytes,
    durationSec: upload.durationSec,
    width: upload.width,
    height: upload.height,
    fromTemplate: false,
  };
}

export function materialFromTemplate(material: VideoStudioTemplateMaterial): VideoStudioFormMaterial {
  return {
    key: material.key,
    url: material.url,
    mediaType: material.mediaType,
    name: material.label,
    bytes: null,
    durationSec: null,
    width: null,
    height: null,
    fromTemplate: true,
  };
}

/** 预检要看的事实：模板素材不知道大小时长，预览地址没了就是已删除。 */
export function materialFacts(material: VideoStudioFormMaterial): VideoStudioMediaFacts {
  return {
    mediaType: material.mediaType,
    key: material.key,
    bytes: material.bytes,
    durationSec: material.durationSec,
    unavailable: material.fromTemplate && material.url === null,
  };
}

// ── 模板 / 做同款 ───────────────────────────────────────────────────────────

export const TEMPLATE_TITLE_MAX = 40;
export const TEMPLATE_DESCRIPTION_MAX = 200;

/** 存模板时的标题 / 说明检查（与服务端 VIDEO_STUDIO_TEMPLATE_INVALID 同口径：去首尾空白后按字数）。 */
export function validateTemplateDraft(title: string, description: string): string[] {
  const problems: string[] = [];
  const t = countPromptChars(title);
  if (t === 0) problems.push("请填写标题");
  else if (t > TEMPLATE_TITLE_MAX) problems.push(`标题最多 ${TEMPLATE_TITLE_MAX} 个字，现在 ${t} 个`);
  const d = countPromptChars(description);
  if (d > TEMPLATE_DESCRIPTION_MAX) problems.push(`说明最多 ${TEMPLATE_DESCRIPTION_MAX} 个字，现在 ${d} 个`);
  return problems;
}

/** 做同款时怎么填表（纯数据，表单照着改状态）。 */
export interface TemplateApplyPlan {
  /** 原作的模型还在列表里就选它；否则 null（用默认模型）。 */
  endpointId: string | null;
  /** 模板记了原作模型、但现在列表里没有它。 */
  modelUnavailable: boolean;
  /** 原样的规格，表单会再按所选模型的合同对齐。 */
  selection: VideoStudioSelection;
  prompt: string;
  /** 「高级」里的随机种子输入框内容；模板没有种子为空串。 */
  seedText: string;
  firstFrame: VideoStudioTemplateMaterial | null;
  lastFrame: VideoStudioTemplateMaterial | null;
  /** 参考素材，按模板里的顺序。 */
  references: VideoStudioTemplateMaterial[];
}

export function planTemplateApply(template: VideoStudioTemplate, models: readonly VideoStudioModel[]): TemplateApplyPlan {
  const wanted = template.endpointId?.trim() || null;
  const matched = wanted ? models.find((m) => m.endpointId === wanted) : undefined;
  return {
    endpointId: matched ? matched.endpointId : null,
    modelUnavailable: wanted !== null && !matched,
    selection: {
      mode: template.mode,
      resolutionTier: template.resolutionTier,
      aspectRatio: template.aspectRatio,
      seconds: template.seconds,
    },
    prompt: template.prompt,
    seedText: template.seed != null ? String(template.seed) : "",
    firstFrame: template.materials.find((m) => m.role === "first_frame") ?? null,
    lastFrame: template.materials.find((m) => m.role === "last_frame") ?? null,
    references: template.materials.filter((m) => m.role === "reference"),
  };
}
