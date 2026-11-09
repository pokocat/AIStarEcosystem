# Seedance 官方凭据切换与人像核验准备（2026-11-09）

## 已生效：生产 Key

用户明确要求 Fast / Mini 切换新凭据、官方素材库和真人核验。

通过现有模型配置签名命令 `endpointSave`，只更新以下两条的 `apiKey`，服务端加密入库并留下审计记录：

- `ai-1fb0d9ce-d74`：`doubao-seedance-2-0-fast-260128`
- `ai-d91e6ae3-6df`：`doubao-seedance-2-0-mini-260615`

两条回读均启用、Key 尾部匹配用户新 Key、基础地址仍为官方 `https://ark.cn-beijing.volces.com/api/v3`。未修改售价、默认模型或其他端点。本文不保存凭据。

## 官方接口真实验证

项目：`bingbing`，控制面：`ark.cn-beijing.volcengineapi.com`，AK/SK Signature V4，service `ark`，region `cn-beijing`。

- 新 API Key 调模型目录 200，包含 Fast / Mini。
- `ListAssetGroups` 200，初始为空。
- `CreateAssetGroup` / `GetAssetGroup` 200，`group-20261109112741-sqzp2`，`GroupType=AIGC`、`ProjectName=bingbing`。
- 使用火山官方虚拟人像指南公开示例图调用 `CreateAsset` 200，`asset-20261109113339-4s6l2`；随后 `GetAsset` 返回 `Active`。该素材仅为接口验收样本，不是用户的真人素材。
- `CreateVisualValidateSession` 200，返回 `BytedToken` / `H5Link` / `CallbackURL`。未展示或记录含令牌链接，未代替本人刷脸。

这证明素材库写权限和核验会话权限已可用；不代表本人核验、真人素材一致性审核或真实视频生成已完成。

## 当前工作区，未发布

增加官方控制面、素材声明、本人核验和回调、撤销授权、V78、官方适配器和视频素材引用接入。界面使用 Ant Design 的 Table / Form / Select / Radio / Checkbox / Modal / QRCode，页面与生成前弹窗复用真实组件。计费前检查优先处理含人脸图片，官方明确拒绝兜底暂停原任务；审核后原地继续，不重建任务或重复冻结，等待最多 30 分钟。

Mac mini devq：`0031aa19bf65` 的全部 12 个 workspace 串行 typecheck 和 51 项前端定向测试通过，接口抽取的引号约定失败随后已修；`acb810311a78` 退出码 0，5 类后端共 67 项（0 失败/错误）及 API 契约通过；`f166dbdc3fe6` 退出码 0，当前 app typecheck 与 4 文件 51 项前端测试通过。没有用虚拟视频冒充真实生成。

预览用实际前端组件和隔离样本 API；桌面及 390×844 手机检查已覆盖选择、授权、审核状态与继续原操作。前端测试存在既有 React act 提示和 Ant Design maskClosable 废弃提示，不影响通过；未声称生产端到端验收。

生产端点尚未绑定 `ark-bingbing` 素材库，未发布后端或前端。真实核验、真人素材和生成闭环仍需后续完成；不得将设计演示状态视为接口验收。

原工作区有大量不属于本次的未提交修改，均保留。

## 独立发布工作区验证

发布工作区基于最新 `origin/main`（`142a75f8a`），只提取本次人像素材代码；视频复刻等并行修改不包含在内。Mini devq `d40a73a883ae` 退出码 0：9 类后端测试、12 个 workspace 串行类型检查、API 契约与 5 文件 72 项前端测试通过。正式发布构建单独打包 server / web-aiavatar；Studio 沿用生产企业入口开关 1。
