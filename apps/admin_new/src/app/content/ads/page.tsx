"use client";

import * as React from "react";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listAds } from "@/api/film";
import { AD_STATUS } from "@/constants/status";
import { formatCompactNumber, formatCredits } from "@/lib/format";
import type { Advertisement } from "@/types/film";

const TYPE_LABEL: Record<string, string> = { TVC: "TVC 短片", digital: "数字广告", print: "平面", social: "社交媒体" };

const STATUS_OPTIONS = [
  { value: "all",         label: "全部" },
  { value: "negotiating", label: "洽谈中" },
  { value: "shooting",    label: "拍摄中" },
  { value: "completed",   label: "已交付" },
];

export default function AdsPage() {
  const { data } = useAsyncList(() => listAds());
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const rows = data.filter((a) => {
    if (status !== "all" && a.status !== status) return false;
    if (q && !(a.brand.includes(q) || a.product.includes(q))) return false;
    return true;
  });

  const columns: Column<Advertisement>[] = [
    { key: "brand", header: "品牌 / 产品",
      render: (a) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{a.brand}</div>
          <div className="text-xs text-muted-foreground">{a.product} · {TYPE_LABEL[a.type]} · {a.duration}s</div>
        </div>
      ),
    },
    { key: "status", header: "状态",
      render: (a) => {
        const s = AD_STATUS[a.status];
        return s ? <StatusBadge tone={mapTone(s.tone)} label={s.label} /> : null;
      },
    },
    { key: "pay",  header: "合约金额", align: "right", render: (a) => <span className="tabular-nums">{formatCredits(a.payment)}</span> },
    { key: "view", header: "曝光",    align: "right", render: (a) => <span className="tabular-nums">{formatCompactNumber(a.views)}</span> },
  ];

  return (
    <>
      <PageHeader title="商业广告" description="品牌代言 / TVC / 数字广告" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatCard icon={Megaphone} label="广告总数" value={data.length} tone="primary" />
        <StatCard label="洽谈中" value={data.filter((a) => a.status === "negotiating").length} tone="amber" />
        <StatCard label="累计收入" value={formatCredits(data.reduce((s, a) => s + a.payment, 0))} tone="violet" />
      </div>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按品牌 / 产品搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </Toolbar>
      <DataTable<Advertisement> columns={columns} rows={rows} rowKey={(a) => a.id} />
    </>
  );
}
