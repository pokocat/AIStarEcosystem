// mocks/_handlers/film.ts — 影视业务 mock handlers（短剧 / 电影 / 广告 / 配音）。

import type { Drama, DramaStatus } from "@ai-star-eco/types/film";
import type { ID } from "@ai-star-eco/types/_shared";
import { ApiError, mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { DRAMAS, MOVIES, ADS, VOICE_WORKS } from "@/mocks/film";
import type { CreateDramaInput } from "@/api/film";

const dramaStore: Drama[] = DRAMAS.map((d) => ({ ...d }));

function notFound(id: ID): ApiError {
  return new ApiError({ code: "drama.not_found", message: `未找到剧集 ${id}` }, 404);
}

registerMocks([
  {
    method: "GET",
    pattern: "/film/dramas",
    handler: () => mockDelay(dramaStore.map((d) => ({ ...d }))),
  },
  {
    method: "GET",
    pattern: "/film/dramas/:id",
    handler: ({ params }) => {
      const found = dramaStore.find((d) => d.id === params.id);
      return mockDelay(found ? { ...found } : null);
    },
  },
  {
    method: "POST",
    pattern: "/film/dramas",
    handler: ({ body }) => {
      const input = body as CreateDramaInput;
      const drama: Drama = {
        id: `d-${Date.now()}`,
        title: input.title,
        genre: input.genre,
        episodes: input.episodes,
        role: input.role,
        status: input.status ?? "casting",
        views: 0,
        revenue: 0,
        rating: 0,
        releaseDate: input.releaseDate,
      };
      dramaStore.unshift(drama);
      return mockDelay({ ...drama });
    },
  },
  {
    method: "PATCH",
    pattern: "/film/dramas/:id/status",
    handler: ({ params, body }) => {
      const idx = dramaStore.findIndex((d) => d.id === params.id);
      if (idx < 0) throw notFound(params.id);
      const status = (body as { status: DramaStatus }).status;
      const updated: Drama = { ...dramaStore[idx]!, status };
      dramaStore[idx] = updated;
      return mockDelay({ ...updated });
    },
  },
  {
    method: "PATCH",
    pattern: "/film/dramas/:id",
    handler: ({ params, body }) => {
      const idx = dramaStore.findIndex((d) => d.id === params.id);
      if (idx < 0) throw notFound(params.id);
      const updated: Drama = { ...dramaStore[idx]!, ...(body as Partial<Drama>), id: params.id };
      dramaStore[idx] = updated;
      return mockDelay({ ...updated });
    },
  },
  {
    method: "DELETE",
    pattern: "/film/dramas/:id",
    handler: ({ params }) => {
      const idx = dramaStore.findIndex((d) => d.id === params.id);
      if (idx >= 0) dramaStore.splice(idx, 1);
      return mockDelay(undefined);
    },
  },
  { method: "GET", pattern: "/film/movies", handler: () => mockDelay(MOVIES) },
  { method: "GET", pattern: "/film/ads", handler: () => mockDelay(ADS) },
  { method: "GET", pattern: "/film/voice-works", handler: () => mockDelay(VOICE_WORKS) },
]);
