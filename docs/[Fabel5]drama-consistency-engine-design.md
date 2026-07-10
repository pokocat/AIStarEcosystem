# AI 短剧一致性引擎 · 实现级设计（C-1 / D-11 / C-2 / C-3）

> 交付对象：后续逐阶段落地的执行 agent。本文把审计报告
> [`[Fabel5][TODO]drama-audit-2026-07.md`](./%5BFabel5%5D%5BTODO%5Ddrama-audit-2026-07.md) §1.3（五层一致性引擎）
> 与 §1.4（C 序列路线图）中的 **C-1 / D-11 / C-2 / C-3** 拆成可执行设计。
> 只做设计；执行时仍须遵守 AGENTS.md §4.1 / §4.7 / §5 / §8.0 / §9（见 §0 硬约束）。
>
> 落地顺序（依赖）：**C-1（独立）→ D-11（C-3 前置）→ C-2（C-3 前置）→ C-3**。
> C-1 与 D-11 可并行；C-2 与 D-11 可并行；C-3 必须等 C-2 + D-11 都合并。

---

## 0. 硬约束（写给执行 agent，逐条不可违反）

| 约束 | 出处 | 落地检查点 |
|---|---|---|
| **资产真值 = cdnKey**，新列一律 `cdnKey`，不再加 `cdnUrl` 列；出 wire 由 `CdnUrlSigner.signKey(key)` 派生 | AGENTS §4.7.4 | C-1 加 `lastFrameCdnKey`（非 `lastFrameCdnUrl`）；C-2 refImages 存 cdnKey |
| **DTO 出 wire 必经 signer**；文档内 URL 递归重签（`resignAssetUrls` 范式） | §4.7.5 / §4.7.7 | C-1 `toCard` 注入 signer；C-2 实体 DTO 工厂带 signer 参数 |
| **禁静默降级**：外部依赖未配置/失败 → 抛带 code 的 4xx/5xx，不扣费、不落假数据 | §8.0 | D-11 白名单未命中 → 503 不回退；C-2 三视图未配图像端点 → 503 `IMAGE_NOT_CONFIGURED` |
| **降级失败仅 WARN 的例外**：观测类旁路（用量/镜像）可吞异常 | §8.0 例外 | C-1 末帧镜像失败 → WARN + 保留上游 URL，**不得 markFailed** |
| **DTO record 字段名 = TS interface 字段名**（1:1） | §4.1 | C-2 `DramaCharacterDto` 字段名 = `CharacterDef` |
| **新增领域 SOP**：types → api → server mirror → openapi | §5 | C-2 见 §4.7 的“类型真源澄清”（drama 类型不在 packages/types） |
| **文档同步纪律**：同 commit 更 openapi / README / VERSION_HISTORY / TODO.md | §9 | 每阶段 §*.openapi + §*.docs 清单 |
| **测试启动**：`AEP_CDN_DRIVER=local`（否则 OSS 驱动在 @SpringBootTest 崩） | MEMORY env-cdn-driver-boot-gotcha | 所有集成测试类加 `@TestPropertySource(properties="aep.cdn.driver=local")` |
| **改 DTO/record 后跑 `./mvnw test-compile`**（不是只 compile；本地 aliyun maven 镜像不可达，联网构建走 central `MAVEN_ARGS`） | MEMORY backend-test-compile-gate / deploy-maven-mirror | 每阶段门禁 |

---

## 1. 现状锚点速查（免重复探索）

### 1.1 渲染服务端

| 关注点 | 位置 | 备注 |
|---|---|---|
| 首帧出图 `renderFrame(body,userId)` | `DramaRenderService.java:139` | 走 `IMAGE_GENERATION` 端点；每版 `callImageModel` → `cdnUploader.upload` 落 `drama/frames/<uuid>.png`；出 wire `{frames:[{cdnKey,url}],cost}`。**扣费用 `creditService.debit`（一次性，非 hold）** `:177-182` |
| 图像模型调用 `callImageModel(ep,prompt,size,refImages)` | `:192-302` | `ref_images` → `extra_body.image[]`，**先过 `isFetchableImageRef` 过滤**，drop 只 WARN `:205-221` |
| **dev 参考图被过滤** `isFetchableImageRef(u)` | `:417-422` | 非 http(s) / localhost / 内网 → false（本地 `/cdn/...` 全被丢） |
| 视频出片 `renderClip(body,userId)` | `:321-374` | 把 `frame_url` / `last_frame_url` 用**中文 marker 拼进 prompt 文本** `:342-350`，委派 `videoJobs.submit`；`variant_config` 存 `target/scene_id/shot_id/episode_no` `:362-366` |
| prompt 模板服务端化 `buildMediaPrompt` | `:110-131` | `kind`→模板 key；未配 → 503 `PROMPT_NOT_CONFIGURED` |
| 端点解析 `resolveEndpoint(purpose)` | `AiModelInvocationService.java:78-82` | `bindingRepo.findById(purpose)` → 端点 → `.filter(enabled)`；**一用途一端点，无候选** |
| Controller | `DramaRenderController.java` | `/api/me/drama/render/{frame,frame-jobs,clip,tasks}` |

### 1.2 视频任务管线（MaterialVideoJob）

| 关注点 | 位置 | 备注 |
|---|---|---|
| 实体 | `MaterialVideoJob.java` | `videoUrl`/`thumbnailUrl`/`lastFrameUrl` 三个 **URL 列**（1024）；`variantConfigJson` LONGTEXT；ddl-auto=update 自动加列 |
| **末帧现状** `lastFrameUrl` | `:99-101` | 存**上游模型临时 URL**（seedance `return_last_frame`），未镜像 CDN → 过期即断（G-6） |
| Worker 成功分支 | `MaterialVideoWorker.java:114-140` | `poll.succeeded()` → `mirrorToCdn`（video+thumbnail）→ `markSucceeded(jobId,videoUrl,thumb,poll.lastFrameUrl())` `:137`。**末帧不镜像** |
| CDN 镜像 `mirrorToCdn` | `:168-198` | 下载 → `cdnUploader.upload` → 返回 `cdnUrl()`（注意：video 存的是 **URL 非 key**，§4.7.6 欠债） |
| `markSucceeded(...lastFrameUrl)` | `:264-277` | 只 set `lastFrameUrl` URL |
| 提交/扣费 `submit` | `MaterialVideoJobService.java:72-116` | hold→worker commit/release；`credit_cost` 可 item 覆盖（drama 传 30） |
| **wire 映射 `toCard`** | `:189-224` | 输出 `video_url`/`thumbnail_url`/`last_frame_url` **原样、未签名**；**无 signer 注入** `:218-220` |
| 视频协议客户端 | `MaterialVideoModelClient.java` | `SEEDANCE`(`:336-352` content 数组 first/last_frame + `return_last_frame`) / `AGNES` / `GENERIC`(`:369-380` image/end_image)；末帧抽取 `extractLastFrameUrl` `:613-625` |
| Repo | `MaterialVideoJobRepository.java` | `findByOwnerUserIdAndScriptId...`；**无按 variant_config.shot_id 查询**（shot_id 只在 JSON） |

### 1.3 项目文档（payloadJson）

