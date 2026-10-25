# Studio JSON 异常 JVM-Sandbox 热修复（2026-10-25 UTC）

## 结果

2026-10-25 07:14:39 UTC，生产 `aistareco-server` 已启用 `aep-json-recovery`，未重启后端。只对 `com.aistareco.aep.ipstudio.service.ModelJson.parse(ObjectMapper,String)` 原本抛出的 Jackson 异常尝试恢复；正常返回不变。无法恢复时抛应用自己的 `BusinessException(AI_BAD_OUTPUT)`，由原工作流保留失败退款和诊断。

这是进程内临时模块；永久解析器 / 工作流修复已合入 main，但本次不替换普通应用 JAR。下次正常发布使用 main 中的永久修复，并先卸载临时模块。操作和回退见 [JVM-Sandbox 手册](../runbooks/studio-json-jvm-sandbox.md)。

## 制品与范围

| 项目 | 实际值 |
|---|---|
| 构建用 main 提交 | `31fc2bdf29da8b25822253cb64ac92071dcdb494`，已推送；从干净 main 的 Git archive 构建 |
| 永久修复提交 | `ee8fe3b7`（解析器、工作流明确提示及长任务容量修复）；本次热加载仅包含解析恢复模块 |
| 官方工具 | [alibaba/jvm-sandbox 1.4.0](https://github.com/alibaba/jvm-sandbox/releases/tag/1.4.0) |
| 模块 JAR SHA256 | `b213bfbd949353e59ff8655554d6f6f14883b960d312543338bc2a6073f01d8a` |
| 打包归档 SHA256 | `127b599889a94eeebf3d63790183933d93fa583af50fee58cbee6ddf0578599e` |
| 解析器源码 SHA256 | `4456db4f4fb280eec851f99d196ae82506990ef4aaa8a7a0794e7df4ca8de2a1` |
| 主进程 PID / NRestarts | `2556307` / `0`，加载前后相同 |
| 主进程启动时间 | `2026-10-25 13:49:26 CST`，加载前后相同 |
| 应用 JAR SHA256 | `e79d9a535355dc948885a97c8788480d435c5f0e93684318d096850bf795cbba`，加载前后相同 |
| 匹配范围 | 1 class / 1 method；应用类加载器 `org.springframework.boot.loader.launch.LaunchedClassLoader` |
| Sandbox namespace | `aep-json-20261024` |
| 管理监听 | 仅环回 `127.0.0.1:24769`；Linux 显示为 `[::ffff:127.0.0.1]:24769` |
| 服务器目录 | `/home/ecs-user/.local/share/aistareco/hotfix/studio-json-31fc2bdf`（私有目录） |

本次未更改产品数据库、systemd、server.env、nginx、模型配置或应用 JAR，未重跑生成任务，也未调用厂商模型。模块使用隔离的 Jackson，通过应用自己的 mapper 返回应用 JsonNode；无法桥接时保留原异常，不伪造成功。

## 验证

- **代码检查**：后端 50 项直接回归通过；离线编译、管理端 typecheck、API 契约检查通过。全 workspace 并行 typecheck 退出 137、无 TypeScript 诊断；未完成的 aiavatar / drama 拆开重跑均通过，其余项目先前已完成。
- **本机独立 Java 17**：使用从线上 JAR 提取的原始 ModelJson / BusinessException，在隔离应用类加载器中验证 attach → FROZEN 不生效 → ACTIVE 自动恢复 → 无法恢复明确报错 → unload 恢复原行为。同一 PID，HTTP 健康采样无失败。
- **两份真实响应**：分别恢复 3997 字和 2053 字，正文 SHA256 为 `98b9c7aaa71c3764f43992aabed53af6f287c0e5feed45dad19f30431e139596`、`11f9ffa03cf68c8a884d9ff7d64a6fe345e7d8c53bb9f4aa5923ceed78a619fc`，与此前定点恢复逐字一致。
- **服务器 Dragonwell 17 隔离进程**：同样验证加载、恢复、明确报错、卸载回退，`bridgeErrors=0`，HTTP 健康采样无失败；生产主进程未参与这一步。
- **生产先冻结检查**：只匹配一个业务类的一个方法，原格式探针仍报 JsonParseException，合法 JSON 保持原样。首次冻结预检因 Linux 把 IPv4 环回显示为 IPv4-mapped IPv6 而被过严的字符串校验拒绝，按预案卸载；改用 IP 地址语义校验后重新加载，确认仅环回监听，再激活。两次均未重启主服务。
- **生产激活后固定内存探针**：`valid=PASS repair=PASS`；`unrecoverable=PASS code=AI_BAD_OUTPUT`；`active=true recovered=1 rejected=1 bridgeErrors=0`。这两个计数来自探针，不代表新增客户付费生成验收。
- **激活窗口健康采样**：本机 API 22 次、公网 API 22 次，44 次均 HTTP 200，采样最大延迟 31.4ms。PID、启动时间、NRestarts、应用 JAR SHA256 均未变化。抽样结果不等同于全量请求零影响。

远端完整记录：上述服务器目录下 `production-evidence.json`、`activation-health.jsonl` 和 `health-samples.jsonl`。不把客户原始剧本或任何凭据写入仓库。

## 回退与后续

按手册对 namespace `aep-json-20261024` 执行 `-u aep-json-recovery` 撤销方法增强，可再 `-S` 退出管理容器；无需重启应用。不要用重启当前旧 JAR 来代替补丁卸载：重启会丢失临时修复。正常发版必须构建已包含永久修复的 main，再按常规发布和业务验收流程执行。
