#!/usr/bin/env node
// 发布：扫 data/drama-recipes/* bundle → 重新生成运行期 seed 文件 + 回写封面到 public。
//   - apps/server/.../seed/drama-recipes-official.json
//   - apps/server/.../seed/flova-skill-example-videos.json
//   - apps/web-drama/public/recipes/**（封面从 bundle 还原）
// 确定性：按 id 排序输出。视频不下载，只透传 bundle 里记录的 ossKey/publicUrl。
// 用法：
//   node scripts/drama-recipe/build-seed.mjs           # 生成 + 写盘
//   node scripts/drama-recipe/build-seed.mjs --check    # 只校验「bundle→seed」与现有 seed 一致，不写盘（CI 门）

import {
  PATHS, readJson, writeJson, listBundleIds, readBundle, exists,
  officialEntryFromBundle, videoMetaFromBundle, exportCoverToPublic, canonical,
} from "./_lib.mjs";

const check = process.argv.includes("--check");

const ids = listBundleIds();
if (ids.length === 0) {
  console.error("✗ 没有 bundle。先跑 backfill.mjs 或 prep.mjs。");
  process.exit(1);
}

const official = [];
const videos = [];
let coverWrites = 0;
for (const id of ids) {
  const r = readBundle(id);
  official.push(officialEntryFromBundle(r));
  const vm = videoMetaFromBundle(r);
  if (vm) videos.push(vm);
  if (!check) { if (exportCoverToPublic(id, r)) coverWrites++; }
}
official.sort((a, b) => a.id.localeCompare(b.id));
videos.sort((a, b) => a.skill_id.localeCompare(b.skill_id));

if (check) {
  const curOfficial = exists(PATHS.seedOfficial) ? readJson(PATHS.seedOfficial) : [];
  const curVideos = exists(PATHS.seedVideos) ? readJson(PATHS.seedVideos) : [];
  const mismatches = [];
  const byId = (arr, k) => new Map(arr.map((x) => [x[k], x]));
  const cmp = (label, gen, cur, key) => {
    const g = byId(gen, key), c = byId(cur, key);
    for (const [k, v] of g) if (!c.has(k)) mismatches.push(`${label}: 新增 ${k}`);
    for (const [k, v] of c) if (!g.has(k)) mismatches.push(`${label}: 缺失 ${k}`);
    for (const [k, v] of g) if (c.has(k) && canonical(v) !== canonical(c.get(k))) mismatches.push(`${label}: 内容不一致 ${k}`);
  };
  cmp("official", official, curOfficial, "id");
  cmp("videos", videos, curVideos, "skill_id");
  if (mismatches.length) {
    console.error(`✗ build-seed --check 失败（${mismatches.length}）：\n  ` + mismatches.join("\n  "));
    process.exit(1);
  }
  console.log(`✓ build-seed --check 通过：${official.length} 条配方 / ${videos.length} 条视频元数据 与现有 seed 一致`);
  process.exit(0);
}

writeJson(PATHS.seedOfficial, official);
writeJson(PATHS.seedVideos, videos);
console.log(`✓ 生成 seed：${official.length} 条配方 → drama-recipes-official.json`);
console.log(`✓ 生成 seed：${videos.length} 条视频元数据 → flova-skill-example-videos.json`);
console.log(`✓ 回写封面：${coverWrites} 张 → ${PATHS.publicRecipes}`);
console.log(`提示：封面/视频上 OSS 走单独上传流程（见 SKILL.md「资产上传」）。重启 server 后 DramaRecipeSeeder 幂等 upsert 生效。`);
