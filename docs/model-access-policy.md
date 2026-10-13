# 模型类型与应用开放范围

模型端点仍由原 AIStar 服务管理。每个端点可配置多个类型标签（例如 `text`、`image`、`video`、`embedding`），并选择向所有已登记应用开放或仅向指定应用开放。类型标签用于模型目录分组，不自动授予生成能力；实际调用还要通过用途候选、端点启用状态及应用功能配置。

配置存于原服务的 `platform_config`：`ai.model-access.<endpointId>`，内容为 `categories`、`scope`、`appCodes`。存量端点没有此配置时，按 `unclassified`、所有应用处理，以保持原有应用可用性。配置损坏时请求失败，避免误放行。保存使用模型管理命令 `modelAccessSave`，并写入既有审计日志；平台运营后台只是原服务的管理入口。

Studio 剧本和图片仍通过 `ai.scene-policy.studio.script` / `.image` 选模型、默认项和积分售价；候选还须在对应共享用途启用且向 Studio 开放。Studio 视频的开放列表及默认项由 `ai.app-model-group.studio.video` 管理；缺失配置时没有视频候选。运行时与模型目录使用同一组配置。各应用新任务按应用编码核对开放范围；已接受的视频任务不会因配置变动重新提交，但轮询仍需端点保持可用。

历史 `ipstudio.model-provider` 的聚算专属规则不再执行；供应商 URL 只用于供应商协议和传输，不决定应用开放范围。修改模型归属或关联应用应在“模型类型与应用开放范围”中进行，然后在“应用 AI 管理”设置该功能的用途候选、默认项与售价。运行调用仍由原业务服务执行，不迁移到平台 Runtime。
