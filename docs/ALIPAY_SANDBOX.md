# 支付宝直连 · 沙箱本地联调 Runbook（v2 §6 · driver=alipay）

> 目标：本地跑通 `web-celebrity → server → 支付宝沙箱 → 入账 → 余额`。
> 切生产只换 4 项凭证 + 回调域名,业务代码零改。

## 0. 现状（已就绪，代码侧）

- `AlipayPaymentGateway`（`driver=alipay`）：`alipay-easysdk` 直连。下单按 wayCode 映射
  （`ALI_PC`/`ALI_WAP`→自动提交表单 / `ALI_QR`→二维码串）;查单;RSA2 验签。缺凭证 fail-fast。
- `AlipayNotifyController` `POST /api/pay/notify/alipay`：验签→金额/状态→`settlePaidOrder`（幂等）。
- `PaymentReconcileService`：`@Scheduled`（默认 20s）+ 手动 `POST /api/admin/finance/recharge-orders/reconcile`。
  **本地无公网收不到 notify 时,靠它主动查单也能入账。**
- 前端 `web-celebrity /wallet`：`payDataType=page` → `document.write` 跳支付宝收银台。
- 测试：钱包+支付套件 80/80。

## 1. 拿支付宝沙箱凭证（你来做，一次性）

1. 登录 [支付宝开放平台](https://open.alipay.com) → 控制台 → **沙箱环境**（开发者自动分配,无需申请、无需企业资质）。
2. 记下 **沙箱 APPID**。
3. **密钥**：用支付宝「密钥工具」生成 RSA2(SHA256) 应用公私钥 → 上传**应用公钥** → 平台返回**支付宝公钥**。
   - 拿到三样：`应用私钥(merchant-private-key)` / `支付宝公钥(alipay-public-key)` / `APPID`。
4. **沙箱买家账号**：沙箱页有现成的买家账号（账号 + 登录/支付密码,有虚拟余额,无需充值/实名）。

> 沙箱网关：`openapi-sandbox.dl.alipaydev.com`（接入时按控制台核对当前确切域名,历史上变过）。

## 2. 配置本地 server（driver 切 alipay）

在 `apps/server/.env` 或 `infra/env/server.local.env` 加（机密,禁进 git）：

```bash
AEP_PAYMENT_DRIVER=alipay
AEP_PAYMENT_ALIPAY_APP_ID=<沙箱 APPID>
AEP_PAYMENT_ALIPAY_MERCHANT_PRIVATE_KEY=<应用私钥（单行，无 BEGIN/END）>
AEP_PAYMENT_ALIPAY_PUBLIC_KEY=<支付宝公钥（单行）>
AEP_PAYMENT_ALIPAY_GATEWAY_HOST=openapi-sandbox.dl.alipaydev.com
AEP_PAYMENT_ALIPAY_DEFAULT_WAY_CODE=ALI_PC
AEP_PAYMENT_ALIPAY_SANDBOX=true
# 回调地址：有公网/隧道就填可达地址；纯靠查单兜底可先填本机占位（notify 收不到,reconcile 照样入账）
AEP_PAYMENT_ALIPAY_NOTIFY_URL=http://localhost:8080/api/pay/notify/alipay
```

> 私钥/公钥是 PEM 去掉头尾、单行 base64。easysdk 用「公钥模式」（不需要 .crt 证书文件）。

## 3. 两种联调姿势

### A. 纯查单兜底（最省事，无需公网/隧道）— 推荐先用这条

**最快：一键验证脚本**（起好后端后直接跑，自动下单+轮询+校验）：
```bash
node scripts/alipay-sandbox-verify.mjs
# → 下单 ALI_PC → 写出 alipay-pay.html（浏览器打开自动跳收银台）→ 你用沙箱买家付款
# → 自动轮询 reconcile 直到 PAID → 校验 余额/paidVia/channelPayNo/幂等 → PASS/FAIL
```

或手动走：
1. 起后端 `./infra/scripts/dev-server.sh`，起前端 `pnpm dev:celebrity`。
2. web-celebrity 登录 → `/wallet` → 选套餐 → **立即支付（在线）** → 跳到支付宝沙箱收银台。
3. 用**沙箱买家账号**付款 → 浏览器跳回。
4. 等 ≤20s（`@Scheduled` 查单）或手动 `POST /api/admin/finance/recharge-orders/reconcile`（finance 登录）
   → 订单转 PAID、余额到账。刷新钱包即见。

### B. 真实异步回调（需公网）
1. `ngrok http 8080`（或 frp/cpolar）拿到公网 HTTPS 域名。
2. `AEP_PAYMENT_ALIPAY_NOTIFY_URL=https://<ngrok域名>/api/pay/notify/alipay`，重启 server。
3. 同上付款 → 支付宝异步回调直接入账（reconcile 仍作兜底,二者幂等,只入账一次）。

## 4. 验证清单

- [ ] checkout 返回 `payDataType=page` + 非空 `payData`（HTML 表单）
- [ ] 浏览器跳到支付宝沙箱收银台,沙箱买家付款成功
- [ ] 订单 `status=paid`、`paidVia=alipay`、`channelPayNo`=支付宝 trade_no（admin「充值订单」可见）
- [ ] 钱包 `rechargeBalance` += 套餐积分、`giftBalance` += 赠送积分;重复回调/查单不二次入账
- [ ] 金额被篡改的回调被拒（验签/金额校验）

## 5. 上生产（凭证就绪后）

只动两处,业务代码零改：
- **凭证**：APPID/应用私钥/支付宝公钥换生产、`AEP_PAYMENT_ALIPAY_GATEWAY_HOST=openapi.alipay.com`、`SANDBOX=false`
  （生产 APPID 需支付宝正式审核通过）。
- **回调**：`AEP_PAYMENT_ALIPAY_NOTIFY_URL` 换正式公网域名。

> 多渠道：将来接微信时加 `wechat` driver（wechatpay-java），与 `alipay`/`shadow`/`jeepay` 并列,抽象层零破坏。
