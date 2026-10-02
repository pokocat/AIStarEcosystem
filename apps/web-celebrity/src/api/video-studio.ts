// ─────────────────────────────────────────────────────────────────────────────
// api/video-studio.ts：「AI 创作 → 视频生成」数据层（docs/video-studio-plan.md §4）。
//
//   GET    /api/me/celebrity/video-studio/models                       可选模型 + 合同 + 计价
//   POST   /api/me/celebrity/video-studio/uploads                      multipart（file + mediaType）→ 存储 key
//   POST   /api/me/celebrity/video-studio/jobs                         提交一条生成任务
//   GET    /api/me/celebrity/video-studio/jobs                         本区任务（新 → 旧，最多 100 条）
//   GET    /api/me/celebrity/video-studio/jobs/{id}                    单条任务（签名地址过期后用它换新）
//   POST   /api/me/celebrity/video-studio/prompt-optimizations         发起一次智能优化（同一个 clientRequestId 只算一次）
//   GET    /api/me/celebrity/video-studio/prompt-optimizations/{id}    查优化结果
//   GET    /api/me/celebrity/video-studio/templates                    官方模板 + 我的模板
//   GET    /api/me/celebrity/video-studio/templates/{id}               单个模板（签名地址过期后用它换新）
//   POST   /api/me/celebrity/video-studio/templates                    把一条成功的生成记录存成模板
//   DELETE /api/me/celebrity/video-studio/templates/{id}               删除自己的 / 撤回官方的
//
// live 失败一律抛 ApiError（带服务端原话），调用方原样展示；模型列表拿不到时
// 调用方必须禁用提交、不显示报价，**绝不回落写死单价**（报价要与冻结金额同源）。
//
// USE_MOCK=1：不发网络请求。上传返回假 key + 本地预览地址；提交的任务按时间推进
// （排队 → 生成中 → 已完成，约 20 秒），没有真实成片，界面会标「演示」；智能优化几秒后出结果
// （提示词里写 #fail 会失败）；模板的增删、做同款次数只在本页会话里生效。
// 演示分支照服务端的规则校验（同一套错误码），演示能过、线上不过的情况尽量不出现。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VideoStudioJob,
  VideoStudioJobInput,
  VideoStudioJobRequest,
  VideoStudioMediaType,
  VideoStudioMode,
  VideoStudioModel,
  VideoStudioModeSpec,
  VideoStudioOptimization,
  VideoStudioOptimizationRequest,
  VideoStudioReferenceInput,
  VideoStudioTemplate,
  VideoStudioTemplateCreateRequest,
  VideoStudioTemplateMaterial,
  VideoStudioUpload,
} from "@ai-star-eco/types/video-studio";
import {
  MOCK_UPLOAD_AUDIO_SECONDS,
  MOCK_UPLOAD_MAX_BYTES,
  MOCK_VIDEO_STUDIO_JOBS,
  MOCK_VIDEO_STUDIO_MODELS,
  MOCK_VIDEO_STUDIO_TEMPLATES,
} from "@/mocks/video-studio";
import {
  MEDIA_TYPE_NAME,
  findCanvas,
  findModeSpec,
  formatSeconds,
  formatSizeLimit,
  isValidClientRequestId,
  optimizationPrice,
  preflight,
  quote,
  referenceLabels,
  validateTemplateDraft,
  type VideoStudioMediaFacts,
} from "@/lib/video-studio";
import { apiFetch, ApiError, USE_MOCK, mockDelay } from "./_client";

/** 可选模型（含合同与计价）。空数组 = 后台还没配视频生成模型。 */
export async function listModels(): Promise<VideoStudioModel[]> {
  if (USE_MOCK) return mockDelay(MOCK_VIDEO_STUDIO_MODELS);
  return apiFetch<VideoStudioModel[]>("/me/celebrity/video-studio/models");
}

