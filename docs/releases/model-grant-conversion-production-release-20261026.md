# 通用积分转模型赠款 · 生产发布（2026-10-26）

- **制品**：`20261026-model-grant-conversion`，从干净 main `ea826383` 构建（含上一版线上 `3e45f6e4` 的全部内容 + `feat/gift-to-model-grant`）。
- **服务**：server、admin。无新迁移，Flyway 校验 69 个迁移通过。
- **发布时间**：2026-10-26 00:58 CST server 重启完成（启动 16.5 秒），`verify ALL GREEN`。

## 做了什么

后台「积分运营 → 模型赠款与折扣 → 积分转赠款」（仅 SUPER_ADMIN）：把最近几天加过积分的客户的赠送 / 激活码积分转成某个赠款活动的模型赠款，每人保留一部分通用积分（默认 1000 = 约 10 元）。充值积分不动。每个客户独立事务，ADJUST 扣款与赠款发放同事务；同一请求编号重试不重复扣。规则见 `specs/BUSINESS_RULES.md`「模型折扣与模型赠款」。

## 验证

- 本地：`ModelGrantConversionIntegrationTest` 5 项、`ScopedCreditServiceIntegrationTest` 36 项在 H2 与 MySQL 8.0 上都通过；后台 `page.test.tsx` 14 项；typecheck 两门、server 编译、接口契约门全绿。
- 线上：重启后 0 条 ERROR；`GET /api/admin/model-billing/conversions/candidates` 未登录返回 401（路由存在）；`/admin/finance/model-billing` 返回 200，部署包里有「积分转赠款」页签。
- 重启窗口内 HTTP 会短暂 502（单实例重启，已知）。
- **还没有在线上执行过转换**：需要超管登录后台，先建 H3 赠款活动再执行，见下。

## 执行步骤（运营）

1. 「赠款活动」新建：适用接入点选 `ai-jusuan-minimax-h3`；发放总额 ≥ 约 75,000；单账户限额 ≥ 约 15,000（最大的一位约 14,286）；到期时间 ≥ 30 天后。
2. 「积分转赠款」：最近 3 天、每人保留 1000、选上面的活动、有效期 30 天、填原因 → 读取候选 → 核对预览 → 二次确认。
3. 结果逐行显示「已转换 / 无需转换 / 已转换过 / 失败（原因）」。失败的客户不受影响，可调高活动限额后用「重试上一次转换」再跑。
