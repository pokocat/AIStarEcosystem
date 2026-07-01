# 短剧分镜一致性优化方案（借鉴 ViMax）

> last-reviewed：2026-06-30 / v0.98 工作台收敛为「剧集脚本分镜表 = 唯一逐镜工作面」（删视频工厂阶段，6→5 阶段）
> v0.97 P0/P1/P2 全量落地（镜间承接 + 场景绑定 + 机位/电影语言 prompt + seedance 首尾帧双关键帧 + return_last_frame 链式承接闭环 + decompose 节点）

## v0.98 结构收敛（方案 B）

用户决策：逐镜出片全在**剧集脚本分镜表**内完成，删独立「视频工厂」阶段（项目 6→5 阶段）。
- 强渲染逻辑抽成 `use-shot-render.ts`（供参考/复用），最终由 `epscript.tsx` 承载：出图 4 版挑选、角色+场景+镜间承接参考图、首尾帧、AI 拆镜（首帧▷末帧双联 + hover 预演）、镜间一致性开关。
- 删 `stages/factory.tsx` + `FactoryDrawer` + `use-shot-render` 消费方（factory）；`stages-config` 去 factory，成片合成前移。
- P1：epscript 不再 lock，脚本始终可编辑（`保存·去成片合成`）。
- P5：删左下 `ai-chat-panel` 浮窗 → 行级 Wand2 就地改写本镜（`/shot/rewrite` + `drama.shot_rewrite`）。
- P6：短视频面包屑按 pathname 派生 + beat 改 AI 逐镜生成。
- P4：假模型下拉随工厂删除已消失；真·多模型选择拆独立 PR（TODO D-11，改共享 `AiAppBinding`）。
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
- **后续可选**：VLM best-of-N 一致性自检（生成多版首帧自动选最一致）；末帧 CDN 镜像（当前 `lastFrameUrl` 存上游 URL，best-effort，可能有时效）。
