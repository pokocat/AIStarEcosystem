# Studio Ops 独立后台

独立 Next.js 查询前端，生产挂载路径由 `NEXT_PUBLIC_STUDIO_ADMIN_BASE_PATH` 决定。它不依赖旧 `apps/admin` 页面运行，身份仍复用后台登录与服务端角色校验。

## 本地验证

```bash
pnpm --filter @ai-star-eco/studio-admin dev
pnpm --filter @ai-star-eco/studio-admin typecheck
pnpm --filter @ai-star-eco/studio-admin test
pnpm --filter @ai-star-eco/studio-admin build
```

开发环境可用 `http://localhost:3004/technology?tab=models&days=7&demo=1` 查看明确标注的本地演示数据。演示分支在 production 构建中不可启用。

## 信息架构与请求边界

- 左侧主菜单是独立路由：`/business`、`/technology`、`/suppliers`、`/scenes`、`/models`；根路由跳转到经营分析。
- `/models` 是模型配置（模型接入、IP Studio 模型、功能与售价），替代统一后台和 `apps/admin` 的 LLM API 页；规则见 `docs/platform-model-management.md`。保存逻辑都在 `src/lib/model-config.ts`，规格一律当不透明 JSON，不要写只列部分字段的表单。
- 顶部页签只切换当前模块的子页面，状态保存在 `tab` 查询参数中，支持刷新、前进和后退。
- 经营与技术请求分别使用 `scope=business|technology`，后端不计算当前模块不会展示的另一半聚合；共用健康状态仍在两者中展示。
- 供应商性能只在 `/suppliers` 动态加载，不随技术监控页面一起请求；切换筛选或离开页面会取消过期查询。

## 供应商性能口径

- 入口：左侧“供应商分析”，顶部可切换“性能概览 / 任务明细”。
- API：`GET /api/admin/studio-operations/supplier-performance`，只允许 `SUPER_ADMIN`、`OPERATOR`、`FINANCE_ADMIN`。
- 时区：北京时间、洛杉矶时间、UTC；查询最多 31 个本地自然日。
- 成功率分母只含成功与失败终态，进行中、取消、未知单列。
- P50、P95、最长耗时只统计交付成功且时间字段完整的任务；耗时从创建到交付，包含排队、生成、下载与转存。
- 余额不足、内容审核、限流、上游 HTTP、结果校验、超时和未知原因分开；排除项必须由操作者明确选择，并同时应用于统计和明细。
- 单来源最多读取 50,000 条；超过上限整次报错，不截断冒充全量。接口使用只读事务、12 秒超时和私有 30 秒缓存，前端查询 15 秒主动取消。
- 明细不返回用户、完整提示词、原始错误文案或上游凭据，展示字段包含任务标识、供应商、模型、类型、归一状态、错误分类和成功耗时。

当前数据源覆盖 `ip_run` 和 `material_video_job`。真实并发上限、供应商配额与供应商内部可用率没有可靠采集源时仍显示未知，不用 0 或绿色替代。
