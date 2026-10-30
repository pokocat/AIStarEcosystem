"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, QRCode, Radio, Space, Spin } from "antd";
import type { PaymentChannel } from "@ai-star-eco/api-client";
import type { RechargeOrder } from "@ai-star-eco/types/wallet";
import { WalletApi, type WalletPackage } from "@/proto/api";

/** Merchant payment belongs to the Studio order; client launch success never grants credits. */
export function StudioRechargeDialog({ pack, initialOrderId, onClose, onPaid }: {
  pack?: WalletPackage; initialOrderId?: string; onClose: () => void; onPaid: () => void;
}) {
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [channel, setChannel] = useState("");
  const [order, setOrder] = useState<RechargeOrder>();
  const [orderId, setOrderId] = useState(initialOrderId);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false), delivered = useRef(false), alive = useRef(true);
  const pending = !!orderId && (!order || order.status === "pending");
  useEffect(() => {
    alive.current = true;
    WalletApi.channels().then(list => {
      if (!alive.current) return;
      const available = list.filter(c => c.code === "wechat" || c.code === "alipay");
      setChannels(available);
      setChannel(available.find(c => c.code === "wechat")?.code || available[0]?.code || "");
    }).catch(e => { if (alive.current) setError(e.message || "支付方式加载失败"); })
      .finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; };
  }, []);
  function accept(next: RechargeOrder) {
    setOrder(next);
    if (next.status !== "pending") setError("");
    if (next.status === "paid" && !delivered.current) { delivered.current = true; onPaid(); }
  }
  useEffect(() => {
    if (!pending || !orderId) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const next = await WalletApi.order(orderId); if (!stopped) accept(next); }
      catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "订单状态暂时无法读取，请稍后刷新"); }
      if (!stopped) timer = setTimeout(poll, 3000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [orderId, pending]);
  async function sync() {
    if (!orderId || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { const next = await WalletApi.syncOrder(orderId); if (alive.current) accept(next); }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "支付结果暂未确认，请稍后刷新"); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  async function pay() {
    const packageId = order?.packageId || pack?.id;
    if (!packageId || !channel || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const selected = order?.wayCode?.startsWith("WX_") ? "wechat" : order?.wayCode?.startsWith("ALI_") ? "alipay" : channel;
      const way = order?.wayCode || (selected === "wechat" ? "WX_NATIVE" : channels.find(c => c.code === selected)?.defaultWayCode);
      const result = await WalletApi.checkout(packageId, selected, way);
      if (!alive.current) return;
      setChannel(selected);
      setOrderId(result.orderId);
      const url = new URL(window.location.href); url.searchParams.set("rechargeOrder", result.orderId);
      window.history.replaceState(window.history.state, "", url);
      if (result.payDataType === "qr" && result.payData) setQr(result.payData);
      else if (result.payDataType === "page") { document.open(); document.write(result.payData); document.close(); }
      else setError("该支付方式暂不支持，请联系客服并提供订单号");
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "下单结果暂未确认，请稍后重试"); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  function close() {
    // Keep pending order in the URL for refresh/re-entry; dismissing the dialog does not cancel payment.
    if (order && order.status !== "pending") {
      const url = new URL(window.location.href); url.searchParams.delete("rechargeOrder");
      window.history.replaceState(window.history.state, "", url);
    }
    onClose();
  }
  const amount = order?.priceCents ?? (!orderId ? pack?.priceCents : undefined);
  const credits = order?.credits ?? pack?.credits ?? 0;
  const bonus = order?.bonusCredits ?? pack?.bonusCredits ?? 0;
  const activeChannel = order?.wayCode?.startsWith("WX_") ? "wechat" : order?.wayCode?.startsWith("ALI_") ? "alipay" : channel;
  return <Modal open title="积分充值" onCancel={close} footer={<Button onClick={close}>{order?.status === "paid" ? "完成" : "关闭"}</Button>} destroyOnHidden>
    {amount !== undefined && <p>支付金额 <strong>¥{(amount / 100).toFixed(2)}</strong> · {credits.toLocaleString("zh-CN")} 积分{bonus > 0 && ` + 赠送 ${bonus.toLocaleString("zh-CN")} 积分`}</p>}
    {loading ? <Spin /> : !orderId && <>
      {channels.length ? <Radio.Group value={channel} onChange={e => setChannel(e.target.value)} aria-label="支付方式"><Space>{channels.map(c => <Radio key={c.code} value={c.code}>{c.label}</Radio>)}</Space></Radio.Group>
        : <Alert type="info" title="暂无可用支付方式，请稍后再试或联系客服" />}
      <p><Button type="primary" loading={busy} disabled={!channel || !pack} onClick={() => void pay()}>确认支付</Button></p>
    </>}
    {pending && <>
      {qr && <div style={{ display: "grid", justifyItems: "center", gap: 12, margin: "20px 0" }}><QRCode value={qr} size={208} /><span>请使用{activeChannel === "wechat" ? "微信" : "支付宝"}扫一扫完成付款</span></div>}
      <p>等待支付结果，积分将在确认收款后到账。</p>
      <Space wrap><Button loading={busy} onClick={() => void sync()}>我已支付，刷新结果</Button>{!qr && order && <Button disabled={busy || loading} onClick={() => void pay()}>重新打开支付</Button>}</Space>
    </>}
    {order?.status === "paid" && <Alert type="success" showIcon title="充值成功，积分已到账" />}
    {order && !["paid", "pending"].includes(order.status) && <Alert type="info" title={order.status === "refunded" ? "该订单已退款" : "该订单已结束，请关闭后重新充值"} />}
    {orderId && <p style={{ color: "var(--ink-3)", overflowWrap: "anywhere", fontSize: 12 }}>订单号：{orderId}</p>}
    {error && <Alert type="error" showIcon title={error} />}
  </Modal>;
}
