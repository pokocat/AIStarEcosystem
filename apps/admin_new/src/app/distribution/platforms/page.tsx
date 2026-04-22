"use client";

import * as React from "react";
import { Radio } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listPlatforms } from "@/api/distribution";
import { PLATFORM_STATUS } from "@/constants/status";
import type { Platform } from "@/types/distribution";

const CATEGORY_LABEL: Record<string, string> = { music: "音乐", video: "视频", social: "社交", live: "直播" };

const STATUS_OPTIONS = [
  { value: "all",          label: "全部" },
  { value: "connected",    label: "已接入" },
  { value: "pending",      label: "接入审核" },
  { value: "disconnected", label: "已断开" },
];
const CAT_OPTIONS = [
  { value: "all",    label: "全部分类" },
  { value: "music",  label: "音乐" },
  { value: "video",  label: "视频" },
  { value: "social", label: "社交" },
  { value: "live",   label: "直播" },
];

export default function PlatformsPage() {
  const { data } = useAsyncList(() => listPlatforms());
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [cat, setCat] = React.useState("all");

  const rows = data.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (cat !== "all" && p.category !== cat) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <PageHeader title="分发渠道" description="第三方平台接入 / 审核 / 粉丝同步" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Radio} label="平台总数" value={data.length} tone="primary" />
        <StatCard label="已接入" value={data.filter((p) => p.status === "connected").length} tone="emerald" />
        <StatCard label="待审核" value={data.filter((p) => p.status === "pending").length} tone="amber" />
        <StatCard label="已断开" value={data.filter((p) => p.status === "disconnected").length} tone="rose" />
      </div>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按平台名搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <FilterChip label="分类" value={cat} options={CAT_OPTIONS} onChange={setCat} />
      </Toolbar>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {rows.map((p) => (
          <PlatformCard key={p.id} platform={p} />
        ))}
      </div>
    </>
  );
}

function PlatformCard({ platform: p }: { platform: Platform }) {
  const s = PLATFORM_STATUS[p.status];
  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elev-1 transition-shadow hover:card-elev-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center text-xl shrink-0">
            {p.icon}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{p.name}</div>
            <div className="text-xs text-muted-foreground">{CATEGORY_LABEL[p.category]}</div>
          </div>
        </div>
        {s && <StatusBadge tone={mapTone(s.tone)} label={s.label} />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">粉丝</div>
          <div className="mt-0.5 font-medium tabular-nums">{p.followers}</div>
        </div>
        <div>
          <div className="text-muted-foreground">上次同步</div>
          <div className="mt-0.5">{p.lastSync}</div>
        </div>
      </div>
    </div>
  );
}
