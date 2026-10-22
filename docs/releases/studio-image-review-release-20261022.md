# 图片受理未知与执行名额修复 · 2026-10-22

范围：server + web-aiavatar。先合入 main，再从干净 main 构建发布；保留主线已有视频铺满、抽帧、模型用量归属等功能。

## 问题与处理

生产图片 `IPR-b7074fc9`（2026-10-22 13:35 北京时间）与 `IPR-af62983c`（10-21 17:01）均调用 CATech GPT Image 2，约五分钟后返回 HTTP 504，没有产物或供应商任务号。任务保留 `running/image.provider.recovering/STUDIO_IMAGE_SUBMISSION_UNKNOWN/pct=10`，各冻结 30 积分且无 SPEND/RELEASE。两张 running 票据占满端点 concurrencyLimit=2。

- 并发准入、派发、`queue.running` 改为共用数据库只读 `countOccupyingSlots`：仅排除上述需人工核对的图片状态。原票据保留，端点仍不能被删除；任务、请求、付款授权、冻结和账本均不改写，原任务不重提。已知图片恢复、视频与音频原容量规则保留。无需迁移，旧记录部署后立即适用。
- 画布未知受理显示静态提示图标、“受理结果待核对”、联系运营及勿重复生成/冻结待核实说明；不转圈、不显示阶段百分比。正常图片显示生成/保存/查询阶段，视频进度保留。
- 任务列表、历史、制作面板统一状态文案；未知受理任务没有无效的停止/重新生成按钮。原请求核对和基于供应商明确未受理证据释放冻结仍走既有后台流程。

## 验证

证据目录：根工作区 `.studio-e2e/image-review-20261022/`（gitignored）。

- 后端 46 项：真实 H2 并发/FIFO、两个未知图片票据下后续同步与图片准入和自动派发、已知任务恢复后重新计数、未知任务不重提、原冻结不消费/不释放、超时清理与人工核对规则。
- 前端定向 133 项：画布、任务列表、工作台、节点回写、生成与资产提取。未知受理刷新后仍显示待核对；无百分比/转圈/无效取消；视频进度与正常任务操作保留。
- 四道编译门：typecheck:all、typecheck:admin、mvn compile -q -o、check:api-contract 全部通过。提交前 git diff --check 通过。
- 本地浏览器使用生产源组件与样式、隔离固定任务数据，不调用供应商：1280 桌面和 390×844 窄屏均可读，未知任务无转圈/百分比，窄屏 scrollWidth=390；截图 `desktop.png`、`mobile.png`。这是组件界面验收，不宣称已登录真实客户会话。
- 全量前端 148 文件、1148 项：1146 通过；资产提取异步断言首轮偶发失败、定向重测通过（13 项）；`select-field-wiring` 检出原有 `apps/admin/src/app/ai/audit/page.tsx` 原生 select，已在未修改的 main `57be2582` 复现，属于主线存量问题，本次不修改或部署 admin。日志 `web-targeted.log`、`main-baseline.log`、`web-integration.log`。

## 发布

待合并、构建、发布与线上验收后补充实际 main SHA、制品和结果。
