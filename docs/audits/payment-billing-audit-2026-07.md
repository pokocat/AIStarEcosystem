> 状态：审计完成 · v1 · 2026-07-04
> 本页是「支付 / 计费 / 积分账本」系统的一次全面审计报告 + 交由后续 agent 落地的优化方案台账。
> 审计范围：`apps/server`（充值订单 / 支付网关 / 积分账本 / 业务扣费 / 对账 / 退款 / 财务后台）+ `apps/admin` 资金财务面 + 四个 web app 收银台 + 小程序 + `specs/` 契约文档。
> 审计方法：payment-system-design skill 的 10 类失效模式目录 + 风控规则 R1–R8，5 路并行代码走查（只读，未改任何代码）。

# 给接手 Agent 的话（先读这段）

- 本方案属于 **AIStarEcosystem**（`apps/server` = Spring Boot 3.3.5 / Java 17，H2 dev / MySQL prod；四个 Next 16 web app + 微信小程序）。支付方 = **支付宝当面付/H5 + 微信支付 V3（Native/JSAPI/H5）**，v0.94 起多渠道直连（删 jeepay）。
- 计费模型 = **一次性充值 + 积分账本消费**（非订阅、非订阅周期）。因此：**不需要** dunning / 自动续费 webhook / proration / 周期锚点；**需要**的是充值入账幂等、积分账本不可变、消费扣费防双花、退款回收、桶纯度与提现风控。审计据此右尺寸，不套订阅态机。
- 本仓账务底座（`CreditService` 三段式 hold→commit/release + 悲观行锁 + 不可变 `LedgerEntry` + `settlePaidOrder` 条件 UPDATE 单一入账漏斗）**设计扎实、核心路径无双花**。绝大多数问题集中在 **① 遗留旁门入口**、**② 提现侧风控真空**、**③ 退款回收不全**、**④ 财务操作审计缺失** 四类，不是底座重写。
- 被指派修某条时：先读下方「决策台账」（已定的口径别推翻），再按「实施波次」里对应的 Task 卡执行，每张卡带 `file:line` 定位 + 验收断言。

---

# 一页纸结论（TL;DR）

- **核心病**：账务底座很稳，但**有一条零支付白嫖充值的活体路由**（多 agent 独立命中），**提现可把无现金背书的赠送积分套现为真实打款**，**退款只回收主积分、放跑赠送积分与存储**，**财务动钱操作几乎不写审计**。
- **修复主轴**：① 堵遗留免费入账/免费算力入口 ② 提现桶隔离 + 审批单化 ③ 退款全额权益回收 + 应退金额锚点 ④ 资金操作全量审计 + 端点门控补齐 ⑤ 渠道侧关单/退款闭环 + 迟到支付告警。
- **计费模型**：一次性充值 + 积分消费（不引入订阅机制）。
- **总体评级**：底座 A-，外围 C。**存在 2 个必须本周堵的可利用资损口（P0），8 个 P1**。生产当前靠「`CreditPack` 无生产 seeder / 部分渠道未配真凭据」等**数据缺失**侥幸挡住部分 P0，属脆弱防线，不可依赖。

---

# 决策台账（已拍板口径，勿推翻）

| # | 决策 | 理由 / 影响 |
|---|---|---|
| D1 | 计费模型锁定为「一次性充值 + 积分账本消费」，不引入订阅/续费/proration | 现状即如此；避免过度设计。审计不检查续费/宽限/折算类失效模式 |
| D2 | **积分账本 `LedgerEntry` 不可变 + `CreditService` 是唯一记账入口**，任何绕过它直接改 `Wallet` 余额的路径一律视为缺陷 | 已是 CLAUDE.md §4.2 硬规则；本次发现的 P0/P1 多为违反此条的旁门 |
| D3 | **提现只能提「有真实现金背书」的桶**（recharge 或专设可提现 income 桶）；gift/license 桶结构上不可提现 | 防「平台负债单位套现为真实打款」；见风控 R7 |
| D4 | **退款回收所有随单发放的权益**（主积分 + 赠送积分 + 存储扩容），并给出按比例应退现金锚点 | 防买赠退现套利（audit-catalog #9 / 风控 R7），退款金额可勾稽 |
| D5 | **一切动钱/动权益的 admin 操作必须写 `AuditLog`（含结构化 before/after）** | 财务合规底线；退款/改价/调差/核准当前不可追 |
| D6 | 渠道侧订单必须设与本地 TTL 一致的过期时间，关单/取消/驳回在线单先调渠道 close，迟到支付进人工告警而非静默吞 | 防「钱收了不入账不退款不告警」；见网关 P1 |
| D7 | 影子/沙箱通道遵循 §8.0 双控：环境开关 + 鉴权 + **生产 fail-fast 拒启**（不止横幅），confirm 端点必须校验订单确为 SHADOW 渠道 | 防演示通道泄漏生产 = 免费充值 |
| D8 | 需幂等的入账类型（RECHARGE/GIFT/REFUND_CASH）在 DB 层加 `(reference_type, reference_id)` 唯一约束，把幂等从代码约定升级为数据库不变量 | `existsBy` 读后写存在 TOCTOU；并发复核可双发 |

---

# 一、审计结论矩阵（失效模式 × 命中）

