# 视频素材库统一方案

状态：OneToken 已接入统一框架，代码在分支上，未发布；火山官方因子账号没有权限暂缓（见第 12 节）。last-reviewed 2026-11-07。

## 现在做到哪了

| | 状态 |
|---|---|
| 素材准备（`VideoAssetPreparer`）、适配器接口（`VideoAssetLibrary`）、素材库表（V75） | 已实现，未发布 |
| OneToken 搬入（`OneTokenAssetLibrary`），两条 Seedance 绑定 `onetoken-main` | 已实现，未发布 |
| 同账号的型号共用回执（2.0 和 2.5 同一张图只传一次） | 已实现，未发布 |
| 引用失效时作废回执、重传一次再提交 | 已实现，未发布 |
| 火山拒绝真人图时提示换 Seedance 2.5 或 MiniMax H3 | 已实现，未发布 |
| 火山虚拟库、真人认证、弹窗、等审核 | 没做，等权限 |
| 聚算、七牛搬入 | 没做 |

下面第 3 节往后写的是完整方案。接口和表现在只有 OneToken 用得到的部分，第 4 节和第 8 节标了哪些要等火山一起加。

## 1. 为什么要做

现在素材交给视频模型有四种做法，分散在 `MaterialVideoModelClient` 和数字人代码里：

| 渠道 | 现在怎么交素材 | 问题 |
|---|---|---|
| OneToken Seedance 2.0 / 2.5 | 传素材库换 `asset://ota-…`（原来写在端点规格 `inputAssets` 里，已搬入统一框架） | 能用 |
| 火山官方 Seedance 2.0 Fast / Mini | 直接给签名链接 | 真人图被拒，没有入库路径 |
| 聚算 H3 | 上传换 `assetId` | 也是素材库，但单独一套代码 |
| 七牛 modelink（数字人） | 建组、刷脸、入库、`qasset://` | 只有数字人能用 |

线上证据（2026-11-07）：

- 火山 Seedance 2.0 Fast 近 30 天 10 条任务，0 条成功，9 条被判真人。
- 同一批 9 张图，火山点名第 5 张（用户上传）和第 9 张（平台生成）。换到 OneToken 2.0 跑了两次，提交都通过，但都没出片：一次「provider failure confirmed by administrator」，一次「受理超时已退回」。两次都不是真人拒收，所以不能说明这批图在 OneToken 能出片。
- OneToken 2.5 另一条任务（5 张图走素材库）出片成功。这是素材库引用第一条真实成片。

## 2. 目标

1. 所有视频任务提交前走同一步「素材准备」，业务代码不需要知道走哪个渠道。
2. 渠道差异只写在各自的适配器里。新增供应商只加一个适配器。
3. 官方渠道能用真人图和 AI 人物图，用户不用懂素材库是什么。
4. 不静默降级（AGENTS §8.0）：入库失败就明确报错，不丢素材，不偷偷换模型。

## 3. 用户看到什么

**OneToken：** 没有变化。

**火山官方，AI 生成的人物：** 任务卡显示「素材审核中」，审核通过后自动继续，不用操作。

**火山官方，用户上传的人物图：** 第一次被拦下时弹窗，列出被点名的图，每张选一项：

- **真人：** 进入本人认证。电脑上显示二维码，本人手机扫码刷脸。通过后这张图入库。
- **AI 生成的虚拟人物：** 进虚拟库审核。
- **不用这张：** 回到编辑。

入库过的图下次直接可用，不再弹窗。同一个人认证一次，之后加图不用再刷脸。积分在弹窗出现时已退回，全部通过后点「重新生成」，按原来的请求再提交一次，这时才重新冻结积分。

## 4. 总体结构

