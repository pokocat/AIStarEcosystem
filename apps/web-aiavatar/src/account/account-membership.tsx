"use client";

// 会员与积分：充值套餐（含存储空间套餐）、模型赠款、充值记录。收银台沿用 StudioRechargeDialog。

import { useEffect, useState } from "react";
import { Image as ImageIcon, Video } from "lucide-react";
import { ModelBillingApi } from "@ai-star-eco/api-client";
import type { RechargeOrder } from "@ai-star-eco/types";
import type { ScopedCreditGrant } from "@ai-star-eco/types/model-billing";
import { USE_MOCK, WalletApi, type WalletPackage } from "@/proto/api";
import { AccountApi } from "@/ip/api";
import { StudioRechargeDialog } from "@/ip/studio-recharge-dialog";
import { formatDateTime } from "@/lib/datetime";
import { IconBox, LoadState, number } from "./account-ui";

type Package = WalletPackage & { grantStorageMb?: number | null };

const yuan = (cents: number) => `¥${(cents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "待支付", tone: "is-warn" },
  paid: { label: "已到账", tone: "is-ok" },
  rejected: { label: "未通过", tone: "is-error" },
  cancelled: { label: "已取消", tone: "" },
  closed: { label: "已关闭", tone: "" },
  refunded: { label: "已退款", tone: "" },
};
const PAID_VIA: Record<string, string> = { wechat: "微信", alipay: "支付宝", manual: "线下转账", shadow: "测试支付" };

function PackButton({ p, selected, onSelect }: { p: Package; selected: boolean; onSelect: () => void }) {
  const storage = (p.grantStorageMb ?? 0) > 0;
  return <button type="button" className="account-pack" aria-pressed={selected} onClick={onSelect}>
    {p.recommended && <span className="account-pack-flag">推荐</span>}
    <b>{storage ? formatStorage(p.grantStorageMb!) : number.format(p.credits)}<small>{storage ? "存储空间" : "积分"}</small></b>
    <span className="account-pack-price">{yuan(p.priceCents)}</span>
    {!storage && (p.bonusCredits ?? 0) > 0 && <span className="account-pack-gift">赠 {number.format(p.bonusCredits!)} 积分</span>}
  </button>;
}

function formatStorage(mb: number) { return mb >= 1024 ? `${number.format(Math.round(mb / 102.4) / 10)} GB` : `${number.format(mb)} MB`; }

export function AccountMembership() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [packState, setPackState] = useState({ loading: true, error: "" });
  const [selected, setSelected] = useState<string>();
  const [cashier, setCashier] = useState(false);
  const [resumeOrder, setResumeOrder] = useState<string>();
  const [grants, setGrants] = useState<ScopedCreditGrant[]>([]);
  const [orders, setOrders] = useState<RechargeOrder[]>([]);
  const [orderState, setOrderState] = useState({ loading: true, error: "" });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("rechargeOrder");
    if (id) { setResumeOrder(id); setCashier(true); }
  }, []);
  useEffect(() => {
    let live = true;
    setPackState({ loading: true, error: "" });
    WalletApi.packages().then(list => {
      if (!live) return;
      const all = list as Package[];
      setPackages(all);
      setSelected(prev => prev && all.some(p => p.id === prev) ? prev : (all.find(p => p.recommended && !(p.grantStorageMb ?? 0)) ?? all[0])?.id);
      setPackState({ loading: false, error: "" });
    }).catch(() => { if (live) setPackState({ loading: false, error: "充值套餐加载失败，请稍后刷新重试。" }); });
    if (!USE_MOCK) ModelBillingApi.myGrants({ page: 0, size: 50 }).then(r => { if (live) setGrants(r.data.filter(g => g.available > 0)); }).catch(() => { /* 赠款区块在没有数据时不显示 */ });
    setOrderState({ loading: true, error: "" });
    AccountApi.rechargeOrders().then(list => { if (live) { setOrders(list); setOrderState({ loading: false, error: "" }); } })
      .catch(() => { if (live) setOrderState({ loading: false, error: "充值记录加载失败，请稍后刷新重试。" }); });
    return () => { live = false; };
  }, [reload]);

  const credits = packages.filter(p => !(p.grantStorageMb ?? 0));
  const storage = packages.filter(p => (p.grantStorageMb ?? 0) > 0);
  const pack = packages.find(p => p.id === selected);
  const received = pack && !(pack.grantStorageMb ?? 0) ? pack.credits + (pack.bonusCredits ?? 0) : 0;

  return <>
    {cashier && <StudioRechargeDialog pack={pack} initialOrderId={resumeOrder} onClose={() => { setCashier(false); setResumeOrder(undefined); }} onPaid={() => setReload(v => v + 1)} />}
    <section aria-labelledby="account-recharge">
      <div className="account-section-head"><h2 id="account-recharge">充值积分</h2><p>支持微信和支付宝</p></div>
      <LoadState loading={packState.loading} error={packState.error} onRetry={() => setReload(v => v + 1)}
        empty={!packState.loading && !packState.error && credits.length === 0 ? <strong>暂无可用的充值套餐</strong> : undefined}>
        <div className="account-packs">{credits.map(p => <PackButton key={p.id} p={p} selected={selected === p.id} onSelect={() => setSelected(p.id)} />)}</div>
      </LoadState>
      {storage.length > 0 && <div id="storage" className="account-section">
        <div className="account-section-head"><h2>存储空间</h2><p>购买后增加账号的存储上限</p></div>
        <div className="account-packs">{storage.map(p => <PackButton key={p.id} p={p} selected={selected === p.id} onSelect={() => setSelected(p.id)} />)}</div>
      </div>}
      {packages.length > 0 && <div className="account-pay">
        {received > 0 && <span className="account-muted" style={{ fontSize: 12.5 }}>共到账 {number.format(received)} 积分</span>}
        <button type="button" className="account-go is-large" disabled={!pack} onClick={() => setCashier(true)}>{pack ? `充值 · ${yuan(pack.priceCents)}` : "充值"}</button>
      </div>}
    </section>

    {grants.length > 0 && <section className="account-section" aria-labelledby="account-grants">
      <div className="account-section-head"><h2 id="account-grants">模型赠款</h2><p>仅限指定模型使用，生成时优先抵扣</p></div>
      <div className="account-grants">{grants.map(g => {
        const video = g.targetLabels.some(label => /视频|video|H3|Seedance/i.test(label));
        const pct = g.amount > 0 ? Math.round(g.available / g.amount * 100) : 0;
        return <article key={g.id} className="account-grant">
          <div className="account-grant-top">
            <IconBox tone={video ? "is-video" : "is-image"}>{video ? <Video /> : <ImageIcon />}</IconBox>
            <div><strong title={g.campaignName}>{g.campaignName}</strong><span className="account-muted account-ellipsis" style={{ display: "block" }} title={g.targetLabels.join("、")}>{g.targetLabels.join("、")}</span></div>
            {g.expiresAt && <span className="account-tag">{formatDateTime(g.expiresAt)} 到期</span>}
          </div>
          <div className="account-grant-amount"><span className="account-muted">剩余</span><b>{number.format(g.available)}</b><span className="account-muted">/ {number.format(g.amount)} 积分</span></div>
          <div className="account-track" role="img" aria-label={`剩余 ${pct}%`}><i style={{ width: `${pct}%` }} /></div>
        </article>;
      })}</div>
    </section>}

    <section className="account-section" aria-labelledby="account-orders">
      <div className="account-section-head"><h2 id="account-orders">充值记录</h2></div>
      <LoadState loading={orderState.loading} error={orderState.error} onRetry={() => setReload(v => v + 1)}
        empty={!orderState.loading && !orderState.error && orders.length === 0 ? <strong>还没有充值记录</strong> : undefined}>
        <div className="account-table account-orders" role="table" aria-label="充值记录">
          <div className="account-tr is-head" role="row"><span role="columnheader">订单号</span><span role="columnheader">套餐</span><span role="columnheader">金额</span><span role="columnheader">支付方式</span><span role="columnheader">状态</span><span role="columnheader">时间</span></div>
          {orders.map(o => {
            const s = ORDER_STATUS[o.status] ?? { label: o.status, tone: "" };
            return <div key={o.id} className="account-tr" role="row">
              <span className="account-code" role="cell" title={o.id}>{o.id}</span>
              <span role="cell" className="account-ellipsis">{number.format(o.credits)} 积分{o.bonusCredits > 0 ? `，赠 ${number.format(o.bonusCredits)}` : ""}</span>
              <span role="cell">{yuan(o.priceCents)}</span>
              <span role="cell">{o.paidVia ? PAID_VIA[o.paidVia] ?? "在线支付" : "—"}</span>
              <span role="cell"><span className={`account-tag ${s.tone}`}>{s.label}</span></span>
              <span role="cell" className="account-muted">{formatDateTime(o.paidAt ?? o.createdAt)}</span>
            </div>;
          })}
        </div>
      </LoadState>
    </section>
  </>;
}
