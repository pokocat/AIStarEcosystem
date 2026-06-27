#!/usr/bin/env node
// 支付宝沙箱真实往返 一键验证（v2 §6 · driver=alipay）。
//
// 前置（你做一次）：
//   1. open.alipay.com 开沙箱 → 拿 APPID / 应用私钥 / 支付宝公钥 + 一个沙箱买家账号
//   2. apps/server/.env 填：AEP_PAYMENT_DRIVER=alipay + AEP_PAYMENT_ALIPAY_{APP_ID,MERCHANT_PRIVATE_KEY,PUBLIC_KEY}
//   3. 起后端：./infra/scripts/dev-server.sh
//
// 然后跑本脚本：node scripts/alipay-sandbox-verify.mjs
//   它会：dev-login → 用 ALI_PC 下单 → 把支付宝收银台表单写成 alipay-pay.html →
//   提示你在浏览器打开并用沙箱买家付款 → 轮询查单兜底(reconcile)直到 PAID →
//   校验 余额到账 / paidVia=alipay / channelPayNo / 幂等,打印 PASS/FAIL。
//
// 本地无公网也行：notify 收不到没关系,脚本靠 reconcile 主动查单确认。
import fs from 'fs';
import path from 'path';

const BASE = process.env.PAY_BASE || 'http://localhost:8080';
const PKG = process.env.PAY_PKG || 'pkg-1000';
const HTML = path.resolve('alipay-pay.html');
const POLL_SECONDS = Number(process.env.PAY_POLL_SECONDS || 180);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, p, { token, body } = {}) {
  const res = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: res.status, j };
}
const die = (m) => { console.error(`\n❌ ${m}`); process.exit(1); };

(async () => {
  // 0) server up?
  const acc = await api('POST', '/api/auth/dev-login', { body: { username: 'creator_luna' } }).catch(() => null);
  if (!acc || acc.status !== 200) die(`后端没起或 dev-login 不可用（${BASE}）。先跑 ./infra/scripts/dev-server.sh`);
  const luna = acc.j.data;
  const finance = (await api('POST', '/api/admin/auth/login', { body: { username: 'finance', password: 'finance123' } })).j.data?.token;
  if (!finance) die('finance 登录失败');

  const w0 = (await api('GET', '/api/me/wallet', { token: luna.token })).j.data;

  // 1) 下单 ALI_PC
  console.log(`▶ 下单（${PKG}，ALI_PC）…`);
  const co = await api('POST', '/api/me/wallet/recharge/checkout', { token: luna.token, body: { packageId: PKG, wayCode: 'ALI_PC', sourceApp: 'celebrity' } });
  if (co.status !== 200 || !co.j.data?.orderId) die(`下单失败：${JSON.stringify(co.j)}`);
  if (co.j.data.payDataType !== 'page') die(`payDataType=${co.j.data.payDataType}，不是 page —— 后端可能不是 driver=alipay（确认 .env 与重启）`);
  const orderId = co.j.data.orderId;
  fs.writeFileSync(HTML, co.j.data.payData, 'utf8');
  console.log(`  ✅ 订单 ${orderId}，收银台表单已写入：${HTML}`);
  console.log(`\n  👉 现在：在浏览器打开 file://${HTML} （会自动跳支付宝沙箱收银台）`);
  console.log(`     用你的【沙箱买家账号】登录并付款。付完回来,本脚本会自动确认。\n`);

  // 2) 轮询：reconcile（查单兜底）直到 PAID
  console.log(`▶ 轮询查单兜底（最多 ${POLL_SECONDS}s）…`);
  let paid = null;
  for (let t = 0; t < POLL_SECONDS; t += 5) {
    await sleep(5000);
    await api('POST', '/api/admin/finance/recharge-orders/reconcile', { token: finance }).catch(() => null);
    const list = (await api('GET', '/api/admin/finance/recharge-orders?status=all', { token: finance })).j.data || [];
    const o = list.find((x) => x.id === orderId);
    process.stdout.write(`\r  …${t + 5}s status=${o?.status}        `);
    if (o?.status === 'paid') { paid = o; break; }
    if (o?.status === 'cancelled' || o?.status === 'rejected') die(`\n订单变 ${o.status},未支付`);
  }
  console.log('');
  if (!paid) die(`${POLL_SECONDS}s 内订单仍未 PAID。确认你已在浏览器付款;或检查 server 日志 [pay][alipay] / [pay][reconcile]`);

  // 3) 校验
  console.log('▶ 校验');
  const w1 = (await api('GET', '/api/me/wallet', { token: luna.token })).j.data;
  const pkgs = (await api('GET', '/api/me/wallet/packages', { token: luna.token })).j.data;
  const pk = pkgs.find((p) => p.id === PKG);
  const expect = pk.credits + (pk.bonusCredits || 0);
  let pass = 0, fail = 0;
  const ok = (c, n, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`); };
  ok(paid.paidVia === 'alipay', 'paidVia=alipay', paid.paidVia);
  ok(!!paid.channelPayNo, 'channelPayNo=支付宝 trade_no', paid.channelPayNo);
  ok(w1.totalBalance - w0.totalBalance === expect, `余额 +${expect}`, `Δ${w1.totalBalance - w0.totalBalance}`);
  ok(w1.rechargeBalance - w0.rechargeBalance === pk.credits, `现金桶 +${pk.credits}`, `Δ${w1.rechargeBalance - w0.rechargeBalance}`);
  // 幂等：再 reconcile 一次,余额不变
  await api('POST', '/api/admin/finance/recharge-orders/reconcile', { token: finance });
  const w2 = (await api('GET', '/api/me/wallet', { token: luna.token })).j.data;
  ok(w2.totalBalance === w1.totalBalance, '重复查单不二次入账', `${w1.totalBalance}→${w2.totalBalance}`);

  try { fs.unlinkSync(HTML); } catch {}
  console.log(`\n${'='.repeat(46)}\n${fail === 0 ? '🎉 真实沙箱往返 PASS' : '部分失败'}: ${pass} passed, ${fail} failed\n${'='.repeat(46)}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => die(`脚本异常：${e.message}`));
