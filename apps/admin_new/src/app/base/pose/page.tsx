"use client";

import * as React from "react";
import { PersonStanding } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { Section } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listPoses, listExpressions, listGestures } from "@/api/pose";
import { POSE_DIFFICULTY } from "@/constants/status";
import type { Pose, Expression, Gesture } from "@/types/pose";

const CAT_LABEL: Record<string, string> = {
  standing: "站姿", sitting: "坐姿", dancing: "舞蹈", singing: "演唱", action: "动作",
};

const CAT_OPTIONS = [
  { value: "all", label: "全部分类" },
  ...Object.entries(CAT_LABEL).map(([v, l]) => ({ value: v, label: l })),
];

export default function PoseBasePage() {
  const [tab, setTab] = React.useState<"姿态" | "表情" | "手势">("姿态");
  const poses = useAsyncList(() => listPoses());
  const exps = useAsyncList(() => listExpressions());
  const gestures = useAsyncList(() => listGestures());

  return (
    <>
      <PageHeader title="动作与表情" description="姿态 / 表情 / 手势库" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={PersonStanding} label="姿态总数" value={poses.data.length} tone="primary" />
        <StatCard label="表情总数" value={exps.data.length} tone="violet" />
        <StatCard label="手势总数" value={gestures.data.length} tone="emerald" />
        <StatCard label="新品" value={poses.data.filter((p) => p.isNew).length} tone="amber" />
      </div>

      <div className="flex items-center gap-1 border-b border-border mb-3">
        {["姿态", "表情", "手势"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            className={`px-3 py-2 -mb-px border-b-2 text-sm transition-colors ${
              tab === t ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "姿态" && <PoseGrid rows={poses.data} />}
      {tab === "表情" && <ExpressionGrid rows={exps.data} />}
      {tab === "手势" && <GestureGrid rows={gestures.data} />}
    </>
  );
}

function PoseGrid({ rows }: { rows: Pose[] }) {
  const [cat, setCat] = React.useState("all");
  const filtered = rows.filter((p) => cat === "all" || p.category === cat);
  return (
    <>
      <Toolbar className="mb-3">
        <FilterChip label="分类" value={cat} options={CAT_OPTIONS} onChange={setCat} />
      </Toolbar>
      <Section padding={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 p-3">
          {filtered.map((p) => {
            const d = POSE_DIFFICULTY[p.difficulty];
            return (
              <div key={p.id} className="rounded-lg border border-border bg-card overflow-hidden hover:card-elev-2 transition-shadow">
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {p.thumbnail && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.thumbnail} alt={p.name} className="h-full w-full object-cover" />
                  )}
                  {p.isNew && <span className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500 text-white">NEW</span>}
                </div>
                <div className="p-2.5 flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{CAT_LABEL[p.category]}</div>
                  </div>
                  {d && <StatusBadge tone={mapTone(d.tone)} label={d.label} dot={false} className="text-[10px] px-1.5 py-0" />}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}

function ExpressionGrid({ rows }: { rows: Expression[] }) {
  return (
    <Section padding={false}>
      <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 p-3">
        {rows.map((e) => (
          <div key={e.id} className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3">
            <div className="text-4xl">{e.emoji}</div>
            <div className="text-sm font-medium">{e.name}</div>
            <div className="text-[11px] text-muted-foreground">强度 {e.intensity}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function GestureGrid({ rows }: { rows: Gesture[] }) {
  return (
    <Section padding={false}>
      <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 p-3">
        {rows.map((g) => (
          <div key={g.id} className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3">
            <div className="text-4xl">{g.icon}</div>
            <div className="text-sm font-medium">{g.name}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{g.category}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