| 关注点 | 位置 | 备注 |
|---|---|---|
| 实体 | `DramaProject.java` `payloadJson` LONGTEXT | 整树 `ProjectData` 单列 |
| 读写 | `DramaProjectService.java` `readPayload:915` / `write:1052` / `saveProject:144`（**全量覆盖，无版本号**） | signer 已注入 `:45` |
| **出 wire 递归重签** `resignAssetUrls` | `:973-1000` | 遍历整树对 textual 值 `signer.maybeSign`；C-2/C-3 新增资产字段自动被覆盖 |
| seed 空文档 `seedProjectData` | `:843-890` | `characters:[]` `:857`、`scenes:[]` `:859`（SceneAsset）、`episodeDocs:{}` `:878` |
| 角色 AI 抽取 `castAiDraft` | `:546-592` | 产 `ch_N` + `avatar/bound`（**未落库**，前端合并 PUT） |
| 分镜归一 `normalizeShot` | `:746-774` | `cast:[]` 空、`camId/sfx/bgm/fx` 透传 |
| 拆镜 `decomposeShot` / 改写 `rewriteShot` | `:417-531` | 均 `withCharge` hold-lite；未落库 |
| 扣费包 `withCharge(userId,price,desc,supplier)` | `:67-84` | 短剧 AI 动作统一入口 |

### 1.4 前端（reference 语义现全在组件里 — C-3 要下沉的对象）

| 关注点 | 位置 | 备注 |
|---|---|---|
| **参考图装配** `shotRefImages(sceneId,shot,extraLeading?)` | `epscript.tsx:643-666` | @cast → 文本名匹配 → 全员；`chainConsistency` 开关下 + 场景参考 + 同场上一镜末帧；`Set` 去重 `slice(0,6)` |
| 场景参考 `sceneRefUrlFor` | `:612-621` | `sceneRefId` 显式 → 名称兜底 |
| 同场上一镜承接 `prevFrameInScene` | `:623-631` | `lastFrameUrl ?? frameUrl ?? frameUrls[0]` |
| 同场下一镜尾帧 `nextFrameInScene` | `:633-641` | 作 seedance 尾帧 |
| 一致性体检 `shotConsistencyIssues` | `:670-688` | 只产警告文案（可无视） |
| vars 组装 `shotVars` | `:598-610` | visual/size/move/sceneClause/lineClause/castClause/styleSuffix |
| render 主流程 | `:690-759` | frame→`submitFrameJob`；clip→`renderClip`（拼 firstFrame/endFrame） |
| 拆镜末帧出图 | `:764-800` | `renderFrame` + `shotRefImages(...,[ownFrame])` |
| render api | `api/render.ts` | `RenderFrameInput`/`RenderClipInput`（`refImages?:string[]`）`:21-54` |
| 短视频线消费 | `app/(workspace)/shorts/make/page.tsx`（1340 行） | 复制了同套 ref 逻辑（P-6） |

### 1.5 CDN / 扣费 / AI 绑定基础设施

| 关注点 | 位置 | 签名 |
|---|---|---|
| `CdnUploader.upload(Path,key,contentType)` | `service/cdn/CdnUploader.java:26` | 返回 `CdnUploadResult(cdnUrl,key,uploadedBytes,uploadedAt)` |
| `CdnUrlSigner.signKey(key[,ttl])` / `maybeSign(url[,ttl])` | `service/cdn/CdnUrlSigner.java:100/67` | signKey：key→派生+签；maybeSign：URL→抽 key→重签；`NOOP` 单例给测试 |
| `CreditService.hold / commitHold / releaseHold` | `CreditService.java:354 / 450 / 516` | hold 幂等（同 refType+refId）；commit 可分次；release 退原桶 |
| `CreditService.debit(userId,amount,refType,refId,desc)` | `:140` | 一次性直扣（renderFrame 现用这个） |
| 短剧单价 keys | `DramaConfigSeeder.java` | `KEY_FRAME=drama.credit.frame(2)`、`KEY_CLIP(30)`、`KEY_DECOMPOSE(3)`… `configs.getLong(KEY,default)` |
| AI 绑定实体 | `AiAppBinding.java` | `@Id purpose` → `endpointId`（一对一） |
| 绑定 service / controller | `AiAppBindingService.java` / `AdminAiAppBindingController.java` | `/api/admin/ai-app-bindings/{purpose}` PUT/DELETE |
| 端点实体 | `AiModelEndpoint.java`（表 `ai_model_providers`） | 已有 `unitPriceMicros` / `billingMode` / `modelsJson` 列 |
| Purpose 枚举 | `AiModelPurpose.java` | `IMAGE_GENERATION` / `VIDEO_GENERATION` / `DRAMA_SCRIPT_DRAFT`… |
| admin 绑定 UI | `apps/admin/src/app/platform/ai-models/page.tsx` | `BINDING_GROUPS`（drama 组 `:214`）；`AiModelsApi.listBindings()` |

### 1.6 openapi 现状（重要：render 端点是**单行 stub**）

`specs/openapi.yaml:7565-7580` 的 `/me/drama/render/*` 只有 `summary` + `responses:{'200':{description:ok}}`，**无 request/response schema**。契约门 `scripts/check-api-contract.mjs` 仅按 **URL+method** 匹配 → 字段增改只需更 summary 文本；**新端点必须新增 path stub**，否则 `apiFetch` 调用它会 gate fail。

---

## 2. Phase C-1 — 末帧 CDN 镜像 + 参考生效回报

**目标**：修 G-6 —（1）`lastFrameUrl` 从上游临时 URL 升级为 CDN 镜像 cdnKey（不过期）；（2）render frame/clip 响应体加 `applied_refs`，前端展示“参考 N/M 生效”，消除“看起来开了一致性、实际一张没送”的暗坑。

### 2.1 实体/列变更

`MaterialVideoJob.java` 新增一列（ddl-auto=update 自动加，无 Flyway）：

```java
/** C-1：成片真实末帧的 CDN 镜像 object key（§4.7.4 真值）；出 wire 由 signer 派生 URL。
 *  镜像失败时为 null，回退读 lastFrameUrl（上游临时 URL）。 */
@Column(name = "last_frame_cdn_key", length = 512)
private String lastFrameCdnKey;
```

保留 `lastFrameUrl`（过渡 fallback）。**不新增 `lastFrameCdnUrl`**（§4.7.4）。

### 2.2 末帧镜像时序（在 Worker 哪个点、失败语义）

改点 `MaterialVideoWorker.java`：

1. **`mirrorToCdn` 扩展**（`:168-198`）：成功分支已有 `poll.lastFrameUrl()`。在 `runGeneration` 成功分支（`:114-140`）里，当 `props.isUploadToCdn() && cdnUploader != null` 时，除 video/thumbnail 外**追加镜像末帧**：
   - 下载 `poll.lastFrameUrl()` → `cdnUploader.upload(tmp, key, "image/png")`，key = `material-videos/<jobId>/last-frame<ext>`；
   - 返回结构里带 `lastFrameKey`（扩展 `CdnMirrorResult` record 加 `String lastFrameKey`）。
2. **`markSucceeded` 签名扩展**：加参数 `String lastFrameCdnKey`，`j.setLastFrameCdnKey(...)`；`lastFrameUrl` 仍写上游 URL 作 fallback。
3. **失败语义（§8.0 例外——观测类旁路）**：末帧镜像是**best-effort**，包在 `mirrorToCdn` 现有 `try{...}catch(IOException|RuntimeException)` 内（`:132-135` 同款），失败仅
   ```
   log.warn("[material-video] job {} last-frame CDN mirror failed (keeping provider URL): {}", jobId, e);
   ```
   **绝不 `markFailed` / `releaseCredits`**——视频本身已成功出片，末帧只是下游承接的锚，缺它退化为“无末帧承接”，不能让整条出片任务失败。lastFrameCdnKey=null 时下游读 lastFrameUrl 兜底。
   > 与主链路区别：video 镜像失败当前也只是 WARN + 保留上游 URL（`:132`），末帧同惯例，语义一致。