payment-system-design 的 10 类失效模式逐条判定（本仓为一次性充值模型，标注 N/A 的属订阅专有）：

| # | 失效模式 | 判定 | 关键证据 |
|---|---|---|---|
| 1 | 永久权益 | **命中（旁门）** | `SettingsController.purchaseCreditPack` 零支付发积分（F-01） |
| 2 | 自然月额度泄漏 | N/A | 无周期额度，纯一次性充值 |
| 3 | live-reference 误伤已购 | **未命中 ✅** | 订单下单即快照 credits/bonus/price，改价不追溯 |
| 4 | 布尔代状态机 | **未命中 ✅** | 订单 6 态机 + 积分桶模型，非布尔 |
| 5 | 信客户端/回调时间 | **未命中 ✅** | 到期判断用服务端 `Instant.now()`（但不可注入，见 F-19） |
| 6 | 非幂等发放 | **部分命中** | 充值入账幂等到位；但业务扣费/GIFT 入账无 DB 唯一约束（F-08），frame 等无幂等键（F-16） |
| 7 | 读判写竞态/双花 | **部分命中** | 核心扣费悲观锁到位 ✅；`SettingsController`/`LicenseActivation` 绕锁（F-11） |
| 8 | 折算套利 | N/A | 无套餐折算 |
| 9 | 退款不回收权益 | **命中** | 退款不回收 bonus/storage（F-05），渠道退款 API 缺失（F-13） |
| 10 | 不可测支付路径 | **部分命中** | 有 shadow mock + 仿真 confirm ✅；无可注入时钟（F-19） |

外加本仓特有的三条重灾区：**提现风控真空**（F-03/F-04）、**财务操作审计缺失**（F-06）、**免费算力/免费入账旁门**（F-01/F-02）。

---

# 二、Findings（按严重度排序，跨 5 路审计去重合并）

> 编号 F-xx 为全局唯一。每条：严重度 · 证据 `file:line` · 影响/攻击场景 · 修复要点。落地动作见「四、实施波次」的 Task 卡。

## P0 — 可被任意登录用户直接利用的资损口，本周必修

### F-01 · 零支付白嫖充值路由 + 鉴权真空 + 制造对账负 drift
**P0** ·（账本审计 + 前端审计**双路独立命中**，最强信号）
- 证据：`apps/server/.../controller/SettingsController.java:73-128`
  ```java
  @PostMapping("/credit-packs/{packId}/purchase")
  public ApiResponse<CreditPurchaseDto> purchaseCreditPack(Principal principal, @PathVariable String packId, ...) {
      wallet.setTotalBalance(newBalance);
      wallet.setRechargeBalance(wallet.getRechargeBalance() + pack.getCredits()); // 直接加现金背书桶
      walletRepo.save(wallet);                                                    // 绕过 CreditService（违反 D2）
      LedgerEntry.builder().entryType(RECHARGE).referenceType("credit_pack").referenceId(packId)... // 非 recharge_order
  }
  ```
- 三重叠加：① **零支付**——整链无 `RechargeOrder`/支付网关/审批，任何 JWT 持有者 `POST` 即入账，可无限刷；② **鉴权真空**——`/api/settings/**` 未在 `AepSecurityConfig.java:56-102` 出现，落 `.anyRequest().permitAll()`；③ **orphan RECHARGE**——`referenceType="credit_pack"` 的 RECHARGE 行无对应订单，抬高 `ReconciliationService` 的 `ledgerRecharge` 但订单侧 `grossRecharge` 不含 → 负 drift，与 memory 记录的历史事故（recon-drift-orphan-recharge）**完全同 class**，只是换了入口。
- 当前生产仅靠「`CreditPack` 只有 `@Profile({"dev","test"})` 的 `DemoCatalogSeeder`、admin 无创建端点」这一**数据缺失**侥幸挡住——脆弱，不可依赖。
- 修复：**删除该端点**（前端 `api/settings.ts` 虽引用，但已被 v0.56 `RechargeService` 订单流取代，属遗留死路由）；如需保留积分包展示，purchase 动作必须改走 `rechargeService.createOrReuseCheckoutOrder` + 支付回调 settle。同步给 `/api/settings/**` 显式加 `.authenticated()`，删 `openapi.yaml` 对应 path。→ Task T1

### F-02 · 素材视频生成 `credit_cost` 客户端可传 0 → 免费刷视频算力
**P0** ·（业务扣费审计命中）
- 证据：`apps/server/.../service/materialvideo/MaterialVideoJobService.java:248-252`
  ```java
  private long itemUnitCost(JsonNode item) {
      long override = item.path("credit_cost").asLong(-1L);
      if (override >= 0) return override;   // 直接采信客户端传入
      return videoUnitCost();
  }
  ```
  `controller/MaterialOpsController.java:102-105` 把未清洗请求体直接交给 `submit`；`submit` 里 `if (billable && unit > 0) hold(...)` → `unit=0` 跳过扣费但照常异步出片。
- 攻击场景：登录用户 `POST /api/material/videos/generate {"items":[{"credit_cost":0,"prompt":"...","duration_sec":60}]}` → 零扣费拿视频。`credit_cost` 本是短剧 renderClip 的**内部注入字段**，误对外部客户端开放。
- 修复：controller 层剥离外部请求体的 `credit_cost`/`credit_label`；`itemUnitCost` 忽略外部传入，一律服务端按 kind 查配置定价（外部传值若低于配置价则抬到配置价）。内部 drama renderClip 直接调 service，不经此 controller。→ Task T2

