# Studio JSON 格式错误：JVM-Sandbox 临时热修复

本方案用于用户明确要求不重启后端时的临时缓解。正常修复仍在 `ModelJson` 和 `StudioWorkflowWorker`，下次正常发布需要带上。只针对 `ModelJson.parse(ObjectMapper,String)` 抛出的 Jackson 解析异常；成功返回不变。构建时直接使用仓库 `ModelJson`，重定位进隔离模块，不另写一套恢复规则。

## 适用范围和边界

- 修复汉字前多余反斜杠、字符串内原始换行 / 制表符、完整值后的尾逗号和缺失的末尾括号；不补写正文或猜测缺值。不能恢复时抛应用自己的 `BusinessException(AI_BAD_OUTPUT)`，原异常作为 cause 保留，原工作流继续负责失败退款。
- 只观察一个业务类的一个方法，且仅在原方法抛 Jackson 异常后执行。正常返回（包括老解析器已接受的结果）不走模块，因此临时模块不等同于正常发布后完整的严格解析策略。`finish_reason=length` 在调用解析器之前被工作流拒绝，模块不会把它改为成功。
- 不拦截 HTTP、模型调用、worker 或账本，不新增模型请求或重放已受理任务。模块内 Jackson 与应用 Jackson 隔离，通过原 mapper 把修复后的 JSON 转成应用自己的 JsonNode，不能跨类加载器直接强转。
- 模块默认 FROZEN，先加载检查范围、再显式激活；只绑定 `127.0.0.1`，不修改 nginx / 防火墙或开放公网管理端口。不重启 JVM，不改 app.jar 或运行环境文件。卸载模块即撤销增强；重启后补丁不会自动存在。

## 固定依赖

官方仓库：<https://github.com/alibaba/jvm-sandbox>，1.4.0 支持 JDK 17。

官方 release 指向的二进制：<https://github.com/alibaba/jvm-sandbox/wiki/upload/sandbox-stable-bin.zip>。本次取得的 `cfg/version=1.4.0`，ZIP SHA256：`c7d344c1e9fa27ae49dab119802f6b85b59eacfdc890ff1f83585f908a0ae317`。下载内容或版本变化时重新核查，不静默替换。二进制不入库。

## 构建与隔离验证

先通过仓库编译门、合入 main，再从干净 main 的精确 Git archive 构建正式模块。不要把其他功能分支或脏工作区当发布源。构建程序不下载、不 attach、不读取服务器凭据。

```bash
python3 infra/hotfix/studio-json-sandbox/build.py \
  --sandbox /absolute/path/sandbox \
  --java-home /absolute/path/jdk17 \
  --output /absolute/path/artifacts
```

模块包含 `manifest.json` 指定的提交、解析器源码 SHA256 和模块 JAR SHA256。Git archive 不含 `.git` 时，加 `--source-commit` 指定已验证的完整 main SHA。

`probe.py` 只创建自己的 Java 17 子进程，不接受生产 PID。准备 `probe-root/original/` 下从原 app.jar 提取的 ModelJson / BusinessException class，以及可选的 `real1.json`、`real2.json` 原模型文本（0600，不入库）。`--classpath` 传应用同版本 Jackson、SLF4J API、Spring Web JAR。运行 attach → 冻结无效 → 激活恢复 → 无法恢复明确报错 → 卸载回退，持续采样本机测试 HTTP；同一 PID、无模型或产品数据库调用。测试会清理自己启动的探针进程。

```bash
python3 infra/hotfix/studio-json-sandbox/probe.py \
  --sandbox /absolute/path/sandbox --module /absolute/path/aep-json-recovery.jar \
  --java-home /absolute/path/jdk17 --probe-root /absolute/path/probe \
  --classpath /absolute/path/dependency1.jar:/absolute/path/dependency2.jar
```

## 生产加载与回退

保留独立目录和原配置备份，把模块放在该 Sandbox 的 `sandbox-module/` 中；`cfg/sandbox.properties` 的 `user_module` 只指向这个目录，`unsafe.enable=false`。先在服务器自己的 Dragonwell 17 子进程再做一次上述验证。记录原 app.jar SHA256、MainPID、ActiveEnterTimestamp、NRestarts 和本机 / 公网健康采样；任一范围或探针不符，卸载模块并停止，不重启主服务兜底。

以下是核对路径、PID、空闲端口之后的命令模板；需用服务运行用户执行，后续管理直接 `-C` 连接，避免反复 attach。

```bash
# sandbox.sh 需要 JAVA_HOME 指向该服务器自己的 JDK 17，SANDBOX_HOME_DIR 指向独立安装目录。
bash sandbox.sh -p "$AEP_TARGET_PID" -n aep-json-20261024 -I 127.0.0.1 -P 24769 -l
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -d aep-json-recovery/status
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -a aep-json-recovery
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -d aep-json-recovery/probe
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -d aep-json-recovery/status

# 回退；卸载后原方法恢复，仍不重启应用。
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -u aep-json-recovery
# 完全退出 Sandbox 管理容器（生产前必须在探针中验证）。
bash sandbox.sh -C -n aep-json-20261024 -I 127.0.0.1 -P 24769 -S
```

期望模块匹配 1 class / 1 method，`active=true`、`bridgeErrors=0`；固定探针返回 `valid=PASS repair=PASS` 和 `unrecoverable=PASS code=AI_BAD_OUTPUT`。探针只在内存里调用解析方法，不创建作品或任务，不代表新的一次真实模型生成验收。健康采样只说明采样期间的结果，不等同于全量请求零中断。正常发布时先卸载 / 停止临时模块，再发布已经含修复的 main，以免形成两层临时恢复策略。
