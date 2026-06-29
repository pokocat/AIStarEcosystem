"use client";

export const dynamic = "force-dynamic";

// 统一回收站 —— 短剧项目 + 短视频草稿都在这里（软删保留 30 天，可恢复 / 彻底删除）。
// 不再只挂在「短剧工坊」下：作为顶层入口，两类作品分 Tab 管理。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Clock, Film, RotateCcw, Trash2, Zap } from "lucide-react";
import { Thumb, dramaConfirm } from "@/components/drama-ui";
import { ProjectsApi, ShortsApi } from "@/api";
import type { DramaProjectTrashItem } from "@/api/projects";
import type { ShortDraftTrashItem } from "@/api/shorts";
import { useAsync, invalidate } from "@/lib/drama-query";
import { aiErrorMessage } from "@/lib/ai-error";

type TabKey = "drama" | "shorts";

export default function TrashPage() {
  return (
    <React.Suspense fallback={<TrashSkeleton />}>
      <TrashInner />
    </React.Suspense>
  );
}

function TrashInner() {
  const sp = useSearchParams();
  const [tab, setTab] = React.useState<TabKey>(sp?.get("tab") === "shorts" ? "shorts" : "drama");

  const dramaQ = useAsync("/me/drama/projects/trash", () => ProjectsApi.listTrashProjects(), {
    revalidateOnMount: true,
  });
  const shortsQ = useAsync("/me/drama/shorts/trash", () => ShortsApi.listTrashDrafts(), {
    revalidateOnMount: true,
  });
  const dramaItems = dramaQ.data ?? [];
  const shortsItems = shortsQ.data ?? [];

  const refreshDrama = () => {
    invalidate("/me/drama/projects");
    invalidate("/me/drama/projects/trash");
  };
  const refreshShorts = () => {
    invalidate("/me/drama/shorts");
    invalidate("/me/drama/shorts/trash");
  };

  const restoreDrama = async (p: DramaProjectTrashItem) => {
    try {
      await ProjectsApi.restoreProject(p.id);
      refreshDrama();
      toast.success(`已恢复《${p.title}》到短剧工坊`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "恢复失败，请稍后重试"));
    }
  };
  const purgeDrama = async (p: DramaProjectTrashItem) => {
    const ok = await dramaConfirm({
      title: "彻底删除",
      body: `《${p.title}》将被永久删除，无法恢复。确定继续？`,
      tone: "danger",
      confirmLabel: "彻底删除",
      cancelLabel: "取消",
    });
    if (!ok) return;
    try {
      await ProjectsApi.purgeProject(p.id);
      refreshDrama();
      toast.success("已彻底删除");
    } catch (e) {
      toast.error(aiErrorMessage(e, "删除失败，请稍后重试"));
    }
  };

  const restoreShort = async (s: ShortDraftTrashItem) => {
    try {
      await ShortsApi.restoreDraft(s.id);
      refreshShorts();
      toast.success(`已恢复《${s.title}》到短视频工坊`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "恢复失败，请稍后重试"));
    }
  };
  const purgeShort = async (s: ShortDraftTrashItem) => {
    const ok = await dramaConfirm({
      title: "彻底删除",
      body: `《${s.title}》将被永久删除，无法恢复。确定继续？`,
      tone: "danger",
      confirmLabel: "彻底删除",
      cancelLabel: "取消",
    });
    if (!ok) return;
    try {
      await ShortsApi.purgeDraft(s.id);
      refreshShorts();
      toast.success("已彻底删除");
    } catch (e) {
      toast.error(aiErrorMessage(e, "删除失败，请稍后重试"));
    }
  };

  const active = tab === "drama" ? dramaQ : shortsQ;
  const activeEmpty = tab === "drama" ? dramaItems.length === 0 : shortsItems.length === 0;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>回收站</h1>
        <div className="muted" style={{ marginTop: 4 }}>
          删除的短剧与短视频在此保留 30 天，期间可恢复，到期后自动彻底删除。
        </div>
      </div>

      {/* Tab 切换：短剧 / 短视频 */}
      <div
        className="row"
        style={{ gap: 4, padding: 4, background: "var(--surface-2)", borderRadius: 12, marginBottom: 22, width: "fit-content" }}
      >
        <TabButton active={tab === "drama"} onClick={() => setTab("drama")} icon={<Film size={14} />} label="短剧" count={dramaItems.length} />
        <TabButton active={tab === "shorts"} onClick={() => setTab("shorts")} icon={<Zap size={14} />} label="短视频" count={shortsItems.length} />
      </div>

      {!!active.error && !active.isLoading && (
        <div className="card col center" style={{ padding: 28, gap: 12, textAlign: "center", marginBottom: 20 }}>
          <div className="muted" style={{ fontSize: 13.5 }}>
            回收站加载失败 —— {active.error instanceof Error ? active.error.message : "请稍后重试"}
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={active.refetch}>重新加载</button>
        </div>
      )}

      {active.isLoading && !active.error && <TrashGridSkeleton />}

      {!active.isLoading && !active.error && activeEmpty && (
        <EmptyTrash kind={tab} />
      )}

      {tab === "drama" && dramaItems.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(156px, 1fr))", gap: 16, alignItems: "start" }}>
          {dramaItems.map((p) => (
            <TrashCard
              key={p.id}
              title={p.title}
              from={p.cover.from}
              to={p.cover.to}
              ratio={p.ratio === "16:9" ? "16/10" : "1/1"}
              tag={p.type}
              meta={`${p.episodes} 集`}
              daysLeft={p.daysLeft}
              onRestore={() => void restoreDrama(p)}
              onPurge={() => void purgeDrama(p)}
            />
          ))}
        </div>
      )}

      {tab === "shorts" && shortsItems.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(156px, 1fr))", gap: 16, alignItems: "start" }}>
          {shortsItems.map((s) => (
            <TrashCard
              key={s.id}
              title={s.title}
              from={s.from}
              to={s.to}
              ratio="3/4"
              tag={s.fmtName}
              meta={s.durationSec > 0 ? `${s.durationSec}s` : "草稿"}
              daysLeft={s.daysLeft}
              onRestore={() => void restoreShort(s)}
              onPurge={() => void purgeShort(s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="row gap-2"
      style={{
        height: 36,
        padding: "0 16px",
        borderRadius: 9,
        border: "none",
        cursor: "pointer",
        fontSize: 13.5,
        fontWeight: 700,
        background: active ? "var(--surface)" : "transparent",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        color: active ? "var(--accent)" : "var(--ink-3)",
        transition: "color .15s, background .15s",
      }}
    >
      {icon}
      <span>{label}</span>
      {count > 0 && (
        <span
          className="num"
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "0 6px",
            minWidth: 18,
            height: 18,
            borderRadius: 999,
            display: "inline-grid",
            placeItems: "center",
            background: active ? "var(--accent-soft)" : "var(--surface)",
            color: active ? "var(--accent)" : "var(--ink-3)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function TrashCard({
  title,
  from,
  to,
  ratio,
  tag,
  meta,
  daysLeft,
  onRestore,
  onPurge,
}: {
  title: string;
  from: string;
  to: string;
  ratio: string;
  tag: string;
  meta: string;
  daysLeft: number;
  onRestore: () => void;
  onPurge: () => void;
}) {
  return (
    <div className="card col" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ position: "relative" }}>
        <Thumb from={from} to={to} ratio={ratio} radius={0} stripes style={{ width: "100%", filter: "grayscale(.4)", opacity: 0.82 }}>
          <div style={{ position: "absolute", inset: 0, padding: 12, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <span className="thumb-label">{meta}</span>
            <div
              style={{
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "-.01em",
                lineHeight: 1.3,
                textShadow: "0 1px 8px rgba(0,0,0,.25)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {title}
            </div>
          </div>
        </Thumb>
      </div>
      <div className="col gap-2" style={{ padding: "11px 12px 12px" }}>
        <div className="row gap-2">
          <span className="tag tag-gray" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{tag}</span>
        </div>
        <div className="row gap-2" style={{ fontSize: 11.5, color: daysLeft <= 3 ? "var(--accent-2)" : "var(--ink-3)" }}>
          <Clock size={12} /> 还有 {daysLeft} 天彻底删除
        </div>
        <div className="row gap-2" style={{ marginTop: 2 }}>
          <button type="button" className="btn btn-primary btn-sm grow" style={{ justifyContent: "center" }} onClick={onRestore}>
            <RotateCcw size={13} /> 恢复
          </button>
          <button type="button" className="btn btn-line btn-sm btn-icon" title="彻底删除" onClick={onPurge}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyTrash({ kind }: { kind: TabKey }) {
  const label = kind === "drama" ? "短剧" : "短视频";
  return (
    <div className="card col center" style={{ padding: "52px 24px", gap: 12, textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
        <Trash2 size={24} />
      </div>
      <div style={{ fontWeight: 800, fontSize: 15 }}>{label}回收站是空的</div>
      <div className="muted" style={{ fontSize: 13 }}>删除{label}后会先放到这里，30 天内都能找回来。</div>
    </div>
  );
}

function TrashGridSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(156px, 1fr))", gap: 16, alignItems: "start" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="skel" style={{ aspectRatio: "1/1", borderRadius: 0 }} />
          <div style={{ padding: 12 }}>
            <div className="skel" style={{ height: 12, width: "60%", marginBottom: 10 }} />
            <div className="skel" style={{ height: 8, width: "40%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrashSkeleton() {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="skel" style={{ height: 32, width: 120, marginBottom: 8 }} />
      <div className="skel" style={{ height: 16, width: 320, marginBottom: 24 }} />
      <TrashGridSkeleton />
    </div>
  );
}
