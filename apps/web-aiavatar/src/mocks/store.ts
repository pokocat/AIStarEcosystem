// ============================================================
// store.ts — 纯前端 Mock 状态机（USE_MOCK 路径的真值源）。
//
// 与真实后端「完全相同的接口契约」（见 api/ai-avatar.ts），差异只在实现：
//   · 内存集合 + localStorage 持久化（跨页面导航不丢）。
//   · 异步任务用全局 ticker 模拟真实进度事件与延迟 → 状态机 / 进度条同等走通。
//   · 任务产出标 providerMode='mock' + engine，前端据此显示 MOCK 角标。
//   · 几何形变（faceWarp）是真实客户端算法（face-warp.ts），不在此模拟。
//
// 任务完成效果由 job.input.kind 派生（可序列化），故 reload 后仍能正确收尾。
// ============================================================
import { nanoid } from "nanoid";
import type {
  AiAvatar,
  AiAvatarAsset,
  AiAvatarVersion,
  AiAvatarSourceMaterial,
  AiAvatarLicenseGrant,
  AiAvatarTemplate,
  AiAvatarJob,
  AiAvatarRefineEdit,
  AiAvatarDetail,
  AiAvatarProviderHealth,
  AiAvatarCapability,
  AiAvatarStatus,
  AiAvatarStandardShot,
  AiAvatarCreateInput,
  AiAvatarUpdateInput,
  AiAvatarSubmitJobInput,
  AiAvatarGeometryRefineInput,
  AiAvatarSignLicenseInput,
  AiAvatarFinalizeInput,
  AiAvatarDeriveInput,
  AiAvatarTemplateCategory,
  AiAvatarTemplateUpsertInput,
  AiAvatarPromptConfig,
  AiAvatarPromptUpsertInput,
  AiAvatarPromptDryRunResult,
  AiAvatarUiConfig,
} from "@ai-star-eco/types/ai-avatar";
import { buildSeed, OWNER, PORTRAITS } from "./seed";
import { CAPABILITY_ENGINE, CAPABILITY_KIND, CAPABILITY_LABEL, COMPOSITIONS, PROMPT_CONFIG_DEFAULTS, UI_CONFIG_DEFAULTS, BEAUTY_TEMPLATES, STYLE_LOOK_TEMPLATES } from "@/constants/aiavatar-ui";

const LS_KEY = "aiavatar.mock.store.v2";
const now = () => new Date().toISOString();

interface State {
  avatars: AiAvatar[];
  assets: AiAvatarAsset[];
  versions: AiAvatarVersion[];
  sourceMaterials: AiAvatarSourceMaterial[];
  licenses: AiAvatarLicenseGrant[];
  templates: AiAvatarTemplate[];
  jobs: AiAvatarJob[];
  refineEdits: AiAvatarRefineEdit[];
  /** v2: 运营可配置 prompt（复用共享 prompt_template 形态）。 */
  promptConfigs: AiAvatarPromptConfig[];
  /** v2: 运营可配置 UI 文案。 */
  uiConfig: AiAvatarUiConfig;
}

/** 简单 {{占位符}} 填充（镜像后端 PromptService.fill）。 */
function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

// 合法状态跃迁（8 态状态机；与后端 AiAvatarStatus 对齐）。
const TRANSITIONS: Record<AiAvatarStatus, AiAvatarStatus[]> = {
  draft: ["sampling"],
  sampling: ["draft_iterating", "sampling"],
  draft_iterating: ["refining", "draft_iterating", "sampling"],
  refining: ["pending_finalize", "refining", "draft_iterating"],
  pending_finalize: ["finalized_2d", "refining"],
  finalized_2d: ["deriving", "archived"],
  deriving: ["finalized_2d", "archived"],
  archived: [],
};

class MockStore {
  private s: State;
  private listeners = new Set<() => void>();
  private ticking = false;

  constructor() {
    this.s = this.load();
    this.ensureTicker();
  }