### 2.3 `applied_refs` DTO 形态（后端 + TS）

`applied_refs` 描述**本次实际生效的参考清单 + 被过滤/裁剪项及原因**，供前端“参考 N/M 生效”。

**后端**——`DramaRenderService`：
- `renderFrame` 出 wire 增 `applied_refs`：在 `callImageModel` 现有 valid/dropped 分流（`:206-221`）基础上，把每张 ref 归类落一个 `ArrayNode`。为不改 `callImageModel` 返回类型，改法：把过滤逻辑抽成 `AppliedRefs computeAppliedRefs(JsonNode refImages)`（返回 valid + dropped-with-reason），`renderFrame` 先算 `applied`，把 `applied.valid()` 传给 `callImageModel`，再 `out.set("applied_refs", applied.toJson())`。
- `renderClip`：同理，对 `frame_url` / `last_frame_url` 归类（fetchable? / 模型是否支持首尾帧——C-1 阶段无 capability 表，先按“seedance 支持首尾帧、其余 GENERIC best-effort、AGNES 仅首帧”的**静态判定**，判定函数 `supportsFirstLastFrame(endpoint,model)` 复用 `MaterialVideoModelClient.protocolFor` 同款关键字），落 `applied_refs`。

**JSON 形态**（后端产、TS 收，字段名 1:1，§4.1）：

```jsonc
"applied_refs": {
  "requested": 6,        // 请求携带的参考总数（含首/尾帧）
  "applied": 4,          // 实际送达模型的数量
  "items": [
    { "role": "character", "url": "https://…", "applied": true },
    { "role": "scene",     "url": "https://…", "applied": true },
    { "role": "prev_last_frame", "url": "https://…", "applied": true },
    { "role": "first_frame", "url": "https://…", "applied": true },
    { "role": "last_frame", "url": "https://…", "applied": false,
      "reason": "model_no_flf" },        // 模型不支持首尾帧
    { "role": "character", "url": "/cdn/…", "applied": false,
      "reason": "local_unfetchable" }    // dev 本地 /cdn，外部模型抓不到
  ]
}
```

`reason` 枚举（wire 全小写）：`local_unfetchable` | `model_no_flf` | `over_max_refs`（C-3 才会出现）| `empty`。
> C-1 阶段 `role` 仅需 `character`/`scene`/`prev_last_frame`/`first_frame`/`last_frame`——C-1 前端仍传 `ref_images:string[]`（无槽位），后端**无法区分 character/scene**，故 C-1 的 frame 场景 `items[].role` 统一标 `ref`（未知槽位）；带槽位的精确 role 由 **C-3** Reference Assembler 提供。C-1 先把 `first_frame/last_frame`（clip 有明确字段）标准确，`ref_images` 数组标 `ref`。

**TS**（`apps/web-drama/src/api/render.ts`）新增：

```ts
export type AppliedRefReason = "local_unfetchable" | "model_no_flf" | "over_max_refs" | "empty";
export interface AppliedRefItem { role: string; url: string; applied: boolean; reason?: AppliedRefReason; }
export interface AppliedRefs { requested: number; applied: number; items: AppliedRefItem[]; }
```
`renderFrame` 返回体从 `{frames,cost}` → `{frames,cost,applied_refs}`；`renderClip` 的 `DramaEpisodeJob`（`short-drama.ts`）与 frame-job 卡加可选 `applied_refs?: AppliedRefs`。
> `renderFrame` 当前 `Promise<RenderedFrame[]>` 丢掉了 cost/applied_refs。C-1 改签名为 `Promise<{frames:RenderedFrame[];cost:number;appliedRefs?:AppliedRefs}>`，或加旁路 `renderFrameDetailed`；推荐直接改返回类型（调用点少，epscript `:779` + shorts/make）。

### 2.4 前端展示点

- `epscript.tsx` 分镜行：首帧/出片按钮旁加一个 chip「参考 4/6 生效」，`title` 展开被 drop 的项与原因（用户友好文案，§跨 app 约定：不暴露 `model_no_flf` 原值，转“尾帧未生效（当前模型不支持首尾帧）”）。数据来自 `applied_refs`，存进 `FormShot`（加 `appliedRefs?`）随 render 回填。
- 溢出约束：chip 定宽 + ellipsis（§8 UI 不溢出）。
- `applied===requested` 时可不显 chip（无损默认态）。

### 2.5 openapi diff

- `/me/drama/render/frame` `post.summary`：追加“返回体加 `applied_refs`（实际生效参考清单 + 过滤原因）”。
- `/me/drama/render/clip` `post.summary`：追加“首/末帧生效情况回报 `applied_refs`；末帧成功后 CDN 镜像落 `lastFrameCdnKey`，链式承接不过期”。
- 无新 path（字段级变更，契约门按 path+method 匹配，summary 更新即可）。

### 2.6 测试计划

- 单测 `MaterialVideoModelClientTest`（已存在协议单测）补 `extractLastFrameUrl` 已覆盖；新增 `MaterialVideoWorkerTest`（若无则建）：mock `CdnUploader`，验证成功分支调用 upload(last-frame key) 且 `setLastFrameCdnKey`；**mock upload 抛 IOException → 任务仍 `succeeded`、`lastFrameCdnKey==null`、`lastFrameUrl` 保留、无 markFailed**（失败语义回归）。
- `DramaRenderServiceTest`（新建，`@TestPropertySource aep.cdn.driver=local`）：`computeAppliedRefs` 纯函数矩阵——全 fetchable / 含 `/cdn` local / clip 首尾帧 vs seedance/generic/agnes 的 `applied` 与 `reason`。
- 门禁：`./mvnw test-compile` + 相关单测；`pnpm --filter @ai-star-eco/web-drama typecheck && build`；`pnpm check:api-contract`。

### 2.7 文件改动清单

```
apps/server/.../aep/model/MaterialVideoJob.java                    (+lastFrameCdnKey 列)
apps/server/.../aep/service/materialvideo/MaterialVideoWorker.java (mirrorToCdn+末帧 / markSucceeded 签名 / CdnMirrorResult)
apps/server/.../aep/service/materialvideo/MaterialVideoJobService.java (toCard 注入 CdnUrlSigner；last_frame_url 改 signKey(lastFrameCdnKey) fallback lastFrameUrl；建议顺带 maybeSign video_url/thumbnail_url——可选)
apps/server/.../aep/service/DramaRenderService.java                (computeAppliedRefs；renderFrame/renderClip 输出 applied_refs)
apps/web-drama/src/api/render.ts                                   (AppliedRefs 类型；renderFrame 返回体；DramaFrameJob/task 加 applied_refs?)
apps/web-drama/src/api/short-drama.ts                              (DramaEpisodeJob 加 applied_refs?)
apps/web-drama/src/mocks/drama-workshop/types.ts                  (FormShot/BoardShot 加 appliedRefs?)
apps/web-drama/src/components/drama-workshop/stages/epscript.tsx  (行内“参考 N/M 生效”chip)
specs/openapi.yaml                                                 (两处 summary)
docs/VERSION_HISTORY.md / apps/web-drama/README.md / TODO.md / docs/drama-storyboard-consistency.md
```