```
业务入口（画布 / AI 视频页 / 导演台 / 长视频）
        │  不变，只传素材 key
        ▼
MaterialVideoWorker
        │
        ▼
VideoAssetPreparer（素材准备）      ← 新增，所有渠道同一套
        │  按端点找到素材库，逐个素材决定：直接用 / 上传 / 等审核 / 问用户
        ▼
VideoAssetLibrary（适配器）         ← 新增接口
   ├ ArkAssetLibrary       火山官方
   ├ OneTokenAssetLibrary  OneToken（由现有 uploadToLibrary 搬入）
   ├ JusuanAssetLibrary    聚算（第三阶段搬入）
   ├ QiniuAssetLibrary     七牛（第三阶段，数字人）
   └ PassThroughLibrary    没有素材库的渠道，给签名链接
```

完整的适配器接口如下。现在代码里只有 OneToken 用得到的两个方法（交文件换引用、判断引用是否失效），其余的和火山的实现一起加，不提前写没人调用的方法：

```java
public interface VideoAssetLibrary {
    Capabilities capabilities();
    /** 上传或入库。同步渠道直接返回 active，异步渠道返回 processing。 */
    LibraryReceipt submit(LibraryFile file, Placement placement, String groupId);
    /** 查询异步入库结果。 */
    LibraryReceipt refresh(String assetRef);
    /** 从供应商拒绝里找出被点名的素材序号；不是素材问题就返回空。 */
    List<Integer> flaggedInputs(int httpStatus, String responseBody);
    /** 只有支持真人认证的渠道实现。 */
    PersonSession startPersonCheck(String callbackUrl);
    String finishPersonCheck(String token);
    void delete(String assetRef);
}

record Capabilities(
    IngestScope scope,      // ALL：全部入库；PEOPLE_ONLY：只入人物
    boolean async,          // 是否要轮询审核结果
    boolean personCheck,    // 是否支持真人认证
    boolean virtualLibrary  // 是否支持虚拟人像入库
) {}
```

`Placement` 只有三种：`PLAIN`（普通存放）、`VIRTUAL`（虚拟人像）、`PERSON`（真人）。

## 5. 各渠道的流程

| | 火山官方 | OneToken | 聚算 H3 | 没有素材库的渠道 |
|---|---|---|---|---|
| 哪些素材入库 | 只有人物（理由见 §6） | 全部 | 全部 | 不入库 |
| 怎么入库 | 把地址交给 `CreateAsset`，异步 | 传文件，同步 | 传文件，同步 | 不入库 |
| 鉴权 | AK/SK 签名 | 模型的 API Key | 模型的 API Key | 按端点 |
| 审核 | 方舟安全审核，真人再比对人脸 | 无 | 无 | 无 |
| 分组 | 要：虚拟一个共用组，每个真人一个组 | 不要 | 不要 | 无 |
| 保留时间 | 主动删除前一直在 | 6 小时 | 按返回的有效期 | 无 |
| 真人认证 | 有，H5 刷脸 | 无 | 无 | 无 |
| 引用形式 | `asset://asset-…` | `asset://ota-…` | `assetId` | 签名链接 |
| 上传频率 | 免费 3 次/分钟，付费 120 次/分钟 | 60 次/分钟 | 未限定 | 无 |

**火山入库步骤（虚拟人像）：** `CreateAssetGroup`（`GroupType=AIGC`，平台共用一个组）→ `CreateAsset` → 轮询 `GetAsset` 到 `Active`。

**火山入库步骤（真人）：** `CreateVisualValidateSession` 拿 `H5Link` 和 `BytedToken` → 本人刷脸 → 浏览器回到我们的回调地址，`resultCode=10000` 算通过 → `GetVisualValidateResult` 拿 `GroupId`（`BytedToken` 30 分钟内有效）→ `CreateAsset` 传该组 → 人脸比对 → 轮询到 `Active`。

## 6. 素材怎么分流

**都走同一步，但入不入库由渠道决定。** 官方文档写明虚拟库里「非虚拟人像类素材无需入库」，也要求不用的素材不要入库。商品图、场景图传给火山不会被拦，文档的示例里也是 `asset://` 和普通链接混用。免费档只有 50 个额度，全部入库很快用完。

