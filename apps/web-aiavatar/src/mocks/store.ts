// ─────────────────────────────────────────────────────────────────────────────
// mocks/store.ts — AiAvatar 中心纯前端 mock 引擎（USE_MOCK=1，可离线整跑）。
//
// 与后端契约完全一致：8 态状态机、异步任务（带进度推进）、版本快照、资产产出、
// Provider 健康（faceWarp=真实 / 其余 mock）。任务进度由前端定时器推进，模拟真实异步。
// localStorage 持久化，刷新不丢。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AiAvatarAsset,
  AiAvatar,
  AiAvatarDetail,
  AiAvatarStatus,
  AiAvatarVersion,
  AiAvatarCapability,
  AiAvatarJob,
  AiAvatarLicenseGrant,
  AiAvatarProviderHealth,
  AiAvatarRefineEdit,
  AiAvatarSourceMaterial,
  AiAvatarTemplate,
} from "@ai-star-eco/types/ai-avatar";
import { FACTORY_TEMPLATES } from "./templates";
import { PROVIDER_HEALTH } from "./providers";
import { SEED_AVATARS, seedAssetsFor, seedVersionsFor, sampleFace } from "./seed";

const KEY = "aistareco.aiavatar.store.v2";
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();
const imageMime = (url: string) => {
  if (/\.jpe?g($|\?)/i.test(url) || url.startsWith("data:image/jpeg")) return "image/jpeg";
  if (/\.svg($|\?)/i.test(url) || url.startsWith("data:image/svg+xml")) return "image/svg+xml";
  return "image/png";
};

interface AiAvatarDb {
  avatars: AiAvatar[];
  versions: AiAvatarVersion[];
  assets: AiAvatarAsset[];
  sources: AiAvatarSourceMaterial[];
  licenses: AiAvatarLicenseGrant[];
  refines: AiAvatarRefineEdit[];
  jobs: AiAvatarJob[];
  templates: AiAvatarTemplate[];
}

let db: AiAvatarDb | null = null;

function load(): AiAvatarDb {
  if (db) return db;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        db = JSON.parse(raw) as AiAvatarDb;
        // 模板始终以工厂最新为准（避免老缓存缺模板）
        if (!db.templates || db.templates.length === 0) db.templates = [...FACTORY_TEMPLATES];
        return db;
      }
    } catch {
      /* fall through to seed */
    }
  }
  db = seedDb();
  save();
  return db;
}

function seedDb(): AiAvatarDb {
  const avatars = [...SEED_AVATARS];
  const versions: AiAvatarVersion[] = [];
  const assets: AiAvatarAsset[] = [];
  for (const a of avatars) {
    const vs = seedVersionsFor(a);
    versions.push(...vs);
    assets.push(...seedAssetsFor(a, vs));
  }
  return {
    avatars,
    versions,
    assets,
    sources: [],
    licenses: [],
    refines: [],
    jobs: [],
    templates: [...FACTORY_TEMPLATES],
  };
}

function save() {
  if (db && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* storage full — ignore */
    }
  }
}

// ── 状态机（镜像后端 AiAvatarStatus.allowedNext）─────────────────────────────
const NEXT: Record<AiAvatarStatus, AiAvatarStatus[]> = {
  draft: ["sampling", "archived"],
  sampling: ["sampling", "draft_iterating", "refining", "archived"],
  draft_iterating: ["draft_iterating", "sampling", "refining", "archived"],
  refining: ["refining", "draft_iterating", "pending_finalize", "archived"],
  pending_finalize: ["refining", "finalized_2d", "archived"],
  finalized_2d: ["deriving", "archived"],
  deriving: ["finalized_2d", "deriving", "archived"],
  archived: [],
};

export function allowedNext(s: AiAvatarStatus): AiAvatarStatus[] {
  return NEXT[s] ?? [];
}
export function canTransition(from: AiAvatarStatus, to: AiAvatarStatus): boolean {
  return from === to || allowedNext(from).includes(to);
}
export function isFrozen(s: AiAvatarStatus): boolean {
  return s === "finalized_2d" || s === "deriving" || s === "archived";
}

