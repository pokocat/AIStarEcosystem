"use client";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────────────────────
// 收银台中间页（v2 §6；v0.94 多渠道）—— 与 celebrity 同款：动态选渠道（支付宝/微信，后台运行时启停）
// → 确认支付 → 拉起渠道收银台（网页表单 / 扫码二维码 / H5 跳转 / 影子）+ 实时轮询。
// 微信小程序内支付（JSAPI）由小程序消费方承载，本网页端不展示。
//
// v0.197：
//   - 弹窗被浏览器拦住时，页面上真的有「重新打开支付页」按钮（之前文案提到了、按钮没有）；
//   - 到账后 invalidate 钱包 / 订单 / 明细缓存并 notifyWalletChanged()，回钱包看到的是新余额；
//   - 从 ?order= 进来点「重新支付」用订单里的套餐（之前 pkg 为空，落到「还没选套餐」）；
//   - 支付方式读失败给「重试」，不再和「没有可用渠道」混成一句话。
//   - 评审后：?order= 读不到订单（不存在 / 不是本人 / 接口一直失败）时给错误态 + 重试 + 回钱包，
//     404 / 403 停止轮询；轮询连续失败 POLL_MAX_FAILS 次也停下，改成手动「我已付款，查看结果」。
//     之前这三种情况都停在「加载中…」，还每 3.5 秒请求一次。
//   - 从钱包「继续支付」回来的影子订单（wayCode=SHADOW）恢复「模拟支付」按钮；
//     下单失败的报错走 aiErrorMessage，渠道没配好单独说「换一种」。
// ────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { AccountApi } from "@ai-star-eco/api-client";
import type { PaymentChannel } from "@ai-star-eco/api-client";
import { formatCredits, formatCurrency } from "@ai-star-eco/api-client/format";
import type { RechargeOrder, RechargePackage } from "@ai-star-eco/types/wallet";
import { Button, Card } from "@/components/premium";
import { StatusBadge, ViewHeader } from "@/components/common";
import { invalidate } from "@/lib/drama-query";
import { notifyWalletChanged } from "@/lib/use-wallet";
import { aiErrorMessage } from "@/lib/ai-error";
import { checkoutErrorMessage, isOrderGone } from "./checkout-errors";
import { LEDGER_CACHE_KEY } from "../../_shared/LedgerList";

type Phase = "select" | "polling" | "done";
const WEB_HIDDEN_SCENES = new Set(["jsapi"]);
const POPUP_BLOCKED = "浏览器拦住了支付页面。请允许本站弹出窗口，再点下面的「重新打开支付页」。";
/** 轮询连续失败这么多次就停下（约 17 秒），别在接口挂掉时一直打。 */
const POLL_MAX_FAILS = 5;
const TERMINAL_STATUSES = new Set<RechargeOrder["status"]>(["paid", "closed", "cancelled", "rejected", "refunded"]);

/** 上一次拉起的支付页（网页表单 / 跳转地址）：弹窗被拦时用它重新打开。 */
type PayLaunch = { kind: "page" | "redirect"; data: string };