/** 上传一个素材（图片 / 视频 / 音频），返回提交任务时要带回的 key 与预览地址。 */
export async function upload(file: File, mediaType: VideoStudioMediaType): Promise<VideoStudioUpload> {
  if (USE_MOCK) return mockUpload(file, mediaType);
  const form = new FormData();
  form.append("file", file);
  form.append("mediaType", mediaType);
  return apiFetch<VideoStudioUpload>("/me/celebrity/video-studio/uploads", { method: "POST", body: form });
}

/** 提交一条生成任务；积分按服务端报价冻结，成功扣、失败退。 */
export async function submitJob(req: VideoStudioJobRequest): Promise<VideoStudioJob> {
  if (USE_MOCK) return mockSubmit(req);
  return apiFetch<VideoStudioJob>("/me/celebrity/video-studio/jobs", { method: "POST", body: req });
}

/** 本区的生成记录，新的在前。 */
export async function listJobs(): Promise<VideoStudioJob[]> {
  if (USE_MOCK) return mockDelay(mockListJobs());
  return apiFetch<VideoStudioJob[]>("/me/celebrity/video-studio/jobs");
}

/** 单条生成记录（成片 / 素材的签名地址过期后，用它换一份新地址）。 */
export async function getJob(id: string): Promise<VideoStudioJob> {
  if (USE_MOCK) return mockDelay(mockGetJob(id));
  return apiFetch<VideoStudioJob>(`/me/celebrity/video-studio/jobs/${encodeURIComponent(id)}`);
}

/** 发起一次智能优化。同一个 clientRequestId 再发一次返回同一条（不重复扣积分）。 */
export async function createOptimization(req: VideoStudioOptimizationRequest): Promise<VideoStudioOptimization> {
  if (USE_MOCK) return mockCreateOptimization(req);
  return apiFetch<VideoStudioOptimization>("/me/celebrity/video-studio/prompt-optimizations", {
    method: "POST",
    body: req,
  });
}

/** 查一次智能优化的进度与结果。 */
export async function getOptimization(id: string): Promise<VideoStudioOptimization> {
  if (USE_MOCK) return mockDelay(mockGetOptimization(id));
  return apiFetch<VideoStudioOptimization>(`/me/celebrity/video-studio/prompt-optimizations/${encodeURIComponent(id)}`);
}

/** 官方模板 + 我自己的模板，新的在前。 */
export async function listTemplates(): Promise<VideoStudioTemplate[]> {
  if (USE_MOCK) return mockDelay(mockListTemplates());
  return apiFetch<VideoStudioTemplate[]>("/me/celebrity/video-studio/templates");
}

/** 单个模板（封面 / 成片 / 素材的签名地址过期后，用它换一份新地址）。 */
export async function getTemplate(id: string): Promise<VideoStudioTemplate> {
  if (USE_MOCK) return mockDelay(mockGetTemplate(id));
  return apiFetch<VideoStudioTemplate>(`/me/celebrity/video-studio/templates/${encodeURIComponent(id)}`);
}

/** 把一条成功的生成记录存成模板；运营可以直接发布成官方模板。 */
export async function createTemplate(req: VideoStudioTemplateCreateRequest): Promise<VideoStudioTemplate> {
  if (USE_MOCK) return mockCreateTemplate(req);
  return apiFetch<VideoStudioTemplate>("/me/celebrity/video-studio/templates", { method: "POST", body: req });
}