**火山怎么知道哪张是人物：** 先按「已入库的用引用，其余用链接」提交。火山拒绝时会点名（`content[5]`），而且拒绝不产生任务、不收费，约 5～8 秒。

| 被点名的图 | 处理 |
|---|---|
| 已有 `Active` 引用 | 不会被点名，直接用引用 |
| 平台纯文生图（可确认生成时没用上传图当参考） | 自动进虚拟库，任务继续等 |
| 其它（用户上传，或用上传图生成的） | 任务结束退积分，弹窗问用户 |
| 虚拟库审核失败 | 弹窗说明「被判定为含真人」，只能走真人认证或换图 |
| 真人比对失败 | 弹窗说明「和认证的本人不一致」，建议换清晰正面图 |

**为什么不把平台生成的图一律自动入库：** 虚拟库要求企业承诺素材不与任何真人雷同。用真人照片当参考生成的图，可能违反这条承诺。

**用户选「AI 生成」要留记录：** 谁、什么时候、对哪张图做的声明都入库，出了肖像纠纷能查。

## 7. 任务流转

**不新增任务状态。** 现有的取消、过期和退积分都认 `queued`，新增状态要改一串地方。等审核的任务保持 `queued`，通过已有的 `queue.requeue(延迟)` 回到等待，不占端点名额。

```
generateAsync
 ├ queue.acquire
 ├ preparer.prepare(job, spec)                ← 在 claimQueued 之前
 │    ├ READY → claimQueued → submit
 │    ├ WAIT  → queue.requeue(30 秒)，线程退出
 │    └ FAIL  → markFailed，退积分
 └ submit 被拒且点名素材
      ├ 全部能自动入库 → submitting 回到 queued（条件更新，只有没有任务号才允许）→ 入库 → WAIT
      └ 有要问用户的 → markFailed(VIDEO_ASSET_NEEDS_REVIEW)，退积分，details 带被点名的素材
```

几个容易错的地方：

- **退回 `queued` 只限明确拒绝。** 受理结果不明（`SubmissionUnknown`）照旧，不能重新提交。
- **`CreditHoldSweeper` 会让久未结算的 `queued` 任务过期。** 素材准备的上限（暂定 30 分钟）必须短于它的超时，或在它那里判断。
- **等待期间不能持锁、不能占连接。** `MaterialVideoInputAssets.resolve` 已改成不包事务，继续保持。
- **频率限制按素材库算，不按端点算。** 火山免费档每分钟 3 次，超了走 `requeue`，不在线程里睡。OneToken 现有的线程内短等可以保留。
- **长视频：** `VIDEO_ASSET_NEEDS_REVIEW` 不自动重试，执行停在 `needs_user`，用户处理完点「继续」。

**为什么等用户时要退积分：** 刷脸可能拖很久，用户也可能走开，不该一直冻着积分。代价是通过后要多点一次「重新生成」。

## 8. 数据

全部是新增表和新增列，不改已执行的迁移。V75 已建 `video_asset_library`（`id`、`name`、`adapter`、`config_json`、时间戳）和 `ai_model_providers.asset_library_id`，并把规格里有 `inputAssets` 的端点绑到 `onetoken-main`。下面其余的列和表等火山一起加，编号按线上最大值 +1。

**`video_asset_library`（新表）：** 一个素材库对应一个供应商账号。

| 字段 | 说明 |
|---|---|
| `id` | 如 `ark-main`、`onetoken-main` |
| `adapter` | `ark` / `onetoken` / `jusuan` / `qiniu` |
| `config_json` | 地址、路径、响应字段位置；OneToken 现在 `inputAssets` 的内容搬到这里 |
| `credential_mode` | `endpoint`：用模型自己的 Key；`own`：用下面这列 |
| `credential_encrypted` | 火山 AK/SK，加密存储，格式同音乐模型的 `AccessKeyId:AccessKeySecret` |
| `project_name` | 火山项目名，必须和出视频的 API Key 同项目 |
| `virtual_group_id` | 平台共用的虚拟人像组 |
| `rate_per_minute`、`asset_limit` | 频率和容量，用于限流和告警 |

