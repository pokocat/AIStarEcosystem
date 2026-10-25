# Studio 余额不足：不重启热修复

永久修复在 `StudioPlanExecutor.submit`：`CreditService` 的 `ResponseStatusException(402)` 是尚未受理的明确拒绝，转为 `STUDIO_PAYMENT_REQUIRED`，立即进入 `needs_user`，清除该步 `pendingRequestId`，在同一事务中刷新真实任务预算。仅已知钱包格式的所需/可用数字可进入提示，其他原因回退为付款账户积分不足。充值后由用户主动继续，定时扫描不得自行重提。其他业务拒绝同样立即刷新预算；连接中断、502 等仍保留稳定请求号，先查已受理任务。

## 临时模块的边界

`infra/hotfix/studio-payment-sandbox/PaymentRecoveryModule.java` 只增强一个类的一个私有方法 `StudioPlanExecutor.submit(String,String,long,Submission)`。模块中保留原提交方法的调用顺序，用反射访问应用自己的服务、Jackson 节点、事务模板及私有 helper，避免跨类加载器强转。原生提交只调用一次；复用原租约 owner/version 校验、`attach`、`refresh`、`save`、`publish`，事件在提交事务结束后发送。桥接失败会抛出错误，由已持久化的请求号恢复，绝不回落再调用一次原方法。

模块只允许加载到构建时指定的原 `StudioPlanExecutor.class` SHA256；源码中的永久修复或运行 JAR 变化后必须拒绝加载旧模块。默认 FROZEN，管理端沿用现有 loopback Sandbox，不增加公网入口。不修改账本，不调用额外模型，不重放客户任务，不修改历史对话或钱包。卸载只撤销增强；正常服务重启后临时模块失效，需用含永久修复的 main 进行正常发布。

未选择增强 `StudioWorkflowService`：官方 Sandbox 1.4.0 在该类的 Java 17 sealed 类型帧计算中出现 `PermittedSubclasses requires ASM9`，隔离测试发现增强未生效。这一路径没有用于生产；最终模块仅增强执行器提交方法，须验明匹配 **1 class / 1 method**。

## 从干净 main 构建、隔离验证

编译门通过并合入 main 后，从干净 main 的 archive 构建。原 class 从线上 JAR 只读提取，不以本地永久修复后的 class 代替。

```bash
python3 infra/hotfix/studio-payment-sandbox/build.py \
  --sandbox /absolute/path/sandbox \
  --java-home /absolute/path/jdk17 \
  --target-class /absolute/path/original/StudioPlanExecutor.class \
  --output /absolute/path/artifact --source-commit FULL_MAIN_SHA
```

`probe.py` 只启动自己的 JVM，不接受已有生产 PID。`probe-root/original` 放线上原执行器（含内部类）和工作流类，其余测试 classpath 使用同一 main 编译的 `target/test-classes`、`target/classes` 和 Maven 测试依赖。探针复用 `StudioPlanExecutorTest` 的 mock 仓库及事务，不启动 Spring、不连接数据库、不调用供应商。使用独立应用类加载器和 subclass mocks。验证冻结、启用、卸载；不足立即暂停/占用归零/重复唤醒不重提，混合任务保留另一任务占用，未知结果仍查任务，直接调用不受影响，租约被抢不落状态，正常提交/已受理后丢响应的回归。持续本机健康采样。

```bash
python3 infra/hotfix/studio-payment-sandbox/probe.py \
  --sandbox /absolute/path/sandbox --module /absolute/path/aep-payment-recovery.jar \
  --java-home /absolute/path/jdk17 --probe-root /absolute/path/probe \
  --classpath /absolute/path/test-classes:/absolute/path/classes:/absolute/path/deps
```

须先在本地 JDK17、再在服务器自己的 Dragonwell17 独立探针通过。`evidence.json` 要有 `pass=true`、`bridgeErrors=0`，冻结/卸载恢复原表现，启用后 `needs_user` 且本次占用为0，混合任务占用40。探针只证明合成输入的执行路径，不冒充真实付费任务验收。

## 生产加载与回退

仅复用现有 `aep-json-20261024` Sandbox namespace（`127.0.0.1:24769`），保留 JSON 模块原 JAR 和 active 状态。备份配置并记录 PID、启动时间、NRestarts、app.jar SHA256；把新的支付模块复制到该实例已有 `user_module` 目录。只运行非强制增量 `-f` 加载新文件，禁止 `-F`/`-R` 重载已有模块。新模块 FROZEN 时先检查类哈希、匹配范围及 JSON 模块仍 active，再激活。

```bash
# 以下须以现有服务用户执行，JAVA_HOME 和 SANDBOX_HOME_DIR 指向核对过的现有安装。
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -f
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -m aep-payment-recovery
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -d aep-payment-recovery/status
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -a aep-payment-recovery
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -d aep-payment-recovery/status
# 只回退支付模块，不碰已有 JSON 模块、服务进程和 JAR。
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -u aep-payment-recovery
```

激活前后持续采样本机及公网 API 健康；核对 PID、启动时间、JAR 均未变，监听仍 loopback。实时计数可能因用户正常制作增长，不为增加计数而创建测试客户任务。下次正常发布含永久修复的 main 时卸载两个临时模块，再按正常流程发布；不把临时热补丁当持久化部署。
