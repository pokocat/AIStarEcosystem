# 短剧分镜一致性优化方案（借鉴 ViMax）

> last-reviewed：2026-07-10 / v0.102 一致性引擎 C-3：参考图装配从前端下沉服务端（见下「C-3 更新」）
> 2026-06-30 / v0.98 工作台收敛为「剧集脚本分镜表 = 唯一逐镜工作面」（删视频工厂阶段，6→5 阶段）
> v0.97 P0/P1/P2 全量落地（镜间承接 + 场景绑定 + 机位/电影语言 prompt + seedance 首尾帧双关键帧 + return_last_frame 链式承接闭环 + decompose 节点）

## C-3 更新（2026-07-10，v0.102）：参考图装配下沉服务端

> 一致性引擎 L1（真源 [`[Fabel5]drama-consistency-engine-design.md`](./%5BFabel5%5Ddrama-consistency-engine-design.md) §5）。**本文下方 v0.97/v0.98 关于前端 `shotRefImages` / `sceneRefUrlFor` / `prevFrameInScene` / `nextFrameInScene` 在 `epscript.tsx` 里拼 `ref_images` 的描述已过时**——那套参考图优先级链已整体移到服务端。

- **前端不再拼 `ref_images`**：render 只传镜头坐标 `shot_ref{project_id,episode_no,scene_id,shot_id,chain_consistency}`；新服务 `DramaReferenceAssembler` 按 `payloadJson` + `drama_character`/`drama_scene` 实体（C-2）自装配角色参考（@cast→文本名→全员，front 优先）+ 场景参考（显式 sceneRefId→名称兜底）+ 同场上一镜真实末帧（文档优先 + `MaterialVideoJob.lastFrameCdnKey` 权威回退）+ 同场下一镜首帧（clip 尾帧）。
- **按端点 capability 裁剪 + 回报**：D-11 candidate 的 `maxRefImages`（全 null→保守默认 1）裁剪，优先级保 identity（character>scene>prev，末位先砍），`applied_refs.items[].role` 为精确槽位；本地 `/cdn` 标 `local_unfetchable`（如实回报，§8.0）。
- **过渡兼容**：`ref_slots`（短视频线显式主角/场景槽位，因 `DramaShort` 草稿无项目实体）> `ref_images`（老前端数组直通）仍受支持，优先级 `shot_ref > ref_slots > ref_images`。
- **前端共享 hook**：真实的 `apps/web-drama/src/lib/use-shot-render.ts`（工作台分镜表 + 短视频工坊两线共用），封装 shot_ref/ref_slots 打包 + 提交 + 轮询 + 出片模型选择。`epscript` 一致性体检（`sceneHasRef` 场景绑定预判、上一镜是否出片）仍在前端（纯 UI 提示，不下沉）。

## v0.98 结构收敛（方案 B）

用户决策：逐镜出片全在**剧集脚本分镜表**内完成，删独立「视频工厂」阶段（项目 6→5 阶段）。
- 强渲染逻辑抽成 `use-shot-render.ts`（供参考/复用），最终由 `epscript.tsx` 承载：出图 4 版挑选、角色+场景+镜间承接参考图、首尾帧、AI 拆镜（首帧▷末帧双联 + hover 预演）、镜间一致性开关。
- 删 `stages/factory.tsx` + `FactoryDrawer` + `use-shot-render` 消费方（factory）；`stages-config` 去 factory，成片合成前移。
- P1：epscript 不再 lock，脚本始终可编辑（`保存·去成片合成`）。
- P5：删左下 `ai-chat-panel` 浮窗 → 行级 Wand2 就地改写本镜（`/shot/rewrite` + `drama.shot_rewrite`）。
- P6：短视频面包屑按 pathname 派生 + beat 改 AI 逐镜生成。
- P4：假模型下拉随工厂删除已消失；真·多模型选择拆独立 PR（TODO D-11，改共享 `AiAppBinding`）。

## v0.98 补丁 · 场景参考图专用提示词（2026-07-01）