/** 删除自己的模板；官方模板由发布人或运营撤回。 */
export async function deleteTemplate(id: string): Promise<void> {
  if (USE_MOCK) return mockDeleteTemplate(id);
  await apiFetch<void>(`/me/celebrity/video-studio/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── USE_MOCK：演示数据 ───────────────────────────────────────────────────────

/** 本页会话里「上传」过的素材：key → 上传结果（提交时据此回显缩略图、做预检）。 */
const mockUploads = new Map<string, VideoStudioUpload>();
let mockUploadSeq = 0;

interface MockJobRecord {
  job: VideoStudioJob;
  modelName: string;
  endpointId: string;
  submittedAtMs: number;
  /** 这条用到的素材（存模板时原样带过去）。 */
  materials: VideoStudioTemplateMaterial[];
}
/** 本页会话里提交的演示任务（新的在前）。刷新页面即清空。 */
const mockSessionJobs: MockJobRecord[] = [];
let mockJobSeq = 0;

// 演示任务的节奏：3 秒排队、3 秒「提交生成请求」、14 秒「AI 生成中」，共 20 秒出结果
const MOCK_QUEUED_MS = 3_000;
const MOCK_SUBMITTING_MS = 6_000;
const MOCK_DONE_MS = 20_000;

interface MockOptimizationRecord {
  optimization: VideoStudioOptimization;
  clientRequestId: string;
  startedAtMs: number;
  /** 提示词里带 #fail 的演示失败。 */
  fail: boolean;
  rewritten: string;
}
const mockOptimizations: MockOptimizationRecord[] = [];
let mockOptimizationSeq = 0;

// 演示优化的节奏：1 秒排队，4 秒出结果（失败的 3 秒）
const MOCK_OPT_QUEUED_MS = 1_000;
const MOCK_OPT_DONE_MS = 4_000;
const MOCK_OPT_FAIL_MS = 3_000;

/** 演示用的模板库（会话内可增删、做同款次数会涨）。 */
let mockTemplates: VideoStudioTemplate[] = MOCK_VIDEO_STUDIO_TEMPLATES.map(copyTemplate);
let mockTemplateSeq = 0;

const PRICE_NOT_CONFIGURED_MESSAGE = "这个规格还没定价，请联系运营在后台「引擎定价 → 视频生成」里配置";

function mockError(code: string, message: string, status = 400): ApiError {
  return new ApiError({ code, message }, status);
}

function extensionOf(name: string, mediaType: VideoStudioMediaType): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  if (m) return m[1].toLowerCase();
  return mediaType === "image" ? "png" : mediaType === "video" ? "mp4" : "mp3";
}

interface ProbedMedia {
  durationSec: number | null;
  width: number | null;
  height: number | null;
}

const UNKNOWN_MEDIA: ProbedMedia = { durationSec: null, width: null, height: null };

/** 用一个不挂到页面上的媒体元素读时长 / 像素；读不出来（格式浏览器不支持、超时）就给 null。 */
function probeMedia(url: string, mediaType: VideoStudioMediaType): Promise<ProbedMedia> {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve(UNKNOWN_MEDIA);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: ProbedMedia) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(UNKNOWN_MEDIA), 5_000);

    if (mediaType === "image") {
      const img = new Image();
      img.onload = () => finish({ durationSec: null, width: img.naturalWidth || null, height: img.naturalHeight || null });
      img.onerror = () => finish(UNKNOWN_MEDIA);
      img.src = url;
      return;
    }
    const el = document.createElement(mediaType === "video" ? "video" : "audio");
    el.preload = "metadata";
    el.muted = true;
    el.onloadedmetadata = () => {
      const d = Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration * 100) / 100 : null;
      const video = el instanceof HTMLVideoElement ? el : null;
      finish({
        durationSec: d,
        width: video?.videoWidth || null,
        height: video?.videoHeight || null,
      });
    };
    el.onerror = () => finish(UNKNOWN_MEDIA);
    el.src = url;
  });
}

async function mockUpload(file: File, mediaType: VideoStudioMediaType): Promise<VideoStudioUpload> {
  await mockDelay(null, 600);
  const max = MOCK_UPLOAD_MAX_BYTES[mediaType];
  if (max === undefined) throw mockError("VIDEO_STUDIO_FORMAT_UNSUPPORTED", "只能上传图片、视频或音频");
  if (file.size === 0) throw mockError("VIDEO_STUDIO_FILE_EMPTY", "这个文件是空的，换一个再试");
  if (file.size > max) {
    throw mockError("VIDEO_STUDIO_FILE_TOO_LARGE", `${MEDIA_TYPE_NAME[mediaType]}不能超过 ${formatSizeLimit(max)}`);
  }

  // 服务端按字节判格式；演示模式退而求其次看浏览器给的类型（给空就放过），图片再看能不能解码
  const type = file.type.toLowerCase();
  const typeOk = !type || type.startsWith(`${mediaType}/`) || (mediaType === "audio" && type === "video/quicktime");
  if (!typeOk) {
    throw mockError("VIDEO_STUDIO_FORMAT_UNSUPPORTED", `这个文件不是${MEDIA_TYPE_NAME[mediaType]}，换一个再试`);
  }

  const url = URL.createObjectURL(file);
  const probed = await probeMedia(url, mediaType);
  if (mediaType === "image" && probed.width == null) {
    URL.revokeObjectURL(url);
    throw mockError("VIDEO_STUDIO_FORMAT_UNSUPPORTED", "这张图片读不出来，请换 PNG、JPEG 或 WEBP 格式");
  }
  const d = probed.durationSec;
  if (mediaType === "audio" && d != null && (d < MOCK_UPLOAD_AUDIO_SECONDS.min || d > MOCK_UPLOAD_AUDIO_SECONDS.max)) {
    URL.revokeObjectURL(url);
    throw mockError(
      "VIDEO_STUDIO_AUDIO_DURATION_INVALID",
      `每段音频要在 ${MOCK_UPLOAD_AUDIO_SECONDS.min} 到 ${MOCK_UPLOAD_AUDIO_SECONDS.max} 秒之间，这段 ${formatSeconds(d)}`,
    );
  }

  mockUploadSeq += 1;
  const result: VideoStudioUpload = {
    key: `video-studio-${mediaType}/mock-user/${Date.now().toString(36)}-${mockUploadSeq}.${extensionOf(file.name, mediaType)}`,
    url,
    mediaType,
    bytes: file.size,
    name: file.name || "未命名文件",
    durationSec: mediaType === "image" ? null : d,
    width: mediaType === "audio" ? null : probed.width,
    height: mediaType === "audio" ? null : probed.height,
  };
  mockUploads.set(result.key, result);
  return result;
}

// ── 演示：生成与优化共用的校验（模型 → 模式 → 模板 → 素材归属），同服务端的顺序与错误码 ──

/** 一个已核对过归属的素材：预检要的事实 + 回显用的预览地址。 */
type MockFacts = VideoStudioMediaFacts & { url: string | null };

interface MockResolved {
  model: VideoStudioModel;
  spec: VideoStudioModeSpec;
  firstFrame: MockFacts | null;
  lastFrame: MockFacts | null;
  references: MockFacts[];
}

interface MockInputs {
  endpointId?: string | null;
  mode: VideoStudioMode;
  firstFrameKey?: string | null;
  lastFrameKey?: string | null;
  references?: VideoStudioReferenceInput[] | null;
  templateId?: string | null;
}

function mockFindTemplate(id: string): VideoStudioTemplate | undefined {
  return mockTemplates.find((t) => t.id === id);
}

function mockResolve(req: MockInputs): MockResolved {
  const model =
    req.endpointId == null
      ? (MOCK_VIDEO_STUDIO_MODELS.find((m) => m.isDefault) ?? MOCK_VIDEO_STUDIO_MODELS[0])
      : MOCK_VIDEO_STUDIO_MODELS.find((m) => m.endpointId === req.endpointId);
  if (!model) throw mockError("VIDEO_STUDIO_MODEL_UNSUPPORTED", "所选模型现在不能用，请刷新页面重新选择");

  const spec = findModeSpec(model.contract, req.mode);
  if (!spec) throw mockError("VIDEO_STUDIO_MODE_INVALID", "当前模型不支持这种生成模式");
  if (
    (!spec.needsFirstFrame && req.firstFrameKey) ||
    (!spec.needsLastFrame && req.lastFrameKey) ||
    (!spec.references && (req.references?.length ?? 0) > 0)
  ) {
    throw mockError("VIDEO_STUDIO_INPUT_INVALID", "这种模式不需要传这些素材");
  }

  let template: VideoStudioTemplate | null = null;
  if (req.templateId) {
    template = mockFindTemplate(req.templateId) ?? null;
    if (!template) throw mockError("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", "这个模板已经下架了，换一个模板做同款", 404);
  }

  // 每个 key 要么是自己在这里上传的，要么是正在做同款的那个模板里的原素材（类型还要对得上）
  const resolve = (key: string | null | undefined, mediaType: VideoStudioMediaType, label: string): MockFacts | null => {
    if (!key) return null;
    const own = mockUploads.get(key);
    if (own && own.mediaType === mediaType) {
      return { mediaType, key, bytes: own.bytes, durationSec: own.durationSec, url: own.url };
    }
    const fromTemplate = template?.materials.find((m) => m.key === key && m.mediaType === mediaType);
    if (fromTemplate) {
      return {
        mediaType,
        key,
        bytes: null,
        durationSec: null,
        unavailable: fromTemplate.url === null,
        url: fromTemplate.url,
      };
    }
    throw mockError("VIDEO_STUDIO_ASSET_INVALID", `${label}不是在这里上传的素材，请重新上传`);
  };

  const refs = req.references ?? [];
  const labels = referenceLabels(refs);
  const references = refs.map((r, i) => {
    const facts = resolve(r.key, r.mediaType, labels[i]);
    if (!facts) throw mockError("VIDEO_STUDIO_INPUT_INVALID", `${labels[i]} 没有素材`);
    return facts;
  });
  return {
    model,
    spec,
    firstFrame: resolve(req.firstFrameKey, "image", "首帧"),
    lastFrame: resolve(req.lastFrameKey, "image", "尾帧"),
    references,
  };
}

function materialsOf(resolved: MockResolved): VideoStudioTemplateMaterial[] {
  const out: VideoStudioTemplateMaterial[] = [];
  if (resolved.firstFrame) {
    out.push({ role: "first_frame", mediaType: "image", key: resolved.firstFrame.key, label: "首帧", url: resolved.firstFrame.url });
  }
  if (resolved.lastFrame) {
    out.push({ role: "last_frame", mediaType: "image", key: resolved.lastFrame.key, label: "尾帧", url: resolved.lastFrame.url });
  }
  const labels = referenceLabels(resolved.references);
  resolved.references.forEach((r, i) =>
    out.push({ role: "reference", mediaType: r.mediaType, key: r.key, label: labels[i], url: r.url }),
  );
  return out;
}

async function mockSubmit(req: VideoStudioJobRequest): Promise<VideoStudioJob> {
  await mockDelay(null, 400);
  const resolved = mockResolve(req);
  const { model } = resolved;

  const problems = preflight(model.contract, {
    mode: req.mode,
    prompt: req.prompt,
    resolutionTier: req.resolutionTier,
    aspectRatio: req.aspectRatio,
    seconds: req.seconds,
    seed: req.seed ?? null,
    firstFrame: resolved.firstFrame,
    lastFrame: resolved.lastFrame,
    references: resolved.references,
  });
  if (problems.length > 0) throw mockError(problems[0].code, problems[0].message);

  let originalPrompt: string | null = null;
  if (req.optimizationId) {
    const record = mockOptimizations.find((r) => r.optimization.id === req.optimizationId);
    const current = record ? advanceOptimization(record, Date.now()) : null;
    if (!current || current.status !== "succeeded") {
      throw mockError("VIDEO_STUDIO_OPTIMIZATION_INVALID", "这次智能优化的结果用不了了，请重新优化");
    }
    originalPrompt = current.originalPrompt;
  }

  const imageCount = resolved.references.filter((r) => r.mediaType === "image").length;
  const price = quote(model.pricing, req.resolutionTier, req.seconds, req.mode, imageCount);
  if (!price) throw mockError("VIDEO_STUDIO_PRICE_NOT_CONFIGURED", PRICE_NOT_CONFIGURED_MESSAGE, 503);
  const canvas = findCanvas(model.contract, req.resolutionTier, req.aspectRatio);
  const materials = materialsOf(resolved);
  const inputs: VideoStudioJobInput[] = materials.map((m) => ({ mediaType: m.mediaType, label: m.label, url: m.url }));

  const now = Date.now();
  mockJobSeq += 1;
  const record: MockJobRecord = {
    modelName: model.name,
    endpointId: model.endpointId,
    submittedAtMs: now,
    materials,
    job: {
      id: `vs-mock-${now.toString(36)}-${mockJobSeq}`,
      mode: req.mode,
      prompt: req.prompt.trim(),
      resolutionTier: req.resolutionTier,
      aspectRatio: req.aspectRatio,
      width: canvas?.width ?? null,
      height: canvas?.height ?? null,
      seconds: req.seconds,
      seed: req.seed ?? null,
      modelName: null,
      status: "queued",
      progressPct: 0,
      stage: "已入队",
      inputs,
      videoUrl: null,
      thumbnailUrl: null,
      errorMessage: null,
      credits: price.total,
      originalPrompt,
      templateId: req.templateId ?? null,
      createdAt: new Date(now).toISOString(),
      completedAt: null,
    },
  };
  mockSessionJobs.unshift(record);
  // 做同款成功建了任务，模板的「已做同款」次数 +1（与服务端同一时机）
  if (req.templateId) {
    mockTemplates = mockTemplates.map((t) => (t.id === req.templateId ? { ...t, useCount: t.useCount + 1 } : t));
  }
  return advanceMockJob(record, now);
}

/** 按提交后过了多久算出演示任务此刻的样子（不靠定时器，读的时候现算）。 */
function advanceMockJob(record: MockJobRecord, nowMs: number): VideoStudioJob {
  const elapsed = nowMs - record.submittedAtMs;
  const job = copyJob(record.job);
  if (elapsed < MOCK_QUEUED_MS) return job;
  if (elapsed < MOCK_SUBMITTING_MS) {
    return { ...job, status: "running", progressPct: 5, stage: "提交生成请求", modelName: record.modelName };
  }
  if (elapsed < MOCK_DONE_MS) {
    const pct = 10 + Math.floor(((elapsed - MOCK_SUBMITTING_MS) / (MOCK_DONE_MS - MOCK_SUBMITTING_MS)) * 85);
    return { ...job, status: "running", progressPct: Math.min(95, pct), stage: "AI 生成中", modelName: record.modelName };
  }
  return {
    ...job,
    status: "succeeded",
    progressPct: 100,
    stage: "已完成",
    modelName: record.modelName,
    completedAt: new Date(record.submittedAtMs + MOCK_DONE_MS).toISOString(),
  };
}

function copyJob(job: VideoStudioJob): VideoStudioJob {
  return { ...job, inputs: job.inputs.map((i) => ({ ...i })) };
}

function mockListJobs(): VideoStudioJob[] {
  const now = Date.now();
  return [...mockSessionJobs.map((r) => advanceMockJob(r, now)), ...MOCK_VIDEO_STUDIO_JOBS.map(copyJob)]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 100);
}

function mockGetJob(id: string): VideoStudioJob {
  const record = mockSessionJobs.find((r) => r.job.id === id);
  if (record) return advanceMockJob(record, Date.now());
  const seeded = MOCK_VIDEO_STUDIO_JOBS.find((j) => j.id === id);
  if (seeded) return copyJob(seeded);
  throw mockError("VIDEO_STUDIO_JOB_NOT_FOUND", "没找到这条生成记录", 404);
}

// ── 演示：智能优化 ───────────────────────────────────────────────────────────

const REFERENCE_USE: Record<VideoStudioMediaType, string> = {
  image: "外观参考",
  video: "动作与运镜参考",
  audio: "节奏参考",
};

/** 演示用的「改写」：把原提示词拆成镜头、光线、素材用法几块，一眼能看出改过。 */
function mockRewrite(req: VideoStudioOptimizationRequest): string {
  const refs = req.references ?? [];
  const labels = referenceLabels(refs);
  const lines = [
    `【主体与动作】${req.prompt.trim()}`,
    "【镜头】开场 1 秒内给到主体，中段镜头缓慢推近，结尾停在主体特写",
    "【光线与色调】柔和的自然光，暖色调，主体和背景分得开",
    refs.length > 0 ? `【素材用法】${refs.map((r, i) => `${labels[i]} 作为${REFERENCE_USE[r.mediaType]}`).join("，")}` : null,
    req.firstFrameKey ? "【首帧】保持首帧的构图和人物外观，动作从首帧自然接上" : null,
    req.lastFrameKey ? "【尾帧】最后一秒自然过渡到尾帧画面" : null,
    `【时长与画面】${req.seconds} 秒，${req.aspectRatio}，${req.resolutionTier}`,
  ].filter((line): line is string => line !== null);
  return Array.from(lines.join("\n")).slice(0, 7000).join("");
}

function advanceOptimization(record: MockOptimizationRecord, nowMs: number): VideoStudioOptimization {
  const elapsed = nowMs - record.startedAtMs;
  const base = { ...record.optimization };
  if (elapsed < MOCK_OPT_QUEUED_MS) return base;
  if (record.fail) {
    if (elapsed < MOCK_OPT_FAIL_MS) return { ...base, status: "running" };
    return {
      ...base,
      status: "failed",
      errorMessage: "智能优化被拒：提示词里带了 #fail，这是演示用的失败",
      completedAt: new Date(record.startedAtMs + MOCK_OPT_FAIL_MS).toISOString(),
    };
  }
  if (elapsed < MOCK_OPT_DONE_MS) return { ...base, status: "running" };
  return {
    ...base,
    status: "succeeded",
    optimizedPrompt: record.rewritten,
    completedAt: new Date(record.startedAtMs + MOCK_OPT_DONE_MS).toISOString(),
  };
}

async function mockCreateOptimization(req: VideoStudioOptimizationRequest): Promise<VideoStudioOptimization> {
  await mockDelay(null, 300);
  if (!isValidClientRequestId(req.clientRequestId)) {
    throw mockError("VIDEO_STUDIO_REQUEST_ID_INVALID", "这次请求的编号不对，请刷新页面再试");
  }
  const existing = mockOptimizations.find((r) => r.clientRequestId === req.clientRequestId);
  if (existing) return advanceOptimization(existing, Date.now());

  const resolved = mockResolve(req);
  const problems = preflight(resolved.model.contract, {
    mode: req.mode,
    prompt: req.prompt,
    resolutionTier: req.resolutionTier,
    aspectRatio: req.aspectRatio,
    seconds: req.seconds,
    seed: null, // 种子不影响优化，服务端也不看
    firstFrame: resolved.firstFrame,
    lastFrame: resolved.lastFrame,
    references: resolved.references,
  });
  if (problems.length > 0) throw mockError(problems[0].code, problems[0].message);
  const price = optimizationPrice(resolved.model.pricing);
  if (price === null) {
    throw mockError("VIDEO_STUDIO_PRICE_NOT_CONFIGURED", "智能优化还没定价，请联系运营在后台「引擎定价 → 视频生成」里配置", 503);
  }

  const now = Date.now();
  mockOptimizationSeq += 1;
  const record: MockOptimizationRecord = {
    clientRequestId: req.clientRequestId,
    startedAtMs: now,
    fail: req.prompt.includes("#fail"),
    rewritten: mockRewrite(req),
    optimization: {
      id: `vs-opt-${now.toString(36)}-${mockOptimizationSeq}`,
      status: "queued",
      originalPrompt: req.prompt.trim(),
      optimizedPrompt: null,
      errorMessage: null,
      credits: price,
      createdAt: new Date(now).toISOString(),
      completedAt: null,
    },
  };
  mockOptimizations.push(record);
  return advanceOptimization(record, now);
}

function mockGetOptimization(id: string): VideoStudioOptimization {
  const record = mockOptimizations.find((r) => r.optimization.id === id);
  if (!record) throw mockError("VIDEO_STUDIO_OPTIMIZATION_NOT_FOUND", "没找到这次智能优化的记录", 404);
  return advanceOptimization(record, Date.now());
}

// ── 演示：模板 ───────────────────────────────────────────────────────────────

function copyTemplate(t: VideoStudioTemplate): VideoStudioTemplate {
  return { ...t, materials: t.materials.map((m) => ({ ...m })) };
}

function mockListTemplates(): VideoStudioTemplate[] {
  return [...mockTemplates]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 100)
    .map(copyTemplate);
}

function mockGetTemplate(id: string): VideoStudioTemplate {
  const t = mockFindTemplate(id);
  if (!t) throw mockError("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", "这个模板已经下架了", 404);
  return copyTemplate(t);
}

async function mockCreateTemplate(req: VideoStudioTemplateCreateRequest): Promise<VideoStudioTemplate> {
  await mockDelay(null, 300);
  const now = Date.now();
  const session = mockSessionJobs.find((r) => r.job.id === req.jobId);
  const job = session ? advanceMockJob(session, now) : MOCK_VIDEO_STUDIO_JOBS.find((j) => j.id === req.jobId);
  if (!job) throw mockError("VIDEO_STUDIO_TEMPLATE_INVALID", "没找到这条生成记录");
  if (job.status !== "succeeded") throw mockError("VIDEO_STUDIO_TEMPLATE_INVALID", "只有生成成功的视频才能存为模板");
  const problems = validateTemplateDraft(req.title, req.description ?? "");
  if (problems.length > 0) throw mockError("VIDEO_STUDIO_TEMPLATE_INVALID", problems[0]);

  // 预置的演示任务没有素材 key，按回显的素材编一个（只在演示里用）
  const materials: VideoStudioTemplateMaterial[] = session
    ? session.materials.map((m) => ({ ...m }))
    : job.inputs.map((input, i): VideoStudioTemplateMaterial => ({
        role: input.label === "首帧" ? "first_frame" : input.label === "尾帧" ? "last_frame" : "reference",
        mediaType: input.mediaType,
        key: `video-studio-${input.mediaType}/mock-demo/${job.id}-${i + 1}`,
        label: input.label,
        url: input.url,
      }));

  mockTemplateSeq += 1;
  const description = req.description?.trim() ?? "";
  const template: VideoStudioTemplate = {
    id: `vs-tpl-mock-${now.toString(36)}-${mockTemplateSeq}`,
    scope: req.official ? "official" : "private",
    title: req.title.trim(),
    description: description || null,
    mode: job.mode,
    prompt: job.prompt,
    resolutionTier: job.resolutionTier,
    aspectRatio: job.aspectRatio,
    seconds: job.seconds,
    seed: job.seed,
    endpointId: session ? session.endpointId : (MOCK_VIDEO_STUDIO_MODELS[0]?.endpointId ?? null),
    modelName: job.modelName,
    materials,
    previewVideoUrl: job.videoUrl,
    previewThumbnailUrl: job.thumbnailUrl,
    useCount: 0,
    mine: true,
    createdAt: new Date(now).toISOString(),
  };
  mockTemplates = [template, ...mockTemplates];
  return copyTemplate(template);
}

async function mockDeleteTemplate(id: string): Promise<void> {
  await mockDelay(null, 200);
  const t = mockFindTemplate(id);
  // 别人的私有模板对我不可见；官方模板演示里当作有撤回权限（界面只给运营显示「撤回」）
  if (!t || (!t.mine && t.scope !== "official")) {
    throw mockError("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", "这个模板已经不在了", 404);
  }
  mockTemplates = mockTemplates.filter((x) => x.id !== id);
}