## P1 — 结构性资损/合规缺口，两周内修

### F-03 · 赠送/授权积分（无现金背书）可经提现套现为真实打款
**P1** ·（账本审计命中；违反 D3 / 风控 R7）
- 证据：`CreditService.withdraw` 扣桶顺序 = gift → license → recharge（`CreditService.java:200-207`），与 `debit` 一致，**不区分桶来源**；`giftBalance` 承载运营赠送、活动补偿、业务 INCOME、以及 F-01 白嫖额。
- 攻击场景：运营赠送/用户白嫖得 gift 积分 → `POST /me/wallet/withdraw {amount:N}` → 生成 WITHDRAW 资金分录，财务线下打款 → 平台净现金流出，而这笔积分从无对应现金流入。
- 修复：提现只允许提 recharge 现金桶（或专设可提现 income 桶），扣减额 clamp 到可提现桶余额；gift/license 结构上不可提现。→ Task T3

### F-04 · 提现无审批/限额/频控/幂等/单据，落账即伪造 "processing"
**P1** ·（账本 + 前端审计命中）
- 证据：`AccountController.java:165-186` + `CreditService.withdraw:189-226` 仅校验 `amount>0` 与余额，随即扣款写 WITHDRAW、返回 `status:"processing"`。无最小额/日限额/频控/二次审批（对比调差/赠送有 maker-checker + 日限额）、**无独立 `Withdrawal` 单据实体**、无幂等键、无 payout 追踪 → `processing` 是假状态，实际打款与账本无法勾稽。且 UI 侧：drama 提现 API 全仓零调用，web-music 提现按钮是 `toast.info` 假按钮（前端 F #2/#9）。WITHDRAW 分录 `referenceId` 为空（TODO L2 在案）。
- 修复：引入 `WithdrawalOrder` 实体（PENDING→APPROVED→PAID/REJECTED，条件 UPDATE 幂等闸，照 `RechargeOrder`）+ 日限额 + 大额 maker-checker + 客户端幂等键；WITHDRAW 分录互链单号。前端补真实表单校验或先下线假按钮。→ Task T3（与 F-03 合并为「提现子系统重做」）

### F-05 · 退款只回收主积分，放跑赠送积分 + 存储扩容 → 买赠退现套利
**P1** ·（财务审计命中；audit-catalog #9 / 风控 R7 / 违反 D4）
- 证据：`RechargeService.refundOrder:503-544` 只调 `refundCashReclaim(order.getCredits())` 回收主积分；`settlePaidOrder` 入账时另发的 `bonusCredits`（GIFT 桶，`:426-435`）与 `grantStorageMb`（`:438-446`）在退款路径**无回收**；`refundCashReclaim` clamp rechargeBalance，物理够不到 gift 桶。
- 攻击场景：买「充 1000 送 200」→ 立即退款 → 现金原路退 + 1000 主积分收回，但 200 赠送积分 + 存储保留。批量小号可薅。
- 修复：退款同事务按 `min(bonusCredits, giftBalance)` 回收赠送分（负分录互链订单）、按订单号幂等撤销存储授予；回收不足时订单标注差额供财务定退款金额。→ Task T4

### F-06 · 动钱操作系统性缺 AuditLog（核准/驳回/退款/查单/调差复核/套餐改价/支付配置变更）
**P1** ·（财务审计命中；违反 D5）
- 证据：全仓 `AuditService` 调用点仅 auth 类 + `AdminUserController`(suspend/reactivate) + 明星授权。`AdminRechargeOrderController` / `RechargeService`(approve `:366`/reject `:471`/refund `:503`) / `CreditOpsService`(approve/reject) / `RechargePackageAdminService` / `AdminPaymentConfigController` 均只 slf4j `log.info`（不可查询、随日志轮转丢失）。`AuditLog.java` 且**无 before/after 结构化字段**（仅 `detail` 文本）。套餐改价、支付渠道机密变更完全无痕。
- 修复：为上述动作统一补 `auditService.recordAdminAction(...)`，detail 带结构化 before/after JSON；`AuditLog` 加 `beforeJson/afterJson` 列。→ Task T5

### F-07 · 裸调差端点 `AdminUserController.adjustCredits` 绕过全套 maker-checker 风控
**P1** ·（财务审计命中）
- 证据：`AdminUserController.java:122-127` `POST /{id}/credits/adjust` **无方法级 `@PreAuthorize`** → 落 `/api/admin/**` 通配（OPERATOR 也过）。`CreditService.adjustUserCredits:78-127` 无阈值/日限额/maker-checker/工单号/审计，且**负数扣减按 gift→license→recharge 扣到 recharge 现金桶**，违反 `refundCashReclaim` javadoc 声明的「REFUND_CASH 是唯一可减 recharge 桶的通道」不变量。`CreditOpsService` 的整套风控被此旁门绕空。admin 前端已不调用它（仅 openapi 残留），属遗留活端点。
- 修复：删除该端点（openapi 同步删），或至少 `@PreAuthorize("hasRole('SUPER_ADMIN')")` 并转发 `CreditOpsService`（吃阈值/限额/审计），禁止负数触碰 recharge 桶。→ Task T6

