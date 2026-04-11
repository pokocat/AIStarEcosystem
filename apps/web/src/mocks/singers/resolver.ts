import type { Lang } from "@/types/app";
import type { SingerDetail } from "@/types/contracts/singers";
import { buildSingerWorkspace } from "@/mocks/singers/factory";

export function resolveSingerWorkspace(lang: Lang) {
  return buildSingerWorkspace(lang);
}

export function resolveCreatedSinger(lang: Lang): SingerDetail {
  const workspace = buildSingerWorkspace(lang);
  const base = workspace.singers[0];
  return {
    ...base,
    id: `draft-${Date.now()}`,
    name: lang === "zh" ? "新歌手" : "New Singer",
    style: lang === "zh" ? "未定义" : "Undefined",
    status: "draft",
    quality: "common",
    tags: ["new"],
    stats: { songs: 0, fans: 0, popularity: 0 }
  };
}
