"use client";

// 运营 · 配方审核（v0.73 抽 skill 飞轮）—— 用户从爆款项目抽出的配方在此审核 / 发布 / 驳回。
// 维护入口在 web-drama 运营后台（非 admin）。后端 /api/me/drama/recipes/**（requireOperator）。
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
      toast.error(e instanceof Error ? e.message : "配方列表加载失败");
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
      toast.success(`已发布「${r.title}」到创意市场`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发布失败");
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
      toast.error(e instanceof Error ? e.message : "驳回失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row gap-2" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)" }}>
        <Boxes size={16} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 800, fontSize: 15 }}>创意审核</span>
        <span className="faint" style={{ fontSize: 12 }}>
          用户自助发布到创意市场的创意 · 待审 {pending.length} · 已上架 {published.length}
        </span>
        <span className="grow" />
        <button type="button" className="btn btn-line btn-sm" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={14} /> 刷新
        </button>
      </div>
      <div className="col gap-2" style={{ padding: 16 }}>
        {loading ? (
          <span className="muted" style={{ fontSize: 13 }}>正在加载配方…</span>
        ) : pending.length === 0 ? (
          <span className="faint" style={{ fontSize: 13 }}>暂无待审创意。用户在「已完成短剧」或「短视频工坊」点「发布到创意中心」后会出现在这里。</span>
        ) : (
          pending.map((r) => {
            const open = expanded === r.id;
            const isRejecting = rejecting === r.id;
            return (
              <div key={r.id} className="card" style={{ padding: 12, background: "var(--surface-2)", border: "none" }}>
                <div className="row gap-3" style={{ alignItems: "flex-start" }}>
                  <span
                    style={{ width: 36, height: 48, borderRadius: 7, flex: "none", overflow: "hidden", background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})` }}
                  >
                    {r.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverImage} alt={r.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    )}
                  </span>
                  <div className="col grow" style={{ minWidth: 0, gap: 3 }}>
                    <div className="row gap-2" style={{ alignItems: "center" }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{r.title}</span>
                      <span className="tag tag-accent" style={{ fontSize: 10.5 }}>{r.type}</span>
                      {r.authorName && (
                        <span className="tag tag-gray" style={{ fontSize: 10.5 }}>来自 @{r.authorName}</span>
                      )}
                      <span className="faint num" style={{ fontSize: 11 }}>{r.episodes} 集 · {r.ratio}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{r.summary || "（无摘要）"}</div>
                    <button
                      type="button"
                      className="row gap-1 faint"
                      style={{ fontSize: 11.5, alignSelf: "flex-start", marginTop: 2 }}
                      onClick={() => setExpanded(open ? null : r.id)}
                    >
                      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} 查看创意结构（{r.data.beats.length} 段节拍）
                    </button>
                    {open && <div style={{ marginTop: 6 }}><RecipeSkeletonView data={r.data} /></div>}
                    {isRejecting && (
                      <div className="row gap-2" style={{ marginTop: 6 }}>
                        <input
                          autoFocus
                          value={note}
                          placeholder="驳回理由（可空，会给到提交人）"
                          onChange={(e) => setNote(e.target.value)}
                          style={{ flex: 1, height: 32, border: "1.5px solid var(--line)", borderRadius: 8, padding: "0 10px", fontSize: 12.5, outline: "none", background: "var(--surface)", color: "var(--ink)" }}
                        />
                        <button type="button" className="btn btn-line btn-sm" disabled={busyId === r.id} onClick={() => void doReject(r)}>确认驳回</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRejecting(null); setNote(""); }}>取消</button>
                      </div>
                    )}
                  </div>
                  {!isRejecting && (
                    <div className="row gap-2" style={{ flex: "none" }}>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === r.id} onClick={() => { setRejecting(r.id); setNote(""); }}>
                        <X size={14} /> 驳回
                      </button>
                      <button type="button" className="btn btn-grad btn-sm" disabled={busyId === r.id} onClick={() => void doPublish(r)}>
                        <Check size={14} /> {busyId === r.id ? "处理中…" : "发布"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 已上架创意（只读巡检）—— 运营可视化任意已发布配方的骨架，含官方内置 / 精选 / 用户自助。 */}
      {!loading && published.length > 0 && (
        <div className="col gap-2" style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--line-soft)" }}>
          <span className="faint" style={{ fontSize: 12, fontWeight: 700 }}>已上架创意 · 只读巡检（{published.length}）</span>
          {published.map((r) => {
            const open = expanded === r.id;
            const originLabel = r.origin === "official" ? "官方内置" : r.origin === "featured" ? "精选" : "用户自助";
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
                    <div className="row gap-2" style={{ alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</span>
                      <span className="tag tag-gray" style={{ fontSize: 10 }}>{originLabel}</span>
                      <span className="faint num" style={{ fontSize: 11 }}>{r.episodes} 集 · {r.ratio} · 套用 {r.useCount}</span>
                    </div>
                    <span className="muted" style={{ fontSize: 12, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.summary || "（无摘要）"}</span>
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
