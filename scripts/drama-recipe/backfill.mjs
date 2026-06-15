#!/usr/bin/env node
// 一次性：把现有运行期 seed（drama-recipes-official.json + flova-skill-example-videos.json）
// 回填成 data/drama-recipes/<id>/ bundle，让 bundle 成为唯一真值源。
// 幂等：重复跑会以当前 seed 覆盖 bundle 的 recipe.json（保留已存在封面文件）。
// 用法：node scripts/drama-recipe/backfill.mjs

import {
  PATHS, readJson, writeJson, bundleDir, bundleFromSeed, importCoverIntoBundle, exists, nowIso,
} from "./_lib.mjs";
import { join } from "node:path";

const official = readJson(PATHS.seedOfficial);
const videos = exists(PATHS.seedVideos) ? readJson(PATHS.seedVideos) : [];
const videoBySkill = new Map(videos.map((v) => [v.skill_id, v]));

const at = nowIso();
let n = 0, covers = 0, missing = 0;
for (const entry of official) {
  const videoMeta = entry.skillId ? videoBySkill.get(entry.skillId) || null : null;
  const recipe = bundleFromSeed(entry, videoMeta, at);
  const local = importCoverIntoBundle(entry.id, recipe.assets.cover.publicFallback);
  if (local) { recipe.assets.cover.local = local; covers++; }
  else if (recipe.assets.cover.publicFallback) { missing++; console.warn(`  ⚠ 封面缺失（未拷贝）：${entry.id} ← ${recipe.assets.cover.publicFallback}`); }
  writeJson(join(bundleDir(entry.id), "recipe.json"), recipe);
  // 原始内容存档：flova skill 原文（若本地有）
  if (entry.skillId) {
    const srcFile = join(PATHS.flovaSkills, `${entry.skillId}.json`);
    if (exists(srcFile)) writeJson(join(bundleDir(entry.id), "source.json"), readJson(srcFile));
  }
  n++;
}
console.log(`✓ 回填完成：${n} 条 bundle（封面拷贝 ${covers}，封面缺失 ${missing}）→ ${PATHS.bundles}`);