> **注意（§4.7 顺带修）**：`toCard` 注入 signer 后，`last_frame_url` 走 `signer.signKey(lastFrameCdnKey)`；因 `toCard` 也服务 celebrity 素材线，`video_url`/`thumbnail_url` 建议一并 `signer.maybeSign(...)`（local `/cdn` 不匹配 OSS base → 原样返回，零影响；OSS 域才签），顺手偿还 §4.7.6 `MaterialVideoJob.videoUrl` 欠债。若想缩小 C-1 爆炸半径，可仅签 last_frame，video/thumbnail 留后续——**在 commit message 里标明选择**。

---

## 3. Phase D-11 — 一用途多候选端点 + capability 元数据

**目标**：把 `AiModelPurpose → 单端点` 升级为 `Purpose → N 候选端点（带 capability）`，为 C-3 参考裁剪 / C-5 质检路由提供数据基础；render 请求可指定 `endpointId`（白名单校验，未配 503 不回退）；可选按端点单价 override。**保留现有一对一绑定完全兼容**。

### 3.1 表结构（新表，不动 AiAppBinding）

新增 `ai_app_endpoint_candidate`（一 purpose 多行）。`AiAppBinding` **保持不变**，语义降格为“该用途的**默认**端点”，`resolveEndpoint(purpose)` 行为零变化 → 所有现有调用者不受影响。

```java
@Entity
@Table(name = "ai_app_endpoint_candidate",
       uniqueConstraints = @UniqueConstraint(columnNames = {"purpose","endpoint_id"}),
       indexes = @Index(name="idx_aaec_purpose", columnList="purpose"))
public class AiAppEndpointCandidate {
    @Id @Column(length = 40)
    private String id;                       // uuid

    @Enumerated(EnumType.STRING) @Column(length = 40, nullable = false)
    private AiModelPurpose purpose;

    @Column(name = "endpoint_id", nullable = false)
    private String endpointId;

    /** 展示排序；小在前。默认端点（= AiAppBinding.endpointId）在 UI 置顶。 */
    @Column(nullable = false) @ColumnDefault("100")
    private int sortOrder;

    @Column(nullable = false) @ColumnDefault("true")
    private boolean enabled;

    // ── capability 元数据（C-3 参考装配 / C-5 路由读取）──
    @Column(name = "max_ref_images")            private Integer maxRefImages;        // null=未知，按保守默认
    @Column(name = "supports_first_last_frame") private Boolean supportsFirstLastFrame;
    @Column(name = "supports_subject_reference")private Boolean supportsSubjectReference;
    @Column(name = "max_duration_sec")          private Integer maxDurationSec;

    /** 可选：本端点在该用途下的积分单价 override（null=用用途默认单价，如 drama.credit.clip）。 */
    @Column(name = "credit_cost_override")      private Long creditCostOverride;

    @Column(nullable = false) private Instant createdAt;
    @Column(nullable = false) private Instant updatedAt;
}
```

> **为什么不给 `AiModelEndpoint` 直接加 capability 列？** capability 是「端点在某用途下」的能力（同一 OpenAI 兼容端点用于 IMAGE 与 VIDEO 时能力不同），挂在 candidate（purpose×endpoint 交点）语义更准。且新表零迁移风险，不碰热路径实体。

### 3.2 兼容迁移（现有 AiAppBinding 数据怎么办）

- **不迁移、不双写破坏**。`AiAppBinding` 继续是默认端点单一真源。
- 新增幂等 seeder（`@Order` 在 AiAppBinding 相关 seeder 之后）：启动时对每条 `AiAppBinding` **确保存在一条对应 candidate**（`purpose+endpointId`，`sortOrder=0` 置顶，capability 全 null），`seedIfAbsent` 语义。这样老数据自动进候选池，UI 立即可见，无需人工。
- capability 全 null 时 C-3 用**保守默认 profile**（见 §3.5），不阻断。

### 3.3 `resolveEndpoint` 重载签名

`AiModelInvocationService`：

```java
// 原：默认端点（AiAppBinding），行为不变
public Optional<AiModelEndpoint> resolveEndpoint(AiModelPurpose purpose);

// 新：显式候选（白名单）。endpointId 必须是该 purpose 的启用 candidate，否则 empty（调用方 503）
public Optional<ResolvedEndpoint> resolveEndpoint(AiModelPurpose purpose, String endpointId);

// 新：列出候选（含 capability + 默认标记），给 /render/models 与 admin
public List<ResolvedEndpoint> listCandidates(AiModelPurpose purpose);

public record ResolvedEndpoint(AiModelEndpoint endpoint, AiAppEndpointCandidate candidate, boolean isDefault) {}
```

- `resolveEndpoint(purpose,null/blank)` → 委派回默认（等价旧行为）。
- `resolveEndpoint(purpose,endpointId)`：candidate 表查 `purpose+endpointId+enabled` → 端点 `enabled` → 命中返回；**未命中返回 empty，调用方抛 503（§8.0：不静默回退默认）**。错误码 `ENDPOINT_NOT_ALLOWED`。

### 3.4 render 请求接 `endpointId`

- `DramaRenderService.renderFrame`/`renderClip` body 增可选 `endpoint_id`。传了 → `resolveEndpoint(IMAGE_GENERATION/VIDEO_GENERATION, endpointId)`，未命中 503 `ENDPOINT_NOT_ALLOWED`（不扣费）；没传 → 默认端点（旧路径）。
- 视频线：`renderClip` 的 `endpoint_id` 需透传到 `MaterialVideoJobService.submit` → `MaterialVideoModelClient`。当前 `MaterialVideoModelClient.pickEndpoint()` 硬编 `resolveEndpoint(VIDEO_GENERATION)`（`:293-297`）。改法：把选定端点随 item 传入（`variant_config` 或新字段 `endpoint_id`），worker 提交时用它；**保持默认路径不变**。这是 D-11 里最深的一处改动，需谨慎（worker/submit/client 三处串联）。
- 单价 override：`creditCostOverride` 非空 → 覆盖 `drama.credit.clip`/`drama.credit.frame`。frame 走 `debit`、clip 走 item `credit_cost`。

### 3.5 `GET /me/drama/render/models` 响应体

新端点（`DramaRenderController` 加 `@GetMapping("/models")`），query `purpose`（默认返回 image+video 两组）：

```jsonc
{
  "image": [
    { "endpointId":"ep_x", "name":"Agnes Image", "isDefault":true,
      "capability": { "maxRefImages":6, "supportsFirstLastFrame":false,
                      "supportsSubjectReference":false, "maxDurationSec":null },
      "creditCost":2 } ],
  "video": [
    { "endpointId":"ep_seedance", "name":"豆包 Seedance", "isDefault":true,
      "capability": { "maxRefImages":4, "supportsFirstLastFrame":true,
                      "supportsSubjectReference":true, "maxDurationSec":12 },
      "creditCost":30 },
    { "endpointId":"ep_generic","name":"通用 i2v","isDefault":false,
      "capability": { "maxRefImages":1,"supportsFirstLastFrame":false,... },"creditCost":30 } ]
}
```

capability 全 null → 前端/装配用**保守默认**：`maxRefImages=1, supportsFirstLastFrame=false, supportsSubjectReference=false`（宁少送不报错）。`creditCost` = override ?? 用途默认单价。

