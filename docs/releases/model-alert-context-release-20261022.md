# 模型告警调用信息生产发布 — 2026-10-22

北京时间 20:51 发布 server、admin；20:55 发布后端数据库列映射修正。两次均先合入并推送 main，再从干净 main 工作树构建。

## 变更

飞书生成异常告警和后台展开详情增加供应商/端点、API 基础地址、模型及脱敏参数摘要，保留错误码、任务号、追查号和请求日志入口说明。优先读取原任务及当前失败图片的请求快照；只能取得当前端点配置时明确标注“当前端点配置，原调用未记录”。视频配置明确标注“任务参数（非完整上游请求）”，不把配置推断为完整供应商请求。

参数仅发送技术字段白名单，提示词/文本只给字符数，参考素材只给数量或存在标记。API 地址去掉账号、密码、查询串和片段；不发送凭据、素材链接及内容。上下文读取失败仍发送原告警，不影响失败收尾和退款。端点兜底按精确 task_id 查询，禁止按用户或时间猜测模型。

初次线上验收发现模型表物理列为 `default_model`，修正查询别名后再次测试、合入 main 并部署后端。测试建表从实体字段的 JPA 映射取列名，覆盖这一实际映射。

## 制品

| 服务 | 构建所用 main 提交 | 发布包 | 制品证据 |
|---|---|---|---|
| server | `bca7980f8715dcbf6d8ebbc68eba1f081b38a88d` | `20261022-model-alert-context-schema` | JAR SHA256 `b2eda7fcfcb1cda1567b81d600ad7c47c6327128e786552a10fc23f922374046` |
| admin | `eb6cfafe6201ae90b62e1e177ff388ed6032b66c` | `20261022-model-alert-context` | BUILD_ID `OURDImq_O3RfcAxUBNb8l` |

后端 JAR 与服务器 SHA256 一致；后台公网 JS chunk SHA256 为 `232b73f13b2043f5bf93716175e4bd76201b5d8a0e41ca7cd63d6e112c1b7899`，与构建产物一致且包含 modelContext。两项服务 active、NRestarts=0，release-id/release-sha 逐服务核对。两次部署 verify.sh 全绿，无数据库迁移，Flyway 仍为 V64。Studio、带货、短剧前端保持上一发布版本。

## 验收

- 后端上下文/通知/客户端共 13 项测试通过；数据库映射修正后的上下文 5 项再次通过。后台完整测试 20 项通过。
- 四道提交门通过：workspace 类型检查、admin 类型检查、后端离线编译、API 契约检查；契约工具既有提示未新增。
- 生产管理员接口及真实浏览器展开详情均显示模型信息，参数自动换行；普通用户访问告警接口仍为 403。
- 群内原有 3 条消息通过飞书官方消息编辑 API 原地更新，逐条验证响应中的 message_id 与完整正文一致，没有新增消息或再次加急。

| 任务 | 线上核实的信息 | 原消息 ID |
|---|---|---|
| `mvj_265ff6b6e166` | 聚算 MiniMax H3；`https://api.jusuanhub.com/v1`；`minimax-h3`；13 秒、16:9、768p、3 张参考图、universal_reference_video | `om_x100b62947c0754a8dd234b11baa1735` |
| `IPR-b7074fc9` | CATech GPT Image 2；`https://ai.aiprox.tech/v1`；`gpt-image-2-1k-pic`；768×1024、n=1、prompt_chars=34 | `om_x100b62947cd62cb0c0834ca6dcd5296` |
| `IPR-af62983c` | 同一 CATech 端点/模型；1152×2048、n=1、prompt_chars=338 | `om_x100b62947fa18ca8c42b7cb1fec4815` |

与上一发布验收快照逐项比较：原退款流水、消息 ID/发送次数和退款总额完全相同。3 个任务仍为 failed、未完成积分已退回、队列 finished；此前共退款 580，本次没有重新结算，没有提交付费模型请求。

证据目录：`.studio-e2e/alert-context-20261022/`，包含测试与构建/部署日志、artifacts-final.json、services-final.json、enriched-receipts.json、settlement-final.json 和实际后台截图 admin-production.png。运行手册见 [模型任务告警](../runbooks/model-task-alerts.md)。
