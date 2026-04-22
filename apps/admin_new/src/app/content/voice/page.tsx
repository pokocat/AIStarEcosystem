"use client";

import * as React from "react";
import { AudioLines } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listVoiceWorks } from "@/api/film";
import { VOICE_WORK_STATUS } from "@/constants/status";
import { formatCredits } from "@/lib/format";
import type { VoiceWork } from "@/types/film";

const TYPE_LABEL: Record<string, string> = { animation: "动画", documentary: "纪录片", audiobook: "有声书", game: "游戏" };

const STATUS_OPTIONS = [
  { value: "all",       label: "全部" },
  { value: "recording", label: "录音中" },
  { value: "editing",   label: "剪辑中" },
  { value: "delivered", label: "已交付" },
];

export default function VoicePage() {
  const { data } = useAsyncList(() => listVoiceWorks());
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const rows = data.filter((v) => {
    if (status !== "all" && v.status !== status) return false;
    if (q && !v.project.includes(q)) return false;
    return true;
  });

  const columns: Column<VoiceWork>[] = [
    { key: "project", header: "项目",
      render: (v) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{v.project}</div>
          <div className="text-xs text-muted-foreground">{TYPE_LABEL[v.type]} · {v.duration} 分钟</div>
        </div>
      ),
    },
    { key: "status", header: "状态",
      render: (v) => {
        const s = VOICE_WORK_STATUS[v.status];
        return s ? <StatusBadge tone={mapTone(s.tone)} label={s.label} /> : null;
      },
    },
    { key: "pay", header: "合约金额", align: "right", render: (v) => <span className="tabular-nums">{formatCredits(v.payment)}</span> },
  ];

  return (
    <>
      <PageHeader title="配音作品" description="动画 / 纪录片 / 有声书 / 游戏配音" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatCard icon={AudioLines} label="项目总数" value={data.length} tone="primary" />
        <StatCard label="已交付" value={data.filter((v) => v.status === "delivered").length} tone="emerald" />
        <StatCard label="累计收入" value={formatCredits(data.reduce((s, v) => s + v.payment, 0))} tone="violet" />
      </div>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按项目名搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </Toolbar>
      <DataTable<VoiceWork> columns={columns} rows={rows} rowKey={(v) => v.id} />
    </>
  );
}