TS（`render.ts`）：`EndpointCapability` / `RenderModelOption` / `RenderModelsResponse` + `listRenderModels(purpose?)`。前端分镜行/短视频加“出片模型”下拉（消费此端点，替代 v0.98 删掉的假下拉）。

### 3.6 admin 页改动

`apps/admin/src/app/platform/ai-models/page.tsx`：drama 绑定组（`:214`）在“默认端点绑定”下加一块“**候选端点 + 能力**”：列 candidate、加/删、编辑 capability（4 个能力字段 + 单价 override）、设默认（= 改 AiAppBinding.endpointId）。
- 新 admin API：`GET/POST/DELETE/PUT /api/admin/ai-app-bindings/{purpose}/candidates[/{endpointId}]`（新 controller 方法或新 `AdminAiAppCandidateController`）。
- `apps/admin/src/api/ai-models.ts` 加对应方法 + 类型。
- §8 UI：能力字段用 checkbox/number，空=未知（提示“留空按保守默认”）。

### 3.7 §8.0 合规点

- `resolveEndpoint(purpose,endpointId)` 未命中 → 503 `ENDPOINT_NOT_ALLOWED`，**不回退默认**、不扣费。
- 候选池为空但传了 endpointId → 同上。
- 没传 endpointId → 默认端点；默认端点也没绑 → 沿用现有 `IMAGE_NOT_CONFIGURED`/`VIDEO_NOT_CONFIGURED`（503）。
- capability 缺失 → **不是降级**，是“按保守默认少送参考”，属 §8.0 允许的“传入不生效 ≠ 伪造产物”，且 C-1 的 `applied_refs` 已如实回报。

### 3.8 openapi diff

- 新 path stub：`/me/drama/render/models`（get，query `purpose`）。
- 新 admin path stub：`/admin/ai-app-bindings/{purpose}/candidates` + `/{endpointId}`。
- `/render/frame`、`/render/clip` summary 追加“可选 `endpoint_id`（候选端点白名单，未命中 503 ENDPOINT_NOT_ALLOWED）”。

### 3.9 测试计划

- `AiModelInvocationServiceTest`：`resolveEndpoint(purpose,endpointId)` 命中/未命中/端点停用/candidate 停用/传 null 回默认；`listCandidates` 含 default 标记。
- seeder 幂等测试：已有 AiAppBinding → 启动后 candidate 表出现对应行；重复启动不重复。
- `DramaRenderServiceTest`：body 带非法 endpoint_id → 503 且未扣费（mock CreditService 验证 0 次 debit/hold）。
- 门禁：`./mvnw test-compile` + 单测；`pnpm typecheck:admin`；`pnpm --filter web-drama typecheck/build`；`pnpm typecheck:all`；`check:api-contract`。

### 3.10 文件清单

```
apps/server/.../aep/model/AiAppEndpointCandidate.java                 (新)
apps/server/.../aep/repository/AiAppEndpointCandidateRepository.java  (新)
apps/server/.../aep/service/AiModelInvocationService.java             (重载 + listCandidates + ResolvedEndpoint)
apps/server/.../aep/service/AiAppBindingService.java                  (候选 CRUD)
apps/server/.../aep/config/AiAppCandidateSeeder.java                  (新，幂等回填)
apps/server/.../aep/controller/AdminAiAppBindingController.java       (候选 endpoints) 或新 controller
apps/server/.../aep/controller/DramaRenderController.java             (+GET /models)
apps/server/.../aep/service/DramaRenderService.java                   (endpoint_id 解析 + models 组装)
apps/server/.../aep/service/materialvideo/{MaterialVideoJobService,MaterialVideoModelClient}.java (endpoint_id 透传)
apps/server/.../aep/dto/AiAppEndpointCandidateDto.java + RenderModelsDto (新)
apps/admin/src/app/platform/ai-models/page.tsx + api/ai-models.ts     (候选 UI + API)
apps/web-drama/src/api/render.ts                                      (listRenderModels + 类型)
apps/web-drama/.../stages/epscript.tsx + shorts/make/page.tsx         (出片模型下拉)
specs/openapi.yaml；docs/*；TODO.md
```

---

## 4. Phase C-2 — 角色 / 场景实体化 + 多角度参考图集

**目标**：L0 地基。把散落 payloadJson 的角色/场景升级为独立表 + 结构化多角度参考图集（cdnKey），渲染真值改读实体（过渡期双写 + 懒回填）；新增“角色一键生成 正/侧/全身 三视图”端点。

### 4.1 两实体完整字段

```java
@Entity @Table(name = "drama_character",
    indexes = @Index(name="idx_dc_project", columnList="project_id"))
public class DramaCharacter {
    @Id @Column(length = 40) private String id;                 // 复用文档 ch_N 或 uuid
    @Column(name="project_id", length=64, nullable=false) private String projectId;
    @Column(name="owner_user_id", length=64, nullable=false) private String ownerUserId; // 属主隔离
    @Column(length=128) private String name;
    @Column(length=16)  private String role;                    // key | extra
    @Column(length=256) private String cast;                    // “女·28·AE”
    @Lob @Column(columnDefinition="LONGTEXT") private String appearanceJson; // 结构化外观（预留）
    @Column(name="dap_avatar_id", length=64) private String dapAvatarId;     // 绑定 AiAvatar（可空）
    @Column(name="voice_id", length=64) private String voiceId;             // 音频线预留（P-1）
    /** 多角度参考图集 JSON：[{cdnKey, angle, label}]（真值 cdnKey，出 wire 派生 url） */
    @Lob @Column(name="ref_images_json", columnDefinition="LONGTEXT") private String refImagesJson;
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at") private OffsetDateTime updatedAt;
    @Column(name="deleted_at") private OffsetDateTime deletedAt; // 软删，随项目
}

@Entity @Table(name = "drama_scene",
    indexes = @Index(name="idx_ds_project", columnList="project_id"))
public class DramaScene {
    @Id @Column(length=40) private String id;
    @Column(name="project_id", length=64, nullable=false) private String projectId;
    @Column(name="owner_user_id", length=64, nullable=false) private String ownerUserId;
    @Column(length=128) private String name;
    @Column(length=64)  private String mood;
    @Lob @Column(name="style_tags_json", columnDefinition="LONGTEXT") private String styleTagsJson; // string[]
    @Lob @Column(name="ref_images_json", columnDefinition="LONGTEXT") private String refImagesJson; // [{cdnKey,angle,label}]
    @Column(name="created_at", nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at") private OffsetDateTime updatedAt;
    @Column(name="deleted_at") private OffsetDateTime deletedAt;
}
```

**refImages 结构化元素**（TS + 后端字段名 1:1）：
```ts
export interface DramaRefImage { cdnKey: string; url?: string; angle?: "front"|"side"|"full"|"expression"|"env"|string; label?: string; }
```
`url` 是出 wire 派生（`signer.signKey(cdnKey)`），入库只留 `cdnKey`。

### 4.2 懒回填与双写触发点

**真值切换原则**：渲染读实体表；编辑器仍读写 `payloadJson.characters/scenes`（视图）；两者过渡期双写。

