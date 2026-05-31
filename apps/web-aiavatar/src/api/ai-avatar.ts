// ─────────────────────────────────────────────────────────────────────────────
// api/ai-avatar.ts — AiAvatar 中心调用层。
//
// USE_MOCK=1 → 走 mocks/store（纯前端引擎，可离线整跑，进度由定时器推进）。
// USE_MOCK=0 → 走 apiFetch → Next rewrites → Spring Boot /api/me/aiavatar/**、/api/aiavatar/health。
// 两条路径共用同一组类型契约；切换只改 .env 的 NEXT_PUBLIC_USE_MOCK。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AiAvatar,
  AiAvatarDetail,
  AiAvatarStatus,
  AiAvatarVersion,
  AiAvatarCapability,
  AiAvatarCreateInput,
  AiAvatarDeriveInput,
  AiAvatarFinalizeInput,
  AiAvatarGeometryRefineInput,
  AiAvatarJob,
  AiAvatarLicenseGrant,
  AiAvatarProviderHealth,
  AiAvatarSignLicenseInput,
  AiAvatarSubmitJobInput,
  AiAvatarTemplate,
  AiAvatarUpdateInput,
} from "@ai-star-eco/types/ai-avatar";
import { apiFetch, mockDelay, USE_MOCK } from "@ai-star-eco/api-client";
import * as store from "@/mocks/store";

const BASE = "/me/aiavatar";

// ── 总库 / CRUD ────────────────────────────────────────────────────────────────
export async function listAvatars(): Promise<AiAvatar[]> {
  if (USE_MOCK) return mockDelay(store.listAvatars());
  return apiFetch<AiAvatar[]>(`${BASE}/avatars`);
}

export async function getDetail(id: string): Promise<AiAvatarDetail> {
  if (USE_MOCK) {
    const d = store.detail(id);
    if (!d) throw new Error("AiAvatar不存在");
    return mockDelay(d);
  }
  return apiFetch<AiAvatarDetail>(`${BASE}/avatars/${id}`);
}

export async function createAvatar(input: AiAvatarCreateInput): Promise<AiAvatar> {
  if (USE_MOCK) return mockDelay(store.createAvatar(input));
  return apiFetch<AiAvatar>(`${BASE}/avatars`, { method: "POST", body: input });
}

export async function updateAvatar(id: string, input: AiAvatarUpdateInput): Promise<AiAvatar> {
  if (USE_MOCK) return mockDelay(store.updateAvatar(id, input as Partial<AiAvatar>));
  return apiFetch<AiAvatar>(`${BASE}/avatars/${id}`, { method: "PUT", body: input });
}

export async function transition(id: string, status: AiAvatarStatus): Promise<AiAvatar> {
  if (USE_MOCK) return mockDelay(store.transition(id, status));
  return apiFetch<AiAvatar>(`${BASE}/avatars/${id}/transition`, { method: "POST", query: { status } });
}

export async function forkAvatar(id: string, name?: string): Promise<AiAvatar> {
  if (USE_MOCK) return mockDelay(store.forkAvatar(id, name));
  return apiFetch<AiAvatar>(`${BASE}/avatars/${id}/fork`, { method: "POST", body: { name } });
}

export async function archiveAvatar(id: string): Promise<AiAvatar> {
  if (USE_MOCK) return mockDelay(store.transition(id, "archived"));
  return apiFetch<AiAvatar>(`${BASE}/avatars/${id}/archive`, { method: "POST" });
}

// ── 素材 / 授权 ─────────────────────────────────────────────────────────────────
export async function addSourceText(avatarId: string, text: string, kind = "text") {
  if (USE_MOCK) return mockDelay(store.addSourceText(avatarId, text, kind));
  return apiFetch(`${BASE}/avatars/${avatarId}/source-text`, { method: "POST", body: { text, kind } });
}

