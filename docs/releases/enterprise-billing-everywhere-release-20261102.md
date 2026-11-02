# 所有付费功能同一套企业付款 · 生产发布（2026-11-02）

用户 2026-11-02 要求：「和普通一样给是否默认的选项，选择后 后续不弹窗，另外其他功能是否都支持企业积分，我要求全部功能都走一样的逻辑」，确认「合进 main 并发布」。

## 用户能看到的变化

- 付款弹窗在「个人积分 / 企业积分」下面直接给「设为默认，以后不再询问」。勾上确认后，所有付费生成都按这个账户付款，不再弹付款选择。
- 默认账户存在服务端（企业成员关系上），换电脑、换手机也有效；浏览器里以前存的默认，第一次读取时自动搬到服务端。设置页「生成付款账户」可以改成个人积分、企业积分或每次询问。
- 默认是企业积分、但成员被停用或企业关闭时，重新询问，不自动改用个人积分；企业积分不够时照常报错，也不换账户。
- 数字资产（AI 建形象、迭代和精调、造型、衍生图和视频、场景图和光线变体、商品图和补角度、人物 × 场景合成图）和声音克隆，以前只能扣个人积分，现在和画布用同一个付款选择、同一套企业规则：企业允许的模型、每人在途上限、成员停用时取消还没开始的任务并退回、按原账户结算与退回、重试沿用原账户。
- 一个数字资产任务里的文字处理和出图只算一个在途任务。
- 生成失败时，报错标题写用户点的那个按钮（例如「「生成 2 个变体」没有完成」），不再写成「确认本次付款账户没有完成」。

图片和视频生成前的费用确认（折扣、模型赠款抵扣）照旧，个人用户也一样，这次没动。

## 正式制品

| 项目 | 真值 |
| --- | --- |
| 构建 main 提交 | `856ce19cf7c3f95d15c8131a491b3331bd0ae2b1`（分支 `fix/enterprise-billing-everywhere` 变基到 origin/main `a7cac3d8a` 后推到 main；`a7cac3d8a` 只改了 TODO 一行） |
| 发布包 | `20261102-enterprise-billing-everywhere`：server / web-aiavatar |
| 构建工作区 | 同级干净工作区 `../AIStarEcosystem-enterprise-canvas`（不在主仓里面），统一队列 `5fe0dd91c73f`，退出码 0 |
| 构建参数 | AUTH_MODE=id、ID_ISSUER=https://id.aibuzz.cn、ENTERPRISE_ENABLED=1、USE_MOCK=0（`manifest.env` 已核对） |
| 制品 SHA256 | server JAR `31a28026dacd3c48d0a43abc57128edfa574e1809133fbe2fe52f3575fb8b768`；web-aiavatar `ea662664072729b86c0880ea724cb3b4641ee3ac498885fbe9a20fec2170fbe7`，BUILD_ID `O5bqK8NR6Mwew0-qFgdjr`；包内入口 `./apps/web-aiavatar/server.js` |
| 数据库 | V74（Java 迁移）：`aep_enterprise_members` 加可空列 `billing_default VARCHAR(16)`；表不存在或列已存在时跳过 |
| 新接口 | `PUT /api/v1/ip-studio/enterprises/{id}/billing-default`；数字资产 11 个付费接口接受请求头 `X-Aep-Billing`（缺省按个人积分） |
| 契约核对 | 线上 server `cbfdf1625` → 本次：dto 只给企业上下文加了 `billingDefault`，openapi 只加参数和新路径，没有删除或改名字段；admin、studio-admin 不读这些字段 |
| 同包带上 | 线上 web-aiavatar 已是 `5bcdebd3b`，本次只多 `ef56dc9e8`、`a7cac3d8a`（都是文档） |
| CI | 直接推 main，没有远端 CI；不拿本地检查冒充 CI |

## 发布前检查

- 统一队列 `ceb431e8e9ba`（变基后）一次跑完：全工作区类型检查、admin 类型检查、接口契约；web-aiavatar 全量 206 个文件 1620 项测试；后端 `com.aistareco.aep.enterprise.**`、`com.aistareco.aep.billing.**`、`com.aistareco.aep.dap.**`、`V7*Test`、`IpRunServiceTest`、`StudioSpeechServiceTest`，surefire 合计 349 项、0 失败、0 错误、4 跳过。
- 新增测试：后端 9 项（`EnterpriseStudioBillingIntegrationTest` 数字资产 6 项、`EnterpriseFoundationTest.memberDefaultPayerIsSavedOnTheMembershipWithoutTouchingItsVersion`、`V74EnterpriseMemberBillingDefaultTest` 2 项），前端 10 项（`studio-billing-dialog`、`studio-billing-preference`、`proto/api-payer`、`studio-errors`）。
- 本地真实路径（库副本 + Agnes 免费模型）：
  - 请求头写错，返回 400 `BILLING_SELECTION_INVALID`。
  - 用企业积分生成一张场景图：企业成员账户 884 → 878，冻结结清，个人积分没被扣。
  - 浏览器付款弹窗里选企业积分并勾选默认，服务端存上；刷新后再生成，不再弹付款选择，请求自动带 `X-Aep-Billing: enterprise:<id>`。
  - 设置页显示「默认使用 TEST E2E 企业的企业积分」。
  - 光线变体没出图：一次 Agnes 限流（429），一次 Agnes 队列满（503）；失败那次冻结的 6 积分已退回企业账户。