- **懒回填（read 时）**：新增 `DramaAssetService.ensureBackfilled(projectId, userId)`——在 `getProject`（`DramaProjectService.toDetail` `:960` 之前）与任何“读渲染真值”入口调用：若 `drama_character`/`drama_scene` 无该项目行但 `payloadJson.characters/scenes` 非空 → 从文档解析建实体（`ch_N` 作 id，单张 `refCdnKey`→`refImages:[{cdnKey,angle:"front"}]`；`avatarImage` 若是 URL 则 `maybeSign` 抽 key）。幂等：以“该项目实体行是否存在”为闸。
- **双写（write 时）**：`saveProject`（`:144`）落 `payloadJson` 后，把 `data.characters/scenes` 同步 upsert 到实体表（增/改/软删对齐文档）。`castAiDraft`（未落库，前端 PUT）走同一 `saveProject` 双写路径，无需单独改。
- **渲染真值改读实体**：C-3 的 Reference Assembler（§5）直接查 `drama_character`/`drama_scene`；C-2 阶段可先只建表+双写+回填，Assembler 落地在 C-3。C-2 自测时用一个内部读路径验证实体与文档一致。

> **过渡期结束（远期）**：文档内 characters/scenes 降为纯编辑器 UI 态或删除，删除双写。C-2 不删文档字段。

### 4.3 三视图生成端点契约（含扣费 hold→commit）

```
POST /api/me/drama/projects/{id}/characters/{charId}/reference-sheet
body: { angles?: ["front","side","full"], ratio?, appearanceHint? }
→ { characterId, refImages: [{cdnKey,url,angle,label}], cost }
```

- 复用 `IMAGE_GENERATION` 端点 + prompt key `drama.character_frame_image`（`frameKeyForKind("character")` 已存在 `:105`）；每角度一次出图，prompt vars 注入 angle（正面肖像/侧脸/全身），ref 用角色已有定妆图锁脸（一致性）。
- **计费 hold→commit（§4.2）**：单价 `drama.credit.frame`（`KEY_FRAME=2`）× 角度数。
  1. `creditService.hold(userId, frameCost*N, "DRAMA_CHAR_SHEET", charId+"_"+uuid, "角色三视图")`；
  2. 逐角度出图成功 → `commitHold(refType, refId, frameCost, "第N视图")`（分次 commit）；
  3. 某角度失败 → 已成功的保留、剩余 `releaseHold`（退未消费）；全失败 → releaseHold 全额 + 抛 502。
  > 与 `renderFrame` 现用的一次性 `debit` 不同——三视图是多产物批处理，hold→commit 才能做“部分成功部分退”。这是**有意的差异**，见 §7 冲突点。
- 未配图像端点 → 503 `IMAGE_NOT_CONFIGURED`（不 hold、不扣费，§8.0）。
- 产物 `cdnUploader.upload` → cdnKey → append 到 `DramaCharacter.refImagesJson`（带 angle）→ 同步文档（双写）。
- `storage.checkQuota("drama",userId,0)` 前置（同 renderFrame `:151`）。

### 4.4 前端 types/api/组件

- 类型（drama 真源在 web-drama，见 §7 冲突）：`mocks/drama-workshop/types.ts` 的 `CharacterDef` 加 `refImages?: DramaRefImage[]`；`SceneAsset` 加 `refImages?: DramaRefImage[]`（保留旧 `refUrl/refCdnKey` 单图字段作过渡）。
- api：`apps/web-drama/src/api/characters.ts`（新）或并入 `projects.ts`：`generateReferenceSheet(projectId,charId,input)`。
- 组件：短剧设定页「角色与场景」的角色卡加“一键三视图”按钮 + 参考图集缩略图墙（正/侧/全身 tab）。

### 4.5 openapi diff

- 新 path stub `/me/drama/projects/{id}/characters/{charId}/reference-sheet`（post）。
- 无需为 characters/scenes 实体加独立 CRUD path（它们随 `saveProject` 双写，不新增端点）。

### 4.6 测试计划

- `DramaAssetServiceTest`（`@TestPropertySource aep.cdn.driver=local`）：懒回填幂等（跑两次不重复建）；双写 upsert（增/改名/软删对齐）；单图 `refCdnKey`→`refImages[0]` 迁移。
- 三视图端点测试：mock 图像端点，验证 hold 总额 = frameCost×N、逐角度 commit、某角度失败 → 剩余 release、未配端点 503 且 0 hold。
- 门禁同上（含 `./mvnw test-compile`）。

### 4.7 文件清单 + 类型真源澄清

```
apps/server/.../aep/model/{DramaCharacter,DramaScene}.java                (新)
apps/server/.../aep/repository/{DramaCharacterRepository,DramaSceneRepository}.java (新)
apps/server/.../aep/service/DramaAssetService.java                        (新：回填+双写+三视图)
apps/server/.../aep/service/DramaProjectService.java                     (saveProject/getProject 挂双写+回填)
apps/server/.../aep/controller/DramaProjectController.java               (+reference-sheet 端点) 或 DramaRenderController
apps/server/.../aep/dto/{DramaCharacterDto,DramaSceneDto,DramaRefImageDto}.java (from(entity,signer))
apps/web-drama/src/mocks/drama-workshop/types.ts                         (CharacterDef/SceneAsset +refImages)
apps/web-drama/src/api/{characters.ts|projects.ts}                       (generateReferenceSheet)
apps/web-drama/.../短剧设定「角色与场景」组件                              (三视图 UI)
specs/openapi.yaml；docs/*；TODO.md
```

> **⚠️ 类型真源与 §5 SOP 的偏差（须知会主架构师，见 §7）**：AGENTS §5 规定“packages/types 是新代码类型唯一事实源”，但 **drama 域的 TS 类型实际不在 `packages/types`**——`CharacterDef`/`SceneAsset`/`BoardShot`/`ProjectData` 都在 `apps/web-drama/src/mocks/drama-workshop/types.ts`，api 契约在 `apps/web-drama/src/api/*.ts`。`packages/types/src/` 无任何 drama 文件。**建议 C-2 沿用 drama 既有本地约定**（在 web-drama 定义），不为两个新实体单独破例去 packages/types，否则 drama 类型分裂两处更糟。这是与主架构师“按 §5 走 packages/types”约束的**冲突点**，需拍板。

---

## 5. Phase C-3 — L1 服务端参考装配（Reference Assembler）

**目标**：把 `epscript.tsx:shotRefImages` 优先级链下沉服务端，按端点 capability（D-11）裁剪并回报（复用 C-1 `applied_refs`）；render 接口改收 `shotId`/结构化槽位包（保留 `ref_images` 过渡兼容）；前端重建共享 `useShotRender` hook 供 epscript + shorts/make 双线消费。

### 5.1 Assembler 输入输出契约（结构化槽位包）

新组件 `DramaReferenceAssembler`（`@Service`，纯装配 + 可单测）。

**输入**（render body 演进，三种入参优先级）：
```jsonc
// 首选：shotId 引用（服务端自装配）
{ "shot_ref": { "project_id":"dp_x", "episode_no":3, "scene_id":"sc_1", "shot_id":"sc_1_s2", "chain_consistency":true } }
// 或：显式结构化槽位包（前端已算好槽位，服务端只裁剪/回报）
{ "ref_slots": { "character_refs":[{cdnKey|url,angle}], "scene_ref":{...}, "prev_last_frame":{...}, "first_frame":{...}, "last_frame":{...}, "style_anchor":{...} } }
// 或（过渡兼容，C-1 现状）：无差别数组
{ "ref_images": ["url1","url2",...] }
```

