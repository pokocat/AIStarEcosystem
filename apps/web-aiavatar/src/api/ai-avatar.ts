// ============================================================
// api/ai-avatar.ts — AiAvatar 数据访问层（mock ↔ live 双路径，单旗切换）。
//
// NEXT_PUBLIC_USE_MOCK=1 → mockStore()（离线整跑）。
// NEXT_PUBLIC_USE_MOCK=0 → apiFetch → Next rewrites → Spring Boot /api/me/aiavatar/*。
// 两条路径共用同一套类型 / 状态机 / 前端代码（任务书 §6）。
// ============================================================
import { apiFetch, USE_MOCK, getAuthToken, API_BASE_URL } from "@ai-star-eco/api-client";
import type {
  AiAvatar,
  AiAvatarDetail,
  AiAvatarVersion,
  AiAvatarJob,
  AiAvatarTemplate,
  AiAvatarLicenseGrant,
  AiAvatarSourceMaterial,
  AiAvatarProviderHealth,
  AiAvatarCreateInput,
  AiAvatarUpdateInput,
  AiAvatarSubmitJobInput,
  AiAvatarGeometryRefineInput,
  AiAvatarSignLicenseInput,
  AiAvatarFinalizeInput,
  AiAvatarDeriveInput,
  AiAvatarStatus,
  AiAvatarCapability,
} from "@ai-star-eco/types/ai-avatar";
import { mockStore } from "@/mocks/store";

/** 当前数据源（前端可见 · 任务书 §6.4）。 */
export type DataSourceMode = "mock" | "live";
export function dataSourceMode(): DataSourceMode {
  return USE_MOCK ? "mock" : "live";
}

const BASE = "/me/aiavatar/avatars";

// ── 资产总库 / CRUD ──────────────────────────────────────────────────────────
export async function listAvatars(): Promise<AiAvatar[]> {
  if (USE_MOCK) return mockStore().listAvatars();
  return apiFetch<AiAvatar[]>(BASE);
}
export async function getAvatarDetail(id: string): Promise<AiAvatarDetail> {
  if (USE_MOCK) return mockStore().detail(id);
  return apiFetch<AiAvatarDetail>(`${BASE}/${id}`);
}
export async function createAvatar(input: AiAvatarCreateInput): Promise<AiAvatar> {
  if (USE_MOCK) return mockStore().createAvatar(input);
  return apiFetch<AiAvatar>(BASE, { method: "POST", body: input });
}
export async function updateAvatar(id: string, input: AiAvatarUpdateInput): Promise<AiAvatar> {
  if (USE_MOCK) return mockStore().updateAvatar(id, input);
  return apiFetch<AiAvatar>(`${BASE}/${id}`, { method: "PUT", body: input });
}
export async function archiveAvatar(id: string): Promise<AiAvatar> {
  if (USE_MOCK) return mockStore().archiveAvatar(id);
  return apiFetch<AiAvatar>(`${BASE}/${id}/archive`, { method: "POST" });
}
export async function forkAvatar(id: string, name?: string): Promise<AiAvatar> {
  if (USE_MOCK) return mockStore().forkAvatar(id, name);
  return apiFetch<AiAvatar>(`${BASE}/${id}/fork`, { method: "POST", body: name ? { name } : {} });
}
export async function transitionAvatar(id: string, status: AiAvatarStatus): Promise<AiAvatar> {
  if (USE_MOCK) return mockStore().transition(id, status);
  return apiFetch<AiAvatar>(`${BASE}/${id}/transition`, { method: "POST", query: { status } });
}