问题：「角色与场景」里生成场景参考图效果很怪、不符剧集脚本取景。根因——`genSceneRef` 误用
`kind:"shot"` → 命中人物分镜首帧提示词 `drama.frame_image`（含景别/运镜/Keep faces consistent），
出「空场景底图」时塞人脸/按分镜构图，且 `{{scene}}` 无占位符被忽略、无作品风格、ratio 用了 16:9。
调研确认 ViMax 亦无「专用场景底图」范式（其环境一致性是被动复用上一时间线帧）。

修：新增 `drama.scene_frame_image`（干净空景 establishing plate，无人物，匹配 place+mood+作品风格）；
`renderFrame` 加 `kind:"scene"`（`buildMediaPrompt` 第 4 参 sceneKey）；前端 `genSceneRef` 传
`kind:"scene"` + 作品风格 + 项目画幅（`data.projectInfo.ratio`）。

## v0.98 补丁 · 场景设定持久化 + 分镜表显式绑定场景参考（2026-07-01）

生产实测两处硬伤：
1. **场景 AI 出图/上传后刷新丢失**：根因是场景回写走陈旧闭包 `ctx.saveData({...data, scenes})`，
   被并发/后续保存覆盖。修：`StageContext` 加 `patchData(prev => next)`（page 用 `dataRef` 取最新
   data 做函数式合并）；cast 场景增删改/出图/上传全改走 `patchData`，异步结果并入最新 data 不丢。
2. **场景参考进不了分镜首帧**：删视频工厂后仅剩「按场名匹配」这一条隐式链，用户上传/AI 生成的场景
   图在分镜表里无处可选 → 一致性断链。修：`ScriptScene.sceneRefId` 显式绑定；分镜表场景头加
   「场景参考」下拉（复用 `onUpdScene` 写 `sceneRefId` + 缩略图 + 「未出图」提示），随脚本落库；
   `sceneRefUrlFor` 改「显式 sceneRefId 优先 → 场名匹配兜底」，喂进该场各镜首帧 `ref_images`。

## v0.98 补丁 · 画面内容 @提及人物 chip + 人物一致性（2026-07-01）

借鉴 ViMax「角色参考复用」把人物一致性打通成一条显式链：
1. **画面内容 = @提及富文本**（新 `character-mention-input.tsx`，基于 `@tiptap/extension-mention`）：
   输入 `@` 弹本集角色 → 选中成内联 chip（如 `@苏娜`）。内联 chip 即本镜出场人物 → 写入
   `shot.cast`。存储：`shot.visual` 存渲染文本（chip 序列化「@名字」可回读重建）、`shot.cast` 存 id。
2. **首帧喂角色参考图锁脸**：`shotRefImages` 改「`@提及 cast` 优先 → 画面文本按角色名兜底匹配
   → 本集全体」；取 `character.avatarImage`(数字人) / `refUrl`(定妆图) 并入 `ref_images`。
3. **角色定妆参考图（两种都支持）**：cast 卡新增「AI 定妆图」（新 prompt `drama.character_frame_image`
   + `renderFrame kind:"character"`，单人肖像锁脸）+ 既有「绑数字人 / 上传」。有图才谈得上锁脸。
4. `buildMediaPrompt` 重构为 `frameKeyForKind(kind)` 统一按 kind 选提示词（shot/short/scene/character）。

## v0.98 补丁 · 修「重新部署后图片全裂」（签名 URL 过期）（2026-07-01）