// ── 占位图（前端 SVG data-uri，深色 + 琥珀斜纹 + 标签）──────────────────────
export function placeholderDataUri(opts: {
  w: number; h: number; title: string; subtitle?: string; badge?: string; seed?: number;
}): string {
  const { w, h, title, subtitle = "", badge = "MOCK", seed = 1 } = opts;
  const hue = 38; // amber
  const cx = w / 2 + ((seed % 7) - 3) * (w * 0.01);
  const headR = Math.min(w, h) * 0.15;
  const headCy = h * 0.36;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
    <defs><pattern id='ph' width='14' height='14' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'>
      <line x1='0' y1='0' x2='0' y2='14' stroke='hsla(${hue},85%,55%,0.10)' stroke-width='2'/></pattern></defs>
    <rect width='100%' height='100%' fill='#17171a'/>
    <rect width='100%' height='100%' fill='url(#ph)'/>
    <ellipse cx='${cx}' cy='${headCy + headR * 1.9}' rx='${headR * 2.0}' ry='${headR * 1.5}' fill='hsla(${hue},85%,55%,0.14)'/>
    <circle cx='${cx}' cy='${headCy}' r='${headR}' fill='hsla(${hue},85%,55%,0.22)'/>
    <rect x='12' y='${h - 86}' width='${w - 24}' height='74' rx='12' fill='rgba(0,0,0,0.45)' stroke='hsla(${hue},85%,55%,0.35)'/>
    <text x='26' y='${h - 56}' fill='#f5f1e8' font-family='monospace' font-size='${Math.max(14, w / 18)}' font-weight='bold'>${esc(title)}</text>
    <text x='26' y='${h - 32}' fill='hsl(${hue},85%,60%)' font-family='monospace' font-size='${Math.max(11, w / 30)}'>${esc(subtitle)}</text>
    <rect x='${w - 78}' y='14' width='62' height='22' rx='11' fill='hsl(${hue},85%,55%)'/>
    <text x='${w - 67}' y='29' fill='#17171a' font-family='monospace' font-size='12' font-weight='bold'>${esc(badge)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── 查询 ─────────────────────────────────────────────────────────────────────
export function listAvatars(): AiAvatar[] {
  const d = load();
  return [...d.avatars].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getAvatar(id: string): AiAvatar | undefined {
  return load().avatars.find((a) => a.id === id);
}

export function detail(id: string): AiAvatarDetail | undefined {
  const d = load();
  const avatar = d.avatars.find((a) => a.id === id);
  if (!avatar) return undefined;
  return {
    avatar,
    versions: d.versions.filter((v) => v.avatarId === id).sort((a, b) => a.versionNo - b.versionNo),
    assets: d.assets.filter((a) => a.avatarId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    sourceMaterials: d.sources.filter((m) => m.avatarId === id),
    licenses: d.licenses.filter((l) => l.avatarId === id),
    refineEdits: d.refines.filter((r) => r.avatarId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    recentJobs: d.jobs.filter((j) => j.avatarId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    allowedNextStatus: allowedNext(avatar.status),
  };
}

export function listJobs(): AiAvatarJob[] {
  return [...load().jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getJob(id: string): AiAvatarJob | undefined {
  return load().jobs.find((j) => j.id === id);
}
export function listTemplates(): AiAvatarTemplate[] {
  return load().templates;
}
export function providerHealth(): AiAvatarProviderHealth[] {
  return PROVIDER_HEALTH;
}

// ── 写操作 ───────────────────────────────────────────────────────────────────
export function createAvatar(input: {
  mode: AiAvatar["mode"]; name: string; persona?: string; styleCategory?: string; tags?: string[];
}): AiAvatar {
  const d = load();
  const a: AiAvatar = {
    id: uid(),
    ownerUserId: "mock-user",
    name: input.name,
    mode: input.mode,
    status: "draft",
    persona: input.persona ?? null,
    styleCategory: input.styleCategory ?? null,
    has3d: false,
    hasVideo: false,
    tags: input.tags ?? [],
    createdAt: now(),
    updatedAt: now(),
  };
  d.avatars.unshift(a);
  save();
  return a;
}

export function updateAvatar(id: string, patch: Partial<AiAvatar>): AiAvatar {
  const d = load();
  const a = d.avatars.find((x) => x.id === id);
  if (!a) throw new Error("not found");
  Object.assign(a, patch, { updatedAt: now() });
  save();
  return a;
}

export function transition(id: string, to: AiAvatarStatus): AiAvatar {
  const d = load();
  const a = d.avatars.find((x) => x.id === id);
  if (!a) throw new Error("not found");
  if (!canTransition(a.status, to)) {
    const e = new Error(`非法状态跃迁：${a.status} → ${to}`);
    (e as { code?: string }).code = "AIAVATAR_ILLEGAL_TRANSITION";
    throw e;
  }
  a.status = to;
  a.updatedAt = now();
  if (to === "archived") a.archivedAt = now();
  save();
  return a;
}

export function forkAvatar(id: string, newName?: string): AiAvatar {
  const d = load();
  const src = d.avatars.find((x) => x.id === id);
  if (!src) throw new Error("not found");
  const copy: AiAvatar = {
    ...src,
    id: uid(),
    name: newName || `${src.name} 副本`,
    status: "draft",
    currentVersionId: null,
    finalizedVersionId: null,
    forkedFromAvatarId: src.id,
    createdAt: now(),
    updatedAt: now(),
  };
  d.avatars.unshift(copy);
  save();
  return copy;
}

export function addSourceText(avatarId: string, text: string, kind = "text"): AiAvatarSourceMaterial {
  const d = load();
  const m: AiAvatarSourceMaterial = { id: uid(), avatarId, kind, text, createdAt: now() };
  d.sources.push(m);
  save();
  return m;
}

/**
 * 真人照片登记。mock 下 dataUri 为用户上传的**真实图片字节**（dataURL）—— 全流程会用这张真实照片，
 * 精调工作台的 MediaPipe 也会在它上面检测关键点。未传则用占位（兼容旧调用）。
 */
export function addSourcePhoto(avatarId: string, name: string, dataUri?: string): { material: AiAvatarSourceMaterial; faceCheckJobId: string } {
  const d = load();
  const assetId = uid();
  const preview = dataUri || placeholderDataUri({ w: 256, h: 320, title: "PHOTO", subtitle: name.slice(0, 14), badge: "加密" });
  const avatar = d.avatars.find((a) => a.id === avatarId);
  const asset: AiAvatarAsset = {
    id: assetId, avatarId, kind: "source_photo", fileUrl: preview, thumbnailUrl: preview,
    mimeType: "image/png", width: 256, height: 320, fileSize: 0, durationSec: 0,
    engine: "upload", encrypted: true, meta: { masked: true }, createdAt: now(),
  };
  d.assets.push(asset);
  // 上传真实照片即作为封面，让总库 / 详情立刻显示真人图。
  if (avatar && dataUri) {
    if (!avatar.coverAssetId) avatar.coverAssetId = assetId;
    avatar.coverUrl = dataUri;
    avatar.updatedAt = now();
  }
  const m: AiAvatarSourceMaterial = { id: uid(), avatarId, kind: "photo", assetId, assetUrl: preview, createdAt: now() };
  d.sources.push(m);
  save();
  // 触发合规检测 mock 任务
  const job = startJob({ avatarId, capability: "faceDetect", title: "人脸合规检测", units: 1 });
  // 检测结果回填到素材
  setTimeout(() => {
    const mm = (db?.sources ?? []).find((x) => x.id === m.id);
    if (mm) {
      mm.faceCheck = { faces: 1, occlusion: false, blur: false, multiFace: false, passed: true, reason: "", engine: "MOCK" };
      mm.faceCheckPassed = true;
      save();
    }
  }, 2600);
  return { material: m, faceCheckJobId: job.id };
}

export function signLicense(avatarId: string, input: {
  subjectName?: string; scope?: string; platforms?: string[];
  validFrom?: string; validTo?: string; signatureName: string; boundAssetIds?: string[]; agreementText?: string;
}): AiAvatarLicenseGrant {
  const d = load();
  const g: AiAvatarLicenseGrant = {
    id: uid(), avatarId, subjectName: input.subjectName ?? null, scope: input.scope ?? null,
    platforms: input.platforms ?? [], validFrom: input.validFrom ?? now(),
    validTo: input.validTo ?? new Date(Date.now() + 365 * 864e5).toISOString(),
    status: "active", hasAgreement: !!input.agreementText, signatureName: input.signatureName,
    signedAt: now(), boundAssetIds: input.boundAssetIds ?? [], credentialUrl: `#credential-${uid().slice(0, 8)}`,
    createdAt: now(),
  };
  d.licenses.push(g);
  save();
  return g;
}

export function hasActiveLicense(avatarId: string): boolean {
  return load().licenses.some((l) => l.avatarId === avatarId && l.status === "active");
}

// ── 异步任务模拟（进度推进 + 完成时落资产/版本/状态机）────────────────────────
const PROGRESS_STEPS = [12, 28, 45, 63, 80, 92, 100];
const timers = new Map<string, ReturnType<typeof setInterval>>();

export interface StartJobOpts {
  avatarId?: string;
  capability: AiAvatarCapability;
  title: string;
  units?: number;
  prompt?: string;
  variants?: number;
  standardShots?: boolean;
  advanceTo?: AiAvatarStatus;
  videoDurationSec?: number;
  templateId?: string;
  params?: Record<string, unknown>;
  batchId?: string;
}

export function startJob(opts: StartJobOpts): AiAvatarJob {
  const d = load();
  const isReal = opts.capability === "faceWarp";
  const job: AiAvatarJob = {
    id: uid(),
    ownerUserId: "mock-user",
    avatarId: opts.avatarId ?? null,
    capability: opts.capability,
    capabilityLabel: capabilityLabel(opts.capability),
    status: "queued",
    progress: 0,
    providerMode: isReal ? "selfhost" : "mock",
    engine: isReal ? "liquify-java(TPS-approx)" : "MOCK",
    title: opts.title,
    input: { prompt: opts.prompt, variants: opts.variants, ...(opts.params ?? {}) },
    attempts: 0,
    maxAttempts: 3,
    creditsHeld: 0,
    batchId: opts.batchId ?? null,
    createdAt: now(),
  };
  d.jobs.unshift(job);
  save();
  runJobTimer(job.id, opts);
  return job;
}

function runJobTimer(jobId: string, opts: StartJobOpts) {
  let i = 0;
  const t = setInterval(() => {
    const d = load();
    const job = d.jobs.find((j) => j.id === jobId);
    if (!job || job.status === "cancelled") {
      clearInterval(t);
      timers.delete(jobId);
      return;
    }
    if (job.status === "queued") { job.status = "running"; job.startedAt = now(); job.attempts = 1; }
    job.progress = PROGRESS_STEPS[Math.min(i, PROGRESS_STEPS.length - 1)];
    i++;
    if (job.progress >= 100) {
      completeJob(job, opts);
      clearInterval(t);
      timers.delete(jobId);
    }
    save();
  }, 650);
  timers.set(jobId, t);
}

function completeJob(job: AiAvatarJob, opts: StartJobOpts) {
  const d = load();
  job.status = "succeeded";
  job.completedAt = now();
  const avatar = opts.avatarId ? d.avatars.find((a) => a.id === opts.avatarId) : undefined;

  const newAssetIds: string[] = [];
  if (opts.capability === "faceDetect") {
    job.result = { passed: true, faces: 1, engine: "MOCK" };
  } else if (opts.capability === "nlu") {
    job.result = { style: avatar?.styleCategory ?? "现代时尚", summary: "结构化人设解析完成", engine: "MOCK" };
    if (avatar) avatar.personaStructured = job.result as Record<string, unknown>;
  } else {
    // 产图 / 3D / 视频
    const specs = buildAssetSpecs(job, opts);
    for (const s of specs) {
      const a: AiAvatarAsset = { id: uid(), avatarId: opts.avatarId ?? null, ...s, createdAt: now() } as AiAvatarAsset;
      d.assets.push(a);
      newAssetIds.push(a.id);
    }
  }

  // 建版本快照 + 推进状态机
  if (avatar && newAssetIds.length > 0) {
    const versionNo = d.versions.filter((v) => v.avatarId === avatar.id).reduce((m, v) => Math.max(m, v.versionNo), 0) + 1;
    const previewAssetId = newAssetIds.find((id) => {
      const a = d.assets.find((x) => x.id === id);
      return a && (a.kind === "image_2d" || a.kind === "draft_image" || a.kind === "expression_image");
    }) ?? newAssetIds[0];
    const v: AiAvatarVersion = {
      id: uid(), avatarId: avatar.id, versionNo, label: job.title, note: job.capabilityLabel,
      author: "mock-user", sourceStatus: avatar.status, params: job.input, previewAssetId,
      previewUrl: d.assets.find((x) => x.id === previewAssetId)?.fileUrl ?? null,
      assetIds: newAssetIds, jobId: job.id, preferred: false, discarded: false, createdAt: now(),
    };
    d.versions.push(v);
    for (const id of newAssetIds) {
      const a = d.assets.find((x) => x.id === id);
      if (a) a.versionId = v.id;
    }
    job.versionId = v.id;
    avatar.currentVersionId = v.id;
    if (!avatar.coverAssetId) avatar.coverAssetId = previewAssetId;
    avatar.coverUrl = d.assets.find((x) => x.id === avatar.coverAssetId)?.fileUrl ?? avatar.coverUrl;
    if (opts.capability === "img23d") avatar.has3d = true;
    if (opts.capability === "img2video") avatar.hasVideo = true;
    if (opts.advanceTo && canTransition(avatar.status, opts.advanceTo)) avatar.status = opts.advanceTo;
    avatar.updatedAt = now();
  }
  save();
}

function buildAssetSpecs(job: AiAvatarJob, opts: StartJobOpts): Partial<AiAvatarAsset>[] {
  const cap = opts.capability;
  if (cap === "img23d") {
    return [{
      kind: "model_3d", fileUrl: "#mock-glb", thumbnailUrl: placeholderDataUri({ w: 512, h: 512, title: "3D MODEL", subtitle: "GLB · 可旋转", badge: "MOCK" }),
      mimeType: "model/gltf-binary", width: 0, height: 0, fileSize: 932, durationSec: 0, format3d: "GLB",
      engine: "MOCK", providerMode: "mock", encrypted: false, meta: { interactive: true },
    }];
  }
  if (cap === "img2video") {
    const dur = opts.videoDurationSec ?? 10;
    const poster = placeholderDataUri({ w: 405, h: 720, title: `VIDEO ${dur}s`, subtitle: "缓慢运镜 · SVD", badge: "MOCK" });
    return [{
      kind: "video", fileUrl: poster, thumbnailUrl: poster, mimeType: "image/png",
      width: 405, height: 720, fileSize: 0, durationSec: dur, engine: "MOCK", providerMode: "mock",
      encrypted: false, meta: { effect: "ken_burns", posterOnly: true, fps: 25 },
    }];
  }
  // 人脸图片来源：真人复刻优先用上传的真实照片；否则用可被 MediaPipe 检测的占位人脸。
  const faceFor = (i: number) => sourceFace(opts.avatarId) ?? sampleFace(i);

  if (opts.standardShots) {
    const shots: AiAvatarAsset["standardShot"][] = [
      "full_body",
      "half_body",
      "bust_closeup",
      "detail_closeup",
      "three_quarter_profile",
      "overhead",
    ];
    return shots.map((shot, i) => {
      const url = faceFor(i);
      return {
        kind: "image_2d", standardShot: shot,
        fileUrl: url, thumbnailUrl: url,
        mimeType: imageMime(url), width: 384, height: 512, fileSize: 0, durationSec: 0,
        engine: "MOCK", providerMode: "mock", encrypted: false,
      };
    });
  }
  const n = Math.max(1, Math.min(5, opts.variants ?? (cap === "faceClone" || cap === "txt2img" ? 3 : 1)));
  const kind: AiAvatarAsset["kind"] = cap === "faceClone" || cap === "txt2img" || cap === "img2img" ? "draft_image" : "image_2d";
  return Array.from({ length: n }, (_, i) => {
    const url = faceFor(i);
    return {
      kind,
      fileUrl: url, thumbnailUrl: url,
      mimeType: imageMime(url), width: 384, height: 512, fileSize: 0, durationSec: 0,
      engine: cap === "faceWarp" ? "liquify-java(TPS-approx)" : "MOCK",
      providerMode: cap === "faceWarp" ? "selfhost" : "mock", encrypted: false,
    };
  });
}

/** 取该 avatar 最近上传的真人照片（真实 dataURL），用于复刻 / 出图复用真实人脸；无则 null。 */
function sourceFace(avatarId?: string): string | null {
  if (!avatarId || !db) return null;
  const photos = db.sources.filter((m) => m.avatarId === avatarId && m.kind === "photo" && m.assetUrl && m.assetUrl.startsWith("data:"));
  return photos.length ? photos[photos.length - 1].assetUrl! : null;
}

export function cancelJob(id: string): AiAvatarJob {
  const d = load();
  const job = d.jobs.find((j) => j.id === id);
  if (!job) throw new Error("not found");
  if (job.status === "queued" || job.status === "running") {
    job.status = "cancelled";
    job.completedAt = now();
  }
  const t = timers.get(id);
  if (t) { clearInterval(t); timers.delete(id); }
  save();
  return job;
}

export function retryJob(id: string): AiAvatarJob {
  const d = load();
  const job = d.jobs.find((j) => j.id === id);
  if (!job) throw new Error("not found");
  job.status = "queued";
  job.progress = 0;
  job.errorMessage = null;
  job.maxAttempts = job.attempts + 3;
  save();
  runJobTimer(job.id, { capability: job.capability, title: job.title ?? "", avatarId: job.avatarId ?? undefined });
  return job;
}

/** 几何微调（前端 canvas 已真实形变）：登记 after 资产 + 版本（同步，无 job）。 */
export function recordGeometryRefine(avatarId: string, input: {
  afterDataUri: string; params?: Record<string, unknown>; note?: string;
}): AiAvatarVersion {
  const d = load();
  const avatar = d.avatars.find((a) => a.id === avatarId);
  if (!avatar) throw new Error("not found");
  if (canTransition(avatar.status, "refining")) avatar.status = "refining";
  const assetId = uid();
  const asset: AiAvatarAsset = {
    id: assetId, avatarId, kind: "image_2d", fileUrl: input.afterDataUri, thumbnailUrl: input.afterDataUri,
    mimeType: "image/png", width: 384, height: 512, fileSize: 0, durationSec: 0,
    engine: "liquify-canvas", providerMode: "selfhost", encrypted: false,
    meta: { deterministic: true, algo: "radial-liquify" }, createdAt: now(),
  };
  d.assets.push(asset);
  const versionNo = d.versions.filter((v) => v.avatarId === avatarId).reduce((m, v) => Math.max(m, v.versionNo), 0) + 1;
  const v: AiAvatarVersion = {
    id: uid(), avatarId, versionNo, label: "几何微调", note: input.note ?? "瘦脸/眼睛/鼻梁/脸型/嘴型",
    author: "mock-user", sourceStatus: avatar.status, params: input.params ?? null, previewAssetId: assetId,
    previewUrl: input.afterDataUri, assetIds: [assetId], jobId: null, preferred: false, discarded: false, createdAt: now(),
  };
  d.versions.push(v);
  asset.versionId = v.id;
  d.refines.push({
    id: uid(), avatarId, versionId: v.id, kind: "geometry", params: input.params ?? null,
    afterAssetId: assetId, note: input.note ?? null, createdAt: now(),
  });
  avatar.currentVersionId = v.id;
  avatar.coverUrl = avatar.coverUrl ?? input.afterDataUri;
  avatar.updatedAt = now();
  save();
  return v;
}

export function finalize(avatarId: string, versionId?: string): AiAvatar {
  const d = load();
  const a = d.avatars.find((x) => x.id === avatarId);
  if (!a) throw new Error("not found");
  if (a.mode === "real_clone" && !hasActiveLicense(avatarId)) {
    const e = new Error("真人复刻定稿前需先签署有效肖像授权");
    (e as { code?: string }).code = "AIAVATAR_LICENSE_REQUIRED";
    throw e;
  }
  const vid = versionId ?? a.currentVersionId ?? undefined;
  if (!vid) throw new Error("尚无可定稿的版本");
  if (!canTransition(a.status, "finalized_2d")) {
    // 自动补齐到 pending_finalize
    if (canTransition(a.status, "pending_finalize")) a.status = "pending_finalize";
  }
  const v = d.versions.find((x) => x.id === vid);
  if (v) v.preferred = true;
  a.status = "finalized_2d";
  a.finalizedVersionId = vid;
  a.currentVersionId = vid;
  a.updatedAt = now();
  save();
  return a;
}

export function derive(avatarId: string, capabilities: AiAvatarCapability[], videoDurationSec?: number): AiAvatarJob[] {
  const d = load();
  const a = d.avatars.find((x) => x.id === avatarId);
  if (!a) throw new Error("not found");
  if (!isFrozen(a.status)) {
    const e = new Error("请先定稿再进行衍生");
    (e as { code?: string }).code = "AIAVATAR_NOT_FINALIZED";
    throw e;
  }
  if (canTransition(a.status, "deriving")) a.status = "deriving";
  a.updatedAt = now();
  save();
  const batchId = `dhbatch-${uid().slice(0, 8)}`;
  return capabilities
    .filter((c) => c === "img23d" || c === "img2video")
    .map((c) => startJob({
      avatarId, capability: c, title: c === "img23d" ? "衍生 3D" : "衍生视频",
      videoDurationSec, batchId,
    }));
}

export function markVersion(versionId: string, patch: { preferred?: boolean; discarded?: boolean }): AiAvatarVersion {
  const d = load();
  const v = d.versions.find((x) => x.id === versionId);
  if (!v) throw new Error("not found");
  if (patch.preferred !== undefined) v.preferred = patch.preferred;
  if (patch.discarded !== undefined) v.discarded = patch.discarded;
  save();
  return v;
}

export function revertToVersion(avatarId: string, versionId: string): AiAvatar {
  const d = load();
  const a = d.avatars.find((x) => x.id === avatarId);
  if (!a) throw new Error("not found");
  a.currentVersionId = versionId;
  a.updatedAt = now();
  save();
  return a;
}

// ── labels ───────────────────────────────────────────────────────────────────
export function capabilityLabel(c: AiAvatarCapability): string {
  const m: Record<AiAvatarCapability, string> = {
    faceClone: "真人复刻打样", txt2img: "AI 原创打样", img2img: "草稿指令调整", faceWarp: "几何微调",
    inpaint: "局部重绘", makeup: "妆容迁移", hair: "发型变换", restore: "美颜/质感",
    img23d: "2D→3D", img2video: "图生视频", faceDetect: "人脸合规检测", nlu: "人设文案解析", segment: "局部分割",
  };
  return m[c] ?? c;
}
export function shotLabel(s: NonNullable<AiAvatarAsset["standardShot"]>): string {
  const m: Record<string, string> = {
    full_body: "全身远景",
    half_body: "半身中景",
    bust_closeup: "胸像近景",
    detail_closeup: "面部特写",
    three_quarter_profile: "3/4 侧身",
    overhead: "俯拍氛围",
    front_bust: "正面半身",
    front_full: "正面全身",
    left_profile: "左侧脸",
    right_profile: "右侧脸",
    expression: "表情图",
  };
  return m[s] ?? s;
}

/** 测试 / 重置用：清空 mock 库回到种子。 */
export function resetStore() {
  db = seedDb();
  save();
}
