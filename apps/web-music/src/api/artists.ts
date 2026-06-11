// ─────────────────────────────────────────────────────────────────────────────
// api/artists.ts — 艺人领域 API 封装。
// 用户侧端点：/api/me/digital-ips
// USE_MOCK=1 时返回 mocks/artists.ts（会话内引入的艺人放 mockImported，刷新即失）；
// 否则走 apiFetch。
// ─────────────────────────────────────────────────────────────────────────────

import type { Artist, ImportAvatarRequest } from "@ai-star-eco/types/artist";
import type { ID } from "@ai-star-eco/types/_shared";
import { MOCK_ARTISTS } from "@/mocks/artists";
import { MOCK_DAP_AVATARS, resolveMockDisplayImage } from "@/mocks/dap-avatars";
import { ApiError, apiFetch, USE_MOCK, mockDelay } from "./_client";

/** mock 模式下会话内「引入数字人」创建的艺人（置于列表头部） */
const mockImported: Artist[] = [];

function mockAll(): Artist[] {
  return [...mockImported, ...MOCK_ARTISTS];
}

/** 列出当前用户名下的所有 Digital IP */
export async function listArtists(): Promise<Artist[]> {
  if (USE_MOCK) return mockDelay(mockAll());
  return apiFetch<Artist[]>("/me/digital-ips");
}

/** 查询单个艺人详情 */
export async function getArtist(id: ID): Promise<Artist | null> {
  if (USE_MOCK) {
    return mockDelay(mockAll().find((a) => a.id === id) ?? null);
  }
  return apiFetch<Artist | null>(`/me/digital-ips/${encodeURIComponent(id)}`);
}

/** 创建新艺人。后端会基于 Principal 自动绑定 ownerUserId。 */
export async function createArtist(data: Partial<Artist>): Promise<Artist> {
  if (USE_MOCK) {
    const fake: Artist = {
      ...MOCK_ARTISTS[0],
      ...data,
      id: `mock-${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    } as Artist;
    return mockDelay(fake);
  }
  return apiFetch<Artist>("/me/digital-ips", {
    method: "POST",
    body: data,
  });
}

/**
 * v0.60 收敛：从 AiAvatar 引入数字人为艺人（引用不复制，不扣孵化积分）。
 * 形象与展示名实时跟随数字人；展示图可用 dapDisplayRef 指定（缺省跟随定妆照）。
 * 同 (数字人, 艺人类型) 仅允许引入一次 —— 重复引入 409 DAP_AVATAR_ALREADY_IMPORTED。
 */
export async function importAvatarAsArtist(req: ImportAvatarRequest): Promise<Artist> {
  if (USE_MOCK) {
    const avatar = MOCK_DAP_AVATARS.find((a) => a.id === req.dapAvatarId);
    if (!avatar) {
      throw new ApiError({ code: "DAP_AVATAR_NOT_FOUND", message: "数字人不存在或无权访问" }, 404);
    }
    const kind = req.type ?? "singer";
    const dup = mockAll().find((a) => a.dapAvatarId === avatar.id && a.type === kind);
    if (dup) {
      throw new ApiError({
        code: "DAP_AVATAR_ALREADY_IMPORTED",
        message: `该数字人已引入为艺人「${dup.name}」，请勿重复引入；如需调整可在该艺人详情里更换展示图`,
      }, 409);
    }
    const fake: Artist = {
      ...MOCK_ARTISTS[0],
      id: `mock-${Date.now()}`,
      name: req.name || avatar.name,
      type: kind,
      status: "active",
      avatar: "",
      bio: req.bio ?? "",
      dapAvatarId: avatar.id,
      dapDisplayRef: req.dapDisplayRef ?? null,
      dapAvatarName: avatar.name,
      dapDisplayImageUrl: resolveMockDisplayImage(avatar, req.dapDisplayRef ?? null),
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    } as Artist;
    mockImported.unshift(fake);
    return mockDelay({ ...fake });
  }
  return apiFetch<Artist>("/me/digital-ips/import-avatar", {
    method: "POST",
    body: req,
  });
}

/** 全量替换艺人（PUT） */
export async function updateArtist(id: ID, data: Partial<Artist>): Promise<Artist> {
  if (USE_MOCK) return mockDelay(mockPatch(id, data));
  return apiFetch<Artist>(`/me/digital-ips/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: data,
  });
}

/** 增量更新艺人（PATCH） */
export async function patchArtist(id: ID, data: Partial<Artist>): Promise<Artist> {
  if (USE_MOCK) return mockDelay(mockPatch(id, data));
  return apiFetch<Artist>(`/me/digital-ips/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: data,
  });
}

/** mock 版 patch：基于真实目标艺人合并；更换展示图时同步派生 dapDisplayImageUrl。 */
function mockPatch(id: ID, data: Partial<Artist>): Artist {
  const base = mockAll().find((a) => a.id === id) ?? MOCK_ARTISTS[0];
  const updated: Artist = { ...base, ...data, id } as Artist;
  if ("dapDisplayRef" in data && updated.dapAvatarId) {
    const avatar = MOCK_DAP_AVATARS.find((a) => a.id === updated.dapAvatarId);
    if (avatar) updated.dapDisplayImageUrl = resolveMockDisplayImage(avatar, data.dapDisplayRef ?? null);
  }
  const idx = mockImported.findIndex((a) => a.id === id);
  if (idx >= 0) mockImported[idx] = updated;
  return { ...updated };
}

/** 删除艺人 */
export async function deleteArtist(id: ID): Promise<void> {
  if (USE_MOCK) {
    const idx = mockImported.findIndex((a) => a.id === id);
    if (idx >= 0) mockImported.splice(idx, 1);
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/digital-ips/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