根因：`DramaProject.payloadJson` 里存的是**当时签名的 OSS URL**（首帧/末帧/成片/场景图/角色图），
`AEP_CDN_SIGNED_URL_STRATEGY=oss` + `TTL=3600s`，`saveProject` 原样存、`getProject` 原样返回 →
**1h 后签名过期 → 403 图裂**（重新部署是巧合，非诱因）。违反 §4.7「key 真值 / 出 wire 派生」。
修：`DramaProjectService` 注入 `CdnUrlSigner`，`toDetail` 出 wire 时递归 `signer.maybeSign(...)`
重签文档内所有资产 URL（`resignAssetUrls`，从 URL 抽 key 重签，对已过期 URL 亦有效）；driver=local
相对 `/cdn` 不匹配 OSS base 原样返回，dev 不受影响。规范已写入 AGENTS §4.7.7。
**同类债待清**：`DramaShort.payloadJson`（短视频草稿）存签名 URL 同样会过期 —— 见 TODO D-12。
> 真源：本文件是「一集多分镜视频一致性」专题的工程设计真源。
> 关联代码：`apps/web-drama/src/components/drama-workshop/stages/factory.tsx`、
> `apps/server/.../service/DramaRenderService.java`、
> `apps/server/.../service/materialvideo/MaterialVideoModelClient.java`。

## 0. 背景与目标

短剧工作台「视频工厂」里，一集由多个分镜（shot）逐镜出片再拼接。当前痛点：**同一集的多个分镜视频之间，人物形象 / 场景环境 / 光线构图 不稳定**——同一个角色在镜 1 和镜 5 可能脸不一样，同一间屋子换了陈设。