**输出**（Assembler → 供 `callImageModel`/`renderClip` + 回报前端）：
```jsonc
{
  "slots": {                       // 装配后的真实资产（cdnKey 优先，签名 url 派生）
    "character_refs": [ {"cdnKey":"…","url":"…","angle":"front"} ],
    "scene_ref":       {"cdnKey":"…","url":"…"},
    "prev_last_frame": {"cdnKey":"…","url":"…"},
    "first_frame":     {"url":"…"},
    "last_frame":      {"url":"…"}
  },
  "applied_refs": { /* §2.3 同结构，role=character|scene|prev_last_frame|first_frame|last_frame */ }
}
```

**装配 → 模型入参**：
- 图像（frame）：`slots.character_refs + scene_ref + prev_last_frame` 展平去重，按 `capability.maxRefImages` 裁剪（超出标 `over_max_refs`）→ `extra_body.image[]`。
- 视频（clip）：`first_frame`/`last_frame` 按 `capability.supportsFirstLastFrame` 决定是否送（不支持标 `model_no_flf`）；其余多参考视 `supportsSubjectReference`。
- 裁剪优先级（保 identity）：character_refs > scene_ref > prev_last_frame（末位先被砍）。

### 5.2 优先级链 → 服务端数据来源映射

对照 `epscript.tsx:shotRefImages`（`:643-666`）逐条：

| 前端逻辑 | 服务端来源 | 取法 |
|---|---|---|
| `shot.cast[]` @提及角色 | 从 payloadJson 定位 shot | shotId=`<sceneId>_s<no>`；遍历 `payloadJson.episodeDocs[<episode_no>].storyboard.scenes[].shots[]`（或 `script.scenes`）匹配 `id==shot_id`，读其 `cast:string[]`（角色 id） |
| cast 空 → 画面文本名匹配 | `shot.desc/visual` + 角色名 | 同 epscript：对 `drama_character`（C-2 实体）name 做 `desc.includes(name)` 兜底 |
| 仍空 → 本集全体 | `drama_character` by projectId | 全体有 refImages 的角色 |
| 角色参考图 | **`drama_character.refImages`（C-2 实体，cdnKey）** | 优先 `angle=front`；无实体时懒回填后再取；再兜底 `avatarImage` |
| `sceneRefUrlFor`（sceneRefId 显式→名称兜底） | `drama_scene`（C-2）+ 文档 `ScriptScene.sceneRefId` | scene_id → 该 scene 绑定的 `sceneRefId` → `drama_scene.refImages`；兜底名称匹配 |
| `prevFrameInScene`（同场上一镜真实末帧） | **两条来源，见下** | ↓ |
| `nextFrameInScene`（下一镜首帧作尾帧） | 同场下一镜 shot 的 `frameUrl` | 从 payloadJson 同场 shots 顺序取 |

**同场上一镜“真实末帧”查询（关键，注意 variant_config）**：
- **首选（简单可靠）**：从 `payloadJson` 同场上一镜的 shot 记录读 `lastFrameUrl ?? frameUrl`（前端 render 回填已写入文档，`resignAssetUrls` 会重签）。
- **权威回退（真值）**：查 `MaterialVideoJob`——`renderClip` 把 `shot_id`/`scene_id`/`episode_no` 写进 `variant_config`（`DramaRenderService.java:362-366`），成功任务的 `lastFrameCdnKey`（C-1）是真值。但 `variant_config` 是 JSON、**无索引列**（Repo 只有 `findByOwnerUserIdAndScriptId`）。取法：`findByOwnerUserIdAndScriptIdOrderByCreatedAtDesc(userId, projectId)` 拉该项目 job，内存解析 `variantConfigJson` 找 `scene_id` 相同、`shot_id` 为上一镜、`status=succeeded` 的最新 job，读 `lastFrameCdnKey`→`signer.signKey`。
- **推荐**：C-3 用“文档优先 + job 权威回退”，job 侧用 `lastFrameCdnKey`（C-1 产物，不过期）替代过期的 `lastFrameUrl`——这正是 C-1 是 C-3 隐性前置的原因。若嫌内存扫 job 慢，可另开 backlog：给 MaterialVideoJob 加 `shotId`/`sceneId` 索引列（C-4 DAG 时必做，C-3 不强求）。

### 5.3 过渡兼容策略

- 三种入参共存：`shot_ref` > `ref_slots` > `ref_images`。老前端继续传 `ref_images` 数组照常工作（Assembler 直通 + 只做 fetchable/capability 裁剪 + applied_refs 回报）。
- 新前端（useShotRender）改传 `shot_ref`，服务端全装配。
- 灰度：先上服务端 Assembler（接受三种），前端后切 `shot_ref`，验证 `applied_refs` 一致后删前端 `shotRefImages`。

### 5.4 `useShotRender` hook API 面

`apps/web-drama/src/lib/use-shot-render.ts`（放 lib，不再随 stage 陪葬，修 P-6）：

```ts
export interface UseShotRenderOptions { projectId?: string; ratio?: string; kind?: "shot"|"short"; endpointId?: string; }
export interface ShotRenderResult { appliedRefs?: AppliedRefs; }
export function useShotRender(opts: UseShotRenderOptions): {
  renderFrame(shotRef: ShotRef, count?: number): Promise<{frames: RenderedFrame[]; appliedRefs?: AppliedRefs}>;
  renderClip(shotRef: ShotRef): Promise<DramaEpisodeJob & {appliedRefs?: AppliedRefs}>;
  decompose(shotRef: ShotRef): Promise<ShotDecomposeResult>;
  frameJobs: Map<string, DramaFrameJob>;   // 轮询态
  polling: boolean;
};
// ShotRef = { episodeNo; sceneId; shotId; chainConsistency; endpointId? }
```

hook 内聚合：提交（传 `shot_ref`）+ 轮询（`pollFrameJob`/`pollClipJob`）+ applied_refs 暴露。epscript 与 shorts/make 都消费它，删各自复制的 `shotRefImages`/`watchFrameJob`/`watchClipJob`。

### 5.5 双线接入点

- `epscript.tsx`：删 `shotRefImages/sceneRefUrlFor/prevFrameInScene/nextFrameInScene`（`:611-666`）+ `watchFrameJob/watchClipJob`；`render`（`:690-759`）改调 `useShotRender`。`shotConsistencyIssues`（`:670-688`）体检可保留前端（纯 UI 提示）或也下沉（可选，非本阶段强制）。
- `shorts/make/page.tsx`：同样替换为 `useShotRender`（`kind:"short"`）。
- dev 过滤暗坑：Assembler 在 local driver 下仍产 `/cdn` 参考，但 `applied_refs` 标 `local_unfetchable`（见 §6），前端 chip 如实显“本地环境参考未送达”，不再静默。

### 5.6 openapi diff

- `/render/frame`、`/render/clip` summary 追加“可传 `shot_ref`（服务端参考装配）/ `ref_slots` / 兼容 `ref_images`；返回 `applied_refs` 带槽位 role”。
- 无新 path（复用现端点）。

### 5.7 测试计划

- `DramaReferenceAssemblerTest`（**纯函数矩阵**，审计 §3.5 明确要求）：cast 命中/文本兜底/全员；scene 显式/名称兜底；prev_last_frame 文档 vs job；capability 裁剪（maxRefImages=1/4/6、supportsFlf true/false）；去重；三入参优先级。
- 集成：`shot_ref` 定位 payloadJson 内 shot 正确（episodeDocs 嵌套遍历）；job 权威回退取 `lastFrameCdnKey`。
- fake-llm E2E：dev 下 `applied_refs` 标 local_unfetchable。
- 门禁同上。

