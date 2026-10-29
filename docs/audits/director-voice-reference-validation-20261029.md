# 导演台角色声音上传与聚算引用验证

> 发布补记：2026-10-29 已随 main `9ad3603b0` 发布 server + Studio，线上范围和实际验收见 [发布记录](../releases/director-ai-entries-production-release-20261029.md)。下文保留各开发与审查阶段的历史事实；本次未验证真实供应商声音效果或视频出片。

日期：2026-10-29。状态：本地实现及验证完成，提交及合并以 Git 记录为准，尚未发布；没有重提用户任务或发起真实视频生成。

## 生产故障证据

只读核对主服务 `aistareco-server` 日志，导演台 `POST /api/v1/ip-studio/director/works/{id}/uploads` 存在实际 500（例如 traceId `Uanp82DT2X4SwWrk`）。异常链经过 `DirectorService.uploadAudio`、`StudioMediaImportService`、个人素材自动入库，最终为查询 `aep_users ... FOR UPDATE` 时 MySQL 报 `Cannot execute statement in a READ ONLY transaction`。

该接口虽已把作品归属查询改为无锁读取，外层仍是 `@Transactional(readOnly=true)`；自动入库需要持用户行锁，并且上传要写存储额度与素材记录。错误发生在我方入库阶段，尚未发送到聚算。

## 本地改动

- 上传改为可写事务，接收 MP3 / WAV / M4A；在存储前以实际字节与 ffprobe 检查 2–15 秒、最多 15 MiB。
- 保存角色音色时重新校验本人 key、实际文件与时长。作品当前选择聚算全能参考模型时，先向厂商上传样本取得可用 assetId，再绑定人物。失败保留原角色照片及声音。
- V71 新建 `material_video_input_asset`。以端点、地址、模型、凭据、来源 key 的散列隔离回执，长期人物绑定仍使用我方 storage key；不存凭据和签名 URL。
- 保存音色与生成 worker 共用同一上传及回执复用路径。仅在 `expiresAt` 前且剩余超过 60 秒时复用；没有有效期不假定永久。到期从原样本重新上传。首次并发引用使用原子 upsert，避免撞主键。
- 浏览器保留已上传样本；聚算绑定失败后再次保存只重试绑定。描述已单独保存时记录新的对象版本，避免后续重试误报 409。

接口依据：[聚算上传输入素材](https://docs.jusuanhub.com/docs/reference/models/uploadInputAsset)，本轮读取当前页面，确认 `asset.assetId`、`status`、`expiresAt` 与存储策略；没有把厂商素材保存当成声音训练。

## 验证

- 真实隔离 MySQL 8.0.36：`DirectorVoiceUploadTest` 5 项通过。用只读事务重现原报错，正常上传成功；自动进入本人素材库；绑定声音后照片引用不变；刷新保留声音；客户端伪造的时长不生效；错误归属、1 秒及 16 秒音频拒绝；供应商失败不改角色；同一样本并发首次写入无主键冲突。
- V71 SQL 在独立 MySQL 库执行成功，检查四个字段及主键与实体一致。没有修改已执行迁移。
- 服务端定向回归 164 项通过：`Director*Test`、`MaterialVideoModelClient*Test`、`MaterialVideoInputAssetsTest`、`StudioMediaImportServiceTest`。仅计入本轮新生成的报告，未将旧报告混入统计。
- HTTP 协议回归：先上传声音，然后分别提交两条视频请求；两条都带同一声音 assetId，声音文件只上传一次。使用本地模拟供应商，不代表真实出片。
- 导演台前端组件回归 30 项通过，其中新增两项验证绑定失败重试复用样本、描述保存进度保留，以及上传失败不错误绑定。
- `pnpm typecheck:all`、`pnpm typecheck:admin`、离线后端编译、`pnpm check:api-contract`、`git diff --check` 通过。

测试资料是本地生成的 WAV、模拟供应商响应及隔离用户数据；没有使用真实用户声音，没有调用声音训练或真实视频生成，没有变更生产钱包、配置、数据或服务。尚未验证真实聚算上传及成片音色还原效果，尚未完成生产部署和线上用户动线验收。

## 最新主线集成复验（2026-10-29）

基线 `main=c81d8d0af`，功能提交 `54fdcb76`。保留主线新增的导演台回收站、人物自有图片、HTML 导入、长剧本文本、模型计费及公开错误提示规则；文档冲突合并双方内容。主线已占用 V66–V69，另有独立工作使用 V70，因此本功能采用 V71，不修改旧迁移。

合并后后端定向回归 306 项、导演台前端 115 项通过；workspace / admin 类型检查、后端离线编译、API 契约和差异检查通过。后端回归首次发现主线已有三处旧断言仍期待供应商配额原文或旧提示前缀，核对 `ProviderErrorMessage` 与 `PublicModelErrorPolicy` 后仅同步断言，保留主线业务规则。此处只记录提交与集成验证，尚未部署，未进行真实聚算上传或出片。