**`ai_model_providers.asset_library_id`（新列）：** 模型属于哪个素材库。放列而不放规格 JSON，因为规格解析很严格，加字段会挡住回滚（见 `docs/releases/onetoken-assets-release-20261107.md`）。火山 Fast 和 Mini 共用一个素材库，同一张图不用传两次。

**`material_video_input_asset`（加列，保留原表和旧数据）：**

| 新增字段 | 说明 |
|---|---|
| `library_id` | 所属素材库 |
| `status` | `processing` / `active` / `failed` / `expired` / `deleted` |
| `placement` | `plain` / `virtual` / `person` |
| `person_id` | 真人素材对应的人 |
| `owner_user_id` | 素材所有者 |
| `fail_code`、`fail_reason` | 入库失败原因 |
| `declared_kind`、`declared_by`、`declared_at` | 用户声明记录 |
| `last_used_at` | 用于清理 |

**`video_asset_person`（新表）：** 一个用户在一个素材库里认证过的一个人。字段：`id`、`owner_user_id`、`library_id`、`name`、`group_id`、`status`（`verifying` / `active` / `failed` / `revoked`）、`consent_id`、`callback_token`、`byted_token`、时间戳。

## 9. 接口

| 接口 | 用途 |
|---|---|
| `POST /api/v1/ip-studio/asset-library/declarations` | 提交弹窗里每张图的选择，触发入库 |
| `GET /api/v1/ip-studio/asset-library/items?keys=` | 查这些素材的入库状态，弹窗和任务卡轮询 |
| `POST /api/v1/ip-studio/asset-library/persons` | 开始真人认证，返回链接和二维码内容 |
| `GET /api/v1/ip-studio/asset-library/persons` | 我认证过的人 |
| `GET /api/v1/ip-studio/asset-library/persons/{id}` | 认证进度 |
| `DELETE /api/v1/ip-studio/asset-library/persons/{id}` | 撤销授权，同时删火山上的素材和素材组 |
| `GET /api/v1/asset-library/callback` | 刷脸后浏览器回跳，无登录，靠 `callback_token` 校验 |

视频任务和运行记录的返回内容新增 `assetReview`：状态、每张图的序号、缩略图、入库状态。错误码新增 `VIDEO_ASSET_NEEDS_REVIEW`、`VIDEO_ASSET_REVIEW_FAILED`、`VIDEO_ASSET_REVIEW_TIMEOUT`、`VIDEO_ASSET_QUOTA_EXCEEDED`。

**回调不能只信地址参数：** 收到 `resultCode=10000` 后，还要用 `GetVisualValidateResult` 向火山确认，拿到 `GroupId` 才算通过。

**前端：** `reportStudioError` 认出 `VIDEO_ASSET_NEEDS_REVIEW` 后打开同一个弹窗组件，画布、AI 视频页、导演台、长视频共用。

**可以复用的：** `VolcOpenApiSigner`（火山签名）、`DapConsentService`（人脸授权协议和版本）、`/api/v1/real-auth/callback` 的回调写法、`DapModelinkPoller` 的轮询写法。真人记录不并入 `dap_material_group`，那张表和数字人的捕获流程绑得很紧，而且线上在用。

## 10. 边界和故障

| 情况 | 处理 |
|---|---|
| 入库失败、超时 | 任务失败退积分，写明第几张、什么原因 |
| 引用失效（过期、被删、付费档逾期被回收） | 提交被拒时作废这条记录，重新入库一次；真人素材要重新上传，不用重新刷脸 |
| 同一张图两个任务同时要入库 | 记录唯一，第二个任务等第一个的结果 |
| 素材库容量满 | 报 `VIDEO_ASSET_QUOTA_EXCEEDED`，飞书告警；80% 时提前告警（接 `ModelQuotaAlerts`） |
| 火山项目不一致 | 启动时不查，第一次真调时会失败；配置时用 `GetAsset` 验证 |
| OneToken 被拒且判真人 | 它没有真人认证，提示换模型 |
| 用户撤销授权 | 调 `DeleteAsset` / `DeleteAssetGroup`，把记录标为 `revoked`，之后不能再引用 |
| 长期不用的虚拟素材 | 30 天没用就 `DeleteAsset`，释放额度；真人素材不自动删 |