### F-08 · 业务扣费/入账账本无 DB 级幂等唯一约束，并发复核可双发
**P1** ·（账本审计命中；违反 D8）
- 证据：`LedgerEntry` 实体无 `(referenceType, referenceId)` 唯一约束。`debit()`/`creditAccount()` 无幂等校验；`CreditOpsService.doCompensate:226`/`doGrant:241` 用 `existsByReferenceTypeAndReferenceId` 做幂等 = **读后写、无唯一索引兜底**，两个并发 approve 同一 `incidentRef` 都能过 `existsBy` 后各插一条 → 双重补偿/双重赠送。
- 修复：给 GIFT/RECHARGE/REFUND_CASH 等需幂等入账类型加 DB 唯一约束（或专门幂等表），把幂等升级为 DB 不变量。→ Task T7

### F-09 · 迟到支付黑洞：关单/取消/驳回后渠道侧仍可支付，钱收了不入账、不退款、不告警
**P1** ·（网关审计命中；违反 D6）
- 证据：① 下单不设渠道过期——`AlipayPaymentGateway.createPayOrder:89-115` 无 `timeout_express`、`WechatPaymentGateway:105-182` 无 `timeExpire`（支付宝/微信二维码默认 2h ≫ 本地 30min TTL）；② 本地单方面关单——`closeStalePendingOrders:281-294`/`syncOrderCore:148-150`/`cancelOrder`/`rejectOrder` 只改本地态，**不调渠道 close API**（全仓无 `tradeClose`/`closeOrder`）；③ 迟到支付被静默吞——`settlePaidOrder` claimed==0 时仅 `log.info` no-op（`:402-409`），notify controller 随后回 SUCCESS 止投；reconcile 只扫 PENDING（`:61`）+ 年龄 ≤30min（`:77`），30min 后成功支付永久盲区；④ 加重——复用单按 `createdAt` 判 TTL，第 29 分钟复用出新码 1 分钟后即被关。
- 影响：用户真金被扣、积分不到账、无自动退款、无 ERROR 告警，只能靠客诉发现。生产事故级体验缺陷。
- 修复：createPayOrder 传渠道过期时间 = 本地 TTL；关单/取消/驳回在线单先调渠道 close；`settlePaidOrder` claimed==0 且现单为 CLOSED/CANCELLED/REJECTED 而回调是「已支付」→ `log.ERROR` + `notifyAdmins`（需人工退款）；复用单 TTL 用 `updatedAt` 或临近 TTL 直接新建。→ Task T8

### F-10 · 影子渠道 confirm 不校验 SHADOW 单 + `matchIfMissing=true` + 生产不拒启
**P1**（默认配置未命中；误配一行 env 即升 P0）·（网关审计命中；违反 D7）
- 证据：`DevShadowPayController` `@ConditionalOnProperty(..., matchIfMissing=true)`（`:25`）——属性缺失即注册；`confirm:49-51` 只校验登录 + 订单归属，**不校验 `order.wayCode()=="SHADOW"`** → shadow 启用环境里，用户对自己任意 alipay/wechat PENDING 单调 `POST /api/dev/pay/shadow/confirm` 即免费入账。`ShadowPaymentGateway.warnIfProdProfile:38-49` 生产只打 ERROR 横幅、**不 fail-fast**；`application-mysql.yml` 默认 `false`（安全），但一行 `AEP_PAYMENT_SHADOW_ENABLED=true` 误配 → 生产任意登录用户无限免费充值。
- 修复：confirm 加 `if (!"SHADOW".equals(order.wayCode())) throw 409`；`matchIfMissing` 改 `false`；mysql/prod profile + shadow.enabled → 启动抛 `IllegalStateException`（或要求二次显式确认开关）。→ Task T9

### F-11 · web-music 无充值能力 + 假提现按钮 + 双语残留
**P1** ·（前端审计命中）
- 证据：`apps/web-music/src/app/(workspace)` 无 wallet 路由；`FinancePage.tsx:120` 提现 = `toast.info('提现申请已提交')` 不调 API；同文件 24 处 `zh ?` 三元违反 §4.6 中文单语。音乐用户无法在线充值，付费闭环缺失。
- 修复：复用 drama 收银台/钱包页移植到 web-music；假提现按钮在真链路前移除/禁用；清双语。→ Task T13

## P2 — 纵深防御缺口 / 能力虚标 / 正确性，一个月内修