// ── 素材 / 授权 ────────────────────────────────────────────────────────────
export async function addSourceText(id: string, text: string, kind = "text"): Promise<AiAvatarSourceMaterial> {
  if (USE_MOCK) return mockStore().addSourceText(id, text, kind);
  return apiFetch<AiAvatarSourceMaterial>(`${BASE}/${id}/source-text`, { method: "POST", body: { text, kind } });
}
/** 上传真人参考照片：mock 读 File→dataURL；live 走 multipart。 */
export async function uploadSourcePhoto(id: string, file: File): Promise<AiAvatarSourceMaterial> {
  if (USE_MOCK) {
    const dataUrl = await fileToDataUrl(file);
    return mockStore().addSourcePhoto(id, dataUrl);
  }
  const form = new FormData();
  form.append("file", file);
  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}${BASE}/${id}/source-photo`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || json?.success !== true) throw new Error(json?.error?.message ?? "上传失败");
  return json.data as AiAvatarSourceMaterial;
}
export async function signLicense(id: string, input: AiAvatarSignLicenseInput): Promise<AiAvatarLicenseGrant> {
  if (USE_MOCK) return mockStore().signLicense(id, input);
  return apiFetch<AiAvatarLicenseGrant>(`${BASE}/${id}/licenses`, { method: "POST", body: input });
}

// ── 7 步生成动作 ──────────────────────────────────────────────────────────────
export async function startSampling(id: string, req?: AiAvatarSubmitJobInput): Promise<AiAvatarJob> {
  if (USE_MOCK) return mockStore().startSampling(id, req);
  return apiFetch<AiAvatarJob>(`${BASE}/${id}/sampling`, { method: "POST", body: req ?? {} });
}
export async function startDraftIterate(id: string, req: AiAvatarSubmitJobInput): Promise<AiAvatarJob> {
  if (USE_MOCK) return mockStore().startDraftIterate(id, req);
  return apiFetch<AiAvatarJob>(`${BASE}/${id}/draft-iterate`, { method: "POST", body: req });
}
export async function refineAppearance(id: string, capability: AiAvatarCapability, req: AiAvatarSubmitJobInput): Promise<AiAvatarJob> {
  if (USE_MOCK) return mockStore().startAppearanceRefine(id, capability, req);
  return apiFetch<AiAvatarJob>(`${BASE}/${id}/refine/appearance`, { method: "POST", query: { capability }, body: req });
}
export async function refineRegion(id: string, req: AiAvatarSubmitJobInput): Promise<AiAvatarJob> {
  if (USE_MOCK) return mockStore().startRegionInpaint(id, req);
  return apiFetch<AiAvatarJob>(`${BASE}/${id}/refine/region`, { method: "POST", body: req });
}
export async function refineGeometry(id: string, input: AiAvatarGeometryRefineInput): Promise<AiAvatarVersion> {
  if (USE_MOCK) return mockStore().recordGeometryRefine(id, input);
  return apiFetch<AiAvatarVersion>(`${BASE}/${id}/refine/geometry`, { method: "POST", body: input });
}

/**
 * 提交客户端几何形变（face-warp.ts 真实算法）的结果图。
 * mock：直接落 dataURL 资产 + 版本；live：先 multipart 上传图为 asset，再记录 RefineEdit。
 */
export async function commitGeometryRefine(
  id: string,
  dataUrl: string,
  params: Record<string, unknown>,
  note?: string,
): Promise<AiAvatarVersion> {
  if (USE_MOCK) return mockStore().commitGeometry(id, dataUrl, params, note);
  // live：上传 after 图 → 拿 assetId → refineGeometry。
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], "geometry-refine.png", { type: "image/png" });
  const form = new FormData();
  form.append("file", file);
  form.append("avatarId", id);
  form.append("kind", "image_2d");
  const token = getAuthToken();
  const up = await fetch(`${API_BASE_URL}/me/aiavatar/assets`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
    credentials: "include",
  });
  const upJson = await up.json();
  const afterAssetId = upJson?.data?.id as string | undefined;
  return refineGeometry(id, { afterAssetId: afterAssetId ?? "", params: params as never, note });
}

/**
 * 提交客户端美颜 / 模版套用（beauty.ts 真实 canvas 算法）的结果图为新版本。
 * mock：直接落 dataURL 资产 + 版本（即时可见）；live：multipart 上传 after 图 → 记录 appearance RefineEdit。
 */
export async function commitBeautyRefine(
  id: string,
  dataUrl: string,
  params: Record<string, unknown>,
  note?: string,
  label?: string,
): Promise<AiAvatarVersion> {
  if (USE_MOCK) return mockStore().commitBeauty(id, dataUrl, params, note, label);
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], "beauty-refine.png", { type: "image/png" });
  const form = new FormData();
  form.append("file", file);
  form.append("avatarId", id);
  form.append("kind", "image_2d");
  const token = getAuthToken();
  const up = await fetch(`${API_BASE_URL}/me/aiavatar/assets`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
    credentials: "include",
  });
  const upJson = await up.json();
  const afterAssetId = upJson?.data?.id as string | undefined;
  // 复用 geometry 记录端点提交「客户端产出图为新版本」（server 端按 RefineEdit 落库；params 标注 beauty）。
  return refineGeometry(id, { afterAssetId: afterAssetId ?? "", params: { ...params, _kind: "beauty" } as never, note });
}
export async function templateBeautify(id: string, req: AiAvatarSubmitJobInput): Promise<AiAvatarJob> {
  if (USE_MOCK) return mockStore().startTemplateBeautify(id, req);
  return apiFetch<AiAvatarJob>(`${BASE}/${id}/template-beautify`, { method: "POST", body: req });
}
export async function finalizeAvatar(id: string, input: AiAvatarFinalizeInput): Promise<AiAvatar> {
  if (USE_MOCK) return mockStore().finalize(id, input);
  return apiFetch<AiAvatar>(`${BASE}/${id}/finalize`, { method: "POST", body: input });
}
export async function deriveAssets(id: string, input: AiAvatarDeriveInput): Promise<AiAvatarJob[]> {
  if (USE_MOCK) return mockStore().derive(id, input);
  return apiFetch<AiAvatarJob[]>(`${BASE}/${id}/derive`, { method: "POST", body: input });
}

/**
 * 选中打样 / 草稿候选图：mock 置为封面（视觉连续）；live 标记所属版本为 preferred（best-effort）。
 */
export async function chooseVariant(id: string, assetId: string, versionId?: string): Promise<void> {
  if (USE_MOCK) {
    mockStore().setCover(id, assetId);
    return;
  }
  if (versionId) {
    await markVersion(id, versionId, true).catch(() => undefined);
  }
}

// ── 版本管理 ───────────────────────────────────────────────────────────────
export async function listVersions(id: string): Promise<AiAvatarVersion[]> {
  if (USE_MOCK) return mockStore().listVersions(id);
  return apiFetch<AiAvatarVersion[]>(`${BASE}/${id}/versions`);
}
export async function markVersion(id: string, versionId: string, preferred?: boolean, discarded?: boolean): Promise<AiAvatarVersion> {
  if (USE_MOCK) return mockStore().markVersion(id, versionId, preferred, discarded);
  return apiFetch<AiAvatarVersion>(`${BASE}/${id}/versions/${versionId}/mark`, { method: "POST", query: { preferred, discarded } });
}
export async function revertToVersion(id: string, versionId: string): Promise<AiAvatar> {
  if (USE_MOCK) return mockStore().revertToVersion(id, versionId);
  return apiFetch<AiAvatar>(`${BASE}/${id}/versions/${versionId}/revert`, { method: "POST" });
}

// ── 模板中心 ───────────────────────────────────────────────────────────────
export async function listTemplates(): Promise<AiAvatarTemplate[]> {
  if (USE_MOCK) return mockStore().listTemplates();
  return apiFetch<AiAvatarTemplate[]>("/me/aiavatar/templates");
}

// ── 任务中心 ───────────────────────────────────────────────────────────────
export async function listJobs(): Promise<AiAvatarJob[]> {
  if (USE_MOCK) return mockStore().listJobs();
  return apiFetch<AiAvatarJob[]>("/me/aiavatar/jobs");
}
export async function getJob(id: string): Promise<AiAvatarJob> {
  if (USE_MOCK) return mockStore().getJob(id);
  return apiFetch<AiAvatarJob>(`/me/aiavatar/jobs/${id}`);
}
export async function cancelJob(id: string): Promise<AiAvatarJob> {
  if (USE_MOCK) return mockStore().cancelJob(id);
  return apiFetch<AiAvatarJob>(`/me/aiavatar/jobs/${id}/cancel`, { method: "POST" });
}
export async function retryJob(id: string): Promise<AiAvatarJob> {
  if (USE_MOCK) return mockStore().retryJob(id);
  return apiFetch<AiAvatarJob>(`/me/aiavatar/jobs/${id}/retry`, { method: "POST" });
}

// ── 授权管理 ───────────────────────────────────────────────────────────────
export async function listLicenses(): Promise<AiAvatarLicenseGrant[]> {
  if (USE_MOCK) {
    const all = mockStore().listLicenses();
    return all;
  }
  // 后端无独立 license 列表端点；从各 avatar detail 聚合（live 由 licenses 页处理）。
  const avatars = await listAvatars();
  const reals = avatars.filter((a) => a.mode === "real_clone");
  const details = await Promise.all(reals.map((a) => getAvatarDetail(a.id).catch(() => null)));
  return details.flatMap((d) => d?.licenses ?? []);
}

// ── Provider 健康（可观测 · 公开端点）────────────────────────────────────────
export async function providerHealth(): Promise<AiAvatarProviderHealth[]> {
  if (USE_MOCK) return mockStore().providerHealth();
  return apiFetch<AiAvatarProviderHealth[]>("/aiavatar/health/providers");
}

// ── 工具 ───────────────────────────────────────────────────────────────────
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
