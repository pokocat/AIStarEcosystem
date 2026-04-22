"use client";

import * as React from "react";
import { KeySquare, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { Section } from "@/components/shared/Section";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listBatches } from "@/api/licenses";
import { LICENSE_BATCH_STATUS, LICENSE_TIER } from "@/constants/status";
import { LICENSE_TIERS } from "@/types/license";
import { formatCredits } from "@/lib/format";
import type { LicenseBatch } from "@/types/license";

const STATUS_OPTIONS = [
  { value: "all",       label: "全部" },
  { value: "active",    label: "发放中" },
  { value: "exhausted", label: "已售罄" },
  { value: "revoked",   label: "已撤回" },
  { value: "expired",   label: "已过期" },
];

export default function LicensesPage() {
  const { data } = useAsyncList(() => listBatches(0, 200));
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");

  const rows = data.filter((b) => {
    if (status !== "all" && b.status !== status) return false;
    if (q && !(b.name.toLowerCase().includes(q.toLowerCase()) || b.batchNo.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const columns: Column<LicenseBatch>[] = [
    {
      key: "batch",
      header: "批次",
      render: (b) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{b.name}</div>
          <div className="text-xs text-muted-foreground font-mono">{b.batchNo}</div>
        </div>
      ),
    },
    {
      key: "tier",
      header: "等级",
      render: (b) => {
        const m = LICENSE_TIER[b.tier];
        return m ? <StatusBadge tone={mapTone(m.tone)} label={m.label} dot={false} /> : null;
      },
    },
    { key: "grant", header: "单包点数", align: "right", render: (b) => <span className="tabular-nums">{formatCredits(b.initialCreditGrant)}</span> },
    {
      key: "progress",
      header: "核销进度",
      render: (b) => {
        const ratio = b.totalCount > 0 ? b.activatedCount / b.totalCount : 0;
        return (
          <div className="w-44">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="tabular-nums">{b.activatedCount} / {b.totalCount}</span>
              <span>{Math.round(ratio * 100)}%</span>
            </div>
            <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
              <div
                className={ratio >= 0.9 ? "bg-destructive h-full" : ratio >= 0.6 ? "bg-warning h-full" : "bg-primary h-full"}
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "状态",
      render: (b) => {
        const m = LICENSE_BATCH_STATUS[b.status];
        return m ? <StatusBadge tone={mapTone(m.tone)} label={m.label} /> : null;
      },
    },
    { key: "valid", header: "有效期",
      render: (b) => <span className="text-muted-foreground text-xs">{b.validFrom.slice(0, 10)} ~ {b.validTo.slice(0, 10)}</span>
    },
  ];

  const active = data.filter((b) => b.status === "active");
  const exhausted = active.filter((b) => b.totalCount > 0 && b.activatedCount / b.totalCount >= 0.9);
  const totalGranted = data.reduce((s, b) => s + b.activatedCount * b.initialCreditGrant, 0);

  return (
    <>
      <PageHeader
        title="秘钥批次"
        description="秘钥池与核销进度 · 激活时一次性发放初始点数（basic=1k / premium=10k）"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> 新建批次
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={KeySquare} label="批次总数" value={data.length} tone="primary" />
        <StatCard label="发放中"    value={active.length} tone="emerald" />
        <StatCard label="≥90% 核销" value={exhausted.length} tone="amber" hint="建议补充" />
        <StatCard label="累计入账"  value={formatCredits(totalGranted)} tone="violet" hint="credits" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {(Object.values(LICENSE_TIERS) as { key: string; label: string; accountLabel: string; initialCreditGrant: number; description: string }[]).map((t) => (
          <Section key={t.key} title={<><span className="text-primary">●</span> {t.label}</>}>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>兑换激活：<span className="text-foreground font-medium">{t.accountLabel}</span></div>
              <div>初始点数：<span className="text-foreground font-medium tabular-nums">{formatCredits(t.initialCreditGrant)}</span> credits</div>
              <div>{t.description}</div>
            </div>
          </Section>
        ))}
      </div>

      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按批次号或名称搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} 个批次</span>
      </Toolbar>

      <DataTable<LicenseBatch> columns={columns} rows={rows} rowKey={(b) => b.id} />
    </>
  );
}
