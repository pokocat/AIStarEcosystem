"use client";

export const dynamic = "force-dynamic";

// 我发布的模板（v0.75 起；v0.197 统一叫法）—— 模板广场的子页。
// 汇总当前用户名下的所有 Recipe：自助发布的（submitted/published/rejected）
// 与平台邀请公开的（invited 待同意 / declined）。invited 行可一键「同意公开 / 不同意」。
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Check, Clapperboard, Film, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { RecipesApi } from "@/api";
import type { DramaRecipe, RecipeStatus } from "@/api/recipes";
import { aiErrorMessage } from "@/lib/ai-error";

const STATUS_META: Record<RecipeStatus, { label: string; tone: string; bg: string }> = {
  draft: { label: "草稿", tone: "var(--ink-3)", bg: "var(--surface-2)" },
  submitted: { label: "审核中", tone: "#b45309", bg: "rgba(245,158,11,.14)" },
  invited: { label: "平台邀请你公开", tone: "var(--accent)", bg: "var(--accent-soft)" },
  published: { label: "已公开", tone: "#047857", bg: "rgba(16,185,129,.14)" },
  rejected: { label: "没通过", tone: "#b91c1c", bg: "rgba(239,68,68,.12)" },
  declined: { label: "已拒绝", tone: "var(--ink-3)", bg: "var(--surface-2)" },
};

export default function MyPublishedPage() {
  const router = useRouter();
  const [list, setList] = React.useState<DramaRecipe[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setList(await RecipesApi.listMine());
    } catch (e) {
      // 网络 / 服务错误单独呈现「加载失败 + 重试」，不与「还没有发布过模板」空态混淆。
      setError(aiErrorMessage(e, "没加载出来，请重试"));
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const respond = async (r: DramaRecipe, approve: boolean) => {
    if (busyId) return;
    setBusyId(r.id);
    try {
      await RecipesApi.respondInvite(r.id, approve);
      toast.success(approve ? `已同意公开「${r.title}」` : `已拒绝「${r.title}」的邀请`);
      await load();
    } catch (e) {
      toast.error(aiErrorMessage(e, "操作失败，请重试"));
    } finally {
      setBusyId(null);
    }
  };

  const invites = list.filter((r) => r.status === "invited");
  const mine = list.filter((r) => r.status !== "invited");

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => router.push("/templates")}>
        <ArrowLeft size={15} /> 返回模板广场
      </button>
      <div className="row" style={{ marginBottom: 18, gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="grow" style={{ minWidth: 0, flex: "1 1 240px" }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>我发布的模板</h1>
          <div className="muted" style={{ marginTop: 4 }}>你提交的模板和审核进度，还有平台发给你的公开邀请</div>
        </div>
        <button type="button" className="btn btn-line btn-sm" style={{ flex: "none" }} disabled={loading} onClick={() => void load()}>
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {invites.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 20, border: "1.5px solid var(--accent)" }}>
          <div className="row gap-2" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)", background: "var(--accent-soft)" }}>
            <Boxes size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 800, fontSize: 14, color: "var(--accent)" }}>平台邀请 · {invites.length}</span>
          </div>
          <div className="col gap-2" style={{ padding: 14 }}>
            {invites.map((r) => (
              <div key={r.id} className="row gap-3 mk-pub-row" style={{ alignItems: "center", padding: 10, borderRadius: 10, background: "var(--surface-2)" }}>
                <span style={{ width: 40, height: 54, borderRadius: 7, flex: "none", background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})` }} />
                <div className="col grow" style={{ minWidth: 0, gap: 2 }}>
                  <div title={r.title} style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                    同意后别人能用它做同款，模板上会署你的名字。{r.summary || r.data?.mainline || ""}
                  </div>
                </div>
                <div className="row gap-2 mk-pub-actions" style={{ flex: "none" }}>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === r.id} onClick={() => void respond(r, false)}>
                    <X size={14} /> 不同意
                  </button>
                  <button type="button" className="btn btn-grad btn-sm" disabled={busyId === r.id} onClick={() => void respond(r, true)}>
                    <Check size={14} /> {busyId === r.id ? "处理中…" : "同意公开"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && !loading ? (
        <div className="card col center" style={{ padding: 40, gap: 12, textAlign: "center" }}>
          <div className="muted" style={{ fontSize: 13.5 }}>{error}</div>
          <button type="button" className="btn btn-line btn-sm" onClick={() => void load()}>重试</button>
        </div>
      ) : loading ? (
        <div className="col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 14 }}>
              <div className="skel" style={{ height: 12, width: "50%", marginBottom: 8 }} />
              <div className="skel" style={{ height: 8, width: "80%" }} />
            </div>
          ))}
        </div>
      ) : mine.length === 0 && invites.length === 0 ? (
        <div className="card col center" style={{ padding: 40, gap: 8, textAlign: "center" }}>
          <Boxes size={26} style={{ color: "var(--ink-3)" }} />
          <div style={{ fontWeight: 700 }}>你还没有发布过模板</div>
          <div className="faint" style={{ fontSize: 12.5, maxWidth: 440, lineHeight: 1.6 }}>
            在「我的短剧」或「我的短视频」里打开一部做好的作品，在成片预览里点「发布成模板」。审核通过后会出现在模板广场。
          </div>
          <div className="row gap-2" style={{ marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" className="btn btn-line btn-sm" onClick={() => router.push("/projects")}>
              <Clapperboard size={14} /> 去我的短剧
            </button>
            <button type="button" className="btn btn-line btn-sm" onClick={() => router.push("/shorts")}>
              <Film size={14} /> 去我的短视频
            </button>
          </div>
        </div>
      ) : (
        <div className="col gap-2">
          {mine.map((r) => {
            const m = STATUS_META[r.status] ?? STATUS_META.submitted;
            return (
              <div key={r.id} className="card row gap-3 mk-pub-row" style={{ padding: 12, alignItems: "center" }}>
                <span style={{ width: 40, height: 54, borderRadius: 7, flex: "none", overflow: "hidden", background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})` }}>
                  {r.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverImage} alt={r.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                </span>
                <div className="col grow" style={{ minWidth: 0, gap: 3 }}>
                  <div className="row gap-2" style={{ alignItems: "center", minWidth: 0 }}>
                    <span title={r.title} style={{ fontWeight: 700, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                    <span className="tag tag-gray" style={{ fontSize: 10.5, flex: "none" }}>{r.type}</span>
                    <span className="num faint" style={{ fontSize: 11, flex: "none" }}>{r.episodes > 1 ? `${r.episodes} 集` : "单条"} · {r.ratio}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.summary || r.data?.mainline || "—"}
                  </div>
                  {r.status === "rejected" && r.reviewNote && (
                    <div style={{ fontSize: 11.5, color: "#b91c1c" }}>没通过的原因：{r.reviewNote}</div>
                  )}
                </div>
                <div className="col mk-pub-actions" style={{ flex: "none", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: m.tone, background: m.bg, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{m.label}</span>
                  {r.status === "published" && r.useCount > 0 && (
                    <span className="faint num" style={{ fontSize: 11 }}>{r.useCount} 人用过</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
