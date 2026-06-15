# data/drama-recipes — 短剧官方配方真值源（bundle）

每个子目录是一条官方配方（recipe）的 **bundle**，是创意市场官方配方的**唯一真值源**。
运行期 seed（`apps/server/src/main/resources/seed/drama-recipes-official.json` +
`flova-skill-example-videos.json`）和 `apps/web-drama/public/recipes/**` 封面都是从这里
**生成的派生物**——不要手改派生物，改 bundle 后跑 `build-seed`。

完整流程 SOP 见 [`.claude/skills/drama-recipe-seed/SKILL.md`](../../.claude/skills/drama-recipe-seed/SKILL.md)。

## 目录形态

```
data/drama-recipes/<recipe-id>/
├── recipe.json     # 标准结构（见下）：来源 + 元数据 + 蒸馏 payload + 资源引用
├── source.json     # 原始内容存档（flova skill 原文；manual 手写可缺省）
└── cover.<ext>     # 封面资源文件（小，入 git）；视频不入库，只在 recipe.json 记 ossKey/url
```

`<recipe-id>` 约定：flova 来源 = `rcp-official-<skillId 前 12 位>`；手写 = `rcp-official-<语义名>`。

## recipe.json schema（schemaVersion: 1）

```jsonc
{
  "schemaVersion": 1,
  "id": "rcp-official-486a2483a403",
  "origin": "official",            // 入创意市场的官方内置
  "status": "published",
  "source": {
    "provider": "flova",           // flova | manual
    "skillId": "486a…",            // manual 为 null
    "skillName": "故事驱动型视频",   // 用于生成视频元数据
    "description": "…",
    "skillDescription": "…",
    "url": "https://www.flova.ai/zh-CN/skill/486a…"
  },
  "meta": {                         // → drama-recipes-official.json 的展示字段
    "title": "…", "summary": "…",
    "typeKey": "style", "type": "风格短片",
    "ratio": "9:16", "episodes": 1,
    "coverFrom": "#7c3aed", "coverTo": "#ec4899"
  },
  "payload": {                      // 蒸馏内容（DramaRecipe.payloadJson 真值）
    "mainline": "可迁移主线模板",
    "beats": [{ "no": 1, "hook": "钩子套路", "beat": "本集功能与情绪转折" }],
    "characters": [{ "role": "key", "archetype": "角色原型", "desc": "性格/弧线" }],
    "hooks": ["关键留扣手法"],
    "notes": "套用建议"
  },
  "assets": {
    "cover":   { "local": "cover.webp",
                 "publicFallback": "/recipes/486a….webp",            // dev 直出路径
                 "ossKey": "media/seed/drama/recipes/flova/486a….webp" },  // 生产 OSS 真值
    "preview": { "logicalKey": "seed/flova/skills/486a….mp4",        // seed 兜底逻辑 key
                 "ossKey": "media/seed/flova/skills/486a….mp4",
                 "publicUrl": "https://…/486a….mp4",                 // dev 可播放
                 "durationSec": null, "width": null, "height": null,
                 "bytes": null, "contentType": null }
    // 视频本仓库不下载；preview 只记引用，样片由外部流程产出后回填
  },
  "distill": {
    "method": "llm",               // llm | manual | skeleton | backfill
    "model": "…", "promptVersion": "drama.recipe_extract@v1",
    "at": "2026-…", "reviewed": true   // reviewed:true 后 prep 不再覆盖（除非 --force）
  }
}
```

## 改一条配方

改对应 `recipe.json` → `node scripts/drama-recipe/build-seed.mjs` → `--check` 自检 → 同一 commit 提交
bundle + 生成的 seed + public 封面。
