# 模型任务故障处理与飞书告警

2026-10-22 新策略由用户明确指定：没有拿到有效生成回执即按失败处理，用户可以重试；不要求用户等待人工核对。

## 任务和积分

- 图片、视频、配音、口型提交无有效任务号：原任务终止为失败，原事务释放未完成部分冻结，记录错误和追查号，释放并发名额。已成功图片和已扣费用保留。
- 旧 `*_SUBMISSION_UNKNOWN` 记录沿用原结算服务收尾，不通过 SQL 直接改钱包。图片/语音需先确认执行租约结束；有已知供应商任务号或已镜像产物时继续原任务处理。
- 系统不自动重复提交；用户从失败记录主动重新生成，新任务新计价。平台承担供应商可能已收到旧请求的风险，不能事后补扣已退还积分。
- 已有任务号的短暂查询错误：继续查询原任务，用户可刷新状态，无新提交/扣费。浏览器没收到平台响应的请求仍以原幂等键查询，不能混同于平台未收到供应商回执。

## 后台可见性

后台「AI 模型与用量」顶部显示“生成异常告警”。`GET /api/admin/ai-generation-attention?page=0` 仅 SUPER_ADMIN/OPERATOR 可读，每页20条，保留原任务、端点、错误、追查号。列表由原记录投影，不改任务或积分。原始供应商请求在请求日志中，完整错误追查仅超管可读。

## 飞书应用机器人

采用飞书应用机器人，向配置的群发送普通文本告警。2026-10-28 起生产关闭应用内加急，代码与 env 示例也默认关闭（`AEP_FEISHU_ALERT_URGENT=false`）。Webhook 自定义机器人不适用。只有显式开启加急时才要求 `im:message.urgent:app_send`（或等价 `im:message.urgent`）权限；机器人与接收人均须在群内。

环境变量见 `infra/env/server.env.example`：`AEP_FEISHU_ALERTS_ENABLED`、`AEP_FEISHU_APP_ID`、`AEP_FEISHU_APP_SECRET`、`AEP_FEISHU_ALERT_CHAT_ID`、`AEP_FEISHU_ALERT_USER_ID`、`AEP_FEISHU_ALERT_URGENT`。密钥仅安装在服务器受限 env 文件，不写 Git、聊天或日志。默认禁用；配置完整才入队/发送。

V64 新增 `model_alert_delivery`，仅记录通知投递：同任务+错误码生成稳定 UUID 主键去重，飞书发送复用该 UUID。独立调度线程每10秒取一条、数据库60秒租约防抢占；HTTP单次5秒超时。发送成功先持久化 message_id，加急失败只重试已有消息；最多5次、30/60/120/240秒退避，最终失败留下状态与脱敏错误。通知异常不得回滚任务失败/退款，或拖住生成调度。

2026-10-24 调整（已部署 server，按用户要求未做上线验证；见 [发布记录](../releases/model-alert-bjt-response-release-20261024.md)）：机器人时间固定为 **北京时间（Asia/Shanghai，UTC+8）**，格式 `yyyy-MM-dd HH:mm:ss.SSS`，保存入队时刻并在投递重试时复用。消息保留具体错误原因、我方错误码、任务号、追查号、供应商/端点、模型、后台入口，以及实际取得的远端 HTTP 状态、追踪号、任务号和**服务方响应正文（包括嵌套错误原因与详情）**。空字段直接省略，删除 Unix 毫秒、参数摘要、API 地址和固定说明；仅当前配置可知的模型简注“当前配置”。

`ProviderResponseDiagnostics` 随原异常携带响应正文与追踪信息；文本 HTTP/解析失败、流式错误、Studio 成功响应后的业务解析失败，以及图片/视频/配音/口型终态失败均保留对应响应。无服务方响应的本地或网络异常展示实际异常链，不推断远端 HTTP 状态。密钥、令牌、签名素材链接与媒体二进制做脱敏/省略；保留服务方错误描述和生成文本。响应最多12000字符，超长明确标记并指向后台，原因摘要最多2000字符，避免通知超出持久化列容量。原始正文继续由现有请求日志留存。

