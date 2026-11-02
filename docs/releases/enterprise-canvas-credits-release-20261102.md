# 画布用企业积分 · 生产发布（2026-11-02）

用户 2026-11-02 要求「studio画布要支持企业积分」，确认「合进 main 并发布」。

## 为什么以前用不了

发布前只读查线上库：4 家企业（含已关闭的验收企业）的生成设置都还是建企业时的样子，`allowed_endpoint_ids_json='[]'`、`max_active_jobs=1`、`version=0`，从没人改过；`aep_enterprise_billing_authorizations` 0 行，企业积分一次都没付过款。

- 旧规则下空名单等于什么模型都不能用，付款弹窗里「企业积分」一直是灰的（「企业尚未授权生成模型」）。
- 每人同时 1 个任务：就算选了模型，画布的多步制作做到第二步也会因为上限停下。

## 用户能看到的变化

- 企业没设过模型名单时，成员用企业积分可以用 Studio 里的全部模型（包括以后新上的）。主账号仍可在「企业管理 › 生成设置」改成「只允许选定的模型」，这个选项下至少选一个模型才能保存。
- 新建企业每人默认同时 10 个任务；线上 4 家没改过设置的企业由 V73 一起改成 10。
- 画布右上角在个人积分旁边显示「N 企业积分」（本人被分配到的、不含冻结），点进去是企业页。只在画布开，左侧导航和顶栏不变。
- 付款方式不变：每次生成选个人或企业，或者存成默认。

## 正式制品

| 项目 | 真值 |
| --- | --- |
| 构建 main 提交 | `cbfdf16254e54c22649f544f47a6cb218a35d094`（修复分支 `fix/studio-enterprise-credits` 变基到 origin/main `c7f45b855` 后快进推到 main） |
| 发布包 | `20261102-enterprise-canvas-credits`：server / web-aiavatar |
| 构建工作区 | 同级干净工作区 `../AIStarEcosystem-enterprise-canvas`（不在主仓里面），统一队列 `975c82819829`，退出码 0 |
| 构建参数 | AUTH_MODE=id、ID_ISSUER=https://id.aibuzz.cn、ENTERPRISE_ENABLED=1；mock 与开发登录关闭（`manifest.env` 已核对） |
| 制品 SHA256 | server JAR `fb7a0208989607909b735f8ed4ab47ac827ae34de0f3857b91a5bd926ac19e8c`；web-aiavatar `b374893666ba8ebceed01238e30f7ded971e465824af9911b4c35e349927aafc`，BUILD_ID `klxN-tLZFalC_zeYTajaZ`；包内入口 `./apps/web-aiavatar/server.js` |
| 数据库 | V73（Java 迁移）：`UPDATE aep_enterprise_policies SET max_active_jobs=10, version=version+1 WHERE version=0 AND max_active_jobs=1`；表不存在（全新库）时跳过，交给 Hibernate 建表 |
| 契约核对 | 线上 server / web-aiavatar `76b353939` → 本次：dto 无变化，openapi 只给 `allowedEndpointIds` 加了说明；admin 不读也不写这个字段 |
| 同包带上 | `c7f45b855`（只是文档） |
| CI | 直接推 main，没有远端 CI；不拿本地检查冒充 CI |

## 发布前检查

- 统一队列 `975c82819829` 一次跑完：web-aiavatar 全量 203 个文件 1605 项测试、全工作区类型检查、admin 类型检查、接口契约；后端 `com.aistareco.aep.enterprise.**`、`com.aistareco.aep.billing.**`、`V73EnterprisePolicyDefaultsTest`、`IpRunServiceTest`、`StudioSpeechServiceTest`，无失败；然后打包。
- 此前单独跑过：企业相关 6 个测试类 85 项（含新增 `emptyModelListLetsMembersPayWithEnterpriseCredits`、`newEnterpriseAllowsEveryModelAndTenTasksInFlight`、V73 两项）。
- 本地真实路径（库副本 + Agnes 免费模型）：企业设置改「全部模型」保存 → 新画布出图 → 付款弹窗里企业积分可选 → 报价确认 8 积分 → 出图完成；企业成员账户 892 → 884、冻结结清，个人积分 479 没动，企业消费记录里有这一笔（Agnes Image，已完成）。画布右上角两个积分在 1440 和 1024 宽都放得下；企业积分轮询频率和个人积分相同（每 15 秒）。
- 备份（root-only）：`/opt/ai-star-eco/backups/20261102-enterprise-canvas-credits-20261102T100439Z/`，内有发布前的 `aep_enterprise_policies`（`mysqldump --single-transaction`，gzip SHA256 `8e4aa810…`，4 行）和上一版 server JAR（SHA256 `dd50509a…`，即 `20261101-client-image-upload`）。

## 等在途任务跑完再重启

10:04:47 UTC 复核时有用户刚在导演台点了「生成全部参考图」：15 个出图任务（3 个在生成、12 个排队）。按发布规约不在这时重启，后台每 30 秒查一次 `ip_run` 和 `ip_plan_execution` 在途数，10:28:46 起连续两次为 0，10:30:46 开始发布。

## 线上验收

时间都是 UTC（北京时间 = UTC+8）。

- **server**：10:30:46 开始，`aistareco-server` 10:31:16 起来，10:31:21 执行 V73（7 毫秒，`flyway_schema_history` 73 成功），10:31:34 启动完成（16.8 秒），NRestarts=0。运行中的 JAR 校验和与制品一致；env-check、verify 均 ALL GREEN。`/opt/ai-star-eco/server/release-id.txt`、`release-sha.txt`、`release-manifest.env` 已手工写成本版（部署脚本不改它们）。
- **数据库**：4 行企业策略都变成 `[]` / 10 / version 1。发布后到 10:34 后端日志 0 条 ERROR、0 条 `ENTERPRISE_*` 错误码。
- **web-aiavatar**：10:31:59–10:32:33，10:32:28 起来，NRestarts=0，线上 BUILD_ID `klxN-tLZFalC_zeYTajaZ`；env-check、verify 均 ALL GREEN。
- **页面**（已登录的浏览器，「声量引擎」主账号，只看不改）：画布右上角显示「5,752 个人积分」和「0 企业积分」（这个账号没给自己分配企业积分）；「企业管理 › 生成设置」选中「全部模型」、每人 10 个。
- **重启窗口**：nginx 18:30:30–18:33:30（北京时间）共 38 个 200、2 个 302、6 个 502；502 都在 10:31:17–10:31:32，全是部署脚本探测 `GET /api/config`，没有用户请求失败。不称零中断。
- **没验的**：没在线上真用企业积分出图（会花企业的钱）；线上第一笔企业付款的结果等真实用户使用后再看。

## 备份与回滚

- server、web-aiavatar 回上一版：生产机 `/opt/ai-star-eco/releases/20261101-client-image-upload-76b353939`（`76b353939`）。两者可以各自回，没有接口依赖。
- 只回 server 时：旧代码里空名单又等于全部禁用，企业积分会重新变灰；V73 改过的在途上限 10 不会自动回去。要回到发布前的策略，用备份里的 `aep_enterprise_policies` 恢复（会丢掉发布后主账号在设置页保存过的改动，先确认没人改过）；Flyway 记录里的 V73 保留；Flyway 默认忽略库里比代码新的已执行迁移，旧 JAR 照常启动。
- 只回 web-aiavatar 时：设置页回到旧的多选框，空名单在旧界面上看着像「没选」，但服务端仍按全部模型放行。
- 本机构建工作区 `../AIStarEcosystem-enterprise-canvas` 保留到下一次发布。
