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

- 构建提交：干净 main `7bce53dae05f63278b95013e0d2f69fa16496f25`，功能分支先快进合入 main，再普通推送 origin/main；保留 main 原有 `57be2582` 的全部功能与发布记录。
- 发布：`20261022-studio-image-review`，范围仅 `server web-aiavatar`。北京时间 2026-10-22 15:30:12/13 重启，server PID `1654244`、web PID `1654295`，均 `NRestarts=0`。`deploy-release.sh` 完成，`verify.sh ALL GREEN`，API、全部服务、nginx、字体和 sau-service 健康检查通过。
- JAR SHA-256：`f00abb4b37fb201ec5b9c9f3249df39f6fa902824475f5b1f8a88a36908018a2`，与本地 main 制品一致。前端 `BUILD_ID=ANDyvlQBq0Eoz48DMGL8i`；包含本次状态提示的公开 chunk `/_next/static/chunks/1596.c9a8f43a81869c76.js` HTTP 200，SHA-256 `87138fdc39f11c73609fa50a4f7ef9218995c4c677a299071d2fdee32ee56d4b`，与本地构建逐字节一致。核验后同步两服务 release-id/release-sha 标记。
- 生产存量验收：同一数据库谓词计算旧票据仍为 2 张，但执行名额占用为 **0/2**。两笔旧任务、输入、输出、心跳与冻结/账本快照发布前后逐字节一致，各 ACTIVE 冻结 30 积分、无新增 SPEND/RELEASE。无需直接改写任务或队列票据，即恢复后续准入额度。新任务准入、FIFO、同步入口与自动派发由前述真实 H2 事务回归验证，本轮没有新增生产付费生成。
- 日志：重启后至验收时主服务 ERROR=0（匹配线上真实级别格式）。本地证据 `build-release.log`、`deploy-release.log`、`online-runtime.log`、`runtime-acceptance.json`、`public-assets.json`。
- 回滚备份：生产 `/opt/ai-star-eco/backups/studio-image-review-20261022/` 保存旧 JAR、服务原标记、旧前端 BUILD_ID、两笔任务与账本前后快照（0600）；前端原制品由安装器保留在 `/opt/ai-star-eco/web-aiavatar.__previous__`。回滚仅替换对应服务制品并重启；不恢复覆盖客户业务表。旧代码会重新将未知任务计入容量，回滚前应评估此影响。

验收边界：已验证实际线上制品、生产任务/冻结未变及有效容量计数；本地浏览器为真实组件的隔离状态验收，未登录客户生产会话，未重提旧任务，也未因 HTTP 504 自动退款。
