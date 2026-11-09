# 视频素材库统一方案

状态：OneToken 已接入统一框架；2026-11-09 新凭据的 `bingbing` 项目已通过官方素材组、虚拟人像入库及核验会话实测。Fast / Mini 已绑定 `ark-bingbing`，官方素材库和核验页已随 `20261109-ark-portraits-137b5754` 发布。本人刷脸和真人成片尚待验收。last-reviewed 2026-11-09。

## 现在做到哪了

| | 状态 |
|---|---|
| 素材准备（`VideoAssetPreparer`）、适配器接口（`VideoAssetLibrary`）、素材库表（V75） | 已发布 |
| OneToken 搬入（`OneTokenAssetLibrary`），两条 Seedance 绑定 `onetoken-main` | 已发布 |
| 同账号的型号共用回执（2.0 和 2.5 同一张图只传一次） | 已发布 |
| 引用失效时作废回执、重传一次再提交 | 已发布 |
| 火山拒绝真人图时提示换 Seedance 2.5 或 MiniMax H3 | 已发布 |
| 火山虚拟库、真人认证、人像核验页 | 新凭据权限已验证，已发布并绑定 Fast / Mini；本人刷脸及真人成片尚未验收 |
| 聚算、七牛搬入 | 没做 |

下文按 2026-11-09 当前工作区实现更新。生产已切换 Fast / Mini API Key 并绑定官方素材库；后续渠道和容量治理列为待办。

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

**火山官方：** 画布、AI 视频和分段视频在调用生成接口及冻结积分之前检查参考素材。已入库的人像复用 `asset://`；已登记但未就绪的人像，以及前端本地检测到可能含人脸的图片，在当前页弹窗确认。检测只判断可能含人脸，不判断真人或虚拟，也不代替供应商审核。检测不可用或漏检时，由官方明确的人脸拒绝作为兜底。

弹窗保留提示词、参考图和当前任务。用户选择「真人照片」并关联已核验人物，或选择「AI 虚拟人像」并确认声明后提交审核。真人首次通过官方 H5 本人核验取得专属素材组；新增同一人的素材仍需一致性审核。审核通过后点「继续生成」。关闭弹窗只推迟处理，不清空创作内容。

资产页 `/assets/verification` 沿用白底、深墨、精简列表，默认「人像素材」，次级「本人核验」。页面与弹窗复用同一套 Ant Design 表格、表单、选择器、授权勾选及核验对话框，不使用原生下拉控件。

官方**预置虚拟人像**已有资产 ID，可以直接引用；自有图片属于私域素材入库，不能仅加上 `asset://` 前缀。当前没有接官方预置库的浏览/检索界面。本人核验不能由服务端自动完成。

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

当前 `VideoAssetLibrary` 保留 OneToken 的同步上传方法，并增加带 owner 的 `preparedReference`、`flagReview`、`forgetReferences` 和 `preparesLegacyInputs` 扩展。`ArkAssetLibrary` 负责官方渠道引用与拒绝映射，`ArkPortraitLibrary` 负责官方控制面、本人记录和素材状态；普通素材继续签名 URL，只有登记的人像进入官方库。不用空适配器或空引用表示成功。

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
| 尚未声明的含人脸图片（包括平台生成图片） | 弹窗明确选择人像类型并确认声明 |
| 其它（用户上传，或用上传图生成的） | 同一弹窗确认，不自动声明为虚拟人物 |
| 虚拟库审核失败 | 弹窗说明「被判定为含真人」，只能走真人认证或换图 |
| 真人比对失败 | 弹窗说明「和认证的本人不一致」，建议换清晰正面图 |

**为什么不把平台生成的图一律自动入库：** 虚拟库要求企业承诺素材不与任何真人雷同。用真人照片当参考生成的图，可能违反这条承诺。

**用户选「AI 生成」要留记录：** 谁、什么时候、对哪张图做的声明都入库，出了肖像纠纷能查。

## 7. 任务流转

前置检查先于计费；处理期间尚未创建视频任务或冻结积分。

已受理任务遇到官方明确的人脸拒绝时，只有未取得供应商任务号才进入 `queued + VIDEO_ASSET_NEEDS_REVIEW`，原请求、原任务及原冻结保留，等待期间不占端点槽、不重复调用。服务端记录核验轮次和开始时间，30 分钟未恢复则取消并释放原冻结。此为当前“原地继续”实现；取代第 12 节原先“失败退回后重新生成”的草案流程，已随 `20261109-ark-portraits-137b5754` 生效。

客户端从原运行记录的 `assetReviews` / 任务卡 `asset_reviews` 打开同一弹窗。核验完毕，`reviews/{id}/resume` 在服务端重验本人归属、素材 Active、真人授权有效和任务未受理，以条件更新清除阻断，事务提交后唤醒原队列。双击、刷新或丢失响应不新建任务、不二次冻结。

受理未知或已有供应商任务号不进入此流程，继续原有对账。取消与 30 分钟过期只释放一次。核验期间不持数据库锁或连接；官方上传按素材库限频。长视频不把核验错误当成自动重试的生成失败。

## 8. 数据

V75 保留 `video_asset_library` 和模型的 `asset_library_id`；V78 新增加密凭据列以及 `video_asset_person`、`video_asset_portrait`，不修改已执行迁移。项目名、AIGC 素材组等非敏感配置存在 `config_json`；AK/SK 与本人会话凭证加密，不出 DTO、审计或日志。

