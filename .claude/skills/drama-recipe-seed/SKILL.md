---
name: drama-recipe-seed
description: 给短剧「创意市场」批量新增 / 维护官方配方（recipe）的标准流程。两段式：① 本地把来源素材（flova skill 等）蒸馏成标准 bundle（data/drama-recipes/，含原始内容+蒸馏内容+资源）；② 从 bundle 生成运行期 seed 文件 + 上 OSS。触发场景：新增官方短剧模板/配方、上传 skill、批量导入 flova skill、服务器迁移/全新部署重建配方 seed、修改某条官方配方内容或封面。
---

# 短剧官方配方 Seed SOP

> 背景见 AGENTS.md §「抽 skill 飞轮」、`DramaRecipeSeeder.java`、`DramaRecipeService` 蒸馏逻辑。
> 真值源是 **bundle**，运行期 seed 是派生物。视频**不在本仓库下载/入库**（见「资产上传」）。

## 心智模型

```
来源素材(flova skill / 手写)         真值源(入 git)                 运行期派生物(生成)
resources/downloads/all_skills_by_id ──prep──▶ data/drama-recipes/<id>/ ──build-seed──▶ seed/drama-recipes-official.json
                                              ├ recipe.json (meta+payload+资产引用)        seed/flova-skill-example-videos.json
                                              ├ source.json (原始内容存档)                 apps/web-drama/public/recipes/**(封面)
                                              └ cover.<ext> (封面资源)            ──上 OSS──▶ media/seed/drama/recipes/** + media/seed/flova/skills/**
```

- **bundle = 唯一真值源**，入 git，迁移/重装时它就是初始化依据。
- **build-seed 是确定性生成器**：seed 文件、public 封面都从 bundle 重算，不要手改这些派生物。
- 改一条配方 = 改它的 `recipe.json` → 跑 build-seed → 提交。

## 标准 bundle 结构

见 [`data/drama-recipes/README.md`](../../../data/drama-recipes/README.md)（schema 真值）。一条 = 一个目录：
`recipe.json`（schemaVersion/id/origin/source/meta/payload/assets/distill）、`source.json`（原文存档）、`cover.<ext>`。

## 流程 A — 新增/批量导入 flova skill

```bash
# 1) 蒸馏成 bundle（需 LLM 凭据，OpenAI 兼容）
export DRAMA_LLM_BASE_URL=...   # 如 https://api.openai.com/v1 或自建 gateway
export DRAMA_LLM_API_KEY=...
export DRAMA_LLM_MODEL=...
node scripts/drama-recipe/prep.mjs --skill <skillId>          # 单条
node scripts/drama-recipe/prep.mjs --all                       # 全部未建的 flova skill

#    没有 LLM 凭据时：先建空骨架（payload 留空，诚实不伪造），之后人工填
node scripts/drama-recipe/prep.mjs --skill <skillId> --no-distill

# 2) 人工校对 bundle/<id>/recipe.json：核对 meta（title/typeKey/type/ratio/episodes/封面色）
#    与 payload（mainline/beats/characters/hooks/notes）。满意后把 distill.reviewed 改成 true。
#    （reviewed:true 的 bundle，prep 默认不再覆盖，除非 --force。）

# 3) 生成运行期 seed + 回写封面
node scripts/drama-recipe/build-seed.mjs

# 4) 三端门 + 提交（bundle 与生成物同一个 commit）
node scripts/drama-recipe/build-seed.mjs --check     # 一致性自检
git add data/drama-recipes apps/server/src/main/resources/seed apps/web-drama/public/recipes
```

> flova skill 是「风格/工作流」型单集创意，`drama.recipe_extract` 提示词偏多集短剧；
> 若蒸馏效果不佳，可用 `--prompt <path>` 指定更贴合的提示词，或 `--no-distill` 后手写 payload。

## 流程 B — 手写一条官方配方（非 flova）

直接在 `data/drama-recipes/<id>/` 建 `recipe.json`（`source.provider:"manual"`，无 skillId），
放好 `cover.<ext>` 并在 `assets.cover` 写 `local`/`publicFallback`/`ossKey`；跑 build-seed。
（现有 9 条 `rcp-official-home-*` 即此形态，可作模板。）

## 资产上传（OSS）

- **封面**：build-seed 已把 bundle 封面回写到 `apps/web-drama/public/recipes/`（dev/本地直出）。
  生产再把这些文件按 `assets.cover.ossKey` 上 OSS（前缀 `media/seed/drama/recipes/...`）。
- **视频**：**本仓库不下载视频**。bundle 只在 `assets.preview` 记 `ossKey`/`publicUrl`/`logicalKey`。
  样片由「别的办法」产出后传到 `media/seed/flova/skills/<skillId>.mp4`，把 ossKey/publicUrl/
  时长宽高等回填进 `recipe.json` 的 `assets.preview` 再 build-seed。
- 上传命令用阿里云 ossutil（凭据见运维，勿写仓库）。合规：AGENTS.md §4.7（DB 真值是 key，URL 派生）。

## 迁移 / 全新部署

`data/drama-recipes/` 在 git 里 → `node scripts/drama-recipe/build-seed.mjs` 重生成 seed →
按 `assets.*.ossKey` 把封面/视频上 OSS → 启动 server，`DramaRecipeSeeder`（@Order 72）幂等 upsert。
统一、可复现，DB 零手工。

## 一次性回填（已执行，留档）

`node scripts/drama-recipe/backfill.mjs` 把当时的 28 条 seed 反向回填成 bundle，
使 bundle 成为真值源。已用 `build-seed --check` 验证往返无损。除非要重置 bundle，不要再跑。

## 注意

- **不要手改** `seed/*.json` 或 `public/recipes/*` —— 它们是派生物，下次 build-seed 会覆盖。改 bundle。
- build-seed 按 id 排序输出（确定性）；与历史手工顺序不同属正常。
- §8.0：prep 缺 LLM 凭据时产出**空 payload 骨架**（诚实留空），绝不伪造蒸馏结果。