**费用：** 入库和认证不扣用户积分。火山的上传和被拒都不收费，真人认证现在限时免费。权益包月费由平台承担。

**日志：** 按 AGENTS §8.0.1 ① 记录供应商原话。AK/SK 和 `H5Link`（里面带令牌）不进日志。

## 11. 分阶段

| 阶段 | 内容 | 用户能看到什么 |
|---|---|---|
| **OneToken 接入（已做）** | 适配器和素材准备；OneToken 搬入；同账号共用回执；引用失效重传一次 | 引用失效时任务不再失败；同一张图换型号不重传 |
| **0 真调（等权限）** | 开通权益，配 AK/SK；真调建组、入库、查询和一次刷脸，确认响应格式、审核时长、API 流程要不要登录火山账号、逼真的 AI 脸能否通过虚拟库审核 | 没有 |
| **1 虚拟库** | 火山适配器和虚拟库；等审核；纯文生图自动入库后继续 | 平台生成的人物图在火山模型上能出片 |
| **2 弹窗和真人库** | 弹窗、声明记录、真人认证和回调、已认证人物列表、撤销授权 | 用户上传的真人图能出片 |
| **3 收尾** | 聚算、七牛搬入；额度告警和清理；导演台角色图提前入库，不用等拒绝；Studio 后台的素材库页（查看和设置模型绑定、用量） | 少一次等待，后台能看用量 |

阶段 0 不用写业务代码，它的结果可能改变后面的设计，所以要先做。真调脚本要 AK/SK（存本机 `~/.config/aistar/ark-assets.key`，格式 `AK:SK`），子账号要有 `ArkFullAccess`，还要开通免费的 Entry 权益。

## 12. 已确认的决定（2026-11-07，用户）

1. **官方渠道只入人物。** 全部入库不符合官方用法，还要开 1 万元/月的档位。
2. **权益先开免费的 Entry**（50 个素材、50 个组、每分钟 3 次）跑通，上量再升 1 万元/月（100 万个、每分钟 120 次）。
3. **只有能确认的纯文生图才自动进虚拟库，其余问用户。** 这条承诺是公司签的。
4. **等用户时退积分。** 代价是通过后多点一次「重新生成」。
5. **先搭 OneToken。** 开通火山素材库时子账号没有权限，这部分先放下。在这之前，火山的 Seedance 2.0 Fast / Mini 仍不收含真人的参考图，报错时提示换模型，不替用户换。

## 13. 依据

- [Seedance 便利创作含肖像视频](https://docs.volcengine.com/docs/ark/seedance-portrait-asset-guide?lang=zh)
- [私域真人人像素材资产使用指南](https://docs.volcengine.com/docs/ark/guide-preview?lang=zh)
- [私域虚拟人像素材资产库使用指南](https://docs.volcengine.com/docs/ark/private-virtual-avatar-library-guide-preview?lang=zh)
- [录入真人形象素材](https://docs.volcengine.com/docs/ark/upload-real-person-portrait-assets?lang=zh)
- [创建素材资产 API](https://docs.volcengine.com/docs/ark/create-asset-api?lang=zh)
- [Seedance 高级创作权益包购买说明](https://docs.volcengine.com/docs/ark/seedance-2-0-purchase-guide?lang=zh)
- [火山方舟错误码](https://docs.volcengine.com/docs/ark/error-codes?lang=zh)
- [OneToken API 文档](https://onetoken.love/docs?video_model=seedance-2.5)
