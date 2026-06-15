// 短剧官方配方 SOP · 共享映射层。
//
// 真值源 = data/drama-recipes/<id>/ bundle（recipe.json + source.json + cover.<ext>）。
// 运行期 seed 文件（apps/server/.../seed/*.json）是从 bundle 生成的派生物。
// 本模块只负责「bundle ↔ seed」双向映射与路径常量，不含 I/O 副作用以外的业务逻辑。
//
// 设计依据：AGENTS.md §4.7（资产真值是 OSS key，URL 派生）+ §8.0（生产禁静默降级）。
// 视频不在本地下载/入库（见 SKILL.md），bundle 只记 preview 的 ossKey/publicUrl。

import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..", "..");

export const PATHS = {
  bundles: join(ROOT, "data", "drama-recipes"),
  seedOfficial: join(ROOT, "apps", "server", "src", "main", "resources", "seed", "drama-recipes-official.json"),
  seedVideos: join(ROOT, "apps", "server", "src", "main", "resources", "seed", "flova-skill-example-videos.json"),
  publicRecipes: join(ROOT, "apps", "web-drama", "public", "recipes"),
  flovaSkills: join(ROOT, "resources", "downloads", "all_skills_by_id"),
};

export const SCHEMA_VERSION = 1;

// ── I/O helpers ──────────────────────────────────────────────────────────────
export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const writeJson = (p, v) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};
export const exists = existsSync;

export function listBundleIds() {
  if (!existsSync(PATHS.bundles)) return [];
  return readdirSync(PATHS.bundles, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => existsSync(join(PATHS.bundles, id, "recipe.json")))
    .sort();
}
export const bundleDir = (id) => join(PATHS.bundles, id);
export const readBundle = (id) => readJson(join(bundleDir(id), "recipe.json"));

/** 把一个 public/recipes 相对路径（如 /recipes/home/x.jpg）的封面文件拷进 bundle，返回 bundle 内文件名。 */
export function importCoverIntoBundle(id, publicFallback) {
  if (!publicFallback) return null;
  const rel = publicFallback.replace(/^\/recipes\//, "");
  const src = join(PATHS.publicRecipes, rel);
  if (!existsSync(src)) return null;
  const ext = extname(src) || ".webp";
  const localName = "cover" + ext;
  mkdirSync(bundleDir(id), { recursive: true });
  copyFileSync(src, join(bundleDir(id), localName));
  return localName;
}

/** build 时把 bundle 封面拷回 public/recipes（按 publicFallback 还原路径）。返回是否拷贝。 */
export function exportCoverToPublic(id, recipe) {
  const local = recipe?.assets?.cover?.local;
  const fallback = recipe?.assets?.cover?.publicFallback;
  if (!local || !fallback) return false;
  const src = join(bundleDir(id), local);
  if (!existsSync(src)) return false;
  const dst = join(PATHS.publicRecipes, fallback.replace(/^\/recipes\//, ""));
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  return true;
}

// ── seed → bundle（回填 / prep 共用） ────────────────────────────────────────
export function bundleFromSeed(entry, videoMeta, nowIso, distillMeta) {
  const skillId = entry.skillId || null;
  const preview =
    entry.previewVideo || videoMeta
      ? {
          logicalKey: entry.previewVideo || null,
          ossKey: videoMeta?.example_video_cdn_key || null,
          publicUrl: videoMeta?.example_video_public_url || null,
          durationSec: videoMeta?.duration_sec ?? null,
          width: videoMeta?.width ?? null,
          height: videoMeta?.height ?? null,
          bytes: videoMeta?.bytes ?? null,
          contentType: videoMeta?.content_type ?? null,
        }
      : null;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: entry.id,
    origin: entry.origin || "official",
    status: entry.status || "published",
    source: {
      provider: skillId ? "flova" : "manual",
      skillId,
      skillName: videoMeta?.skill_name ?? null,
      description: videoMeta?.description ?? null,
      skillDescription: videoMeta?.skill_description ?? null,
      url: skillId ? `https://www.flova.ai/zh-CN/skill/${skillId}` : null,
    },
    meta: {
      title: entry.title ?? "",
      summary: entry.summary ?? "",
      typeKey: entry.typeKey ?? "style",
      type: entry.type ?? "风格短片",
      ratio: entry.ratio ?? "9:16",
      episodes: entry.episodes ?? 1,
      coverFrom: entry.coverFrom ?? "#7c3aed",
      coverTo: entry.coverTo ?? "#ec4899",
    },
    payload: entry.payload ?? { mainline: "", beats: [], characters: [], hooks: [], notes: "" },
    assets: {
      cover: { local: null, publicFallback: entry.coverImage || null, ossKey: entry.coverImageCdnKey || null },
      preview,
    },
    distill: distillMeta || {
      method: "backfill",
      model: null,
      promptVersion: "drama.recipe_extract@v1",
      at: nowIso,
      reviewed: true,
    },
  };
}

// ── bundle → seed（build-seed 用） ──────────────────────────────────────────
/** 生成 drama-recipes-official.json 的一条。null 字段按原 seed 习惯省略（manual 无 skillId/previewVideo）。 */
export function officialEntryFromBundle(r) {
  const e = {};
  e.id = r.id;
  if (r.source?.skillId) e.skillId = r.source.skillId;
  e.title = r.meta.title;
  e.summary = r.meta.summary;
  e.typeKey = r.meta.typeKey;
  e.type = r.meta.type;
  e.ratio = r.meta.ratio;
  e.episodes = r.meta.episodes;
  e.coverFrom = r.meta.coverFrom;
  e.coverTo = r.meta.coverTo;
  if (r.assets?.cover?.publicFallback) e.coverImage = r.assets.cover.publicFallback;
  if (r.assets?.preview?.logicalKey) e.previewVideo = r.assets.preview.logicalKey;
  e.payload = r.payload;
  if (r.assets?.cover?.ossKey) e.coverImageCdnKey = r.assets.cover.ossKey;
  return e;
}

/** 生成 flova-skill-example-videos.json 的一条（仅当 flova 且有视频资产）。否则 null。 */
export function videoMetaFromBundle(r) {
  const p = r.assets?.preview;
  if (r.source?.provider !== "flova" || !r.source?.skillId || !p || (!p.ossKey && !p.publicUrl)) return null;
  return {
    skill_id: r.source.skillId,
    skill_name: r.source.skillName ?? "",
    description: r.source.description ?? "",
    skill_description: r.source.skillDescription ?? "",
    example_video_cdn_key: p.ossKey ?? "",
    example_video_public_url: p.publicUrl ?? "",
    duration_sec: p.durationSec ?? null,
    width: p.width ?? null,
    height: p.height ?? null,
    bytes: p.bytes ?? null,
    content_type: p.contentType ?? null,
  };
}

// ── 校验 ─────────────────────────────────────────────────────────────────────
/** 稳定排序的深度规范化字符串，用于「往返一致性」比对（忽略键顺序与数组顺序差异，数组按 JSON 排序）。 */
export function canonical(v) {
  const norm = (x) => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === "object") {
      const o = {};
      for (const k of Object.keys(x).sort()) o[k] = norm(x[k]);
      return o;
    }
    return x;
  };
  return JSON.stringify(norm(v));
}
export const nowIso = () => new Date().toISOString();