人像记录按 owner + library + storage key 隔离，保存官方资产 ID、入库状态、人物关联、声明版本与时间。真人组只能由官方本人核验结果取得。声明保留不可变记录；撤销后本地立即禁用后续引用，并删除官方素材组，处理迟到回调及并发上传的清理。

## 9. 接口

| 接口 | 用途 |
|---|---|
| `GET /api/v1/ip-studio/asset-library` | 本人素材、人物及协议版本 |
| `POST /api/v1/ip-studio/asset-library/check` | 官方模型引用的前置检查，不上传、不计费 |
| `POST /api/v1/ip-studio/asset-library/items` | 登记本人素材，尚不上传官方 |
| `POST /api/v1/ip-studio/asset-library/items/{id}/declaration` | 明确类型与授权后入库 |
| `POST /api/v1/ip-studio/asset-library/items/{id}/refresh` | 查询已有资产审核结果 |
| `POST /api/v1/ip-studio/asset-library/persons` | 创建本人核验会话 |
| `POST /api/v1/ip-studio/asset-library/persons/{id}/refresh` | 服务端确认本人核验结果 |
| `DELETE /api/v1/ip-studio/asset-library/persons/{id}` | 撤销及清理官方组 |
| `GET /api/v1/ip-studio/asset-library/reviews/{id}` | 原任务需处理的素材 |
| `POST /api/v1/ip-studio/asset-library/reviews/{id}/resume` | 审核通过后恢复原任务 |
| `GET /api/v1/asset-library/callback` | 随机会话 state，服务器核对后 303 去除令牌 |

回调不信任 URL 的成功参数，必须由 `GetVisualValidateResult` 返回 GroupId。素材入库后必须由 `GetAsset` 返回 Active，HTTP 200 本身不表示审核通过。控制面经现有签名管理命令 `videoAssetLibrarySave` 配置，校验项目及组归属；客户端不能填写官方凭据。

## 10. 边界和故障

| 情况 | 处理 |
|---|---|
| 入库失败、超时 | 弹窗展示失败原因并允许处理；原任务等待超过 30 分钟取消并释放冻结 |
| 引用失效（过期、被删、付费档逾期被回收） | 提交被拒时作废这条记录，重新入库一次；真人素材要重新上传，不用重新刷脸 |
| 同一张图两个任务同时要入库 | 记录唯一，第二个任务等第一个的结果 |
| 素材库容量满 | 当前展示官方服务失败；专门错误映射与容量告警待补 |
| 火山项目不一致 | 启动时不查，第一次真调时会失败；配置时用 `GetAssetGroup` 验证 |
| OneToken 被拒且判真人 | 它没有真人认证，提示换模型 |
| 用户撤销授权 | 调 `DeleteAsset` / `DeleteAssetGroup`，把记录标为 `revoked`，之后不能再引用 |
| 长期不用的虚拟素材 | 后续补容量告警和清理策略，当前不自动删 |

**费用：** 入库和认证不扣用户积分。火山的上传和被拒都不收费，真人认证现在限时免费。权益包月费由平台承担。

**日志：** 按 AGENTS §8.0.1 ① 记录供应商原话。AK/SK 和 `H5Link`（里面带令牌）不进日志。

## 11. 分阶段

| 阶段 | 内容 | 用户能看到什么 |
|---|---|---|
| **OneToken 接入（已做）** | 适配器和素材准备；OneToken 搬入；同账号共用回执；引用失效重传一次 | 引用失效时任务不再失败；同一张图换型号不重传 |
| **0 真调（部分完成）** | 凭据、建组、虚拟样本入库、查询和 H5 会话已完成；真人刷脸和成片待验收，确认响应格式、审核时长、API 流程要不要登录火山账号、逼真的 AI 脸能否通过虚拟库审核 | 没有 |
| **1 虚拟库** | 火山适配器和虚拟库；等审核；明确声明后入库并继续 | 已发布，真实生成待验收 |
| **2 弹窗和真人库** | 弹窗、声明记录、真人认证和回调、已认证人物列表、撤销授权 | 已发布，真实核验与成片待验收 |
| **3 收尾** | 聚算、七牛搬入；额度告警和清理；导演台角色图提前入库，不用等拒绝；Studio 后台的素材库页（查看和设置模型绑定、用量） | 少一次等待，后台能看用量 |

当前已解除子账号权限阻碍。业务代码和 V78 已发布，Fast / Mini 已绑定官方素材库；真实本人刷脸、真人一致性审核与成片仍是未完成验收项。不得把示例预览、H5 会话或虚拟样本 Active 当作真人闭环。

## 12. 历史决定（2026-11-07，用户）

本节保留当时选择；权限和发布状态以后续顶部现状及第 7 节为准。

1. **官方渠道只入人物。** 全部入库不符合官方用法，还要开 1 万元/月的档位。
2. **权益先开免费的 Entry**（50 个素材、50 个组、每分钟 3 次）跑通，上量再升 1 万元/月（100 万个、每分钟 120 次）。
3. **原草案只有能确认的纯文生图才自动进虚拟库，其余问用户。** 当前实现对所有新登记的人像都要求显式声明，未增加自动虚拟声明。
4. **原草案等用户时退积分。** 2026-11-09 为接入原地续接，当前工作区改为优先在冻结前核验；漏检后的明确拒绝保留原冻结最多 30 分钟，超时释放，见第 7 节。
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