- 备份（root-only）：`/opt/ai-star-eco/backups/20261102-enterprise-billing-everywhere-20261102T175047Z/`，内有发布前的 `aep_enterprise_members`（`mysqldump --single-transaction`，gzip SHA256 `020c4367…`）和上一版 server JAR（SHA256 `fb7a0208…`，即 `20261102-enterprise-canvas-credits`）。
- 17:43 和 17:50 UTC 两次只读查询：`ip_run`、`material_video_job`、`ip_plan_execution`、`dap_job` 都没有在途任务；企业付款授权 0 行；Flyway 在 73。

## 线上验收

时间都是 UTC（北京时间 = UTC+8）。

- **server**：17:50:5x 开始，`aistareco-server` 17:51:25 起来，17:51:30 执行 V74（154 毫秒，`flyway_schema_history` 74 成功），NRestarts=0。运行中的 JAR 校验和与制品一致；env-check、verify 均 ALL GREEN。`/opt/ai-star-eco/server/release-id.txt`、`release-sha.txt`、`release-manifest.env` 已手工写成本版（部署脚本不改它们）。
- **数据库**：16 个企业成员的 `billing_default` 都是空（每次询问）。
- **web-aiavatar**：17:52:34 起来，NRestarts=0，线上 BUILD_ID `O5bqK8NR6Mwew0-qFgdjr`；env-check、verify 均 ALL GREEN。
- **日志**：发布后到 17:53:50 后端 0 条 ERROR、0 条 `ENTERPRISE_*` / `BILLING_SELECTION_*`；前端日志无报错。
- **页面**（已登录的浏览器，「声量引擎」成员，只看不改）：企业接口 200，成员 active，`billingDefault` 为空时接口省略这个字段，前端按「每次询问」处理；设置页「生成付款账户」显示「每次询问」和新的说明文字。这个浏览器里没有旧的本地默认，不会触发搬迁写入。
- **重启窗口**：nginx 01:50–01:54（北京时间）共 47 个 200、3 个 302、277 个 308、6 个 502；502 都在 01:51:25–01:51:41，全是部署脚本探测 `GET /api/config`，没有用户请求失败。不称零中断。
- **没验的**：没在线上真用企业积分做数字资产或声音克隆（会花企业的钱），也没在线上保存默认账户（会改用户设置）；第一笔线上企业数字资产付款等真实用户使用后再看。

## 已知限制

- 企业设置里「只允许选定的模型」的候选列表没有数字资产用的模型；限定了模型名单的企业做数字资产会被拒（`ENTERPRISE_MODEL_NOT_ALLOWED`）。线上 4 家企业都是「全部模型」，现在不受影响。已记 TODO。
- 画布制作计划碰到企业每人在途上限时停下来等用户处理，不会等前面的任务结束后自己接着提交；已记 TODO。

## 备份与回滚

- 两个服务的上一版：server → 生产机 `/opt/ai-star-eco/releases/20261102-enterprise-canvas-credits`（`cbfdf1625`）；web-aiavatar → `/opt/ai-star-eco/releases/20261102-studio-create-chooser`（`5bcdebd3b`）。
- **只回 server 不行，要回就两个一起回**：新前端会给数字资产请求带 `X-Aep-Billing`，旧 server 不认这个头，选了企业积分的数字资产会改扣个人积分；新前端保存默认账户会调 `PUT …/billing-default`，旧 server 没有这个接口，弹窗报「默认账户没有保存」。
- 只回 web-aiavatar 可以：旧前端不带请求头，数字资产按个人积分；默认账户回到只存浏览器，已搬到服务端的默认在旧前端上读不到，会重新询问。
- V74 加的列在回滚后留着，旧代码不读它；Flyway 默认忽略库里比代码新的已执行迁移，旧 JAR 照常启动。
- 本机构建工作区 `../AIStarEcosystem-enterprise-canvas` 保留到下一次发布。
