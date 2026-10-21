# 模型用量归属与多模态统计生产发布（2026-10-21）

## 版本与范围

- 修复提交：`63884b70`；合入并推送 main 后，从干净 main `3782da88994f4a585fc5d22bef46355cc6bb898e` 构建。
- Release：`20261021-model-usage-attribution`；范围：`server,admin`（本仓 `apps/admin`）。独立统一运营后台本次不追加改动。
- 两服务切换时间：2026-10-21 15:00:24 UTC / 23:00:24 CST；后端启动完成：15:00:40 UTC。
- 没有新增数据库迁移。Flyway 校验 63 条成功，当前仍为 V63。

## 修复内容

1. 六类异步 worker 在实际执行入口按持久化 owner 建立 `AiModelUsageContext`，归属按“显式传入 → 任务作用域 → 请求登录用户”解析，嵌套、异常和任务恢复均清理/恢复作用域；无用户且无请求上下文时输出告警。积分账本不依赖这张供应商消耗流水表。
2. 用户、租户未归属筛选使用 `IS NULL`，普通/分页明细和管理通道均支持；同维度空归属与具体 ID 冲突返回 400。admin 的未归属点击、租户筛选同步接通。
3. 增加模态聚合，admin 展示和导出独立的调用数、Token、计费单位、秒数、估算成本；趋势不再把不同单位相加。兼容图片响应中的 Token，音乐记录供应商成功回报的实际时长，即使后续存储交付失败也保留消耗；新配音/口型记录调用单位与秒数分开。
4. 视频智能优化单独按 `VIDEO_PROMPT_OPTIMIZATION` 观测，按端点及原幂等键去重，不套视频每秒成本价；缺独立单价时显示未估价。
5. 历史缺失归属不猜测回填。`DAP_PERSONA` 的展示覆盖 Studio、数字资产文字和理解用途，不把其全部消耗解释为人设生成。

业务真源：[`specs/BUSINESS_RULES.md`](../../specs/BUSINESS_RULES.md)“模型用量归属与多模态统计”。

## 本地门禁

- main 上 `pnpm typecheck:all`、`pnpm typecheck:admin`、`./mvnw compile -q -o`、`pnpm check:api-contract` 均退出 0。契约检查保留原有 24 条缺 handler 提示，本次未新增。
- 12 个后端测试类共 142 项成功，0 失败/错误：用量服务、归属作用域、图片 Token、音乐完成/交付失败、管理通道、Studio 工作流与真实异步对话链、IP/短剧 worker、图片生成和智能优化重试。
- admin 两项交互测试成功，覆盖未归属筛选与统计展示。
- 发布脚本完成后端 package、admin 生产构建；制品校验和成功，admin 包未包含 `.env*` 或本地 fixture，JAR 包含新的归属作用域类。

## 线上验收

- 切换后检查后端日志，未发现 ERROR 或用量漏归属 WARN（验收窗口内）。
- `verify.sh` ALL GREEN：公开页面、`/api/config`、各 systemd 服务、后端本机 API、字体、sau 健康与 `nginx -t` 通过。
- `https://admin.aibuzz.cn/admin/ai/audit` 返回 200；页面引用的 20 个静态资源全部与本地正式制品 SHA-256 一致。匿名访问 admin 用量 API 返回 401。
- 使用已有模型管理签名通道执行只读 `usage`、`usageRecordsPage`、`usageRecords`；密钥只在远端内存读取，未输出或写入验收记录。
- 最近 30 天汇总：293 次成功调用，885074 Token、109 计费单位、259 秒；文本与多模态理解 187 次、图片 75 次、视频与口型 30 次、音频与音乐 1 次。逐项核对模态汇总的调用数、输入/输出/总 Token、单位、秒数、成本，均等于全量总计。历史配音的计费单位仍保留原值；没有配置成本或没有厂商用量字段不代表免费。
- 未归属用户分页总数 282，检查返回的 200 条全部 `userId=null`；未归属租户分页总数 293，返回 200 条全部 `tenantId=null`。两种冲突筛选均返回 400。旧普通明细抽查 100 条同样只返回空用户记录，管理通道未返回请求/响应正文。
- 发布前历史空用户共 386 条、896145 Token；发布后同一时间上界的数据仍为 386 条、896145 Token，未改历史流水。发布前最近 30 天成功未归属数已由最初排查的 247 增至 248。
- 验收时上线后暂无新增模型流水，没有为验收触发真实付费生成。异步归属由本地真实 HTTP/线程池集成链验证；生产新任务归属尚无新增样本，不据此宣称已验证零漏记。
- 生产页面做了路由和制品检查，交互回归在本地完成，未在生产登录后重跑点击流程。

## 制品与回退

| 制品 | SHA-256 / Build ID |
|---|---|
| 后端 JAR（本地、发布存档、运行文件一致） | `7bb5a758c67e087862f0139ae2bd5afb1309f85b3241a0ca915c316208b76d31` |
| admin.tar.gz | `beeb41da7493e42c3871690046129efc73d5b74c57e558cc21588884222530f0` |
| admin BUILD_ID（本地与运行目录一致） | `gdgNKj1HT77cnurj0Zgcu` |

远端存档：`/opt/ai-star-eco/releases/20261021-model-usage-attribution`。

发布前备份：`/opt/ai-star-eco/backups/20261021-model-usage-attribution/server-app.jar` 与 `admin.tar.gz`；旧 JAR SHA-256 为 `0800cb0f03405c2631fae4e5161b6c327e968084a4af4ed2b95100e7255e2cfa`，旧 admin BUILD_ID 为 `wn4UpYD2OyAPac_lc916h`。需要回退时恢复这两个备份并重启对应服务，数据库保持 V63，不回退数据。现网登录和企业开关沿用原值，未改机密配置。
