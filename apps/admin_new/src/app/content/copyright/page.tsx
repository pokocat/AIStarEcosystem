"use client";

import * as React from "react";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listPendingCopyright } from "@/api/coach";
import { COPYRIGHT_STATUS } from "@/constants/status";
import type { CopyrightItem } from "@/types/coach";

const STATUS_OPTIONS = [
  { value: "all",      label: "全部" },
  { value: "pending",  label: "待核验" },
  { value: "verified", label: "已核验" },
];

export default function CopyrightPage() {
  const { data } = useAsyncList(() => listPendingCopyright());
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const rows = data.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (q && !c.title.includes(q)) return false;
    return true;
  });

  const columns: Column<CopyrightItem>[] = [
    { key: "title", header: "作品",
      render: (c) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{c.title}</div>
          <div className="text-xs text-muted-foreground">{c.artist} · {c.type}</div>
        </div>
      ),
    },
    { key: "submitted", header: "提交时间", render: (c) => <span className="text-muted-foreground">{c.submitted}</span> },
    { key: "status", header: "状态",
      render: (c) => {
        const s = COPYRIGHT_STATUS[c.status];
        return s ? <StatusBadge tone={mapTone(s.tone)} label={s.label} /> : null;
      },
    },
    { key: "action", header: "", align: "right",
      render: (c) => c.status === "pending" ? (
        <button className="inline-flex items-center gap-1 rounded-md border border-success/40 text-success bg-success-soft px-2 py-1 text-xs hover:bg-success/10">
          <CheckCircle2 className="h-3 w-3" /> 核验
        </button>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
  ];

  return (
    <>
      <PageHeader title="版权核验" description="作品版权登记队列 · 点击核验走流程" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatCard icon={ShieldCheck} label="总数" value={data.length} tone="primary" />
        <StatCard label="待核验" value={data.filter((c) => c.status === "pending").length} tone="amber" />
        <StatCard label="已核验" value={data.filter((c) => c.status === "verified").length} tone="emerald" />
      </div>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按作品名搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </Toolbar>
      <DataTable<CopyrightItem> columns={columns} rows={rows} rowKey={(c) => c.id} />
    </>
  );
}
