"use client";

export const dynamic = "force-dynamic";

// 短剧回收站 — 软删的短剧在此保留 30 天，可恢复或彻底删除，到期由后端定时物理清除。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Clock, RotateCcw, Trash2 } from "lucide-react";
import { Thumb, dramaConfirm } from "@/components/drama-ui";
import { ProjectsApi } from "@/api";
import type { DramaProjectTrashItem } from "@/api/projects";
import { useAsync, invalidate } from "@/lib/drama-query";
import { aiErrorMessage } from "@/lib/ai-error";

export default function TrashPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useAsync(
    "/me/drama/projects/trash",
    () => ProjectsApi.listTrashProjects(),
    { revalidateOnMount: true },
  );
  const items = data ?? [];

  const refreshAll = () => {
    invalidate("/me/drama/projects");
    invalidate("/me/drama/projects/trash");
  };

  const restore = async (p: DramaProjectTrashItem) => {
    try {
      await ProjectsApi.restoreProject(p.id);
      refreshAll();
      toast.success(`已恢复《${p.title}》到短剧工坊`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "恢复失败，请稍后重试"));
    }
  };

  const purge = async (p: DramaProjectTrashItem) => {
    const ok = await dramaConfirm({
      title: "彻底删除",
      body: `《${p.title}》将被永久删除，无法恢复。确定继续？`,
      tone: "danger",
      confirmLabel: "彻底删除",
      cancelLabel: "再想想",
    });
    if (!ok) return;
    try {
      await ProjectsApi.purgeProject(p.id);
      refreshAll();
      toast.success("已彻底删除");
    } catch (e) {
      toast.error(aiErrorMessage(e, "删除失败，请稍后重试"));
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 8, gap: 12, alignItems: "center" }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/projects")}>
          <ChevronLeft size={16} /> 返回短剧工坊
        </button>
      </div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>回收站</h1>
        <div className="muted" style={{ marginTop: 4 }}>
          删除的短剧在此保留 30 天，期间可恢复，到期后自动彻底删除。
        </div>
      </div>

      {isLoading && !error && (
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
      )}

      {!!error && !isLoading && (
        <div className="card col center" style={{ padding: 28, gap: 12, textAlign: "center", marginBottom: 20 }}>
          <div className="muted" style={{ fontSize: 13.5 }}>
            回收站加载失败 —— {error instanceof Error ? error.message : "请稍后重试"}
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={refetch}>重新加载</button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="card col center" style={{ padding: "52px 24px", gap: 12, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
            <Trash2 size={24} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>回收站是空的</div>
          <div className="muted" style={{ fontSize: 13 }}>删除短剧后会先放到这里，30 天内都能找回来。</div>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(156px, 1fr))", gap: 16, alignItems: "start" }}>
          {items.map((p) => (
            <div key={p.id} className="card col" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ position: "relative" }}>
                <Thumb
                  from={p.cover.from}
                  to={p.cover.to}
                  ratio={p.ratio === "16:9" ? "16/10" : "1/1"}
                  radius={0}
                  stripes
                  style={{ width: "100%", filter: "grayscale(.4)", opacity: 0.82 }}
                >
                  <div style={{ position: "absolute", inset: 0, padding: 12, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <span className="thumb-label">{p.ratio}</span>
                    <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.3, textShadow: "0 1px 8px rgba(0,0,0,.25)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {p.title}
                    </div>
                  </div>
                </Thumb>
              </div>
              <div className="col gap-2" style={{ padding: "11px 12px 12px" }}>
                <div className="row gap-2">
                  <span className="tag tag-gray">{p.type}</span>
                  <span className="grow" />
                  <span className="faint num" style={{ fontSize: 12 }}>{p.episodes} 集</span>
                </div>
                <div className="row gap-2" style={{ fontSize: 11.5, color: p.daysLeft <= 3 ? "var(--accent-2)" : "var(--ink-3)" }}>
                  <Clock size={12} /> 还有 {p.daysLeft} 天彻底删除
                </div>
                <div className="row gap-2" style={{ marginTop: 2 }}>
                  <button type="button" className="btn btn-primary btn-sm grow" style={{ justifyContent: "center" }} onClick={() => void restore(p)}>
                    <RotateCcw size={13} /> 恢复
                  </button>
                  <button type="button" className="btn btn-line btn-sm btn-icon" title="彻底删除" onClick={() => void purge(p)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
