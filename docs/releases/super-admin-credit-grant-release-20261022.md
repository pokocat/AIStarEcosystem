# 超管直接发放积分 · 2026-10-22

范围：server + admin。用户明确要求有效超管直接发放积分、无需另一人复核，并完成既有 `car-e8dcec98-d65` 的 10000 积分赠送。先合入 main，再从干净 main 构建部署。

## 行为

- `CreditOpsService` 读取当前 ACTIVE / SUPER_ADMIN 管理员记录，允许赠送/补偿超阈值直接入账；不接受客户端角色或豁免参数。其他角色保留原阈值和独立复核，财务不可自批。
- 超管可批准本人历史待审单；批准/驳回锁原单，批准状态、真实 maker/checker 与账本同事务，重复或并发批准不能重复入账。
- 原因、补偿工单/活动幂等、每日发放限额、GIFT 桶和不可变账本保留。直接发放写 APPROVED 审计单并注明超管直发；历史单保留原编号，注明超管批准。无需迁移，不批量批准任何其他单据。
- 后台按角色显示规则；超管本人历史单可批准，财务本人单与无复核权限的账号禁用批准按钮。

## 验证

证据：根工作区 `.studio-e2e/super-admin-credits-20261022/`（gitignored）。

- 后端 22 项：19 项服务回归、3 项真实 H2 钱包/账本/角色/事务验收。超管直接增加 10000 GIFT、充值和冻结保持；非超管大额仍待审；财务自批拒绝；停用超管不获得例外；日限额及同活动重复保护；两个并发批准同一张无活动号旧单，只有一个成功、仅一条 GIFT 分录。
- admin 全量 18 项通过，包含 3 项新流程测试：超管本人待审单批准、10000 积分直接发放回执、财务/运营不能自批。
- 四道编译门 typecheck:all、typecheck:admin、mvn compile -q -o、check:api-contract 通过；git diff --check 通过。
- 本地浏览器：生产页面组件和样式 + 隔离 API/身份数据，桌面点击批准后原单消失并提示“已批准并入账”；财务本人单按钮不可用，390×844 无横向溢出。截图 desktop.png / mobile-finance.png。不把隔离预览当成真实生产发放。

## 发布与实际发放

- 已先快进合入并推送 main `8dc276d0b02ea3f3afa52ec709f3cbfb15e4a9fe`，构建前后 main 工作区干净，保留上一版图片受理未知修复与主线既有功能。
- 发布 `20261022-super-admin-credits`，仅 `server admin`；北京时间 2026-10-22 17:34:40/41 重启。server PID `1681094`，admin PID `1681144`，均 NRestarts=0；deploy-release.sh 成功，verify.sh ALL GREEN，主服务重启至验收 ERROR=0。
- 生产 JAR SHA-256 `fa2bbdb946ae3c739c2ee870b3bb0d146c442a671d6ac7f5d42106c0de25d62f` 与 main 制品一致；admin BUILD_ID `zz9qcekzPAqI4LRmEae3p`。公开 `/admin/_next/static/chunks/0k.22u1h-1e8g.js` 返回 200，SHA-256 `710b4fa4b9b0ad0ab3a6600b1fdf1e7d93eac29cb0ae982bcd13612a7378a59e` 与本地一致，包含新的超管规则说明。核验后同步 server/admin 发布标记。
- 生产授权单 `car-e8dcec98-d65` 沿用原请求、原活动号，由当前有效超管通过既有 approve API 批准；maker/checker 为同一超管，状态 APPROVED，新增且仅新增一条 10000 积分 GIFT/CREDIT 分录，cashArtifactId=null。原单与新账本编号关联一致，没有重新提交赠送单。
- 本人个人钱包可用余额 **1586 → 11586**，gift **0 → 10000**；recharge=1586、license=0、pending=30 均与本次操作前一致。已再次通过正常 admin 钱包 GET 核对余额及分桶勾稽。手机号仅保留掩码 `155****6196`；完整用户/钱包、账本号、前后回执保存在生产受限目录，不写入仓库。
- 回执与回滚：生产 `/opt/ai-star-eco/backups/super-admin-credits-20261022/`（目录0700、关键回执0600）含旧 JAR、原发布标记/后台 BUILD_ID、原审批和钱包快照、approve-result.json、fulfill-receipt.json、runtime-acceptance.json。admin 原版由安装器保留在 `/opt/ai-star-eco/admin.__previous__`。服务制品回滚不回滚业务账本、不重开已批准单，不能据回滚重复发放。
- 本地追加证据：build-release.log、deploy-release.log、public-assets.json、fulfill-receipt.json、runtime-acceptance.json。没有改生产角色、阈值配置或登录凭据，没有调用付费模型。
