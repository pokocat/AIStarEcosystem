"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listDistributionQueue } from "@/api/coach";
import { listDistributionContent } from "@/api/distribution";
import { DISTRIBUTION_QUEUE_STATUS, CONTENT_DISTRIBUTION_STATUS } from "@/constants/status";
import type { DistributionQueueItem } from "@/types/coach";
import type { DistributionContentItem } from "@/types/distribution";

const STATUS_OPTIONS = [
  { value: "all",          label: "全部" },
  { value: "reviewing",    label: "待审核" },
  { value: "approved",     label: "已通过" },
  { value: "distributing", label: "分发中" },
];

const CONTENT_STATUS_OPTIONS = [
  { value: "all",          label: "全部" },
  { value: "published",    label: "已发布" },
  { value: "distributing", label: "分发中" },
  { value: "scheduled",    label: "定时发布" },
  { value: "draft",        label: "草稿" },
];

export default function DistributionQueuePage() {
  const [tab, setTab] = React.useState<"队列" | "内容档案">("队列");
  const queue = useAsyncList(() => listDistributionQueue());
  const content = useAsyncList(() => listDistributionContent());

  return (
    <>
      <PageHeader title="发行队列" description="待审核内容队列 + 内容分发档案" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Send} label="队列条目" value={queue.data.length} tone="primary" />
        <StatCard label="待审核" value={queue.data.filter((d) => d.status === "reviewing").length} tone="amber" />
        <StatCard label="分发中" value={queue.data.filter((d) => d.status === "distributing").length} tone="sky" />
        <StatCard label="已通过" value={queue.data.filter((d) => d.status === "approved").length} tone="emerald" />
      </div>

      <div className="flex items-center gap-1 border-b border-border mb-3">
        {["队列", "内容档案"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            className={`px-3 py-2 -mb-px border-b-2 text-sm transition-colors ${
              tab === t
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "队列" && <QueueTable rows={queue.data} />}
      {tab === "内容档案" && <ContentTable rows={content.data} />}
    </>
  );
}

function QueueTable({ rows }: { rows: DistributionQueueItem[] }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (q && !r.title.includes(q)) return false;
    return true;
  });
  const columns: Column<DistributionQueueItem>[] = [
    { key: "title", header: "内容", render: (r) => (
      <div className="min-w-0">
        <div className="font-medium truncate">{r.title}</div>
        <div className="text-xs text-muted-foreground">{r.artist} · {r.type}</div>
      </div>
    )},
    { key: "platforms", header: "覆盖平台", align: "right", render: (r) => <span className="tabular-nums">{r.platforms}</span> },
    { key: "date", header: "提交时间", render: (r) => <span className="text-muted-foreground">{r.date}</span> },
    { key: "status", header: "状态",
      render: (r) => {
        const s = DISTRIBUTION_QUEUE_STATUS[r.status];
        return s ? <StatusBadge tone={mapTone(s.tone)} label={s.label} /> : null;
      },
    },
  ];
  return (
    <>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按标题搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </Toolbar>
      <DataTable<DistributionQueueItem> columns={columns} rows={filtered} rowKey={(r) => r.id} />
    </>
  );
}

function ContentTable({ rows }: { rows: DistributionContentItem[] }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (q && !r.title.includes(q)) return false;
    return true;
  });
  const columns: Column<DistributionContentItem>[] = [
    { key: "title", header: "内容", render: (r) => (
      <div className="min-w-0">
        <div className="font-medium truncate">{r.title}</div>
        <div className="text-xs text-muted-foreground">{r.type}</div>
      </div>
    )},
    { key: "platforms", header: "平台数", align: "right", render: (r) => r.platforms },
    { key: "views", header: "播放", align: "right", render: (r) => <span className="tabular-nums">{r.totalViews}</span> },
    { key: "date", header: "日期", render: (r) => <span className="text-muted-foreground">{r.date}</span> },
    { key: "status", header: "状态",
      render: (r) => {
        const s = CONTENT_DISTRIBUTION_STATUS[r.status];
        return s ? <StatusBadge tone={mapTone(s.tone)} label={s.label} /> : null;
      },
    },
  ];
  return (
    <>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按标题搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={CONTENT_STATUS_OPTIONS} onChange={setStatus} />
      </Toolbar>
      <DataTable<DistributionContentItem> columns={columns} rows={filtered} rowKey={(r) => r.id} />
    </>
  );
}
