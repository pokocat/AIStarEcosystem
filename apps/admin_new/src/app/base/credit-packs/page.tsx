"use client";

import * as React from "react";
import { Coins, Plus, Star } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listCreditPacks, listRechargeHistory } from "@/api/settings";
import { CREDIT_PACK_STATUS } from "@/constants/status";
import { formatCredits, formatCurrency } from "@/lib/format";
import type { RechargeRecord } from "@/types/settings";

const SOURCE_LABEL: Record<string, string> = {
  credit_pack: "积分包",
  license_redeem: "秘钥兑换",
  promo_gift: "活动赠送",
};

export default function CreditPacksPage() {
  const packs = useAsyncList(() => listCreditPacks());
  const history = useAsyncList(() => listRechargeHistory(0, 50));

  return (
    <>
      <PageHeader
        title="积分包"
        description="积分售卖规格（替代原订阅） · 一次性购买 credits"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> 新增积分包
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Coins} label="积分包规格" value={packs.data.length} tone="primary" />
        <StatCard label="上架" value={packs.data.filter((p) => p.status === "active").length} tone="emerald" />
        <StatCard label="充值记录" value={history.data.length} tone="sky" />
        <StatCard label="累计入账" value={formatCredits(history.data.reduce((s, h) => s + h.creditsAdded, 0))} tone="violet" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {packs.data.map((p) => {
          const m = CREDIT_PACK_STATUS[p.status];
          return (
            <div key={p.id} className={`rounded-xl border bg-card p-4 card-elev-1 ${p.recommended ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">{p.code}</div>
                  <div className="text-lg font-semibold truncate">{p.name}</div>
                </div>
                {p.recommended && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold">
                    <Star className="h-3 w-3" /> 推荐
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums">{formatCredits(p.credits)}</span>
                <span className="text-xs text-muted-foreground">credits</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground tabular-nums">{formatCurrency(p.priceCents)}</div>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {p.highlights.map((h, i) => <li key={i}>· {h}</li>)}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                {m && <StatusBadge tone={mapTone(m.tone)} label={m.label} />}
                <button className="text-xs text-primary hover:underline">编辑</button>
              </div>
            </div>
          );
        })}
      </div>

      <Section title="充值 / 兑换历史">
        <DataTable<RechargeRecord>
          columns={[
            { key: "date", header: "时间", render: (r) => <span className="text-muted-foreground">{r.date}</span> },
            { key: "desc", header: "说明", render: (r) => r.desc },
            { key: "source", header: "来源", render: (r) => <StatusBadge tone="neutral" label={SOURCE_LABEL[r.source] ?? r.source} dot={false} /> },
            { key: "credits", header: "入账", align: "right", render: (r) => <span className="tabular-nums font-medium text-success">+{formatCredits(r.creditsAdded)}</span> },
            { key: "price", header: "实付", align: "right", render: (r) => r.priceCents > 0 ? <span className="tabular-nums">{formatCurrency(r.priceCents)}</span> : <span className="text-muted-foreground">—</span> },
            { key: "user", header: "用户", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.userId ?? "—"}</span> },
          ]}
          rows={history.data}
          rowKey={(r) => r.id}
        />
      </Section>
    </>
  );
}
