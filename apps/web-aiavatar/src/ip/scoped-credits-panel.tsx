"use client";

import { useEffect, useState } from "react";
import { ModelBillingApi } from "@ai-star-eco/api-client";
import type { ScopedCreditGrant } from "@ai-star-eco/types/model-billing";
import { useIdentity } from "@/proto/api";
import { formatDateTime } from "@/lib/datetime";

const number = new Intl.NumberFormat("zh-CN");

/** Separate balances: never add scoped grants to the wallet headline or recharge total. */
export function ScopedCreditsPanel({ enterpriseId }: { enterpriseId?: string }) {
  const identity = useIdentity();
  if (!identity?.uid) return null;
  return <ScopedCreditsBody key={`${identity.uid}:${enterpriseId ?? "personal"}`} enterpriseId={enterpriseId} />;
}

function ScopedCreditsBody({ enterpriseId }: { enterpriseId?: string }) {
  const [rows, setRows] = useState<ScopedCreditGrant[]>([]);
  const [page, setPage] = useState(0), [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true); setError("");
    ModelBillingApi.myGrants({ enterpriseId, page, size: 10 }).then(result => {
      if (!current) return;
      setRows(result.data); setHasNext(result.pagination.hasNext);
    }).catch(() => { if (current) setError("暂时读不到模型赠款，请重试。"); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [enterpriseId, page, refresh]);

  return <section aria-label={enterpriseId ? "我的企业模型赠款" : "我的模型赠款"}
    style={{ margin: "18px 0", padding: 16, border: "1px solid var(--line, #e5e7eb)", borderRadius: 12, background: "var(--surface, #fff)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 15 }}>{enterpriseId ? "我的企业模型赠款" : "模型赠款"}</h3>
      <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)} style={{ fontSize: 12 }}>刷新</button>
    </div>
    <p style={{ color: "var(--ink-3, #666)", fontSize: 12, margin: "8px 0 14px" }}>仅用于指定模型，单独抵扣，不计入上方通用积分。</p>
    {loading ? <p role="status">正在读取额度…</p> : error ? <p role="alert">{error}</p> : rows.length === 0 ? <p style={{ color: "var(--ink-3, #666)", fontSize: 13 }}>还没有模型赠款。</p> :
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map(grant => {
          const expired = Date.parse(grant.expiresAt) <= Date.now();
          const usable = !expired && grant.campaignActive;
          return <li key={grant.id} style={{ padding: "12px 0", borderTop: "1px solid var(--line, #e5e7eb)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong style={{ fontSize: 14 }}>{grant.campaignName}</strong><span>{expired ? "已到期" : !grant.campaignActive ? "活动暂停或未开始" : `${number.format(grant.available)} 可用`}</span></div>
            <p style={{ fontSize: 12, color: "var(--ink-2, #555)", margin: "7px 0" }}>适用：{grant.targetLabels.join("、")}</p>
            <p style={{ fontSize: 12, color: "var(--ink-3, #666)", margin: 0 }}>
              {formatDateTime(grant.expiresAt)} 到期 · 已用 {number.format(grant.spent)}
              {grant.frozen > 0 && ` · 任务占用 ${number.format(grant.frozen)}`}
              {!usable && !expired && ` · 剩余额度 ${number.format(grant.available)}`}
            </p>
          </li>;
        })}
      </ul>}
    {(page > 0 || hasNext) && <nav aria-label="额度分页" style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginTop: 12 }}>
      <button type="button" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>上一页</button>
      <span>第 {page + 1} 页</span>
      <button type="button" disabled={loading || !hasNext} onClick={() => setPage(value => value + 1)}>下一页</button>
    </nav>}
  </section>;
}
