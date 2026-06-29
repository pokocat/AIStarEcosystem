"use client";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────────────────────
// 收银台中间页（v2 §6）—— 与 celebrity 同款：选渠道 → 确认支付 → 拉起支付宝（新标签）
// + 实时状态轮询 + 我已支付/重试。后端幂等下单保证重试不重复扣款。
// ────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AccountApi } from "@ai-star-eco/api-client";
import { formatCredits, formatCurrency } from "@ai-star-eco/api-client/format";
import type { RechargeOrder, RechargePackage } from "@ai-star-eco/types/wallet";
import { Button, Card } from "@/components/premium";
import { StatusBadge, ViewHeader } from "@/components/common";

const CHANNELS = [{ id: "alipay", wayCode: "ALI_PC", label: "支付宝", desc: "跳转支付宝收银台付款" }];
type Phase = "select" | "polling" | "done";

export default function CashierPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>加载中…</div>}>
      <CashierInner />
    </React.Suspense>
  );
}

function CashierInner() {
  const router = useRouter();
  const params = useSearchParams();
  const pkgId = params.get("pkg");
  const orderIdParam = params.get("order");

  const [pkg, setPkg] = React.useState<RechargePackage | null>(null);
  const [order, setOrder] = React.useState<RechargeOrder | null>(null);
  const [channel, setChannel] = React.useState("alipay");
  const [orderId, setOrderId] = React.useState<string | null>(orderIdParam);
  const [phase, setPhase] = React.useState<Phase>(orderIdParam ? "polling" : "select");
  const [shadow, setShadow] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pkgId) return;
    AccountApi.listRechargePackages("drama").then((pkgs) => setPkg(pkgs.find((p) => p.id === pkgId) ?? null)).catch(() => {});
  }, [pkgId]);
  React.useEffect(() => {
    if (!orderId) return;
    AccountApi.getRechargeOrder(orderId).then(setOrder).catch(() => {});
  }, [orderId]);
  React.useEffect(() => {
    if (phase !== "polling" || !orderId) return;
    let alive = true;
    const settle = (o: RechargeOrder) => {
      setOrder(o);
      if (o.status === "paid" || o.status === "closed" || o.status === "cancelled" || o.status === "rejected") setPhase("done");
    };
    const tick = () => AccountApi.syncRechargeOrder(orderId).then((o) => alive && settle(o)).catch(() => {});
    const iv = setInterval(tick, 3500);
    tick();
    return () => { alive = false; clearInterval(iv); };
  }, [phase, orderId]);

  const summary = pkg
    ? { tag: pkg.tag, credits: pkg.credits, bonus: pkg.bonusCredits ?? 0, price: pkg.priceCents }
    : order
      ? { tag: order.packageTag ?? "充值套餐", credits: order.credits, bonus: order.bonusCredits ?? 0, price: order.priceCents }
      : null;

  async function confirmPay() {
    if (!pkg || busy) return;
    setBusy(true); setErr(null);
    try {
      const ch = CHANNELS.find((c) => c.id === channel)!;
      const res = await AccountApi.rechargeCheckout({ packageId: pkg.id, wayCode: ch.wayCode, sourceApp: "drama" });
      setOrderId(res.orderId);
      router.replace(`/wallet/checkout?order=${res.orderId}`);
      if (res.payDataType === "page") {
        const w = window.open("", "_blank");
        if (w) { w.document.open(); w.document.write(res.payData); w.document.close(); }
        else setErr("浏览器拦截了支付窗口，请允许弹窗后点「重新打开支付」");
        setPhase("polling");
      } else if (res.payDataType === "shadow") {
        setShadow(res.orderId); setPhase("polling");
      } else if (res.payDataType === "qr") {
        setErr("扫码支付待接入，请用网站支付");
      } else setErr(`暂不支持的支付通道（${res.payDataType}）`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "下单失败，请稍后再试");
    } finally { setBusy(false); }
  }

  async function manualSync() {
    if (!orderId || busy) return;
    setBusy(true);
    try {
      const o = await AccountApi.syncRechargeOrder(orderId);
      setOrder(o);
      if (o.status === "paid" || o.status === "closed" || o.status === "cancelled" || o.status === "rejected") setPhase("done");
    } catch (e) { setErr(e instanceof Error ? e.message : "刷新失败"); }
    finally { setBusy(false); }
  }

  async function confirmShadow(result: "success" | "fail") {
    if (!shadow) return;
    setBusy(true);
    try { await AccountApi.confirmShadowPay(shadow, result); setShadow(null); await manualSync(); }
    catch (e) { setErr(e instanceof Error ? e.message : "确认失败"); }
    finally { setBusy(false); }
  }

  function retry() {
    setPhase("select"); setOrder(null); setOrderId(null); setShadow(null); setErr(null);
    if (pkgId) router.replace(`/wallet/checkout?pkg=${pkgId}`);
  }

  const status = order?.status;
  const paid = status === "paid";
  const failed = status === "closed" || status === "cancelled" || status === "rejected";

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <ViewHeader eyebrow="收银台" title="确认支付" meta={orderId ? `订单 ${orderId}` : undefined}
        action={<Button variant="ghost" size="sm" onClick={() => router.push("/wallet")}>← 返回钱包</Button>} />

      {!summary ? (
        <Card style={{ padding: 22 }}>未选择套餐。<a onClick={() => router.push("/wallet")} style={{ color: "var(--accent)", cursor: "pointer" }}>回钱包选套餐</a></Card>
      ) : (
        <>
          <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{summary.tag}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: "var(--ink)" }}>{formatCredits(summary.credits)}</span>
              <span style={{ fontSize: 14, color: "var(--ink-2)" }}>积分</span>
              {summary.bonus > 0 && <span style={{ fontSize: 13, color: "var(--accent)" }}>+ 赠 {formatCredits(summary.bonus)}</span>}
            </div>
            <div style={{ marginTop: 8, fontSize: 15 }}>应付 <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>{formatCurrency(summary.price)}</span></div>
          </Card>

          {phase === "select" && (
            <Card style={{ padding: "20px 22px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 12 }}>选择支付方式</div>
              {CHANNELS.map((c) => {
                const on = channel === c.id;
                return (
                  <button key={c.id} onClick={() => setChannel(c.id)} style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px",
                    borderRadius: "var(--radius)", cursor: "pointer", textAlign: "left",
                    border: on ? "1.5px solid var(--accent)" : "1px solid var(--line)", background: on ? "var(--accent-soft)" : "var(--surface)" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{c.label}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{c.desc}</div>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: on ? "5px solid var(--accent)" : "2px solid var(--line)" }} />
                  </button>
                );
              })}
              {err && <div style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{err}</div>}
              <Button variant="primary" size="lg" loading={busy} onClick={confirmPay} style={{ width: "100%", marginTop: 16 }}>
                确认支付 {formatCurrency(summary.price)}
              </Button>
            </Card>
          )}

          {phase !== "select" && (
            <Card style={{ padding: 22, textAlign: "center" }}>
              <StatusBadge tone={paid ? "success" : failed ? "danger" : "accent"}>
                {paid ? "✓ 支付成功" : failed ? (status === "closed" ? "支付超时关闭" : "支付未完成") : "● 支付中"}
              </StatusBadge>
              <div style={{ marginTop: 12, fontSize: 14, color: "var(--ink-2)" }}>
                {paid ? `已到账 ${formatCredits(summary.credits + summary.bonus)} 积分`
                  : failed ? "本单已结束，可重新发起支付"
                    : "请在新打开的支付宝页面完成付款，完成后点「我已支付」"}
              </div>
              {err && <div style={{ marginTop: 10, fontSize: 13, color: "var(--danger)" }}>{err}</div>}
              {shadow && !paid && !failed && (
                <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  <Button variant="primary" onClick={() => confirmShadow("success")} disabled={busy}>✅ 模拟支付成功</Button>
                  <Button variant="secondary" onClick={() => confirmShadow("fail")} disabled={busy}>❌ 模拟失败</Button>
                </div>
              )}
              <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {paid && <Button variant="primary" onClick={() => router.push("/wallet")}>返回钱包</Button>}
                {failed && <Button variant="primary" onClick={retry}>重新支付</Button>}
                {!paid && !failed && !shadow && (
                  <>
                    <Button variant="primary" loading={busy} onClick={manualSync}>我已支付 · 刷新状态</Button>
                    <Button variant="secondary" onClick={confirmPay} disabled={busy}>重新打开支付</Button>
                  </>
                )}
                {!paid && <Button variant="ghost" onClick={() => router.push("/wallet")}>稍后再说</Button>}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