  // ── 持久化 ─────────────────────────────────────────────────────────────────
  private load(): State {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(LS_KEY);
        if (raw) return JSON.parse(raw) as State;
      } catch {
        /* ignore */
      }
    }
    return freshState();
  }
  private persist() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(this.s));
    } catch {
      /* quota — ignore */
    }
  }
  reset() {
    this.s = freshState();
    this.persist();
    this.emit();
  }

  // ── 订阅 ───────────────────────────────────────────────────────────────────
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.persist();
    this.listeners.forEach((l) => l());
  }

  // ── 任务 ticker（模拟真实进度）────────────────────────────────────────────
  private ensureTicker() {
    if (this.ticking || typeof window === "undefined") return;
    this.ticking = true;
    window.setInterval(() => this.tick(), 650);
  }
  private tick() {
    let changed = false;
    for (const j of this.s.jobs) {
      if (j.status === "queued") {
        j.status = "running";
        j.startedAt = now();
        changed = true;
      } else if (j.status === "running") {
        j.progress = Math.min(100, j.progress + 6 + Math.random() * 14);
        changed = true;
        if (j.progress >= 100) {
          j.progress = 100;
          j.status = "succeeded";
          j.completedAt = now();
          this.completeJob(j);
        }
      }
    }
    if (changed) this.emit();
  }

  // ── 查询 ───────────────────────────────────────────────────────────────────
  listAvatars(): AiAvatar[] {
    return [...this.s.avatars].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  getAvatar(id: string): AiAvatar {
    const a = this.s.avatars.find((x) => x.id === id);
    if (!a) throw notFound("AVATAR_NOT_FOUND", "数字人不存在");
    return a;
  }
  detail(id: string): AiAvatarDetail {
    const avatar = this.getAvatar(id);
    return {
      avatar,
      versions: this.s.versions.filter((v) => v.avatarId === id).sort((a, b) => b.versionNo - a.versionNo),
      assets: this.s.assets.filter((x) => x.avatarId === id),
      sourceMaterials: this.s.sourceMaterials.filter((x) => x.avatarId === id),
      licenses: this.s.licenses.filter((x) => x.avatarId === id),
      refineEdits: this.s.refineEdits.filter((x) => x.avatarId === id),
      recentJobs: this.s.jobs.filter((x) => x.avatarId === id).slice(-8).reverse(),
      allowedNextStatus: TRANSITIONS[avatar.status] ?? [],
    };
  }
  listTemplates(): AiAvatarTemplate[] {
    return this.s.templates.filter((t) => t.enabled);
  }
  getTemplate(id: string): AiAvatarTemplate {
    const t = this.s.templates.find((x) => x.id === id);
    if (!t) throw notFound("TEMPLATE_NOT_FOUND", "模板不存在");
    return t;
  }
  listJobs(): AiAvatarJob[] {
    return [...this.s.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  getJob(id: string): AiAvatarJob {
    const j = this.s.jobs.find((x) => x.id === id);
    if (!j) throw notFound("JOB_NOT_FOUND", "任务不存在");
    return j;
  }
  listLicenses(): AiAvatarLicenseGrant[] {
    return [...this.s.licenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  assetById(id: string): AiAvatarAsset | undefined {
    return this.s.assets.find((x) => x.id === id);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  createAvatar(input: AiAvatarCreateInput): AiAvatar {
    const id = `DH-${Math.floor(2100 + Math.random() * 800)}`;
    const a: AiAvatar = {
      id,
      ownerUserId: OWNER,
      studioId: null,
      name: input.name || (input.mode === "real_clone" ? "新数字人" : "AI 形象"),
      mode: input.mode,
      status: "draft",
      persona: input.persona ?? null,
      personaStructured: null,
      styleCategory: input.styleCategory ?? null,
      coverAssetId: null,
      coverUrl: null,
      currentVersionId: null,
      finalizedVersionId: null,
      has3d: false,
      hasVideo: false,
      tags: input.tags ?? [],
      forkedFromAvatarId: null,
      createdAt: now(),
      updatedAt: now(),
      archivedAt: null,
    };
    this.s.avatars.unshift(a);
    // v1 原始素材版本
    this.s.versions.push(version(id, 1, "原始素材", input.mode === "real_clone" ? "上传参考照片" : "输入人设文案", "draft"));
    this.emit();
    return a;
  }
  updateAvatar(id: string, input: AiAvatarUpdateInput): AiAvatar {
    const a = this.getAvatar(id);
    if (input.name !== undefined) a.name = input.name;
    if (input.persona !== undefined) a.persona = input.persona;
    if (input.styleCategory !== undefined) a.styleCategory = input.styleCategory;
    if (input.tags !== undefined) a.tags = input.tags;
    a.updatedAt = now();
    this.emit();
    return a;
  }
  archiveAvatar(id: string): AiAvatar {
    const a = this.getAvatar(id);
    a.status = "archived";
    a.archivedAt = now();
    a.updatedAt = now();
    this.emit();
    return a;
  }
  forkAvatar(id: string, name?: string): AiAvatar {
    const src = this.getAvatar(id);
    const copy = this.createAvatar({ mode: src.mode, name: name || `${src.name} 副本`, persona: src.persona ?? undefined, styleCategory: src.styleCategory ?? undefined, tags: src.tags });
    copy.forkedFromAvatarId = id;
    copy.coverUrl = src.coverUrl;
    this.emit();
    return copy;
  }
  transition(id: string, status: AiAvatarStatus): AiAvatar {
    const a = this.getAvatar(id);
    const allowed = TRANSITIONS[a.status] ?? [];
    if (a.status !== status && !allowed.includes(status)) {
      throw badReq("ILLEGAL_TRANSITION", `不能从「${a.status}」跃迁到「${status}」`);
    }
    a.status = status;
    a.updatedAt = now();
    this.emit();
    return a;
  }

  // ── 素材 / 授权 ───────────────────────────────────────────────────────────
  addSourceText(id: string, text: string, kind = "text"): AiAvatarSourceMaterial {
    this.getAvatar(id);
    const m: AiAvatarSourceMaterial = {
      id: `src-${nanoid(8)}`,
      avatarId: id,
      kind,
      assetId: null,
      assetUrl: null,
      text,
      faceCheck: null,
      faceCheckPassed: null,
      createdAt: now(),
    };
    this.s.sourceMaterials.push(m);
    this.emit();
    return m;
  }
  /** Mock 上传素材照片：dataUrl 直接作为 asset.fileUrl（真实字节）。 */
  addSourcePhoto(id: string, dataUrl: string): AiAvatarSourceMaterial {
    const a = this.getAvatar(id);
    const assetId = `asset-${nanoid(8)}`;
    this.s.assets.push({
      id: assetId,
      avatarId: id,
      versionId: null,
      kind: "source_photo",
      standardShot: null,
      fileUrl: dataUrl,
      thumbnailUrl: dataUrl,
      mimeType: "image/*",
      width: 1024,
      height: 1365,
      fileSize: Math.round(dataUrl.length * 0.75),
      durationSec: 0,
      format3d: null,
      engine: "InsightFace(RetinaFace)",
      providerMode: "mock",
      watermarkToken: null,
      encrypted: true,
      meta: null,
      createdAt: now(),
    });
    if (!a.coverUrl) {
      a.coverUrl = dataUrl;
      a.coverAssetId = assetId;
    }
    const m: AiAvatarSourceMaterial = {
      id: `src-${nanoid(8)}`,
      avatarId: id,
      kind: "photo",
      assetId,
      assetUrl: dataUrl,
      text: null,
      faceCheck: { faces: 1, occlusion: false, blur: false, multiFace: false, brightness: "good", passed: true, engine: "InsightFace(RetinaFace)" },
      faceCheckPassed: true,
      createdAt: now(),
    };
    this.s.sourceMaterials.push(m);
    this.emit();
    return m;
  }
  signLicense(id: string, input: AiAvatarSignLicenseInput): AiAvatarLicenseGrant {
    const a = this.getAvatar(id);
    const lic: AiAvatarLicenseGrant = {
      id: `lic-${nanoid(8)}`,
      avatarId: id,
      subjectName: input.subjectName ?? a.name,
      scope: input.scope ?? "commercial",
      platforms: input.platforms ?? ["全平台"],
      validFrom: input.validFrom ?? now(),
      validTo: input.validTo ?? null,
      status: "active",
      hasAgreement: true,
      signatureName: input.signatureName,
      signedAt: now(),
      boundAssetIds: input.boundAssetIds ?? [],
      credentialUrl: `/seed/license-${id}.pdf`,
      createdAt: now(),
    };
    this.s.licenses.push(lic);
    this.emit();
    return lic;
  }

  // ── 异步生成任务 ──────────────────────────────────────────────────────────
  private newJob(avatarId: string, capability: AiAvatarCapability, title: string, input: Record<string, unknown>): AiAvatarJob {
    const j: AiAvatarJob = {
      id: `T-${nanoid(6).toUpperCase()}`,
      ownerUserId: OWNER,
      avatarId,
      versionId: null,
      capability,
      status: "running",
      progress: 4,
      providerMode: "mock",
      engine: "MOCK · " + CAPABILITY_ENGINE[capability],
      title,
      input,
      result: null,
      errorMessage: null,
      attempts: 0,
      maxAttempts: 3,
      creditsHeld: 0,
      batchId: null,
      createdAt: now(),
      startedAt: now(),
      completedAt: null,
    };
    this.s.jobs.unshift(j);
    return j;
  }

  startSampling(id: string, req?: AiAvatarSubmitJobInput): AiAvatarJob {
    const a = this.getAvatar(id);
    a.status = "sampling";
    a.updatedAt = now();
    const capability: AiAvatarCapability = a.mode === "real_clone" ? "faceClone" : "txt2img";
    const variants = req?.variants ?? 5;
    const j = this.newJob(id, capability, `${a.name} · 打样生成`, { kind: "sampling", variants, prompt: req?.prompt });
    this.emit();
    return j;
  }
  startDraftIterate(id: string, req: AiAvatarSubmitJobInput): AiAvatarJob {
    const a = this.getAvatar(id);
    if (a.status === "sampling") a.status = "draft_iterating";
    a.updatedAt = now();
    const j = this.newJob(id, "img2img", `${a.name} · 草稿迭代`, { kind: "draft", variants: req.variants ?? 2, prompt: req.prompt });
    this.emit();
    return j;
  }
  startAppearanceRefine(id: string, capability: AiAvatarCapability, req: AiAvatarSubmitJobInput): AiAvatarJob {
    const a = this.getAvatar(id);
    a.status = "refining";
    a.updatedAt = now();
    const j = this.newJob(id, capability, `${a.name} · ${CAPABILITY_LABEL[capability]}`, { kind: "refine", prompt: req.prompt, note: req.note });
    this.emit();
    return j;
  }
  startRegionInpaint(id: string, req: AiAvatarSubmitJobInput): AiAvatarJob {
    const a = this.getAvatar(id);
    a.status = "refining";
    a.updatedAt = now();
    const j = this.newJob(id, "inpaint", `${a.name} · 局部重绘`, { kind: "refine", prompt: req.prompt });
    this.emit();
    return j;
  }
  /** 几何精调：客户端已用 face-warp 完成形变（确定性真实算法），这里记录 RefineEdit + 新版本。 */
  recordGeometryRefine(id: string, input: AiAvatarGeometryRefineInput): AiAvatarVersion {
    const a = this.getAvatar(id);
    a.status = "refining";
    a.updatedAt = now();
    const vno = this.nextVersionNo(id);
    const v = version(id, vno, `精调 · 几何微调`, input.note ?? "关键点形变", "refining");
    v.previewUrl = a.coverUrl;
    v.params = (input.params as Record<string, unknown>) ?? null;
    this.s.versions.push(v);
    this.s.refineEdits.push({
      id: `re-${nanoid(8)}`,
      avatarId: id,
      versionId: v.id,
      kind: "geometry",
      params: (input.params as Record<string, unknown>) ?? null,
      beforeAssetId: input.beforeAssetId ?? null,
      afterAssetId: input.afterAssetId ?? null,
      jobId: null,
      note: input.note ?? null,
      createdAt: now(),
    });
    a.currentVersionId = v.id;
    this.emit();
    return v;
  }
  /** 提交客户端几何形变结果（face-warp 真实算法产出的 dataURL）：落 after 资产 + 版本 + 置封面。 */
  commitGeometry(id: string, dataUrl: string, params: Record<string, unknown>, note?: string): AiAvatarVersion {
    const a = this.getAvatar(id);
    a.status = "refining";
    const afterId = `warp-${nanoid(8)}`;
    this.s.assets.push({
      id: afterId,
      avatarId: id,
      versionId: null,
      kind: "image_2d",
      standardShot: null,
      fileUrl: dataUrl,
      thumbnailUrl: dataUrl,
      mimeType: "image/png",
      width: 512,
      height: 683,
      fileSize: Math.round(dataUrl.length * 0.75),
      durationSec: 0,
      format3d: null,
      engine: "MediaPipe FaceMesh (client) · 液化形变",
      providerMode: "selfhost",
      watermarkToken: null,
      encrypted: false,
      meta: { params },
      createdAt: now(),
    });
    a.coverUrl = dataUrl;
    a.coverAssetId = afterId;
    return this.recordGeometryRefine(id, { afterAssetId: afterId, params: params as never, note });
  }

  /** 提交客户端美颜/模版套用结果（beauty.ts 真实 canvas 算法产出的 dataURL）：落 after 资产 + 版本 + 置封面。 */
  commitBeauty(id: string, dataUrl: string, params: Record<string, unknown>, note?: string, label = "精调 · 模版套用"): AiAvatarVersion {
    const a = this.getAvatar(id);
    a.status = "refining";
    a.updatedAt = now();
    const afterId = `look-${nanoid(8)}`;
    this.s.assets.push({
      id: afterId,
      avatarId: id,
      versionId: null,
      kind: "image_2d",
      standardShot: null,
      fileUrl: dataUrl,
      thumbnailUrl: dataUrl,
      mimeType: "image/png",
      width: 512,
      height: 683,
      fileSize: Math.round(dataUrl.length * 0.75),
      durationSec: 0,
      format3d: null,
      engine: "GFPGAN + beauty (client)",
      providerMode: "selfhost",
      watermarkToken: null,
      encrypted: false,
      meta: { params },
      createdAt: now(),
    });
    a.coverUrl = dataUrl;
    a.coverAssetId = afterId;
    const v = version(id, this.nextVersionNo(id), label, note ?? "美颜 / 模版套用", "refining");
    v.previewUrl = dataUrl;
    v.assetIds = [afterId];
    v.params = (params as Record<string, unknown>) ?? null;
    this.s.versions.push(v);
    this.s.refineEdits.push({
      id: `re-${nanoid(8)}`,
      avatarId: id,
      versionId: v.id,
      kind: "appearance",
      params: (params as Record<string, unknown>) ?? null,
      beforeAssetId: null,
      afterAssetId: afterId,
      jobId: null,
      note: note ?? null,
      createdAt: now(),
    });
    a.currentVersionId = v.id;
    this.emit();
    return v;
  }

  startTemplateBeautify(id: string, req: AiAvatarSubmitJobInput): AiAvatarJob {
    const a = this.getAvatar(id);
    a.status = "refining";
    a.updatedAt = now();
    const j = this.newJob(id, "restore", `${a.name} · 模板美化 · 标准出图`, {
      kind: "beautify",
      templateIds: (req.params?.templateIds as string[]) ?? [],
      shots: (req.params?.shots as string[]) ?? COMPOSITIONS.map((c) => c.id),
    });
    this.emit();
    return j;
  }
  finalize(id: string, input: AiAvatarFinalizeInput): AiAvatar {
    const a = this.getAvatar(id);
    a.status = "finalized_2d";
    a.updatedAt = now();
    const vno = this.nextVersionNo(id);
    const v = version(id, vno, "定稿 v1.0", input.note ?? "锁定标准图集", "finalized_2d");
    v.previewUrl = a.coverUrl;
    v.assetIds = input.confirmedAssetIds ?? [];
    this.s.versions.push(v);
    a.finalizedVersionId = v.id;
    a.currentVersionId = v.id;
    this.emit();
    return a;
  }
  derive(id: string, input: AiAvatarDeriveInput): AiAvatarJob[] {
    const a = this.getAvatar(id);
    a.status = "deriving";
    a.updatedAt = now();
    const out: AiAvatarJob[] = [];
    for (const cap of input.capabilities) {
      const title = cap === "img23d" ? `${a.name} · 3D 重建` : `${a.name} · 渲染视频`;
      out.push(this.newJob(id, cap, title, { kind: "derive", capability: cap, videoDurationSec: input.videoDurationSec ?? 20, params: input.params ?? null }));
    }
    this.emit();
    return out;
  }

  // ── 版本管理 ───────────────────────────────────────────────────────────────
  listVersions(id: string): AiAvatarVersion[] {
    this.getAvatar(id);
    return this.s.versions.filter((v) => v.avatarId === id).sort((a, b) => b.versionNo - a.versionNo);
  }
  markVersion(id: string, versionId: string, preferred?: boolean, discarded?: boolean): AiAvatarVersion {
    const v = this.s.versions.find((x) => x.id === versionId && x.avatarId === id);
    if (!v) throw notFound("VERSION_NOT_FOUND", "版本不存在");
    if (preferred !== undefined) v.preferred = preferred;
    if (discarded !== undefined) v.discarded = discarded;
    this.emit();
    return v;
  }
  /** 打样 / 草稿选中某候选图：置为封面 + 当前版本（视觉连续）。mock 专用。 */
  setCover(id: string, assetId: string): AiAvatar {
    const a = this.getAvatar(id);
    const asset = this.assetById(assetId);
    if (asset) {
      a.coverUrl = asset.fileUrl || a.coverUrl;
      a.coverAssetId = assetId;
      a.updatedAt = now();
      // 标记所属版本为 preferred。
      const v = this.s.versions.find((x) => x.avatarId === id && x.assetIds.includes(assetId));
      if (v) {
        this.s.versions.filter((x) => x.avatarId === id).forEach((x) => (x.preferred = false));
        v.preferred = true;
        a.currentVersionId = v.id;
      }
      this.emit();
    }
    return a;
  }

  revertToVersion(id: string, versionId: string): AiAvatar {
    const a = this.getAvatar(id);
    const v = this.s.versions.find((x) => x.id === versionId && x.avatarId === id);
    if (!v) throw notFound("VERSION_NOT_FOUND", "版本不存在");
    a.currentVersionId = v.id;
    if (v.previewUrl) a.coverUrl = v.previewUrl;
    a.updatedAt = now();
    this.emit();
    return a;
  }

  // ── 任务控制 ───────────────────────────────────────────────────────────────
  cancelJob(id: string): AiAvatarJob {
    const j = this.getJob(id);
    if (j.status === "running" || j.status === "queued") {
      j.status = "cancelled";
      j.completedAt = now();
    }
    this.emit();
    return j;
  }
  retryJob(id: string): AiAvatarJob {
    const j = this.getJob(id);
    if (j.status === "failed" || j.status === "cancelled") {
      j.status = "running";
      j.progress = 4;
      j.attempts += 1;
      j.errorMessage = null;
      j.startedAt = now();
      j.completedAt = null;
    }
    this.emit();
    return j;
  }

  providerHealth(): AiAvatarProviderHealth[] {
    const caps = Object.keys(CAPABILITY_ENGINE) as AiAvatarCapability[];
    return caps.map((c) => {
      // faceWarp 始终真实（客户端 MediaPipe + 液化），其余 mock 路径。
      const real = c === "faceWarp";
      return {
        capability: c,
        capabilityLabel: CAPABILITY_LABEL[c],
        mode: real ? "selfhost" : "mock",
        healthy: true,
        engine: real ? "MediaPipe FaceMesh (client)" : CAPABILITY_ENGINE[c],
        approach: CAPABILITY_KIND[c],
        message: real ? "客户端确定性几何形变 · 478 关键点" : "Mock 实现 · 产出占位资产，契约与真实路径一致",
      };
    });
  }

  // ── 任务完成效果（由 job.input.kind 派生，serializable）────────────────────
  private completeJob(j: AiAvatarJob) {
    const a = this.s.avatars.find((x) => x.id === j.avatarId);
    if (!a) return;
    const kind = (j.input?.kind as string) ?? "";
    const mkImg = (shot: AiAvatarStandardShot | null, label: string, idx: number): string => {
      const id = `gen-${nanoid(8)}`;
      this.s.assets.push({
        id,
        avatarId: a.id,
        versionId: null,
        kind: shot ? (shot === "expression" ? "expression_image" : "image_2d") : "draft_image",
        standardShot: shot,
        fileUrl: a.coverUrl ?? PORTRAITS[idx % PORTRAITS.length],
        thumbnailUrl: a.coverUrl ?? PORTRAITS[idx % PORTRAITS.length],
        mimeType: "image/png",
        width: 1080,
        height: 1440,
        fileSize: 760_000,
        durationSec: 0,
        format3d: null,
        engine: j.engine,
        providerMode: "mock",
        watermarkToken: null,
        encrypted: false,
        meta: { label },
        createdAt: now(),
      });
      return id;
    };

    if (kind === "sampling" || kind === "draft") {
      const n = (j.input?.variants as number) ?? (kind === "sampling" ? 5 : 2);
      const ids = Array.from({ length: n }, (_, i) => mkImg(null, kind === "sampling" ? `方案 ${String.fromCharCode(65 + i)}` : `R · ${i + 1}`, i));
      const v = version(a.id, this.nextVersionNo(a.id), kind === "sampling" ? "打样候选" : "草稿迭代", `${n} 版候选`, kind === "sampling" ? "sampling" : "draft_iterating");
      v.assetIds = ids;
      v.jobId = j.id;
      v.previewUrl = a.coverUrl;
      this.s.versions.push(v);
      j.result = { assetIds: ids, versionId: v.id };
    } else if (kind === "refine") {
      const aid = mkImg(null, "精调结果", 0);
      const v = version(a.id, this.nextVersionNo(a.id), `精调 · ${CAPABILITY_LABEL[j.capability]}`, (j.input?.note as string) ?? "外观重绘", "refining");
      v.assetIds = [aid];
      v.jobId = j.id;
      v.previewUrl = a.coverUrl;
      this.s.versions.push(v);
      a.currentVersionId = v.id;
      j.result = { assetIds: [aid], versionId: v.id };
    } else if (kind === "beautify") {
      const shots = (j.input?.shots as string[]) ?? COMPOSITIONS.map((c) => c.id);
      const ids = shots.map((sid, i) => {
        const comp = COMPOSITIONS.find((c) => c.id === sid);
        return mkImg(comp?.shot ?? "front_bust", comp?.name ?? "标准图", i);
      });
      a.status = "pending_finalize";
      const v = version(a.id, this.nextVersionNo(a.id), "模板美化 · 标准出图", `${ids.length} 张标准图集`, "pending_finalize");
      v.assetIds = ids;
      v.jobId = j.id;
      v.previewUrl = a.coverUrl;
      this.s.versions.push(v);
      a.currentVersionId = v.id;
      j.result = { assetIds: ids, versionId: v.id };
    } else if (kind === "derive") {
      const cap = j.capability;
      if (cap === "img23d") {
        const id = `gen-3d-${nanoid(6)}`;
        this.s.assets.push({
          id,
          avatarId: a.id,
          versionId: null,
          kind: "model_3d",
          standardShot: null,
          fileUrl: "/seed/placeholder.glb",
          thumbnailUrl: null,
          mimeType: "model/gltf-binary",
          width: 0,
          height: 0,
          fileSize: 4_800_000,
          durationSec: 0,
          format3d: "glb",
          engine: j.engine,
          providerMode: "mock",
          watermarkToken: null,
          encrypted: false,
          meta: null,
          createdAt: now(),
        });
        a.has3d = true;
        j.result = { assetIds: [id] };
      } else if (cap === "img2video") {
        const id = `gen-vid-${nanoid(6)}`;
        this.s.assets.push({
          id,
          avatarId: a.id,
          versionId: null,
          kind: "video",
          standardShot: null,
          fileUrl: "",
          thumbnailUrl: a.coverUrl,
          mimeType: "video/mp4",
          width: 1920,
          height: 1080,
          fileSize: 12_000_000,
          durationSec: (j.input?.videoDurationSec as number) ?? 20,
          format3d: null,
          engine: j.engine,
          providerMode: "mock",
          watermarkToken: null,
          encrypted: false,
          meta: null,
          createdAt: now(),
        });
        a.hasVideo = true;
        j.result = { assetIds: [id] };
      }
      // 衍生任务全部完成后，状态回到 finalized_2d（用户在衍生页「确认入库」再 archive）。
      const pending = this.s.jobs.some((x) => x.avatarId === a.id && (x.input?.kind === "derive") && (x.status === "running" || x.status === "queued"));
      if (!pending && a.status === "deriving") a.status = "finalized_2d";
    }
    a.updatedAt = now();
  }

  private nextVersionNo(id: string): number {
    const vs = this.s.versions.filter((v) => v.avatarId === id);
    return vs.length ? Math.max(...vs.map((v) => v.versionNo)) + 1 : 1;
  }

  // ── 运营配置：prompt 模板（复用共享 prompt_template 形态） ──────────────────────
  listPromptConfigs(): AiAvatarPromptConfig[] {
    return this.s.promptConfigs.map((p) => ({ ...p }));
  }
  getPromptConfig(key: string): AiAvatarPromptConfig {
    const p = this.s.promptConfigs.find((x) => x.key === key);
    if (!p) throw notFound("PROMPT_NOT_FOUND", "Prompt 不存在");
    return { ...p };
  }
  upsertPromptConfig(key: string, input: AiAvatarPromptUpsertInput): AiAvatarPromptConfig {
    const p = this.s.promptConfigs.find((x) => x.key === key);
    if (!p) throw notFound("PROMPT_NOT_FOUND", "Prompt 不存在");
    if (input.systemPrompt !== undefined) p.systemPrompt = input.systemPrompt;
    if (input.userTemplate !== undefined) p.userTemplate = input.userTemplate;
    if (input.params !== undefined) p.params = input.params;
    if (input.enabled !== undefined) p.enabled = input.enabled;
    p.version += 1; // 灰度：每次保存版本 +1（version>1 = 运营已改，seeder 不再覆盖）
    p.origin = "db";
    p.updatedAt = now();
    p.updatedBy = "运营";
    this.emit();
    return { ...p };
  }
  dryRunPrompt(key: string, vars: Record<string, string>): AiAvatarPromptDryRunResult {
    const p = this.getPromptConfig(key);
    return { system: p.systemPrompt, user: fillTemplate(p.userTemplate, vars), origin: p.origin };
  }

  // ── 运营配置：UI 文案 ─────────────────────────────────────────────────────────
  getUiConfig(): AiAvatarUiConfig {
    return { ...this.s.uiConfig };
  }
  updateUiConfig(input: Partial<AiAvatarUiConfig>): AiAvatarUiConfig {
    this.s.uiConfig = { ...this.s.uiConfig, ...input };
    this.emit();
    return { ...this.s.uiConfig };
  }

  // ── 运营配置：模板 CRUD（按 category：style / beauty / composition） ──────────────
  listTemplatesByCategory(category: AiAvatarTemplateCategory): AiAvatarTemplate[] {
    return this.s.templates.filter((t) => t.category === category && t.enabled).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  listAllTemplates(): AiAvatarTemplate[] {
    return [...this.s.templates];
  }
  createTemplate(input: AiAvatarTemplateUpsertInput): AiAvatarTemplate {
    const t: AiAvatarTemplate = {
      id: `tpl-${nanoid(8)}`,
      name: input.name,
      category: input.category,
      categoryLabel: input.category,
      description: input.description ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      params: (input.params as Record<string, unknown>) ?? null,
      capability: input.capability ?? null,
      official: input.official ?? true,
      ownerUserId: input.official === false ? OWNER : null,
      enabled: input.enabled ?? true,
      usageCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    this.s.templates.push(t);
    this.emit();
    return { ...t };
  }
  updateTemplate(id: string, input: AiAvatarTemplateUpsertInput): AiAvatarTemplate {
    const t = this.s.templates.find((x) => x.id === id);
    if (!t) throw notFound("TEMPLATE_NOT_FOUND", "模板不存在");
    if (input.name !== undefined) t.name = input.name;
    if (input.category !== undefined) { t.category = input.category; t.categoryLabel = input.category; }
    if (input.description !== undefined) t.description = input.description;
    if (input.thumbnailUrl !== undefined) t.thumbnailUrl = input.thumbnailUrl;
    if (input.params !== undefined) t.params = input.params as Record<string, unknown>;
    if (input.capability !== undefined) t.capability = input.capability;
    if (input.enabled !== undefined) t.enabled = input.enabled;
    t.updatedAt = now();
    this.emit();
    return { ...t };
  }
  deleteTemplate(id: string): void {
    this.s.templates = this.s.templates.filter((x) => x.id !== id);
    this.emit();
  }
}

/**
 * 构造全新 mock state：avatar 数据来自 buildSeed()，模板/prompt/ui-config 来自「出厂默认」常量。
 * 模板按 category 建成「配置级」（params 带真实配置：beauty 参数 / style prompt / composition 规格），
 * 让精调 / 出图屏能直接消费；运营在配置页改动后持久化覆盖这里的默认值。
 */
function freshState(): State {
  const seed = buildSeed();
  const ts = now();
  const mk = (
    id: string,
    name: string,
    category: AiAvatarTemplateCategory,
    description: string | null,
    params: Record<string, unknown>,
    capability: AiAvatarTemplate["capability"],
    thumbnailUrl: string | null,
  ): AiAvatarTemplate => ({
    id, name, category, categoryLabel: category, description, thumbnailUrl,
    params, capability, official: true, ownerUserId: null, enabled: true,
    usageCount: 0, createdAt: ts, updatedAt: ts,
  });

  const templates: AiAvatarTemplate[] = [
    ...BEAUTY_TEMPLATES.map((b) =>
      mk(b.id, b.name, "beauty", b.tag, { ...b.params, hue: b.hue }, "restore", null)),
    ...STYLE_LOOK_TEMPLATES.map((s) =>
      mk(s.id, s.name, "style", s.desc, { prompt: s.prompt, hue: s.hue }, "img2img", s.sampleUrl)),
    ...COMPOSITIONS.map((c) =>
      mk(c.id, c.name, "composition", c.sub, { shot: c.shot, ratio: c.ratio, main: !!c.main }, null, null)),
  ];

  return {
    ...seed,
    templates,
    refineEdits: [],
    promptConfigs: PROMPT_CONFIG_DEFAULTS.map((p) => ({ ...p, params: p.params ? { ...p.params } : null })),
    uiConfig: { ...UI_CONFIG_DEFAULTS },
  };
}

function version(avatarId: string, no: number, label: string, note: string, stage: AiAvatarStatus): AiAvatarVersion {
  return {
    id: `${avatarId}-v${no}-${nanoid(4)}`,
    avatarId,
    versionNo: no,
    label,
    note,
    author: "陈墨",
    sourceStatus: stage,
    params: null,
    previewAssetId: null,
    previewUrl: null,
    assetIds: [],
    jobId: null,
    preferred: false,
    discarded: false,
    createdAt: now(),
  };
}

// 错误工厂（与 ApiError 形状兼容：screens 直接 catch e.code/e.message）。
class MockError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const notFound = (code: string, msg: string) => new MockError(code, msg, 404);
const badReq = (code: string, msg: string) => new MockError(code, msg, 400);

// 单例（SSR 下也可构造，但 ticker / localStorage 仅在 window 存在时启用）。
let _store: MockStore | null = null;
export function mockStore(): MockStore {
  if (!_store) _store = new MockStore();
  return _store;
}