参考 [HKUDS/ViMax](https://github.com/HKUDS/ViMax)。ViMax 的核心结论：**一致性主要靠视觉生成层（参考图复用 + 关键帧锚定 + 镜间链式参考 + 一致性校验），不是靠 storyboard 文本 prompt**。它的 `storyboard_artist.py`（剧本→分镜、分镜→首末帧/运动）只是上游喂料，一致性贡献最小的一环。

原始借鉴方案（"搬 prompt + schema 不搬代码"）方向对，但：
1. 把一致性押在了 storyboard 文本上——而我们的短板在视觉层；
2. 它的"节点 1"（design_storyboard）在本仓**已存在**（`epscript` + `split_scene`），应增强而非新增；
3. 它的"节点 2"（decompose 出末帧 + 变化等级）只有在**首尾帧双关键帧视频**时才有用。

本方案据此重排为 P0/P1/P2，按 ROI 排序。

## 1. ViMax 借鉴点 × 本仓现状对照

| ViMax 能力 | 一致性贡献 | 本仓现状 | 结论 |
|---|---|---|---|
| 角色 static/dynamic features 进 prompt | 中 | `CharacterDef.cast` 已有静态特征；`shotVars.castClause` 只传角色名 | 增强：把 cast 特征也喂进 prompt |
| 角色参考图复用（identity） | **高** | ✅ `shotRefImages()` 把角色 avatarImage/refUrl 经 `extra_body.image` 喂出图模型 | 已具备 |
| Intelligent Reference Image Selection（取上一时间线的帧） | **高** | ❌ 无镜间承接 | **P0** |
| 环境/场景一致性 | **高** | `ProjectData.scenes` 有 name/mood/参考图，但分镜不引用 | **P0** |
| First/Last-Frame→Video 双关键帧 | **高** | ❌ 视频只传单首帧（且仅 AGNES 协议；GENERIC 连首帧都没传） | **P2** |
| 机位复用（cam_idx，少开新机位） | 中 | ❌ 无机位概念 | **P1** |
| 镜头分解（ff/lf/motion + variation_type） | 中（依赖双关键帧） | ❌ 无 | **P2** |
| 一致性自检（best-of-N + VLM 选最一致） | 中 | 出 4 版首帧人工挑选 | 暂不做（人工挑选已覆盖大半） |
| JSON 解析兜底 / 重试 | 工程健壮性 | ✅ `MaterialAiService.extractJson` + 重试一次 | 已具备，复用 |
| 角色索引越界校验 | 工程健壮性 | 本仓用 `cast[]`（角色 id），做 id 存在性校验即可，比 idx 更稳 | 复用现有 |

## 2. 一致性杠杆分层

```
┌── 文本层（storyboard prompt）──────────────── 贡献最小（P1）
│   epscript / split_scene 产出更克制的分镜描述 + 机位复用 + 角色特征
├── 图像层（首帧出图，ref_images）────────────── 贡献最大、改动最小（P0）
│   ① 角色参考图（已有） ② 镜间承接：上一镜帧（P0） ③ 场景参考图（P0）
└── 视频层（出片，关键帧 i2v）──────────────────── 贡献最大、改动最重（P2）
    首帧 i2v（已有，限 AGNES）→ seedance 首+尾帧双关键帧 + return_last_frame 链式承接
```

关键：**图像层的 `ref_images` 管道已端到端打通**（前端 `shotRefImages` → `/render/frame-jobs` body `ref_images` → `DramaRenderService.callImageModel` → `extra_body.image`，见 `DramaRenderService.java:194`）。所以 P0 只需在前端往这个数组里多塞 URL，**零后端、零契约、零迁移**。

## 3. P0 — 图像层一致性（feasible today，已落地镜间承接）

### 3.1 镜间承接（shot-to-shot reference chaining）✅ 已落地

**动机**：同场连续镜头共享构图 / 光线 / 人物位置。对应 ViMax「取上一时间线帧作参考」。

**实现**（纯前端，`factory.tsx`）：
- 新增 `chainConsistency` 开关（生成设置栏，默认开）。
- `prevSceneFrame(s)`：在有序 `shots` 里向前找**同场**（`sceneId` 相同）最近一个已出首帧的镜头，取其 `frameUrl`（锁定优先）/ `frameUrls[frameIdx]`。跨场不承接（场切应换环境）。
- `shotRefImages(s)`：角色参考图（identity 优先）+ 场景参考图 + 上一镜帧，去重后 `slice(0, 6)`（防超出图像模型入参上限）。
- 开关关闭 → 退回原行为（仅角色参考图）。

**边界**：批量出首帧时前序镜可能尚无帧 → 承接为 best-effort（仅对"前序已锁/已出"的镜头生效）。单镜「锁定→下一镜」的常见流里效果最佳。

**风险**：盲目承接每个连续镜可能降低镜头多样性（该切的没切）。缓解：① 仅同场承接；② 提供开关；③ P1 机位概念 + P2 variation_type 后可更精细控制"该不该承接"。

**改动文件**：`apps/web-drama/src/components/drama-workshop/stages/factory.tsx`（唯一）。无后端 / openapi / 迁移。

### 3.2 场景参考图自动并入 ✅ 已落地

**动机**：跨集 / 同场统一取景地环境。用户已在「短剧设定 · 角色与场景」为 `SceneAsset` 生成 / 上传参考图，但分镜出图没用上。

**实现**（纯前端，`factory.tsx` `build()`）：
- 按名称匹配把 `ScriptScene.place` 与 `ProjectData.scenes[].name` 关联（`place.includes(name)` 且 `name.length≥2`），命中且有 `refUrl` → 作为 `FactoryShot.sceneRefUrl`。
- `sceneRefUrl` 并入 `shotRefImages`（受同一 `chainConsistency` 开关控制）。
- 名称匹配是 best-effort，只"多加一张参考图"，不命中也不影响。

**后续可选（P1）**：把模糊匹配升级为显式绑定——给 `BoardScene` 加 `sceneRefId?: string` + 在分镜表场景头加场景选择器。需契约/文档同步，留待 review 定 UI。

### 3.3 P0 验收
- `pnpm --filter @ai-star-eco/web-drama typecheck` + `build` 绿。
- 真机：同场镜 2 锁定后，镜 3 出图人物/环境与镜 2 明显更接近；关开关后退回原状。

## 4. P1 — 文本层增强（storyboard prompt）

> 借鉴 ViMax storyboard system prompt 的电影语言规则，但**增强现有 `epscript`/`split_scene`，不新增节点**。

### 4.1 prompt 增强（`drama.epscript.md` / `drama.split_scene.md`）
补入硬性要求（admin 可再调）：
- 每镜明确叙事目的（建场 / 表现关系 / 突出反应），不写无意义过场（已有"必须推动冲突"，强化）。
- **机位复用**：景别/角度差异大才开新机位；同机位连续镜复用。
- 画面**位置**（左 / 中 / 右）写进 `desc`。
- 角色名与 `cast` 列表一致（本仓 `line.who` / 角色名已统一，强化"勿用真实公众人物"）。
- 每角色每镜最多一句台词（`line` 已是单条，强化）。

### 4.2 机位字段
- `BoardShot` 加 `camId?: string`（机位标识，载体）。
- `epscript`/`split_scene` 输出 schema 的 shot 加 `camId`（同机位复用同值）。
- `normalizeShot()`（`DramaProjectService`）透传 `camId`。
- 出图/出片时同 `camId` 的镜头可优先复用彼此首帧（与 P0 承接联动）。

**改动**：2 个 prompt md + `BoardShot` 类型 + `normalizeShot` + epscript/split_scene 的 JSON 模板。**契约/文档需同步**（§7）。

## 5. P2 — 视频层关键帧 i2v（首+尾帧 + 链式承接）

> 用户已确认 seedance 支持首尾帧；下游模型不支持则"传入不生效"也无害。

### 5.1 镜头分解节点 `drama.decompose`（借鉴 ViMax 节点 2）
新增 prompt key `drama.decompose`（resource md + admin 可配 + §8.0），输入单镜 `desc` + 角色特征，输出：

```json
{
  "ff_desc": "首帧静态快照（无进行中动作）",
  "ff_cast": ["角色id…"],
  "lf_desc": "末帧静态快照",
  "lf_cast": ["角色id…"],
  "motion_desc": "摄像机运动 + 画面内运动（用外貌指代角色，不用角色名）",
  "variation_type": "small|medium|large",
  "variation_reason": "为何此变化等级"
}
```
- 校验：`ff_cast`/`lf_cast` 做**角色 id 存在性校验**（不是 ViMax 的 idx 越界），非法触发重试（复用 `MaterialAiService` 重试）。
- 计费：新增 `drama.credit.decompose`（`DramaConfigSeeder`），hold→commit，§8.0 未配置 prompt → 503 不扣费。

### 5.2 首帧 / 末帧两张图
- `renderFrame` 已能出图；末帧复用同链路（`ff_desc` 出首帧、`lf_desc` 出末帧）。
- 末帧出图同样并入 `ref_images`（角色 + 首帧 → 末帧，保证首末帧自身一致）。

### 5.3 视频客户端加 seedance 协议（首+尾帧）
**当前 `MaterialVideoModelClient.buildSubmitBody`**：仅 AGNES 传单 `image`；**GENERIC 不传任何图**（`MaterialVideoModelClient.java:334-352`）。seedance 走 `protocolFor` 会落到 GENERIC——**所以现在 seedance 连首帧都没传，必须补协议**。

新增 `PROTOCOL_SEEDANCE`（按 name/baseUrl/model 含 `seedance`/`doubao-seedance` 命中），按火山方舟 API 组 `content` 数组：

```json
{
  "model": "doubao-seedance-2-0-...",
  "content": [
    { "type": "text", "text": "<motion_desc>" },
    { "type": "image_url", "image_url": { "url": "<首帧URL>" }, "role": "first_frame" },
    { "type": "image_url", "image_url": { "url": "<末帧URL>" }, "role": "last_frame" }
  ],
  "ratio": "adaptive", "duration": 4, "resolution": "720p",
  "watermark": false, "return_last_frame": true
}
```
- 末帧可缺省（只传 first_frame → 退化为单关键帧 i2v）。
- `return_last_frame: true`：把生成视频的**真实末帧 URL** 取回。

### 5.4 链式承接闭环（return_last_frame → 下一镜首帧）
- 轮询解析回写 `BoardShot.lastFrameUrl`（视频真实末帧）。
- 下一镜出首帧 / 出片时，把上一镜 `lastFrameUrl` 作为首帧参考（比 P0 用"上一镜首帧"更准——是真实运动后的末态）。
- 这才是 ViMax「时间线链式承接」的完整闭环。

### 5.5 请求体 / 契约变更
- `/render/clip` body 加 `last_frame_url?`、`return_last_frame?`（openapi summary 同步）。
- `DramaRenderService.renderClip` 透传末帧到 `variant_config` / item，传到 `MaterialVideoModelClient`。
- `MaterialVideoJobService` 解析 `return_last_frame` 回填任务卡 → 前端回写 `lastFrameUrl`。
- `BoardShot` 加 `lastFrameUrl?`。

## 6. 计费与 §8.0 合规
- P0：纯前端，不新增计费。
- P1：无新计费（prompt 增强 + 字段）。
- P2：新增 `drama.credit.decompose`（hold→commit）；末帧出图复用 `drama.credit.frame`（或单列 `decompose-frame`，排期定）；新 prompt key 未配置 → `PROMPT_NOT_CONFIGURED` 503 不扣费；下游视频模型不支持首尾帧 → 字段被忽略，不报错、不降级伪造（符合 §8.0：传入不生效 ≠ 静默伪造产物）。

## 7. §9 文档同步清单

| 触发 | 必同步 |
|---|---|
| P0（前端行为变更，无实体/API） | 本文件 + `apps/web-drama/README.md` 版本日志 + `docs/VERSION_HISTORY.md` + `docs/INDEX.md`（本文件已登记） |
| P1（`BoardShot.camId` + prompt） | 上述 + `specs/openapi.yaml`（epscript/split_scene body 注明 camId）+ `apps/web-drama/PRODUCT.md`（如涉模块）|
| P2（新端点字段 + `decompose` + 计费 + `lastFrameUrl`/`camId`） | 上述 + `specs/openapi.yaml`（/render/clip 加 last_frame_url/return_last_frame；新 prompt key）+ `specs/BUSINESS_RULES.md`（decompose 校验/计费）+ `apps/server/README.md`（如涉数据模型说明）+ `TODO.md` |

每期升级前跑：`pnpm typecheck:all` + `pnpm --filter @ai-star-eco/web-drama build` + `(cd apps/server && ./mvnw compile -q -o)` + `pnpm check:api-contract`。

## 8. 落地状态（v0.97 全量完成）
- **P0** ✅：镜间承接（同场上一镜画面 / 成片真实末帧优先）+ 场景参考（P0-b 显式 `BoardScene.sceneRefId` 绑定 + 名称自动匹配兜底）+「镜间一致性承接」开关。
- **P1** ✅：`drama.epscript.md` / `drama.split_scene.md` 补电影语言规则；`BoardShot.camId` + `normalizeShot` 透传 + JSON 模板加字段。
- **P2** ✅：`MaterialVideoModelClient` `PROTOCOL_SEEDANCE`（content 数组首/尾帧 + `return_last_frame`）+ GENERIC 补首/尾帧；`MaterialVideoJob.lastFrameUrl` → 任务卡 → 前端 `BoardShot.lastFrameUrl` 链式承接闭环；`drama.decompose` 节点（端点 `/shot/decompose` + 计费 `drama.credit.decompose` + 角色名校验）。
- **运维前置**：要用 seedance 首尾帧，需在 admin「AI 模型与 Key」把「视频生成」绑到一个名称/baseUrl/model 含 `seedance` 的端点（自动走 SEEDANCE 协议）；否则按原 AGNES/GENERIC 协议工作（首帧仍生效）。
- **后续可选**：VLM best-of-N 一致性自检（生成多版首帧自动选最一致）。
- **末帧 CDN 镜像** ✅ **已落地（一致性引擎 C-1，2026-07-10）**：`MaterialVideoJob.lastFrameCdnKey`（§4.7.4 真值列）+ worker 成功分支下载镜像上游末帧到 CDN（失败 = best-effort，仅 WARN、保留上游 URL、不 markFailed）+ `toCard` 出 wire `signKey` 派生（fallback 旧 `lastFrameUrl`）；同批 `/render/{frame,clip}` 返回体加 `applied_refs` 参考生效回报（前端「参考 N/M 生效」chip）。实现级设计见 [`[Fabel5]drama-consistency-engine-design.md`](./%5BFabel5%5Ddrama-consistency-engine-design.md) §2。

## v0.98 补丁 · 分集剧情模型简化为「标题 + 内容」（2026-07-01）

问题：每集原为 `hook/synopsis/beat` 三段并排、无标签、读着不相干；生成只喂了 hook+synopsis（beat 丢失），
且与 epscript 的 `plot` 双源打架。非 ViMax 实践（ViMax 是「连贯叙事 → 逐层分解」）。
改：`EpisodeOutline` 新模型 `{no, title, content}`——`title` 集标题（可视化：集导航/大纲/审阅），
`content` 一段连贯本集剧情（AI 按「开场钩子→主体→结尾悬念」写，钩子结构做进 `drama.outline` prompt，
不再拆独立字段）。`hook/synopsis/beat` 降级为可选、仅老数据回读兜底（helper `episodeTitle`/`episodeContent`）。
生成/展示单一真源 = `episodes[].content`（epscript 去 `meta.plot` 双源）。后端 `drama.outline` 出 title/content、
`aiDraftOutline`/seed/epscript-plot 读 content 优先。门禁：server 36 drama 单测 + web-drama typecheck/build(31) + contract 全绿。

## v0.98 补丁 · 分镜视频计费解耦为短剧 app 维度（2026-07-01）

问题：短剧分镜视频出片（直出/动态）此前**耦合带货线** action `material.video-generate`（前端还写死 7/9，
既显示错、乐观扣费错、又因 9<10 命中小额免打扰不弹确认）。用户要求按 app 应用维度独立配置、不耦合。
改：
- 新增短剧独立单价 `drama.credit.clip`（DramaConfigSeeder，默认 30）；`DramaConfigController` 的 `clip`
  改读它（去掉对 `CelebrityActionPricingService` 的依赖）。
- `MaterialVideoJobService` 改为**领域无关**：单价按 item 的可选 `credit_cost` 覆盖（+`credit_label`
  账本文案），无覆盖才回落带货线 `material.video-generate`；`DramaRenderService` 出片时传
  `credit_cost=drama.credit.clip` + `credit_label=短剧分镜视频`。带货线本身不变。
- 前端分镜表价格全部走 `/me/drama/config`（`frameCost/clipCost/splitCost`=drama.credit.frame/clip/split-scene），
  删写死的 7/9 与拆镜 6；admin「短剧专区·配置」新增 分镜视频出片/AI 拆镜/行级改写 三项可配（此前缺）。
门禁：server compile + test-compile + MaterialVideo/DramaConfig 测试 + web-drama/admin typecheck + build 全绿。

## v0.98 补丁 · P0 出片前一致性体检 + 串行出片引导（2026-07-01）

对照 ViMax 复盘发现：主干接线通（角色/场景参考图 → 首帧 → seedance 首尾帧 i2v + return_last_frame
→ 真实末帧回填 → 承接），但**系统交互不保证流程**：用户可跳过定妆图/场景绑定、或批量出首帧后再出片
（导致承接不到上一镜真实末帧、降级为首帧承接）。P0 补交互闸：
- `shotConsistencyIssues`：出片(clip)前体检——出场角色缺定妆图 / 本场未绑场景参考 / 直出且同场上一镜
  未出片（承接不到真实末帧）→ `dramaConfirm` 列问题，可"仍要继续"或"去补齐"。首帧不拦（便宜可迭代）。
- 分镜表头加"建议逐镜按顺序出片"引导。
未做（P1/P2 待办，记入 TODO）：camId 机位复用、全局风格锚图、承接帧优先级/直出补锚、best-of-N+VLM 自检、串行自动流水线。
