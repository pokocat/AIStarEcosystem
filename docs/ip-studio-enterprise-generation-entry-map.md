# Studio 企业付款生成入口映射

2026-10-15，本地实现；本文只记录入口、真实扣费引用及恢复路径，不代表生产已开放。

| HTTP 入口 | 实际调用 | 积分引用 / 授权 | 执行与终态 |
|---|---|---|---|
| `POST /api/v1/ip-studio/projects/{id}/nodes/{nodeId}/run` | `IpRunService.run`，图节点编译 | `ip-run` / `IpRun.id` | `IpRunWorker`；逐张 commit，剩余释放；状态、释放及授权结束同事务 |
| `POST /api/v1/ip-studio/projects/{id}/generate` | `IpRunService.generate` | `ip-run` / `IpRun.id` | 同上；实际端点在受理时固定，显式端点不降级 |
| `POST /api/v1/ip-studio/projects/{id}/studio-runs`：`image` | `StudioWorkflowService` → `IpRunService.generate` | 同一 `ip-run` / `IpRun.id`，不二次冻结 | 同上；外层保存原 Studio 请求快照及请求指纹 |
| 同上：`text / script / storyboard / assistant / asset-extract` | `StudioWorkflowService` | `ip-run` / `IpRun.id` | `StudioWorkflowWorker`；按冻结 token 价格快照结算，退回余量；不支持降级端点 |
| 同上：`assemble` | `StudioWorkflowService`，本地拼接 | `ip-run` / `IpRun.id`，零冻结也建授权 | `StudioWorkflowWorker`；完成、失败、取消都结束授权 |
| 同上：fixture 测试响应 | `StudioWorkflowService`，本地确定性产物 | `ip-run` / `IpRun.id`，零冻结也建授权 | 同上；不证明真实厂商调用或真实收费效果 |
| `POST /api/v1/ip-studio/projects/{id}/speech-runs` | `StudioSpeechService` | `ip-run` / `IpRun.id` | `StudioSpeechWorker`；先镜像再按时长结算；已受理/受理不明保留原请求查询 |
| `POST /api/v1/ip-studio/projects/{id}/lip-sync-runs` | `StudioLipSyncService` | `ip-run` / `IpRun.id` | 同上；上传、请求正文、厂商任务 ID 持久化；取消不重提 |
| `POST /api/v1/ip-studio/library/objects/{id}/generate` | `IpLibraryService` → Studio `image` | 同一 backing `ip-run` / `IpRun.id` | 资产库只有归集回执，不另外冻结或扣费 |
| `POST /api/v1/ip-studio/projects/{id}/library/extract`：`analyze:true` | `IpLibraryService` → Studio `asset-extract` | 同一 backing `ip-run` / `IpRun.id` | 同文本链；`analyze:false` 只做本地提取，无授权/计费 |
| `POST /api/v1/ip-studio/projects/{id}/template-steps/{stepId}/runs` | `StudioTemplateExecutionService` → Studio `image / video` | 使用实际子任务引用；模板执行指针不另冻结 | 图片走 IpRunWorker；视频走共享视频 worker |
| `POST /api/v1/ip-studio/projects/{id}/generate-video` | `IpRunService` → `MaterialVideoJobService`，app=`ipstudio` | 每个 `material_video_job` / `MaterialVideoJob.id` | 共享视频 worker 结算；StudioVideoService 负责规格预检/报价 |
| Studio `video` | `StudioWorkflowService` → 同上 | 每条候选一个 `material_video_job` 授权；外层 `studio-video` IpRun 仅为不可变关联，无冻结/授权 | 状态/结果从原生子任务投影；停止必须取消这些原任务 |

`billing:{mode:"enterprise",enterpriseId}` 显式使用企业成员钱包；缺省保留个人钱包。企业余额不足、模型不允许或在途超限直接拒绝，不混扣、不自动切个人。资源仍按实际操作者本人检查。

Studio、配音、口型、资产库、模板均把 `billing` 纳入请求幂等身份。历史请求缺省 `billing` 保持个人语义；旧格式兼容也先核验付款方，禁止用兼容指纹切账户。原生 `/run`、`/generate` 和 `/generate-video` 新增可选 `clientRequestId`；企业付款必须提供，锁本人项目后找回同一受理记录。原生视频另存零扣费绑定，重放只按本人/原分区查询同一视频任务，不创建第二份任务或冻结；工作流外层仍只保存一次绑定。价格、端点、原成员关系和钱包保存在任务/授权及 `_exec` 快照中。

只读找回付款方：

- `GET /api/v1/ip-studio/projects/{id}/billing-selection?clientRequestId=...`：先核验本人项目，再查请求。
- `GET /api/v1/ip-studio/library/objects/{id}/billing-selection?clientRequestId=...`：先核验本人资产对象，再限定对象/操作者查请求。

返回 `{found,billing}`；历史个人请求的 `billing` 为 `null`，不暴露钱包 ID 或授权 ID。

取消与恢复：排队取消在同事务释放冻结并结束授权；配音/口型首次实际提交前核验付款授权，已受理或受理不明继续按原请求查询；图片、文本首次模型调用前核验授权。`IpRunReaper` 通过各 worker 的锁定终态事务处理超时，配音/口型保留自身持久恢复，不由普通超时清理重提。锁序与企业生命周期一致：企业 → 钱包 → 冻结 → 任务。

配置了原生图片协议的端点另存每张图片的 `_exec.imageJobs[]`：请求正文、协议、端点地址与模型在 POST 前持久化；拿到供应商任务号后立刻落库，镜像后的 storageKey 也先落库。已受理图片恢复只查询这个原任务，候选停用或企业策略改变不导致重提；已经成功的前几张不再出图或重复扣款。受理回执丢失、查询/下载暂时失败、结算暂时失败都保留冻结和在途授权。图片 reaper 与通用 hold sweeper 不把这类记录当孤儿释放。

仅平台 SUPER_ADMIN/OPERATOR（不含纯 FINANCE_ADMIN）可使用 `GET /api/admin/ip-studio/runs/{id}` 核对逐张任务凭据。缺原任务号时，`POST /api/admin/ip-studio/runs/{id}/reconcile` 提交 `{imageIndex, externalTaskId, evidence}`；凭据至少 8 字，原请求正文/端点/价格不得改变，已有不同任务号不能覆盖。补录与审计同事务，提交后只查询原供应商任务，不重新生成。返回值只含元数据与请求指纹，不暴露请求正文、密钥或签名素材地址。

若供应商已明确核实原请求未受理且没有上游任务，运营可使用 `POST /api/admin/ip-studio/runs/{id}/release-unknown`，提交 `{imageIndex, evidence, confirmedNoUpstreamTask:true}`。此入口只处理受理未知、无原任务号、无产物且查询租约已到期的当前图片；仅查询不到不能作为释放依据。核对证据、原任务失败终态、原冻结释放与授权完成同事务，退出成员的退回资金仍归集原企业。此前成功候选及真实已花积分保留，原请求重放不再次退款；已知任务号必须查询原任务，不能走该入口。