- **F-12 · 明星视频生成 commit 依赖客户端轮询，停止轮询即免费**（业务审计）：`CelebrityZoneService:414-444` commit 只在用户 `GET /celebrity/jobs/{id}` 进度到 100 时触发；用户提交后关页面 → hold 180min 后被 sweeper 当孤儿 release 退回 → 免费。且接真后端后失败无 release 分支。修复：服务端 scheduler/回调驱动 commit（对齐 MaterialVideoWorker）。→ T10
- **F-13 · 渠道侧退款 API 缺失**（网关 + 财务审计）：`refundOrder` 只回收积分不调 `alipay.trade.refund`/wechat `refunds`，真实 RMB 靠财务线下人肉退，无退款回调/退款单/互链校验，多退漏退重退无系统防线。修复：接渠道退款 API + 退款结果落 `refundChannelNo` 互链。→ T11
- **F-14 · 部分消费订单退款：应退现金未折算未记录，话术引导全额退现**（财务审计）：`refundOrder` 无金额参数、不算 `priceCents*reclaimed/credits`，用户已消费 80% 仍易被全额退款。修复：响应/订单增 `refundCashCentsSuggested` 落库进对账。→ T11
- **F-15 · 查单入账路径（reconcile/sync）不比对金额**（网关审计）：`PayQueryResult` 带回 `amountTotal` 却无人比对 `order.priceCents`（`PaymentReconcileService:81-84`/`PaymentService:139-142`），与 notify 路径金额闸不一致。修复：`settlePaidOrder` 内收口金额比对。→ T8
- **F-16 · 短剧首帧「先生成后扣费」+ debit 类无跨请求幂等键**（业务审计）：`DramaRenderService.renderFrame:139-189` 先调付费图像模型再 `debit`，0 余额可反复烧平台算力（402 前模型已付费落 CDN）；frame/孵化/声音克隆用随机 ref 无幂等键，弱网重试多扣。修复：改 hold-first（进模型前先 hold 校验余额）；接受客户端 `Idempotency-Key`。→ T12
- **F-17 · 沙箱配置零代码防护：生产可被「沙箱钱」充值**（网关审计）：`PaymentChannelConfig.sandbox` 纯装饰，无「prod profile + 沙箱 gatewayHost」校验，财务误留沙箱 host+密钥并启用 → 用户用沙箱资金完成支付、沙箱公钥验签通过、真积分入账。修复：`AlipayPaymentGateway.ensureConfigured` 检测 `alipaydev.com` host 时 prod 强制 `sandbox=true` + ERROR 横幅 + admin 醒目标识。→ T9
- **F-18 · 「异常风控」页是前端合成展示，非真实风控**（财务审计）：`finance/(money)/risk/page.tsx:25-64` 全部检测在浏览器端对最近 200 条现算，规则误报（进行中 hold 判「异常出账」）、数据源含已隐藏的 community demo 域、「冻结/回滚」按钮无 onClick 是死按钮，无 RiskEvent 实体/落库/阈值配置。快充快退套利（即 F-05 利用路径）零覆盖。修复：落 `RiskEvent` 实体 + 服务端规则（充退间隔、日充值频次/金额、REFUND_CASH 频次）+ 按钮接真实处置写审计；或明确标注「演示」。→ T14
- **F-19 · 结算中心 CSV 导出无公式注入防护**（财务审计）：`finance/(money)/ledger/page.tsx:60-63` escape 只处理引号/逗号/换行，不处理 `=+-@` 开头单元格；导出列含用户可控 `displayName`/`description`。财务用 Excel 打开时 `=HYPERLINK/=WEBSERVICE` 会执行。修复：escape 对 `/^[=+\-@\t\r]/` 前缀补 `'`。→ T15
- **F-20 · 定时超时关单误杀线下充值订单**（财务审计）：`closeStalePendingOrders:280-294` 遍历**所有** PENDING（无 `isOnlineOrder` 过滤），线下单 30min 被标 CLOSED → 运营已收款却 `approveOrder` 409。修复：关单循环加 `if (!isOnlineOrder(o)) continue;`。→ T8
- **F-21 · 钱包/流水读端点漏财务门控，OPERATOR 可 API 直读全量资金面**（财务审计）：`AdminCreditController.java:12-48`（`GET /admin/wallets`、`/ledger-entries`）**无 `@PreAuthorize`**，仅 `/admin/**` 通配含 OPERATOR；这正是「结算中心」数据源，声称 FINANCE_ADMIN 专属对读侧不成立。修复：加类级 `@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")`。→ T6
- **F-22 · 退款/线下核准无金额阈值复核，单人可独立完成任意大额**（财务审计）：资金面 `approveOrder`/`refundOrder` 无阈值、无 maker-checker（v2 §9 大额复核仅积分面落地）。修复：priceCents > 阈值的 approve/refund 复用审批单模型 maker≠checker。→ T5
- **F-23 · 部分钱包写路径绕过悲观锁 → lost update**（账本审计）：`SettingsController:85`（见 F-01）、`LicenseActivationService:326-338` 用无锁 `findByUserId` 做 read-modify-write，`Wallet` 无 `@Version`。修复：统一走 `getOrCreateWalletForUpdate` 或给 `Wallet` 加 `@Version` 兜底。→ T6
- **F-24 · 跨渠道换道支付可双付**（网关审计）：`createOrReuseCheckoutOrder:218-224` 复用同单覆写 wayCode，`mchOrderNo` 恒等订单 id，用户先扫支付宝再扫微信两边都可完成，第二笔被静默吞。修复：换渠道先关旧渠道单或新建单隔离 out_trade_no + settle no-op 遇 channelPayNo 不符时 notifyAdmins。→ T8
- **F-25 · 小程序未接微信 JSAPI 支付**（前端审计）：`pages/recharge/index.js:51-69` 仅 v0.56 线下申请流，全 miniprogram 无 `requestPayment`，而后端 JSAPI（openid→prepay→签名）已就绪。修复：接 `checkout(channel=wechat, wayCode=WX_JSAPI, openid)` → `wx.requestPayment`。→ T13
- **F-26 · 收银台轮询用 `/sync`（每 3.5s 直查支付网关）**（前端审计）：`checkout/page.tsx` `setInterval(syncRechargeOrder, 3500)` 每 tick 打网关查单，并发下限流风险，后端已有 20s reconcile + 回调兜底。修复：轮询改 `GET /orders/{id}` 读本地态，`/sync` 留手动按钮。→ T13