/** 真人照片上传：mock 读真实图片字节(dataURL)登记 + 触发合规检测，全流程用这张真实照片；live 走 multipart。 */
export async function uploadSourcePhoto(avatarId: string, file: File, faceCheck = true) {
  if (USE_MOCK) {
    const dataUri = await fileToDataUri(file);
    const r = store.addSourcePhoto(avatarId, file.name, dataUri);
    return mockDelay(r.material, 400);
  }
  const fd = new FormData();
  fd.append("file", file);
  const token = (await import("@ai-star-eco/api-client")).getAuthToken();
  const res = await fetch(`/api${BASE}/avatars/${avatarId}/source-photo?faceCheck=${faceCheck}`, {
    method: "POST",
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) throw new Error("上传失败");
  const json = await res.json();
  return json.data;
}

/** 普通图片上传（参考图 / 几何形变结果回传）。返回 asset。 */
export async function uploadImage(avatarId: string | undefined, kind: string, file: File) {
  if (USE_MOCK) {
    // mock：把 file 读为 dataURL 作为 asset 直接登记走 geometry 通道之外的简化
    const dataUri = await fileToDataUri(file);
    return mockDelay({ id: `mock-asset-${Date.now()}`, fileUrl: dataUri, kind });
  }
  const fd = new FormData();
  fd.append("file", file);
  if (avatarId) fd.append("avatarId", avatarId);
  fd.append("kind", kind);
  const token = (await import("@ai-star-eco/api-client")).getAuthToken();
  const res = await fetch(`/api${BASE}/assets`, {
    method: "POST", body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) throw new Error("上传失败");
  return (await res.json()).data;
}

export async function signLicense(avatarId: string, input: AiAvatarSignLicenseInput): Promise<AiAvatarLicenseGrant> {
  if (USE_MOCK) return mockDelay(store.signLicense(avatarId, input));
  return apiFetch<AiAvatarLicenseGrant>(`${BASE}/avatars/${avatarId}/licenses`, { method: "POST", body: input });
}

// ── 7 步生成动作 ────────────────────────────────────────────────────────────────
export async function startSampling(avatarId: string, req: AiAvatarSubmitJobInput): Promise<AiAvatarJob> {
  if (USE_MOCK) {
    const a = store.getAvatar(avatarId);
    const cap: AiAvatarCapability = a?.mode === "real_clone" ? "faceClone" : "txt2img";
    return mockDelay(store.startJob({
      avatarId, capability: cap, title: "打样", variants: req.variants ?? 3,
      prompt: req.prompt ?? a?.persona ?? undefined, advanceTo: "sampling",
    }));
  }
  return apiFetch<AiAvatarJob>(`${BASE}/avatars/${avatarId}/sampling`, { method: "POST", body: req });
}

export async function startDraftIterate(avatarId: string, req: AiAvatarSubmitJobInput): Promise<AiAvatarJob> {
  if (USE_MOCK) {
    return mockDelay(store.startJob({
      avatarId, capability: "img2img", title: "草稿迭代", prompt: req.prompt, advanceTo: "draft_iterating",
    }));
  }
  return apiFetch<AiAvatarJob>(`${BASE}/avatars/${avatarId}/draft-iterate`, { method: "POST", body: req });
}

export async function startAppearanceRefine(avatarId: string, capability: AiAvatarCapability, req: AiAvatarSubmitJobInput): Promise<AiAvatarJob> {
  if (USE_MOCK) {
    return mockDelay(store.startJob({
      avatarId, capability, title: `精调-${store.capabilityLabel(capability)}`,
      prompt: req.prompt, params: req.params, advanceTo: "refining",
    }));
  }
  return apiFetch<AiAvatarJob>(`${BASE}/avatars/${avatarId}/refine/appearance`, { method: "POST", query: { capability }, body: req });
}

export async function startRegionInpaint(avatarId: string, req: AiAvatarSubmitJobInput): Promise<AiAvatarJob> {
  if (USE_MOCK) {
    return mockDelay(store.startJob({ avatarId, capability: "inpaint", title: "局部重绘", prompt: req.prompt, advanceTo: "refining" }));
  }
  return apiFetch<AiAvatarJob>(`${BASE}/avatars/${avatarId}/refine/region`, { method: "POST", body: req });
}

export async function recordGeometryRefine(avatarId: string, input: AiAvatarGeometryRefineInput & { afterDataUri?: string }): Promise<AiAvatarVersion> {
  if (USE_MOCK) {
    return mockDelay(store.recordGeometryRefine(avatarId, {
      afterDataUri: input.afterDataUri ?? "",
      params: input.params as Record<string, unknown>, note: input.note,
    }));
  }
  return apiFetch<AiAvatarVersion>(`${BASE}/avatars/${avatarId}/refine/geometry`, { method: "POST", body: input });
}

export async function startTemplateBeautify(avatarId: string, req: AiAvatarSubmitJobInput): Promise<AiAvatarJob> {
  if (USE_MOCK) {
    return mockDelay(store.startJob({
      avatarId, capability: "restore", title: "模板美化出图", standardShots: true,
      templateId: req.templateId, advanceTo: "pending_finalize",
    }));
  }
  return apiFetch<AiAvatarJob>(`${BASE}/avatars/${avatarId}/template-beautify`, { method: "POST", body: req });
}

export async function finalize(avatarId: string, input: AiAvatarFinalizeInput): Promise<AiAvatar> {
  if (USE_MOCK) return mockDelay(store.finalize(avatarId, input.versionId));
  return apiFetch<AiAvatar>(`${BASE}/avatars/${avatarId}/finalize`, { method: "POST", body: input });
}

export async function derive(avatarId: string, input: AiAvatarDeriveInput): Promise<AiAvatarJob[]> {
  if (USE_MOCK) return mockDelay(store.derive(avatarId, input.capabilities, input.videoDurationSec));
  return apiFetch<AiAvatarJob[]>(`${BASE}/avatars/${avatarId}/derive`, { method: "POST", body: input });
}

// ── 版本 ─────────────────────────────────────────────────────────────────────
export async function listVersions(avatarId: string): Promise<AiAvatarVersion[]> {
  if (USE_MOCK) {
    const d = store.detail(avatarId);
    return mockDelay(d?.versions ?? []);
  }
  return apiFetch<AiAvatarVersion[]>(`${BASE}/avatars/${avatarId}/versions`);
}

export async function markVersion(avatarId: string, versionId: string, patch: { preferred?: boolean; discarded?: boolean }): Promise<AiAvatarVersion> {
  if (USE_MOCK) return mockDelay(store.markVersion(versionId, patch));
  return apiFetch<AiAvatarVersion>(`${BASE}/avatars/${avatarId}/versions/${versionId}/mark`, { method: "POST", query: patch });
}

export async function revertToVersion(avatarId: string, versionId: string): Promise<AiAvatar> {
  if (USE_MOCK) return mockDelay(store.revertToVersion(avatarId, versionId));
  return apiFetch<AiAvatar>(`${BASE}/avatars/${avatarId}/versions/${versionId}/revert`, { method: "POST" });
}

// ── 任务中心 ───────────────────────────────────────────────────────────────────
export async function listJobs(): Promise<AiAvatarJob[]> {
  if (USE_MOCK) return mockDelay(store.listJobs());
  return apiFetch<AiAvatarJob[]>(`${BASE}/jobs`);
}

export async function getJob(id: string): Promise<AiAvatarJob> {
  if (USE_MOCK) {
    const j = store.getJob(id);
    if (!j) throw new Error("任务不存在");
    return mockDelay(j, 60);
  }
  return apiFetch<AiAvatarJob>(`${BASE}/jobs/${id}`);
}

export async function cancelJob(id: string): Promise<AiAvatarJob> {
  if (USE_MOCK) return mockDelay(store.cancelJob(id));
  return apiFetch<AiAvatarJob>(`${BASE}/jobs/${id}/cancel`, { method: "POST" });
}

export async function retryJob(id: string): Promise<AiAvatarJob> {
  if (USE_MOCK) return mockDelay(store.retryJob(id));
  return apiFetch<AiAvatarJob>(`${BASE}/jobs/${id}/retry`, { method: "POST" });
}

// ── 模板 / 健康 ─────────────────────────────────────────────────────────────────
export async function listTemplates(): Promise<AiAvatarTemplate[]> {
  if (USE_MOCK) return mockDelay(store.listTemplates());
  return apiFetch<AiAvatarTemplate[]>(`${BASE}/templates`);
}

export async function providerHealth(): Promise<AiAvatarProviderHealth[]> {
  if (USE_MOCK) return mockDelay(store.providerHealth());
  return apiFetch<AiAvatarProviderHealth[]>(`/aiavatar/health/providers`);
}

export { USE_MOCK };

// ── helpers ──
function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
