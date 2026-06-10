// mocks/_handlers/artists.ts — 艺人领域 mock handlers。

import type { Artist } from "@ai-star-eco/types/artist";
import type { ID } from "@ai-star-eco/types/_shared";
import { ApiError, mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { MOCK_ARTISTS } from "@/mocks/artists";
import { MOCK_DAP_AVATARS, MOCK_DAP_DERIVS, MOCK_DAP_LOOKS } from "@/mocks/dap-avatars";
import type { DapAvatarLite } from "@/api/dap-avatars";

const store: Artist[] = MOCK_ARTISTS.map((a) => JSON.parse(JSON.stringify(a)));

function notFound(id: ID): ApiError {
  return new ApiError({ code: "drama.not_found", message: `未找到艺人 ${id}` }, 404);
}

/** mock 版展示图解析：ref → 资产 URL，未命中回退定妆照（镜像 server DapAvatarRefResolver）。 */
function resolveMockDisplayImage(avatar: DapAvatarLite, ref: string | null): string | null {
  if (ref) {
    if (ref.startsWith("look:")) {
      const l = MOCK_DAP_LOOKS.find((x) => x.id === ref.slice(5));
      if (l?.imageUrl) return l.imageUrl;
    } else if (ref.startsWith("deriv:")) {
      const d = MOCK_DAP_DERIVS.find((x) => x.id === ref.slice(6));
      const url = d?.fileUrl || d?.thumbUrl;
      if (url) return url;
    } else if (ref.startsWith("variant:")) {
      const url = (avatar.variantImages ?? [])[Number(ref.slice(8))];
      if (url) return url;
    } else if (ref.startsWith("shot:")) {
      const url = avatar.shotImages?.[ref.slice(5)];
      if (url) return url;
    }
  }
  return avatar.imageUrl ?? null;
}

function applyPatch(id: ID, patch: Partial<Artist>): Artist {
  const idx = store.findIndex((a) => a.id === id);
  if (idx < 0) throw notFound(id);
  const updated: Artist = { ...store[idx]!, ...patch, id } as Artist;
  // 更换展示图：同步派生 dapDisplayImageUrl（镜像 server 行为）
  if ("dapDisplayRef" in patch && updated.dapAvatarId) {
    const avatar = MOCK_DAP_AVATARS.find((a) => a.id === updated.dapAvatarId);
    if (avatar) updated.dapDisplayImageUrl = resolveMockDisplayImage(avatar, patch.dapDisplayRef ?? null);
  }
  store[idx] = updated;
  return updated;
}

registerMocks([
  {
    method: "GET",
    pattern: "/me/digital-ips",
    handler: () => mockDelay(store.map((a) => ({ ...a }))),
  },
  {
    method: "GET",
    pattern: "/me/digital-ips/:id",
    handler: ({ params }) => {
      const found = store.find((a) => a.id === params.id);
      return mockDelay(found ? { ...found } : null);
    },
  },
  {
    method: "POST",
    pattern: "/me/digital-ips",
    handler: ({ body }) => {
      const data = (body ?? {}) as Partial<Artist>;
      const seed = store[0]!;
      const now = new Date().toISOString();
      const artist: Artist = {
        ...seed,
        ...data,
        id: data.id ?? `art-${Date.now()}`,
        stats: { ...seed.stats, ...(data.stats ?? {}) },
        talents: { ...seed.talents, ...(data.talents ?? {}) },
        createdAt: now,
        lastActive: now,
      } as Artist;
      store.unshift(artist);
      return mockDelay({ ...artist });
    },
  },
  {
    method: "POST",
    pattern: "/me/digital-ips/import-avatar",
    handler: ({ body }) => {
      const req = (body ?? {}) as { dapAvatarId?: string; type?: Artist["type"]; name?: string; dapDisplayRef?: string | null };
      const avatar = MOCK_DAP_AVATARS.find((a) => a.id === req.dapAvatarId);
      if (!avatar) throw new ApiError({ code: "DAP_AVATAR_NOT_FOUND", message: "数字人不存在或无权访问" }, 404);
      const kind = req.type ?? "actor";
      const dup = store.find((a) => a.dapAvatarId === avatar.id && a.type === kind);
      if (dup) {
        throw new ApiError({
          code: "DAP_AVATAR_ALREADY_IMPORTED",
          message: `该数字人已引入为艺人「${dup.name}」，请勿重复引入；如需调整可在该艺人详情里更换展示图`,
        }, 409);
      }
      const seed = store[0]!;
      const now = new Date().toISOString();
      const artist: Artist = {
        ...seed,
        id: `art-${Date.now()}`,
        name: req.name?.trim() || avatar.name,
        type: kind,
        status: "active",
        avatar: "",
        bio: "",
        dapAvatarId: avatar.id,
        dapDisplayRef: req.dapDisplayRef ?? null,
        dapAvatarName: avatar.name,
        dapDisplayImageUrl: resolveMockDisplayImage(avatar, req.dapDisplayRef ?? null),
        createdAt: now,
        lastActive: now,
      } as Artist;
      store.unshift(artist);
      return mockDelay({ ...artist });
    },
  },
  {
    method: "PUT",
    pattern: "/me/digital-ips/:id",
    handler: ({ params, body }) => mockDelay({ ...applyPatch(params.id, (body ?? {}) as Partial<Artist>) }),
  },
  {
    method: "PATCH",
    pattern: "/me/digital-ips/:id",
    handler: ({ params, body }) => mockDelay({ ...applyPatch(params.id, (body ?? {}) as Partial<Artist>) }),
  },
  {
    method: "DELETE",
    pattern: "/me/digital-ips/:id",
    handler: ({ params }) => {
      const idx = store.findIndex((a) => a.id === params.id);
      if (idx >= 0) store.splice(idx, 1);
      return mockDelay(undefined);
    },
  },
]);