## P3 — 契约/文档 drift、可测性、死代码、体验

- **F-27 · releaseHold 按比例退桶余数塞进 recharge 现金桶**（账本审计，L1 在案）：`CreditService:547-552` 整数除截断余数全给 `backRecharge`，长期累积轻微抬高可退现金上限。修复：余数退回原占比最大的非现金桶。
- **F-28 · commit/release 吞异常仅 WARN，账本与钱包可能不一致**（业务审计）：`MaterialVideoWorker/MixcutJobService/DapJobRunner` 的 commit 失败 `catch{log.warn}`，产物已交付但 sweeper 最终 release 退回 → 用户白拿。修复：commit 失败进重试/「待结算」标记（参考 celebrity `resetCommitted` CAS）。
- **F-29 · SPEND/FREEZE 的 balanceAfter 语义不可作运行余额 + totalBalance 冗余列无一致性守卫**（账本审计）：`balanceAfter` 列非连续可累加；`Wallet.totalBalance` 冗余列无 DB CHECK 保证 `== Σ桶`，未来漏更某桶即静默漂移。修复：文档化 balanceAfter 语义；ReconciliationService 加「每钱包 total == Σbucket」不变量。
- **F-30 · 可注入时钟缺失 + 若干健壮性小项**（网关审计）：`Instant.now()` 硬编码致 TTL 逻辑不可确定性测试；`String.format("%.2f")` 未指定 Locale（`AlipayPaymentGateway:84`）；`(int)amountCents` 窄化（理论溢出）；`Factory.setOptions` JVM 全局静态；reconcile 无退避/上限。修复：注入 `java.time.Clock`；`Locale.ROOT`；`Math.toIntExact`；reconcile 加单轮上限。
- **F-31 · 契约 drift 汇总**（前端审计）：① `openapi.yaml:7602` 与 `:7623` `/me/wallet/withdraw` 重复定义（duplicate mapping key）；② `LedgerEntryType` enum 缺 `refund_cash`（`openapi:1287` 10 值 vs server 11 种 vs `packages/types` 已有）；③ admin 充值订单 status 过滤 enum 缺 `closed`（`openapi:6165`）。修复：删重复 path、补两个 enum 值。
- **F-32 · 文档 drift 汇总**（前端审计）：① `BUSINESS_RULES.md:83` 扣桶顺序写反（写 license→recharge→gift，实际 gift→license→recharge），且 v0.94 渠道/回调幂等/退款 clamp/TTL/对账规则整体缺席；② `VERSION_HISTORY.md` 缺 v0.85/v0.86 章节但 CLAUDE.md 速览表指向它。修复：修正扣桶顺序、补支付章节、补版本节。
- **F-33 · 死代码/UI 体验**（前端审计）：drama `createRecharge` 按金额猜套餐（危险死代码，`finance.ts:67-88`）；钱包页影子面板死代码 + paying 态不复位；USE_MOCK=1 下收银台无 channels/checkout mock 恒显「暂无渠道」；checkout 失败文案暴露 `payDataType` 内部枚举；`api-client/account.ts:114` 注释仍是 jeepay 时代；取消订单无二次确认。修复：删死代码、补 mock handler、文案去黑话。

---

# 三、做得好的点（供报告平衡，勿在整改中破坏）

1. **单一入账漏斗 + 条件 UPDATE 幂等闸**：notify / 查单兜底 / 手工核准 / 影子四路径全走 `settlePaidOrder`，`markPaid`/`markRefunded`/`markClosed` 条件 UPDATE 抢占，重复/并发回调绝不双入账，失败整事务回滚让渠道重投。有 `doubleSettleCreditsOnlyOnce` 等测试守门。
2. **金额只信服务端**：前端仅传 packageId，价格来自套餐快照；notify 金额与订单价硬比对，不符拒入账。
3. **核心扣费路径悲观行锁到位**：`debit/withdraw/hold/commitHold/releaseHold` + `StoreService.redeem` 均 `findByUserIdForUpdate`，有真实多线程并发测试 `WalletBucketAndConcurrencyTest` 验证无 lost update。
4. **两平面模型 + DB CHECK**：`plane<>'CREDIT' OR cash_artifact_id IS NULL` 把「调差/赠送绝不碰现金凭证」升级为数据库不变量；现金桶纯度（RECHARGE 唯一入口）有测试守门。
5. **三段式扣费原语规范 + 孤儿 hold 兜底**：hold 有 `uk_credit_hold_ref` DB 唯一约束；`CreditHoldSweeper` TTL 自动 release 覆盖崩溃/漏 release。
6. **异步 job 失败退费完整**（MaterialVideoWorker/DapJobRunner/MixcutJobService/PublishJobService 终态全覆盖 release）；异步派发在事务 commit 之后。
7. **机密治理**：AES-GCM 随机 IV、prod 用 dev key 启动即 fail-fast、出 wire 全脱敏、机密缺失请求期 503 不入账不回退（守 §8.0）。
8. **在线单禁手工核准**（`ONLINE_ORDER_NO_MANUAL_APPROVE`）堵「运营手滑给未支付单发积分」。
9. **调差/赠送积分面风控扎实**（虽被 F-07 旁门绕过，本体好）：只进 gift 桶、小额也落审计单、大额 maker≠checker、24h 滚动限额、工单幂等。
10. **收银台 UX**：影子/沙箱可见标识清晰、支付中断恢复、QR 本地生成 token 不外发、CreditButton 小额免打扰 + `alwaysConfirm` 逃生口。
11. **订单快照定价**：下单即快照 credits/bonus/price，套餐改价/下架不误伤已下单（无 live-reference 误伤）。
12. **金额全整数 long**，无 float/double，无 int 溢出（除 F-30 理论项）。

