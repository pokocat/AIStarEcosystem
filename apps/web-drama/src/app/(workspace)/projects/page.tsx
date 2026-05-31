"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Film, Plus, Search, Sparkles } from "lucide-react";
import type { Drama, DramaStatus } from "@ai-star-eco/types/film";
import { Button, Card, KpiCard } from "@/components/premium";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  StatusBadge,
  ViewHeader,
} from "@/components/common";
import { FilmApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { NewProjectDialog } from "./_dialogs/NewProjectDialog";

const STATUS_LABEL: Record<DramaStatus, string> = {
  released: "在线",
  filming: "制作中",
  "post-production": "首映 T-3",
  casting: "选角",
};
const STATUS_TONE: Record<DramaStatus, "success" | "info" | "accent" | "violet"> = {
  released: "success",
  filming: "info",
  "post-production": "accent",
  casting: "violet",
};

type Filter = "all" | DramaStatus;

export default function ProjectsListPage() {
  return (
    <React.Suspense fallback={null}>
      <ProjectsListInner />
    </React.Suspense>
  );
}

function ProjectsListInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [showNew, setShowNew] = React.useState(sp.get("new") === "1");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    // URL ?new=1 触发后自动清掉
    if (sp.get("new") === "1") {
      window.history.replaceState(null, "", "/projects");
    }
  }, [sp]);

  const dramasQ = useAsync<Drama[]>("/film/dramas", () => FilmApi.listDramas());
  const all = (dramasQ.data ?? []).filter((d) => d.id.startsWith("d-"));

  const filtered = all.filter((d) => {
    if (filter !== "all" && d.status !== filter) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (!d.title.toLowerCase().includes(needle) && !d.genre.includes(q) && !d.role.includes(q)) return false;
    }
    return true;
  });

  const released = all.filter((d) => d.status === "released").length;
  const filming = all.filter((d) => d.status === "filming").length;
  const post = all.filter((d) => d.status === "post-production").length;
  const casting = all.filter((d) => d.status === "casting").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="项目流水线"
        title={
          <>
            项目{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              流水线
            </span>
          </>
        }
        meta={`${all.length} 条剧集 · ${released} 在线 · ${filming} 制作`}
        action={
          <Button variant="primary" size="md" onClick={() => setShowNew(true)}>
            <Sparkles size={14} />
            创建新项目
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="在线" value={String(released)} tone="success" />
        <KpiCard label="制作中" value={String(filming)} tone="info" />
        <KpiCard label="后期" value={String(post)} tone="accent" />
        <KpiCard label="选角中" value={String(casting)} tone="violet" />
      </div>

      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--surface-1)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Search size={14} color="var(--fg-2)" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="按剧名 / 类型 / 主演搜索…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "var(--fg-0)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "released", "filming", "post-production", "casting"] as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-pill)",
                  border: active
                    ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                    : "1px solid var(--line-2)",
                  background: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--fg-1)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {f === "all" ? "全部" : STATUS_LABEL[f]}
              </button>
            );
          })}
        </div>
      </Card>

      {dramasQ.isLoading && <LoadingBlock rows={3} height={64} />}
      {!!dramasQ.error && <ErrorBlock onRetry={dramasQ.refetch} />}
      {!dramasQ.isLoading && !dramasQ.error && filtered.length === 0 && (
        <EmptyState
          icon={<Film size={28} />}
          title="还没有项目"
          action={
            <Button variant="primary" size="md" onClick={() => setShowNew(true)}>
              <Plus size={14} />
              创建新项目
            </Button>
          }
        />
      )}

      {!dramasQ.isLoading && filtered.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-1)" }}>
                {["剧名", "类型", "集数", "主演", "状态", "排期"].map((h) => (
                  <th
                    key={h}
                    className="eyebrow"
                    style={{
                      textAlign: "left",
                      padding: "14px 18px",
                      borderBottom: "1px solid var(--line)",
                      color: "var(--fg-2)",
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/projects/${encodeURIComponent(p.id)}`)}
                  style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid var(--line)" : "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      "var(--surface-1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                  }}
                >
                  <td
                    style={{
                      padding: "16px 18px",
                      color: "var(--fg-0)",
                      fontWeight: 500,
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {p.title}
                  </td>
                  <td style={{ padding: "16px 18px", color: "var(--fg-1)" }}>{p.genre}</td>
                  <td className="mono" style={{ padding: "16px 18px", color: "var(--fg-1)", fontSize: 12 }}>
                    {p.episodes > 0 ? `${p.episodes} 集` : "—"}
                  </td>
                  <td style={{ padding: "16px 18px", color: "var(--fg-1)" }}>{p.role}</td>
                  <td style={{ padding: "16px 18px" }}>
                    <StatusBadge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</StatusBadge>
                  </td>
                  <td
                    className="mono"
                    style={{ padding: "16px 18px", color: "var(--fg-2)", fontSize: 12 }}
                  >
                    {p.releaseDate ? p.releaseDate.slice(0, 10) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <NewProjectDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(d) => {
          invalidate("/film/dramas");
          toast.success(`项目「${d.title}」已创建`);
          router.push(`/projects/${encodeURIComponent(d.id)}`);
        }}
      />
    </div>
  );
}