`ModelAlertContext` 优先读取原任务快照，图片按已完成候选数定位当前失败图片；缺失快照才回落当前端点配置，禁止按用户或时间猜测其他任务的调用记录。机器人使用精简投影，后台展开详情仍保留原来的脱敏技术参数。全部异步模型 ErrorLog 使用此链路，取消任务不告警。

## 验证与维护

2026-10-28 线上配置验收：仅将 `/etc/aistareco/server.env` 的 `AEP_FEISHU_ALERT_URGENT` 从 true 改为 false，重启现有 server 制品，核对进程环境为 false，`/api/config` 返回 200、服务 active、NRestarts=0。普通验证消息走现有持久化投递链，`task_id=alert-normal-20261028`、state=sent、attempts=1、message_id=`om_x100b611699131ca4df20761cc3e267d`，未调用加急。历史通知未重投；本地默认值、env 示例和回归测试已同步，14 项通知相关测试通过，默认值源码变更随后随同日长任务恢复修复发布（main `fda4e433`）。

先发送明确标注的普通测试消息，核对服务进程中的 `AEP_FEISHU_ALERT_URGENT=false`；不发送测试加急。线上验收检查 delivery.state=sent、message_id 非空。显式启用加急时，群发送成功不等同加急成功。权限问题使用原 message_id 重试，不重复发群消息。已超过5次失败的通知由运维在排除配置问题后人工恢复该通知为 pending、attempts=0；保留 message_id，禁止清空它重发。

排查只读 SQL：`SELECT id,task_id,error_code,log_id,state,attempts,message_id,last_error FROM model_alert_delivery ORDER BY created_at DESC LIMIT 20`。不要导出 message_text 或服务器 env。生产发布只从干净 main 构建，先合并再部署，记录代码 SHA 与真实验收。

## 重启后图片请求缺少回执

同步图片请求可能在写入 `submitAttempted` 后、记录回执或错误码前被进程退出打断。队列对这类记录同样调用 `failUnconfirmedSubmission`，不再要求先有 `STUDIO_IMAGE_SUBMISSION_UNKNOWN` 错误码。

在锁内重新检查任务仍在运行、当前图片没有供应商任务号且没有已镜像产物、执行租约已过期；未留下明确受理未知错误码时，还须超过最后进度时间加原请求快照的 HTTP 超时及 60 秒余量（至少 3 分钟；缺超时快照按 15 分钟请求窗口保守处理）。之后复用现有失败事务，只释放未完成部分冻结、保留已成功图片与已扣费用。队列下一次调度释放名额，不重新提交供应商。已有供应商任务号或镜像产物的任务继续走原任务恢复。

## 同步图片的结果字段与告警措辞（2026-10-29）

`IPR-647fba35`：带参考图的出图走 `/images/edits`，请求里写了 `response_format=b64_json`，供应商仍回 HTTP 200 + `data[0].url`（AWS S3 签名地址）。平台只读配置的 `/data/0/b64_json`，判成「受理结果未确认」并退款，图其实已经出了。现在同步结果按配置字段读不到时，改读同一层的另一种写法（`b64_json` ↔ `url`），日志记一行 `result field fallback`。改读到的地址：端点配了 `outputHosts` 就照名单限制，没配就允许任意公网 HTTPS 地址（仍拒内网、带账号、非 443）；下载不带我方鉴权头。供应商已经答复、同步调用没有任务号可恢复，所以结果不能用（没有图、下载失败、尺寸不符）按**已知失败** `STUDIO_IMAGE_PROVIDER_FAILED` 处理，不再记成 `STUDIO_IMAGE_SUBMISSION_UNKNOWN`。

告警原因写任务的最终结果：判失败并退款的任务，原因里写「已按失败处理并退回未完成部分的冻结积分」，不再沿用运行中的「请勿重新生成」；重启后收尾的旧任务写清是等结果时被中断，原错误信息为空时不再打印 `null`（`GenerationSubmissionFailure.settled`，图片与视频共用）。
