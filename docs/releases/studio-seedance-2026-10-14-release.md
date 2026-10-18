# Seedance 2.0 Studio 接入与生产发布（2026-10-14）

## 变更与原因

- 新建的 `seedance20-onetoken` 端点原先没有视频请求规格，也未加入 Studio 视频候选组，因此画布不能选择。现已提供可配置的视频协议，按端点规格组装请求，不再以供应商域名判断能力。
- 生产端点启用 Seedance 视频规格，供应商模型 ID 配为 `doubao-seedance-2-0-260128`，仅对 `studio` 应用开放；Studio 候选组加入该端点，原 MiniMax H3 保持默认。模型 ID 依据公开 OneToken 接入说明配置，尚未通过收费生成验证。
- 接入后用户画布首次读取模型时，旧图片候选的 `maxRefImages` 为空，`EndpointCapabilityDto.image()` 的三元表达式把空值拆箱成 `int`，导致 `/api/v1/ip-studio/models` 抛空指针并阻断视频模型列表。`ec0593f6` 改为保留可空值，覆盖此回归测试。
- `9c8b24b8` 将 IP Studio 的错误详情保留在全局通知中，显示错误码、消息和 logId，10 秒进度倒计时自动关闭；刷新页面不重复弹出历史失败，历史任务仍可点开详情。

## 代码与发布

- 代码提交：`400d8140`（可配置图片及视频端点协议）、`9c8b24b8`（Studio 错误通知）、`ec0593f6`（旧图片能力空值修复），已推送 `codex/unified-ip-studio`。
- 原服务完整发布：`20261014-studio-model-400d814`（server、web-aiavatar、web-celebrity）。后续服务端补丁：`20261014-studio-image-cap-ec0593f`（server）；通知补丁：`20261014-studio-notify-ec0593f`（web-aiavatar）。运行服务端 JAR 与补丁产物的 SHA256 均为 `78a764b8f095330159a19f868d3a92cd438feea70526f9d902de80cfdd6c5234`。
- 上线前备份：`/opt/ai-star-eco/backups/studio-model-20261014T022956Z`，包含数据库、旧 JAR、静态产物与配置；备份内容已校验。最终 `infra/scripts/verify.sh` 全绿，全部服务 active。
- 针对性 Java 测试通过；web-aiavatar 83 个测试文件、696 项测试通过，类型检查和 Next 生产构建通过。

## 生产验收与边界

- OneToken 保存的凭据通过模型目录检测；`/v1/models` 的 15 个模型未列出该视频模型，不能据此证明视频提交可用。未发送付费生成任务。
- 登录 `aistar.aibuzz.cn` 的 IP Studio 画布后，`seedance20-onetoken` 出现在模型下拉。文生视频和首帧模式均可选 720p；8 秒均报价 640 积分，即 80 积分/秒。刷新后旧错误通知没有重放。
- 80 积分/秒由平台共享视频定价矩阵配置在文生视频和首帧的 720p 档，当前仅 Seedance 使用这些档位；未来若开放其他 720p 模型且无单模型覆盖价，它们也会继承该价格。供应商成本未知，尚未配置，也未验证实际视频生成和结算。