### 5.8 文件清单

```
apps/server/.../aep/service/DramaReferenceAssembler.java             (新，纯装配)
apps/server/.../aep/service/DramaRenderService.java                 (renderFrame/renderClip 收 shot_ref/ref_slots → Assembler)
apps/server/.../aep/repository/MaterialVideoJobRepository.java       (可选：按 scriptId 已够；C-4 再加 shotId 索引)
apps/web-drama/src/lib/use-shot-render.ts                           (新，双线共享)
apps/web-drama/.../stages/epscript.tsx                              (删本地 ref 逻辑，接 hook)
apps/web-drama/src/app/(workspace)/shorts/make/page.tsx            (接 hook)
apps/web-drama/src/api/render.ts                                    (shot_ref/ref_slots 入参)
specs/openapi.yaml；docs/drama-storyboard-consistency.md；README；TODO.md
```

---

## 6. 全局风险与执行顺序注意事项

### 6.1 payloadJson 并发写（审计 §3.1.1，C-2/C-3 会放大）

- 现状：`saveProject` 全量覆盖无版本号（`:166`）；前端编辑与后端异步回填（lastFrameUrl/成片）本就并发。
- C-2 双写、C-3 装配读都会加剧。**本设计不解决乐观锁**（那是审计 P1 独立项），但执行 agent 须知：
  - C-2 双写角色/场景实体时**只 upsert 实体表，不重写整个 payloadJson**（实体是独立行，天然避开文档级 LWW）；渲染真值走实体表正是为了绕开文档并发。
  - render 回填仍走文档 → 与前端 PUT 冲突风险不变；**不要在 C-1/C-3 里新增“后端改写 payloadJson”的写者**（Assembler 只读文档，产物落 MaterialVideoJob 实体，不回写文档）。这是把并发面收敛而非扩大的关键纪律。

### 6.2 dev `/cdn` 参考图被过滤（`isFetchableImageRef` `DramaRenderService.java:417`）在 C-3 怎么解

- C-3 不强行让本地 `/cdn` 变外网可达（成本高）。采用**如实回报**：Assembler 计算完整槽位 → 过滤时把 local 项标 `applied:false, reason:"local_unfetchable"` 进 `applied_refs`（C-1 已建此机制）。前端 chip 显“本地环境参考未送达（生产 OSS 正常）”。
- dev + fake-llm 场景下 fake 图像端点本就不抓 ref，行为无损；真实一致性验证须在 OSS 环境（对齐 MEMORY「Tests on localhost」——本地 HMR 验交互，OSS 验一致性）。
- 可选增强（backlog，不阻塞 C-3）：local driver 下把 `/cdn` 小图 base64 inline 进 `extra_body.image`，让本地也能真送参考。

### 6.3 C-1 是 C-3 的隐性前置

C-3 的“同场上一镜真实末帧”权威来源是 MaterialVideoJob 的末帧；只有 C-1 把它镜像成不过期的 `lastFrameCdnKey` 后，跨镜承接才稳。执行顺序 C-1 先行是硬要求（审计路线图 C-1 无依赖、最先）。

### 6.4 D-11 worker 端点透传是最深改动

`renderClip → MaterialVideoJobService.submit → MaterialVideoWorker → MaterialVideoModelClient.pickEndpoint` 当前硬编 `resolveEndpoint(VIDEO_GENERATION)`。透传 endpointId 要串这四层，且不能破坏 celebrity 素材线（它不传 endpoint_id → 默认端点）。建议 endpointId 随 item 存 `variant_config`，client `pickEndpoint` 优先读 item 指定、缺省回默认。加回归测试覆盖 celebrity 线默认路径。

### 6.5 计费一致性小分裂（须知会架构师）

renderFrame 用 `debit`（一次性），C-2 三视图用 `hold→commit`。两者混用会让“短剧首帧类扣费”在账本上出现 SPEND（debit）与 FREEZE→SPEND（hold）两种形态。可接受（语义不同：单产物 vs 批产物部分退），但需在 TODO.md 记一笔，未来若统一渲染扣费再收敛。

### 6.6 门禁命令清单（每阶段提交前全绿）

```bash
# 后端（改了 DTO/record/实体后必须 test-compile，不是只 compile）
(cd apps/server && ./mvnw test-compile -q)          # 本地；联网构建走 central: MAVEN_ARGS + --dangerouslyDisableSandbox
(cd apps/server && AEP_CDN_DRIVER=local ./mvnw -Dtest=DramaReferenceAssemblerTest,DramaAssetServiceTest,... test)
# 前端
pnpm --filter @ai-star-eco/web-drama typecheck
pnpm --filter @ai-star-eco/web-drama build
pnpm typecheck:admin            # 仅 D-11 动了 admin
pnpm typecheck:all
# 契约
pnpm check:api-contract         # 新端点必须已在 openapi.yaml 有 path（否则 gate fail）
# 文档纪律（§9）
git diff --name-only | grep -E 'openapi.yaml|VERSION_HISTORY|README|TODO.md'   # 确认同 commit 更新
```

- 测试类务必 `@TestPropertySource(properties="aep.cdn.driver=local")`（否则 OSS 驱动崩，MEMORY env-cdn-driver-boot-gotcha）。
- 本地 H2 `./data` 可能有 Flyway/schema drift，宁可用 in-memory / 独立 `SERVER_PORT` dev-login E2E（MEMORY worktree-path-gotcha）。

---

## 7. 需主架构师决策的冲突点（摘要）

1. **drama TS 类型不在 `packages/types`**（在 `apps/web-drama/src/mocks/drama-workshop/types.ts` + `api/*.ts`）。主架构师 C-2 约束写“按 §5 SOP 走 packages/types → api → server mirror”。**实际 drama 域从未进 packages/types**。建议：C-2 两个新实体类型沿用 drama 本地约定，不破例。**须拍板**（否则 drama 类型会分裂两处）。
2. **计费形态分裂**：renderFrame=`debit`（一次性），C-2 三视图建议=`hold→commit`（批产物部分退）。可接受但不统一，记 TODO。若架构师要求全统一，三视图可退化为“逐视图各 debit”（失败即不 debit），代价是失去“预冻结总额”的余额保护。
3. **D-11 表策略**：本设计选“新表 `ai_app_endpoint_candidate` + AiAppBinding 保持默认端点”，而非改 AiAppBinding 主键。这样零迁移、现有调用者与 admin 默认绑定不变。若架构师倾向“candidate 全量替代 AiAppBinding”，则需数据迁移 + 改所有 `resolveEndpoint` 调用点，风险大得多——**建议维持新表方案**。
4. **C-3 同场末帧的权威来源**：文档优先 vs MaterialVideoJob(variant_config 内存扫) 权威回退。variant_config 无索引，大项目内存扫有成本。C-3 先用“文档优先 + job 回退”，给 MaterialVideoJob 加 `shotId/sceneId` 索引列留到 C-4（DAG 必做）。若架构师希望 C-3 就上索引列，可提前，但那会碰热路径实体。
5. **C-1 是否顺带偿还 `MaterialVideoJob.videoUrl` 的 §4.7.6 URL→key 欠债**（toCard 注入 signer 后可 `maybeSign` video/thumbnail）。低风险但扩大 C-1 爆炸半径，建议**仅签 last_frame，video/thumbnail 用 maybeSign 兜底**（local 无影响），完整 key 化留独立 PR。
