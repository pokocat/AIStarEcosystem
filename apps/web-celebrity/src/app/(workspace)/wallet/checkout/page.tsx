"use client";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────────────────────
// 收银台中间页（v2 §6；v0.94 多渠道）
//
// 钱包「立即支付」→ 跳到这里：选支付渠道（支付宝 / 微信，后台运行时启停）→ 选支付方式 →
// 确认支付 → 拉起渠道收银台（网页表单跳转 / 扫码二维码 / H5 跳转 / 影子）→ 实时轮询订单态。
// 渠道从 GET /me/wallet/recharge/channels 动态拉取（多渠道并存，用户自选）。
// 微信小程序内支付（JSAPI）由小程序消费方承载，本网页端不展示。
// ────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AccountApi } from "@ai-star-eco/api-client";
import type { PaymentChannel } from "@ai-star-eco/api-client";
import { formatCredits, formatCurrency } from "@ai-star-eco/api-client/format";
import type { RechargeOrder, RechargePackage } from "@ai-star-eco/types/wallet";
import { Card, Button, Chip } from "@/components/creator";
import { useCelebrityShell } from "@/lib/celebrity-shell-context";

type Phase = "select" | "polling" | "done";

/** 网页端不展示微信小程序内支付（JSAPI）—— 那是小程序消费方的场景。 */
const WEB_HIDDEN_SCENES = new Set(["jsapi"]);

export default function CashierPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--fg-2)" }}>加载中…</div>}>
      <CashierInner />
    </React.Suspense>
  );
}

function CashierInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshWallet } = useCelebrityShell();
  const pkgId = params.get("pkg");
  const orderIdParam = params.get("order");

  const [pkg, setPkg] = React.useState<RechargePackage | null>(null);
  const [order, setOrder] = React.useState<RechargeOrder | null>(null);
  const [channels, setChannels] = React.useState<PaymentChannel[]>([]);
  const [channel, setChannel] = React.useState<string | null>(null);
  const [wayCode, setWayCode] = React.useState<string | null>(null);
  const [orderId, setOrderId] = React.useState<string | null>(orderIdParam);
  const [phase, setPhase] = React.useState<Phase>(orderIdParam ? "polling" : "select");
  const [shadow, setShadow] = React.useState<string | null>(null); // dev 影子收银台 orderId
  const [qr, setQr] = React.useState<string | null>(null);          // 扫码值（code_url）
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // 套餐摘要（首次进入用 ?pkg 拉，续单用 order 字段）
  React.useEffect(() => {
    if (!pkgId) return;
    AccountApi.listRechargePackages("celebrity")
      .then((pkgs) => setPkg(pkgs.find((p) => p.id === pkgId) ?? null))
      .catch(() => {});
  }, [pkgId]);

  // 可用支付渠道（动态）
  React.useEffect(() => {
    AccountApi.getRechargeChannels()
      .then((list) => {
        setChannels(list);
        if (list.length > 0) {
          setChannel((c) => c ?? list[0].code);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!orderId) return;
    AccountApi.getRechargeOrder(orderId).then(setOrder).catch(() => {});
  }, [orderId]);

  // 选中渠道变化 → 默认支付方式（排除小程序 JSAPI）
  const activeChannel = channels.find((c) => c.code === channel) ?? null;
  const webWays = React.useMemo(
    () => (activeChannel ? activeChannel.wayCodes.filter((w) => !WEB_HIDDEN_SCENES.has(w.scene)) : []),
    [activeChannel],
  );
  React.useEffect(() => {
    if (!activeChannel) return;
    const def = webWays.find((w) => w.code === activeChannel.defaultWayCode) ?? webWays[0];
    setWayCode(def ? def.code : null);
  }, [activeChannel, webWays]);

  // 轮询：支付中时每 3.5s 主动查单
  React.useEffect(() => {
    if (phase !== "polling" || !orderId) return;
    let alive = true;
    const settle = (o: RechargeOrder) => {
      setOrder(o);
      if (o.status === "paid") {
        setPhase("done");
        refreshWallet();
      } else if (o.status === "closed" || o.status === "cancelled" || o.status === "rejected") {
        setPhase("done");
      }
    };
    const tick = () => AccountApi.syncRechargeOrder(orderId).then((o) => alive && settle(o)).catch(() => {});
    const iv = setInterval(tick, 3500);
    tick();
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [phase, orderId, refreshWallet]);

  const summary = pkg
    ? { tag: pkg.tag, credits: pkg.credits, bonus: pkg.bonusCredits ?? 0, price: pkg.priceCents }
    : order
      ? { tag: order.packageTag ?? "充值套餐", credits: order.credits, bonus: order.bonusCredits ?? 0, price: order.priceCents }
      : null;

  async function confirmPay() {
    if (!pkg || busy || !channel || !wayCode) return;
    setBusy(true);
    setErr(null);
    setQr(null);
    try {
      const res = await AccountApi.rechargeCheckout({ packageId: pkg.id, channel, wayCode, sourceApp: "celebrity" });
      setOrderId(res.orderId);
      router.replace(`/wallet/checkout?order=${res.orderId}`);
      if (res.payDataType === "page") {
        // 支付宝网页：在新标签页打开自动提交表单（本页保持轮询）
        const w = window.open("", "_blank");
        if (w) {
          w.document.open();
          w.document.write(res.payData);
          w.document.close();
        } else {
          setErr("浏览器拦截了支付窗口，请允许弹窗后点「重新支付」");
        }
        setPhase("polling");
      } else if (res.payDataType === "qr") {
        // 扫码支付（支付宝当面付 / 微信 Native）：渲染二维码
        setQr(res.payData);
        setPhase("polling");
      } else if (res.payDataType === "redirect") {
        // 微信 H5：跳到渠道收银台（新标签页，便于本页继续轮询）
        const w = window.open(res.payData, "_blank");
        if (!w) setErr("浏览器拦截了支付窗口，请允许弹窗后点「重新支付」");
        setPhase("polling");
      } else if (res.payDataType === "shadow") {
        setShadow(res.orderId); // dev 影子收银台
        setPhase("polling");
      } else {
        setErr(`暂不支持的支付通道（${res.payDataType}）`);
        setPhase("polling");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "下单失败，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  async function manualSync() {
    if (!orderId || busy) return;
    setBusy(true);
    try {
      const o = await AccountApi.syncRechargeOrder(orderId);
      setOrder(o);
      if (o.status === "paid") {
        setPhase("done");
        refreshWallet();
      } else if (o.status === "closed" || o.status === "cancelled" || o.status === "rejected") {
        setPhase("done");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "刷新失败");
    } finally {
      setBusy(false);
    }
  }

  async function confirmShadow(result: "success" | "fail") {
    if (!shadow) return;
    setBusy(true);
    try {
      await AccountApi.confirmShadowPay(shadow, result);
      setShadow(null);
      await manualSync();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "确认失败");
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setPhase("select");
    setOrder(null);
    setOrderId(null);
    setShadow(null);
    setQr(null);
    setErr(null);
    if (pkgId) router.replace(`/wallet/checkout?pkg=${pkgId}`);
  }

  const status = order?.status;
  const paid = status === "paid";
  const failed = status === "closed" || status === "cancelled" || status === "rejected";
  const channelLabel = (code: string) => channels.find((c) => c.code === code)?.label ?? code;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, padding: "8px 0 40px" }}>
      <button
        onClick={() => router.push("/wallet")}
        style={{ alignSelf: "flex-start", background: "transparent", border: "none", color: "var(--fg-2)", fontSize: 13, cursor: "pointer", padding: "4px 0" }}
      >
        ← 返回钱包
      </button>

      <div style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 700, color: "var(--fg-0)" }}>收银台</div>

      {!summary ? (
        <Card><div style={{ padding: 20, color: "var(--fg-2)", fontSize: 14 }}>未选择套餐。<a onClick={() => router.push("/wallet")} style={{ color: "var(--accent)", cursor: "pointer" }}>回钱包选套餐</a></div></Card>
      ) : (
        <>
          {/* 订单摘要 */}
          <Card>
            <div style={{ padding: "18px 20px" }}>
              <div style={{ fontSize: 13, color: "var(--fg-2)" }}>{summary.tag}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: "var(--fg-0)" }}>{formatCredits(summary.credits)}</span>
                <span style={{ fontSize: 14, color: "var(--fg-2)" }}>积分</span>
                {summary.bonus > 0 && <span style={{ fontSize: 13, color: "var(--accent)" }}>+ 赠 {formatCredits(summary.bonus)}</span>}
              </div>
              <div style={{ marginTop: 8, fontSize: 15 }}>
                应付 <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-strong)" }}>{formatCurrency(summary.price)}</span>
              </div>
              {orderId && <div className="mono" style={{ marginTop: 6, fontSize: 11, color: "var(--fg-3)" }}>订单 {orderId}</div>}
            </div>
          </Card>

          {/* 选择支付渠道 + 方式 + 确认（仅 select 阶段） */}
          {phase === "select" && (
            <Card>
              <div style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-1)", marginBottom: 12 }}>选择支付方式</div>
                {channels.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--fg-2)" }}>暂无可用支付渠道，请稍后再试或联系客服。</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {channels.map((c) => {
                      const on = channel === c.code;
                      return (
                        <button
                          key={c.code}
                          onClick={() => setChannel(c.code)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                            padding: "14px 16px", borderRadius: "var(--radius-md)", cursor: "pointer",
                            border: on ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                            background: on ? "color-mix(in srgb, var(--accent) 7%, transparent)" : "var(--bg-1)", textAlign: "left",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-0)" }}>
                              {c.label}{c.sandbox && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--accent)" }}>沙箱</span>}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 2 }}>
                              {c.wayCodes.filter((w) => !WEB_HIDDEN_SCENES.has(w.scene)).map((w) => w.label).join(" · ") || "—"}
                            </div>
                          </div>
                          <div style={{ width: 18, height: 18, borderRadius: "50%", border: on ? "5px solid var(--accent)" : "2px solid var(--line-2)" }} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 支付方式（同渠道多场景时可选） */}
                {webWays.length > 1 && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {webWays.map((w) => {
                      const on = wayCode === w.code;
                      return (
                        <button
                          key={w.code}
                          onClick={() => setWayCode(w.code)}
                          style={{
                            padding: "6px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer",
                            border: on ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                            background: on ? "color-mix(in srgb, var(--accent) 9%, transparent)" : "var(--bg-1)",
                            color: on ? "var(--accent-strong)" : "var(--fg-1)",
                          }}
                        >
                          {w.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {err && <div style={{ marginTop: 12, fontSize: 13, color: "#ef4444" }}>{err}</div>}
                <Button variant="accent" onClick={confirmPay} disabled={busy || channels.length === 0 || !wayCode} style={{ width: "100%", marginTop: 16 }}>
                  {busy ? "下单中…" : `确认支付 ${formatCurrency(summary.price)}`}
                </Button>
              </div>
            </Card>
          )}

          {/* 支付中 / 结果（polling / done 阶段） */}
          {phase !== "select" && (
            <Card>
              <div style={{ padding: "20px", textAlign: "center" }}>
                <Chip tone={paid ? "success" : failed ? "danger" : "warning"}>
                  {paid ? "✓ 支付成功" : failed ? (status === "closed" ? "支付超时关闭" : "支付未完成") : "● 支付中"}
                </Chip>

                {/* 扫码支付：渲染二维码 */}
                {qr && !paid && !failed && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <QrImage value={qr} />
                    <div style={{ fontSize: 13, color: "var(--fg-1)" }}>请使用{channel ? channelLabel(channel) : ""}扫码完成支付</div>
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 14, color: "var(--fg-1)" }}>
                  {paid
                    ? `已到账 ${formatCredits((summary.credits) + (summary.bonus))} 积分`
                    : failed
                      ? "本单已结束，可重新发起支付"
                      : qr
                        ? "扫码后将自动到账，可点「我已支付」立即刷新"
                        : "请在新打开的支付页面完成付款，完成后点「我已支付」"}
                </div>
                {err && <div style={{ marginTop: 10, fontSize: 13, color: "#ef4444" }}>{err}</div>}

                {/* dev 影子收银台 */}
                {shadow && !paid && !failed && (
                  <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <Button variant="accent" onClick={() => confirmShadow("success")} disabled={busy}>✅ 模拟支付成功</Button>
                    <Button variant="secondary" onClick={() => confirmShadow("fail")} disabled={busy}>❌ 模拟失败</Button>
                  </div>
                )}

                <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  {paid && <Button variant="accent" onClick={() => router.push("/wallet")}>返回钱包</Button>}
                  {failed && <Button variant="accent" onClick={retry}>重新支付</Button>}
                  {!paid && !failed && !shadow && (
                    <>
                      <Button variant="accent" onClick={manualSync} disabled={busy}>{busy ? "查询中…" : "我已支付 · 刷新状态"}</Button>
                      <Button variant="secondary" onClick={retry} disabled={busy}>换一种支付方式</Button>
                    </>
                  )}
                  {!paid && <Button variant="secondary" onClick={() => router.push("/wallet")}>稍后再说</Button>}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** 客户端二维码渲染（payment token 不外发第三方，本地生成）。 */
function QrImage({ value }: { value: string }) {
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((QR) => QR.toDataURL(value, { width: 220, margin: 1 }))
      .then((u) => { if (alive) setSrc(u); })
      .catch(() => {});
    return () => { alive = false; };
  }, [value]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="支付二维码" width={220} height={220} style={{ borderRadius: 8, border: "1px solid var(--line)" }} />
  ) : (
    <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-3)", fontSize: 13, border: "1px solid var(--line)", borderRadius: 8 }}>生成二维码…</div>
  );
}