---

# 四、实施波次（Task 卡 · 交由后续 agent 执行）

> 每张卡：目标 · 涉及文件 · 验收断言（E2E/单测）。波次 = 上线优先级，波内可并行。所有改动遵守 CLAUDE.md 三端编译门 + `pnpm check:api-contract` + 文档同步纪律（§9）。

## 波次 0 — 止血（本周，堵可利用资损口）

**T1 · 下线零支付白嫖充值路由**（F-01）
- 删 `SettingsController.purchaseCreditPack`（`SettingsController.java:73-128`）及前端 `api/settings.ts` 的 `purchaseCreditPack` 调用；删 `openapi.yaml` 对应 path。保留积分包**展示**则 purchase 改跳 v0.56 收银台。
- `AepSecurityConfig` 补 `.requestMatchers("/api/settings/**").authenticated()`。
- 验收：① 匿名 + 登录态 `POST /api/settings/credit-packs/{id}/purchase` 均 404/405；② 全库无 `referenceType="credit_pack"` 新增 RECHARGE 行；③ `ReconciliationService` drift 回归 0。

**T2 · 素材视频 credit_cost 服务端强制定价**（F-02）
- `MaterialOpsController` 剥离外部 `credit_cost`/`credit_label`；`MaterialVideoJobService.itemUnitCost` 忽略外部传入、服务端按 kind 定价（外部值 < 配置价则抬到配置价）。drama renderClip 保持直接调 service 注入。
- 验收：`POST /material/videos/generate {credit_cost:0}` 仍按配置价 hold；余额不足 402 不建 job；单测断言外部 0 不生效。

**T9 · 影子/沙箱渠道生产双控收紧**（F-10 + F-17）
- `DevShadowPayController.confirm` 加 `if (!"SHADOW".equals(order.wayCode())) throw 409`；`@ConditionalOnProperty matchIfMissing=false`；mysql/prod + shadow.enabled → 启动 `IllegalStateException`。
- `AlipayPaymentGateway.ensureConfigured`：prod profile 检测 gatewayHost 含 `alipaydev.com` 时强制 `sandbox=true` + ERROR 横幅；admin 渠道列表沙箱醒目标识。
- 验收：非 SHADOW 单调 confirm → 409；mysql profile 开 shadow → 启动失败；prod 沙箱 host 未标 sandbox → 拒配/横幅。

## 波次 1 — 提现子系统 + 退款回收（两周）

**T3 · 提现桶隔离 + 审批单化**（F-03 + F-04）
- 新 `WithdrawalOrder` 实体（PENDING→APPROVED→PAID/REJECTED，条件 UPDATE 幂等闸，照 `RechargeOrder`）；`CreditService.withdraw` 只扣可提现桶（recharge 或专设 income 桶），gift/license 不可提；加日限额 + 大额 maker-checker + 客户端幂等键；WITHDRAW 分录互链 `withdrawalOrderId`。admin 加提现审批页。
- 验收：① gift-only 余额提现被拒/clamp 到 0；② 并发两笔提现只成一笔；③ 提现落审批单，approve 前无 payout；④ E2E：充值→消费→提现申请→审批→账实勾稽。

**T4 · 退款全额权益回收 + 应退金额锚点**（F-05 + F-14）
- `refundOrder` 同事务：回收 `min(bonusCredits, giftBalance)`（负分录互链）、按订单号幂等撤销 `grantStorageMb`、计算并落库 `refundCashCentsSuggested = priceCents * reclaimed / credits`。
- 验收：买赠套餐退款后 gift 桶回收、存储撤销；已消费 80% 退款响应给出按比例应退现金；对账可勾稽退现金额。

**T11 · 渠道退款 API 闭环**（F-13 + F-14）
- 接 `alipay.trade.refund` / wechat `refunds`，退款结果落 `refundChannelNo` 与 `refundLedgerEntryId` 互链；加退款回调/查单。本期若仅做「记录应退金额 + 人工渠道退款」，须在决策台账显式记为接受的风险（风控 R7）。
- 验收：退款调渠道 API 成功回填渠道退款号；重复退款幂等；金额与积分回收互链。

## 波次 2 — 审计 + 门控 + 迟到支付告警（三周）

