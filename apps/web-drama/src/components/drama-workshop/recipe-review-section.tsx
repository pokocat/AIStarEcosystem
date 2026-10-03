"use client";

// 运营 · 模板审核（v0.73 抽 skill 飞轮）—— 用户从自己的作品发布成的模板（代码里叫 recipe / 配方）
// 在此审核 / 上架 / 驳回。维护入口在 web-drama 运营页「热点与推荐」（非 admin）。
// 后端 /api/me/drama/recipes/**（requireOperator）。界面文字按 docs/drama-ux-copy-pass.md §2 术语表。
import * as React from "react";
import { toast } from "sonner";
import { Boxes, Check, ChevronDown, ChevronRight, RefreshCw, X } from "lucide-react";
import { RecipesApi } from "@/api";
import type { DramaRecipe } from "@/api/recipes";
import { RecipeSkeletonView } from "./recipe-skeleton-view";

export function RecipeReviewSection() {
  const [pending, setPending] = React.useState<DramaRecipe[]>([]);
  const [published, setPublished] = React.useState<DramaRecipe[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [rejecting, setRejecting] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [p, pub] = await Promise.all([RecipesApi.listForReview(), RecipesApi.listPublished()]);
      setPending(p);
      setPublished(pub);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "模板列表没加载出来，请重试");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const doPublish = async (r: DramaRecipe) => {
    setBusyId(r.id);
    try {
      await RecipesApi.publish(r.id);
      toast.success(`「${r.title}」已上架到模板广场`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上架失败，请重试");
    } finally {
      setBusyId(null);
    }
  };
  const doReject = async (r: DramaRecipe) => {
    setBusyId(r.id);
    try {
      await RecipesApi.reject(r.id, note.trim() || undefined);
      toast.success(`已驳回「${r.title}」`);
      setRejecting(null);
      setNote("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "驳回失败，请重试");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="acct-ops-head">
        <span className="acct-ops-head-title">
          <Boxes size={16} style={{ color: "var(--accent)" }} />
          模板审核
        </span>
        <span className="acct-ops-head-sub">
          用户投稿到模板广场的模板 · 待审 {pending.length} · 已上架 {published.length}
        </span>
        <div className="acct-ops-head-actions">
          <button type="button" className="btn btn-line btn-sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={14} /> 刷新
          </button>
        </div>
      </div>
      <div className="col gap-2" style={{ padding: 16 }}>
        {loading ? (
          <span className="muted" style={{ fontSize: 13 }}>正在加载…</span>
        ) : pending.length === 0 ? (
          <span className="faint" style={{ fontSize: 13, lineHeight: 1.6 }}>没有待审的模板。用户在「我的短剧」或「我的短视频」点「发布成模板」后，会出现在这里。</span>
        ) : (
          pending.map((r) => {
            const open = expanded === r.id;
            const isRejecting = rejecting === r.id;
            return (
              <div key={r.id} className="card" style={{ padding: 12, background: "var(--surface-2)", border: "none" }}>
                <div className="acct-review-item">
                  <span
                    style={{ width: 36, height: 48, borderRadius: 7, flex: "none", overflow: "hidden", background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})` }}
                  >
                    {r.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverImage} alt={r.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    )}
                  </span>
                  <div className="acct-review-item-main">
                    <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.title}>{r.title}</span>
                      <span className="tag tag-accent" style={{ fontSize: 10.5 }}>{r.type}</span>
                      {r.authorName && (
                        <span className="tag tag-gray" style={{ fontSize: 10.5 }}>来自 @{r.authorName}</span>
                      )}
                      <span className="faint num" style={{ fontSize: 11 }}>{r.episodes} 集 · {r.ratio}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{r.summary || "（没写简介）"}</div>
                    <button
                      type="button"
                      className="row gap-1 faint"
                      style={{ fontSize: 11.5, alignSelf: "flex-start", marginTop: 2 }}
                      onClick={() => setExpanded(open ? null : r.id)}
                    >
                      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} 看模板结构（{r.data.beats.length} 集的看点）
                    </button>
                    {open && <div style={{ marginTop: 6 }}><RecipeSkeletonView data={r.data} /></div>}
                    {isRejecting && (
                      <div className="acct-review-reject">
                        <input
                          autoFocus
                          value={note}
                          aria-label="驳回理由"
                          placeholder="驳回理由（选填，会通知投稿人）"
                          onChange={(e) => setNote(e.target.value)}
                          style={{ height: 32, border: "1.5px solid var(--line)", borderRadius: 8, padding: "0 10px", fontSize: 12.5, outline: "none", background: "var(--surface)", color: "var(--ink)" }}
                        />
                        <button type="button" className="btn btn-line btn-sm" disabled={busyId === r.id} onClick={() => void doReject(r)}>确认驳回</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRejecting(null); setNote(""); }}>取消</button>
                      </div>
                    )}
                  </div>
                  {!isRejecting && (
                    <div className="acct-review-item-actions">
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === r.id} onClick={() => { setRejecting(r.id); setNote(""); }}>
                        <X size={14} /> 驳回
                      </button>
                      <button type="button" className="btn btn-grad btn-sm" disabled={busyId === r.id} onClick={() => void doPublish(r)}>
                        <Check size={14} /> {busyId === r.id ? "处理中…" : "通过并上架"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 已上架模板（只读）—— 运营可以展开看任意已上架模板的结构，含官方 / 精选 / 用户投稿。 */}
      {!loading && published.length > 0 && (
        <div className="col gap-2" style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--line-soft)" }}>
          <span className="faint" style={{ fontSize: 12, fontWeight: 700 }}>已上架（{published.length}）· 点开看结构</span>
          {published.map((r) => {
            const open = expanded === r.id;
            const originLabel = r.origin === "official" ? "官方" : r.origin === "featured" ? "精选" : "用户投稿";
            return (
              <div key={r.id} className="card" style={{ padding: 12, background: "var(--surface-2)", border: "none" }}>
                <button type="button" className="row gap-3" style={{ alignItems: "center", width: "100%", textAlign: "left" }} onClick={() => setExpanded(open ? null : r.id)}>
                  <span style={{ width: 30, height: 40, borderRadius: 6, flex: "none", overflow: "hidden", background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})` }}>
                    {r.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverImage} alt={r.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    )}
                  </span>
                  <div className="col grow" style={{ minWidth: 0, gap: 2 }}>
                    <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.title}>{r.title}</span>
                      <span className="tag tag-gray" style={{ fontSize: 10 }}>{originLabel}</span>
                      <span className="faint num" style={{ fontSize: 11 }}>{r.episodes} 集 · {r.ratio} · 做同款 {r.useCount} 次</span>
                    </div>
                    <span className="muted" style={{ fontSize: 12, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.summary || "（没写简介）"}</span>
                  </div>
                  <span className="faint" style={{ flex: "none" }}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                </button>
                {open && <div style={{ marginTop: 8 }}><RecipeSkeletonView data={r.data} /></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
