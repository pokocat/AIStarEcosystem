# Studio 余额不足立即暂停：不重启发布（2026-10-25）

2026-10-25 **08:06:56 UTC（北京时间16:06:56）**，支付异常修复通过现有 JVM-Sandbox 增量加载到生产 `aistareco-server`。没有重启服务、替换 app.jar、修改钱包或重提客户任务。已有 JSON 热补丁保持启用。

## 问题与结果

原故障为 `ResponseStatusException: 402 PAYMENT_REQUIRED "积分余额不足，本次操作需 320，当前可用 16"`。执行器只把 `BusinessException` 当作明确拒绝，402 落入“提交结果未知”，一直保留 `submitted` 和预算占用，定时重查/同键提交，到90分钟才停止。原生视频任务没有建成，旧总结却显示“积分在结算”。这不是模型 JSON 错误或供应商出片超时。

永久修复已合入 main：402 立即进入 `needs_user`，`STUDIO_PAYMENT_REQUIRED` 提示所需积分/当前可用、补足后主动继续、本步尚未提交未扣积分；移除该步 pendingRequestId，在原拒绝事务内刷新预算并在提交后发送事件。其他已受理任务继续计入占用；不自动重提。未知结果、502 等仍先按稳定请求号查任务。已有前端能显示提示及“继续制作”，无需前端运行服务重启。历史消息和已成功的新任务未修改。

## 发布真值

| 项目 | 结果 |
|---|---|
| 构建时干净 main 提交 | `6d6846115c84de0a511e848bce79828d2bed3a26`（已推送 origin/main） |
| 生效范围 | `StudioPlanExecutor.submit(String,String,long,Submission)`；1 class / 1 method |
| 模块 | `aep-payment-recovery`，`20261025.2`，ACTIVE |
| Sandbox | 既有 `aep-json-20261024`，官方1.4.0，仅 loopback `127.0.0.1:24769` |
| 支付模块 JAR SHA256 | `a5007bad1ac0fff0444c666eeef5eb752af9ad277828dccbddb560dcb9c6c43c` |
| 原执行器 class SHA256（加载硬闸） | `950b037b4010835b9316b7aec2be00e9edca4651d62228456ec75178e51c867a` |
| 消息策略源码 SHA256 | `14408a4881fc9cb2620413641e52b11563208dcf93e9329fe080cca40695375e` |
| 模块源码 SHA256 | `a28167fc1723735fac5a0a008c1ca34b32e236f99286690838507c476f3b04d8` |
| 生产 MainPID | `2556307`，激活前后相同 |
| 服务启动时间 / NRestarts | `Sun 2026-10-25 13:49:26 CST` / `0`，前后相同 |
| 生产 app.jar SHA256 | `e79d9a535355dc948885a97c8788480d435c5f0e93684318d096850bf795cbba`，前后相同 |
| 管理配置 | 原有 `user_module`、端口、unsafe=false 均不变；非强制 `-f` 只增量加载新模块 |

临时模块保留原私有提交边界的调用顺序，通过原应用服务调用一次原生 submit，并复用原事务模板、租约校验、attach/refresh/save/publish。桥接失败不回落再调用原方法，保留已持久化请求供后续恢复。详见[构建与回退手册](../runbooks/studio-payment-jvm-sandbox.md)。

## 验证与限度

- 干净 main：`pnpm typecheck:all`、`pnpm typecheck:admin`、`./mvnw compile -q -o`、`pnpm check:api-contract` 均通过。
- 执行相关12个后端测试类，**88 tests / 0 failure / 0 error / 0 skipped**；界面测试 **5 passed**。覆盖余额不足立即暂停、没有虚假占用、重复唤醒不重提、显式继续恢复、其他已受理任务占用保留、未知结果先查任务。
- 正式模块分别在本地 Java17、服务器 Dragonwell17 独立进程验证，使用线上原执行器及工作流 class、同一 main 编译的 fixture；mock 仓库/事务，不启动 Spring，不连接产品库、不调用模型/钱包。冻结和卸载重现旧行为，启用立即 `needs_user`、本步占用0；混合任务保留另一任务40占用，502/提交后丢响应/租约被抢保持原有安全行为。两处 `pass=true`；服务器探针19次健康采样均正常。
- 生产先冻结加载核对匹配1类1方法、类哈希及原 JSON 模块仍 active，随后激活。期间本机 `/api/config` 与公网 `https://aiavatar.aibuzz.cn/api/config` 共 **52次采样均200**，支付模块 `bridgeErrors=0`；JSON 模块仍 active、`bridgeErrors=0`。
- 验收时支付模块 `bridged=0 rejected=0 unknown=0`：没有为测试触发客户请求。支付行为的断言来自上述隔离探针和回归测试，生产验收确认的是正确模块生效、接口采样正常与进程不重启，不冒充新付费生成的端到端验收。

服务器审计文件（不含凭据）位于：

- `/home/ecs-user/.local/share/aistareco/hotfix/studio-payment-6d684611/{manifest.json,production-evidence.json,sandbox.properties.before}`
- `/home/ecs-user/.local/share/aistareco/hotfix/payment-validation-6d684611/probe/evidence.json`

本地正式构建/证据：`/tmp/aep-payment-release-6d684611/`。验证包 SHA256：`dcaa47008b5287d0a50922b6d821cad68d8c27db13d68ca3fcc3068b2a236d7f`。

这是进程内临时热补丁；永久修复已在 main。下次正常后端发布前按手册卸载支付与 JSON 临时模块，发布包含永久修复的 main。普通重启不会自动保留临时模块。仅回退支付补丁时执行 `-u aep-payment-recovery`，不卸载已有 JSON 补丁、不重启应用。