**T5 · 资金操作全量审计 + 大额复核**（F-06 + F-22）
- `AuditLog` 加 `beforeJson/afterJson` 列；approve/reject/refund/sync/adjust-approve/package-upsert/payment-config-upsert 补 `auditService.recordAdminAction`（结构化 before/after）；priceCents > 阈值的 approve/refund 走审批单 maker≠checker。
- 验收：每类动作在 admin「审计日志」页可查带前后值；大额退款需二人。

**T6 · 端点门控补齐 + 裸调差下线**（F-07 + F-21 + F-23）
- 删/收紧 `AdminUserController.adjustCredits`（SUPER_ADMIN + 转发 CreditOpsService + 禁负数碰 recharge）；`AdminCreditController` 加类级 FINANCE_ADMIN 门控；`SettingsController`/`LicenseActivationService` 钱包写改 `getOrCreateWalletForUpdate` 或 `Wallet` 加 `@Version`。
- 验收：OPERATOR 调 `/admin/wallets`、`/credits/adjust` → 403；负数调差不减 recharge 桶。

**T7 · 账本 DB 级幂等约束**（F-08）
- `aep_ledger_entries` 加 `(reference_type, reference_id)` 唯一约束（对需幂等类型）或专门幂等表；MySQL 侧走 Flyway/ddl 迁移，注意 orphan 数据先清理。
- 验收：并发 approve 同一 incidentRef 只入一条；重复 creditAccount 同 ref 被 DB 拒。

**T8 · 迟到支付闭环 + 关单/换道/金额比对**（F-09 + F-15 + F-20 + F-24）
- createPayOrder 传渠道过期 = 本地 TTL；关单/取消/驳回在线单先调渠道 close；`settlePaidOrder` 入参加 `paidAmountCents` 收口金额比对，claimed==0 且现单终态而回调已支付 → ERROR + notifyAdmins；`closeStalePendingOrders` 加 `isOnlineOrder` 过滤；换渠道关旧单新建。
- 验收：关单后渠道支付到达 → 告警 + 不静默；线下单不被 30min 误杀；查单金额不符拒入账；跨渠道双付触发告警。

## 波次 3 — 覆盖补全 + 风控落地 + drift 清理（一个月）

**T10 · 异步 commit 服务端驱动**（F-12 + F-28）：celebrity 视频 commit 改 scheduler/回调；worker commit 失败进重试/待结算标记，不由 sweeper 静默退回。
**T12 · frame hold-first + 幂等键**（F-16）：图像模型前先 hold；debit 类接受 `Idempotency-Key`。
**T13 · 收银台覆盖补全**（F-11 + F-25 + F-26）：web-music 收银台/钱包移植 + 清双语；小程序接微信 JSAPI；收银台轮询改读本地态。
**T14 · 真实风控落地**（F-18）：`RiskEvent` 实体 + 服务端规则（充退间隔、日充值频次/金额、REFUND_CASH 频次）+ 处置动作写审计；或页面标「演示」。
**T15 · CSV 注入防护**（F-19）：ledger 导出 escape 加 `=+-@` 前缀 `'`。
**T16 · 契约 + 文档 drift 清理**（F-31 + F-32 + F-33）：删重复 withdraw path、补 `refund_cash`/`closed` enum；修 BUSINESS_RULES 扣桶顺序 + 补支付章节；补 VERSION_HISTORY 版本节；删死代码（createRecharge 猜套餐、影子面板）、补 USE_MOCK mock handler、文案去黑话。
**T17 · 记账健壮性小项**（F-27 + F-29 + F-30）：releaseHold 余数退非现金桶；ReconciliationService 加「total == Σbucket」不变量；注入 `Clock`、`Locale.ROOT`、`Math.toIntExact`、reconcile 退避。

---

# 五、范围（本方案 in / out）

- **做**：上述 T1–T17（波次 0→3）。
- **不做（有意识延后）**：① 引入订阅/自动续费/proration（D1，与产品模型不符）；② 接渠道**日账单文件**逐笔对账（M3，中期，本期先做 orders↔ledger by referenceId 逐单 left join）；③ Cookie SSO / 多域（与支付无直接耦合）。

# 六、已知风险与接受的取舍

- **渠道退款若本期只做「记录应退 + 人工渠道退款」**：须在本台账显式记为接受的风险，保 `refundCashCentsSuggested` + 审计可追（风控 R7），不得默默漏。
- **T7 加 DB 唯一约束前**：必须先跑 orphan/重复清理（参考历史 recon-drift cleanup），否则迁移失败。
- **提现桶隔离（T3）改扣桶来源**：需回归所有提现相关测试，确认不影响 `refundCashReclaim` 的 clamp 不变量。

# 七、Open Questions（需产品/业务拍板，带推荐默认值）

- [ ] 提现可提桶：仅 recharge 现金桶，还是另设「可提现 income 桶」（如带货分成）？**推荐**：仅 recharge + 专设 income 桶承接真实收入类，gift/license 永不可提。
- [ ] 大额复核阈值（资金面 approve/refund）：**推荐**沿用积分面 5000 门槛，maker≠checker。
- [ ] `SettingsController` 积分包展示是否还保留：**推荐**下线整条（前端已无真实入口，充值统一走 v0.56 收银台）。
- [ ] 渠道退款是否本期接 API：**推荐**接（否则 F-13/F-14 只是半闭环，财务多退漏退无系统防线）。
