"use client";

import * as React from "react";
import { History, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listAuditLogs } from "@/api/audit";
import type { AuditLog } from "@/types/audit";

const RESULT_OPTIONS = [
  { value: "all",     label: "全部" },
  { value: "success", label: "成功" },
  { value: "failure", label: "失败" },
];

export default function AuditPage() {
  const { data } = useAsyncList(() => listAuditLogs(undefined, undefined, undefined, 0, 200));
  const [q, setQ] = React.useState("");
  const [result, setResult] = React.useState("all");

  const rows = data.filter((l) => {
    if (result !== "all" && l.result !== result) return false;
    if (q && !(l.action.toLowerCase().includes(q.toLowerCase()) || l.resourceId.includes(q) || l.userId.includes(q))) return false;
    return true;
  });

  const columns: Column<AuditLog>[] = [
    { key: "time", header: "时间",
      render: (l) => <span className="text-muted-foreground text-xs font-mono">{l.createdAt.slice(0, 19).replace("T", " ")}</span>,
    },
    { key: "user", header: "用户", render: (l) => <span className="font-mono text-xs">{l.userId}</span> },
    { key: "action", header: "动作",
      render: (l) => (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] bg-muted font-mono">{l.action}</span>
      ),
    },
    { key: "resource", header: "资源",
      render: (l) => (
        <span className="font-mono text-xs">
          <span className="text-muted-foreground">{l.resourceType}</span>
          <span className="mx-1">/</span>
          <span>{l.resourceId}</span>
        </span>
      ),
    },
    { key: "result", header: "结果",
      render: (l) => (
        <StatusBadge
          tone={l.result === "success" ? "success" : "danger"}
          label={l.result === "success" ? "成功" : "失败"}
        />
      ),
    },
    { key: "detail", header: "详情", render: (l) => <span className="text-muted-foreground text-xs">{l.detail ?? "—"}</span> },
    { key: "ip", header: "IP / Agent",
      render: (l) => (
        <div className="text-xs text-muted-foreground">
          <div className="font-mono">{l.ipAddress}</div>
          <div className="truncate max-w-[180px]">{l.userAgent}</div>
        </div>
      ),
    },
  ];

  const fail = data.filter((l) => l.result === "failure").length;

  return (
    <>
      <PageHeader
        title="审计日志"
        description="所有人工介入记录 · 包含管理员操作、状态流转、异常调账"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            <Download className="h-4 w-4" /> 导出 CSV
          </button>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={History} label="总事件" value={data.length} tone="primary" />
        <StatCard label="成功" value={data.length - fail} tone="emerald" />
        <StatCard label="失败" value={fail} tone="rose" />
        <StatCard label="独立用户" value={new Set(data.map((l) => l.userId)).size} tone="violet" />
      </div>

      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按动作 / 资源 / 用户搜索" className="mb-3">
        <FilterChip label="结果" value={result} options={RESULT_OPTIONS} onChange={setResult} />
      </Toolbar>
      <DataTable<AuditLog> columns={columns} rows={rows} rowKey={(l) => l.id} />
    </>
  );
}