function openPay(launch: PayLaunch): boolean {
  if (launch.kind === "page") {
    const w = window.open("", "_blank");
    if (!w) return false;
    w.document.open();
    w.document.write(launch.data);
    w.document.close();
    return true;
  }
  return !!window.open(launch.data, "_blank");
}

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
  const [pkgLoading, setPkgLoading] = React.useState(!!pkgId);
  const [order, setOrder] = React.useState<RechargeOrder | null>(null);
  const [channels, setChannels] = React.useState<PaymentChannel[]>([]);
  const [channelsState, setChannelsState] = React.useState<"loading" | "ok" | "error">("loading");
  const [channel, setChannel] = React.useState<string | null>(null);
  const [wayCode, setWayCode] = React.useState<string | null>(null);
  const [orderId, setOrderId] = React.useState<string | null>(orderIdParam);
  const [phase, setPhase] = React.useState<Phase>(orderIdParam ? "polling" : "select");
  const [shadow, setShadow] = React.useState<string | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const [launch, setLaunch] = React.useState<PayLaunch | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  // ?order= 进来时订单读到了没有：gone = 不存在或不是本人（404 / 403），不再轮询。
  const [orderLoad, setOrderLoad] = React.useState<"idle" | "loading" | "ok" | "error" | "gone">(
    orderIdParam ? "loading" : "idle",
  );
  const [pollStalled, setPollStalled] = React.useState(false);
  const [pollKey, setPollKey] = React.useState(0);

  React.useEffect(() => {
    if (!pkgId) {
      setPkgLoading(false);
      return;
    }
    setPkgLoading(true);
    AccountApi.listRechargePackages("drama")
      .then((pkgs) => setPkg(pkgs.find((p) => p.id === pkgId) ?? null))
      .catch(() => {})
      .finally(() => setPkgLoading(false));
  }, [pkgId]);

  const loadChannels = React.useCallback(() => {
    setChannelsState("loading");
    AccountApi.getRechargeChannels()
      .then((list) => {
        setChannels(list);
        if (list.length > 0) setChannel((c) => c ?? list[0].code);
        setChannelsState("ok");
      })
      .catch(() => setChannelsState("error"));
  }, []);
  React.useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // 读单结果回来时订单可能已经换了（「换一种支付方式」下了新单）：旧单的结果丢掉。
  const orderIdRef = React.useRef(orderId);
  orderIdRef.current = orderId;
  const loadOrder = React.useCallback((id: string) => {
    setOrderLoad("loading");
    AccountApi.getRechargeOrder(id)
      .then((o) => {
        if (orderIdRef.current !== id) return;
        setOrder(o);
        setOrderLoad("ok");
        // 从钱包「继续支付」回来的影子订单：把「模拟支付」按钮还给用户（本地测试渠道）。
        if (o.status === "pending" && o.wayCode === "SHADOW") setShadow(o.id);
        if (TERMINAL_STATUSES.has(o.status)) setPhase("done");
      })
      .catch((e) => {
        if (orderIdRef.current === id) setOrderLoad(isOrderGone(e) ? "gone" : "error");
      });
  }, []);
  React.useEffect(() => {
    if (orderId) loadOrder(orderId);
  }, [orderId, loadOrder]);

  /** 订单读失败后的「重试」：重读一次，并重新开始轮询。 */
  function retryOrder() {
    if (!orderId) return;
    setPollStalled(false);
    setPollKey((k) => k + 1);
    loadOrder(orderId);
  }

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

  const orderGone = orderLoad === "gone";
  React.useEffect(() => {
    if (phase !== "polling" || !orderId || orderGone) return;
    let alive = true;
    let fails = 0;
    setPollStalled(false);
    const tick = () =>
      AccountApi.syncRechargeOrder(orderId)
        .then((o) => {
          if (!alive) return;
          fails = 0;
          setOrder(o);
          setOrderLoad("ok");
          if (TERMINAL_STATUSES.has(o.status)) setPhase("done");
        })
        .catch((e) => {
          if (!alive) return;
          if (isOrderGone(e)) {
            clearInterval(iv);
            setOrderLoad("gone");
            return;
          }
          fails += 1;
          if (fails >= POLL_MAX_FAILS) {
            clearInterval(iv);
            setPollStalled(true);
          }
        });
    const iv = setInterval(tick, 3500);
    tick();
    return () => { alive = false; clearInterval(iv); };
  }, [phase, orderId, orderGone, pollKey]);

  const status = order?.status;
  const paid = status === "paid";
  const refunded = status === "refunded";
  const failed = status === "closed" || status === "cancelled" || status === "rejected";
  /** 订单已经有结果了（到账 / 退款 / 关闭），不再等付款。 */
  const ended = paid || refunded || failed;

  // 到账：钱包 / 订单 / 明细缓存全部作废，顶栏余额和钱包页马上重读。每笔订单只通知一次。
  const notifiedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!paid || !order || notifiedFor.current === order.id) return;
    notifiedFor.current = order.id;
    invalidate("/me/wallet");
    invalidate("/me/wallet/recharge/orders");
    invalidate(LEDGER_CACHE_KEY);
    notifyWalletChanged();
  }, [paid, order]);

  const summary = pkg
    ? { tag: pkg.tag, credits: pkg.credits, bonus: pkg.bonusCredits ?? 0, price: pkg.priceCents }
    : order
      ? { tag: order.packageTag ?? "充值套餐", credits: order.credits, bonus: order.bonusCredits ?? 0, price: order.priceCents }
      : null;

  async function confirmPay() {
    if (!pkg || busy || !channel || !wayCode) return;
    setBusy(true); setErr(null); setQr(null); setLaunch(null); setOrder(null);
    try {
      const res = await AccountApi.rechargeCheckout({ packageId: pkg.id, channel, wayCode, sourceApp: "drama" });
      setOrderId(res.orderId);
      router.replace(`/wallet/checkout?order=${res.orderId}`);
      if (res.payDataType === "page" || res.payDataType === "redirect") {
        const l: PayLaunch = { kind: res.payDataType, data: res.payData };
        setLaunch(l);
        if (!openPay(l)) setErr(POPUP_BLOCKED);
        setPhase("polling");
      } else if (res.payDataType === "qr") {
        setQr(res.payData); setPhase("polling");
      } else if (res.payDataType === "shadow") {
        setShadow(res.orderId); setPhase("polling");
      } else {
        setErr("这种支付方式暂时用不了，请换一种。");
        setPhase("polling");
      }
    } catch (e) {
      setErr(checkoutErrorMessage(e));
    } finally { setBusy(false); }
  }

  function reopenPay() {
    if (!launch) return;
    setErr(openPay(launch) ? null : POPUP_BLOCKED);
  }

  async function manualSync() {
    if (!orderId || busy) return;
    setBusy(true);
    try {
      const o = await AccountApi.syncRechargeOrder(orderId);
      setOrder(o);
      setOrderLoad("ok");
      if (TERMINAL_STATUSES.has(o.status)) setPhase("done");
      else {
        setErr(null);
        // 自动轮询之前停下了：手动查通了就接着自动查
        if (pollStalled) { setPollStalled(false); setPollKey((k) => k + 1); }
      }
    } catch (e) {
      if (isOrderGone(e)) setOrderLoad("gone");
      else setErr(aiErrorMessage(e, "没查到支付结果，请稍后再点一次"));
    }
    finally { setBusy(false); }
  }

  async function confirmShadow(result: "success" | "fail") {
    if (!shadow) return;
    setBusy(true);
    try {
      await AccountApi.confirmShadowPay(shadow, result);
      setShadow(null);
      const o = orderId ? await AccountApi.syncRechargeOrder(orderId) : null;
      if (o) {
        setOrder(o);
        if (o.status !== "pending") setPhase("done");
      }
    }
    catch (e) { setErr(aiErrorMessage(e, "确认失败，请重试")); }
    finally { setBusy(false); }
  }

  /** 重新下一单：用当前套餐；从 ?order= 进来时用订单里的套餐。 */
  function retry() {
    const pid = pkg?.id ?? order?.packageId ?? pkgId;
    setPhase("select"); setOrderId(null); setShadow(null); setQr(null); setLaunch(null); setErr(null);
    setOrderLoad("idle"); setPollStalled(false);
    if (pid) router.replace(`/wallet/checkout?pkg=${encodeURIComponent(pid)}`);
  }

  const channelLabel = (code: string) => channels.find((c) => c.code === code)?.label ?? "手机";

  return (
    <div style={{ maxWidth: 560, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <ViewHeader eyebrow="收银台" title="确认支付" meta={orderId ? `订单号 ${orderId}` : undefined}
        action={<Button variant="ghost" size="sm" onClick={() => router.push("/wallet")}>← 返回钱包</Button>} />

      {!summary ? (
        orderId && !order && orderLoad === "gone" ? (
          <Card data-checkout-state="gone" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 14, color: "var(--ink)" }}>找不到这笔订单</span>
            <span style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6 }}>
              可能是订单号不对，或者它不是当前登录的这个账号下的。回钱包看看充值订单，或者重新选一个套餐。
            </span>
            <div><Button variant="primary" size="md" onClick={() => router.push("/wallet")}>返回钱包</Button></div>
          </Card>
        ) : orderId && !order && (orderLoad === "error" || pollStalled) ? (
          <Card data-checkout-state="error" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 14, color: "var(--ink)" }}>订单信息没加载出来</span>
            <span style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6 }}>
              可能是网络不稳。已经付过款的话不用担心，到账后钱包里会看到。
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="primary" size="md" onClick={retryOrder} data-checkout-retry>重试</Button>
              <Button variant="secondary" size="md" onClick={() => router.push("/wallet")}>返回钱包</Button>
            </div>
          </Card>
        ) : pkgLoading || (!!orderId && !order) ? (
          <Card data-checkout-state="loading" style={{ padding: 22, color: "var(--ink-3)", fontSize: 13 }}>加载中…</Card>
        ) : (
          <Card style={{ padding: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: "var(--ink-2)" }}>还没选套餐。</span>
            <Button variant="primary" size="md" onClick={() => router.push("/wallet")}>去选套餐</Button>
          </Card>
        )
      ) : (
        <>
          <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{summary.tag}</div>
            <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              <span className="num" style={{ fontSize: 30, fontWeight: 800, color: "var(--ink)" }}>{formatCredits(summary.credits)}</span>
              <span style={{ fontSize: 14, color: "var(--ink-2)" }}>积分</span>
              {summary.bonus > 0 && <span style={{ fontSize: 13, color: "var(--accent)" }}>+ 赠 {formatCredits(summary.bonus)}</span>}
            </div>
            <div style={{ marginTop: 8, fontSize: 15 }}>应付 <span className="num" style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>{formatCurrency(summary.price)}</span></div>
          </Card>

          {phase === "select" && (
            <Card style={{ padding: "20px 22px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 12 }}>选择支付方式</div>
              {channelsState === "loading" ? (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>正在读取支付方式…</div>
              ) : channelsState === "error" ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13, color: "var(--ink-2)" }}>
                  <span>支付方式没加载出来。</span>
                  <Button variant="secondary" size="sm" onClick={loadChannels}>重试</Button>
                </div>
              ) : channels.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>现在没有能用的支付方式，请稍后再试或联系我们。</div>
              ) : channels.map((c) => {
                const on = channel === c.code;
                return (
                  <button key={c.code} type="button" onClick={() => setChannel(c.code)} style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px",
                    borderRadius: "var(--radius)", cursor: "pointer", textAlign: "left", marginBottom: 8,
                    border: on ? "1.5px solid var(--accent)" : "1px solid var(--line)", background: on ? "var(--accent-soft)" : "var(--surface)" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
                        {c.label}{c.sandbox && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--accent)" }}>测试通道，不扣真钱</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                        {c.wayCodes.filter((w) => !WEB_HIDDEN_SCENES.has(w.scene)).map((w) => w.label).join(" · ") || "—"}
                      </div>
                    </div>
                    <div style={{ width: 18, height: 18, flex: "none", borderRadius: "50%", border: on ? "5px solid var(--accent)" : "2px solid var(--line)" }} />
                  </button>
                );
              })}

              {webWays.length > 1 && (
                <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {webWays.map((w) => {
                    const on = wayCode === w.code;
                    return (
                      <button key={w.code} type="button" onClick={() => setWayCode(w.code)} style={{
                        padding: "6px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer",
                        border: on ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                        background: on ? "var(--accent-soft)" : "var(--surface)", color: on ? "var(--accent)" : "var(--ink-2)" }}>
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {err && <div style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{err}</div>}
              <Button variant="primary" size="lg" loading={busy} onClick={confirmPay} disabled={busy || !pkg || channels.length === 0 || !wayCode} style={{ width: "100%", marginTop: 16 }}>
                确认支付 {formatCurrency(summary.price)}
              </Button>
            </Card>
          )}

          {phase !== "select" && (
            <Card
              data-checkout-state={paid ? "paid" : refunded ? "refunded" : failed ? "failed" : "waiting"}
              style={{ padding: 22, textAlign: "center" }}
            >
              <StatusBadge tone={paid ? "success" : failed ? "danger" : refunded ? "info" : "accent"}>
                {paid ? "支付成功" : refunded ? "已退款" : failed ? (status === "closed" ? "已超时，订单关闭" : "没有付款成功") : "等待付款"}
              </StatusBadge>

              {qr && !ended && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <QrImage value={qr} />
                  <div style={{ fontSize: 13, color: "var(--ink-2)" }}>用{channel ? channelLabel(channel) : "手机"}扫码付款</div>
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6 }}>
                {paid ? `已到账 ${formatCredits(summary.credits + summary.bonus)} 积分`
                  : refunded ? "这笔订单已经退款了"
                  : failed ? "这笔订单已关闭，可以重新下单"
                    : shadow ? "这是本地测试用的模拟支付，点下面的按钮决定这笔订单成功还是失败"
                      : qr ? "付完会自动到账；没到账就点「我已付款，查看结果」"
                        : launch ? "请在新打开的支付页面付款，付完点「我已付款，查看结果」"
                          // 从钱包「继续支付」或刷新页面回来：这一页没有打开过支付页
                          : "付过了就点「我已付款，查看结果」；还没付，点「换一种支付方式」重新打开支付页"}
              </div>
              {err && <div style={{ marginTop: 10, fontSize: 13, color: "var(--danger)" }}>{err}</div>}
              {!err && !ended && orderGone && (
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--danger)" }}>查不到这笔订单了，回钱包看看充值订单。</div>
              )}
              {!err && !ended && !orderGone && pollStalled && (
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink-3)" }}>暂时查不到支付结果，已经停止自动查询。付完可以点「我已付款，查看结果」再查一次。</div>
              )}
              {shadow && !ended && (
                <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  <Button variant="primary" onClick={() => confirmShadow("success")} disabled={busy}><CheckCircle2 size={14} /> 模拟支付成功</Button>
                  <Button variant="secondary" onClick={() => confirmShadow("fail")} disabled={busy}><XCircle size={14} /> 模拟失败</Button>
                </div>
              )}
              <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {(paid || refunded) && <Button variant="primary" onClick={() => router.push("/wallet")}>返回钱包</Button>}
                {failed && <Button variant="primary" onClick={retry}>重新支付</Button>}
                {!ended && !shadow && (
                  <>
                    <Button variant="primary" loading={busy} onClick={manualSync}>我已付款，查看结果</Button>
                    {launch && (
                      <Button variant="secondary" onClick={reopenPay} disabled={busy}>
                        <ExternalLink size={13} /> 重新打开支付页
                      </Button>
                    )}
                    <Button variant="secondary" onClick={retry} disabled={busy}>换一种支付方式</Button>
                  </>
                )}
                {!paid && !refunded && <Button variant="ghost" onClick={() => router.push("/wallet")}>稍后再说</Button>}
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
    <img src={src} alt="支付二维码" width={220} height={220} style={{ borderRadius: 8, border: "1px solid var(--line)", maxWidth: "100%", height: "auto" }} />
  ) : (
    <div style={{ width: 220, height: 220, maxWidth: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 13, border: "1px solid var(--line)", borderRadius: 8 }}>生成二维码…</div>
  );
}
