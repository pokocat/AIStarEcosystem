// mocks/_handlers/artists.ts — 艺人领域 mock handlers。

import type { Artist } from "@ai-star-eco/types/artist";
import type { ID } from "@ai-star-eco/types/_shared";
import { ApiError, mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { MOCK_ARTISTS } from "@/mocks/artists";
import { MOCK_DAP_AVATARS } from "@/mocks/dap-avatars";

const store: Artist[] = MOCK_ARTISTS.map((a) => JSON.parse(JSON.stringify(a)));

function notFound(id: ID): ApiError {
  return new ApiError({ code: "drama.not_found", message: `未找到艺人 ${id}` }, 404);
}

function applyPatch(id: ID, patch: Partial<Artist>): Artist {
  const idx = store.findIndex((a) => a.id === id);
  if (idx < 0) throw notFound(id);
  const updated: Artist = { ...store[idx]!, ...patch, id } as Artist;
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
      const seed = store[0]!;
      const now = new Date().toISOString();
      const artist: Artist = {
        ...seed,
        id: `art-${Date.now()}`,
        name: req.name?.trim() || avatar.name,
        type: req.type ?? "actor",
        status: "active",
        avatar: "",
        dapAvatarId: avatar.id,
        dapDisplayRef: req.dapDisplayRef ?? null,
        dapAvatarName: avatar.name,
        dapDisplayImageUrl: avatar.imageUrl,
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
