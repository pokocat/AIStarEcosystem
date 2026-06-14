"use client";

export const dynamic = "force-dynamic";

// 我发布的创意（v0.75）—— 创意市场的子页。
// 汇总当前用户名下的所有 Recipe：自助发布的（submitted/published/rejected）
// 与运营邀请精选的（invited 待授权 / declined）。invited 行可一键「授权 / 谢绝」。
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Check, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { RecipesApi } from "@/api";
import type { DramaRecipe, RecipeStatus } from "@/api/recipes";
import { aiErrorMessage } from "@/lib/ai-error";

const STATUS_META: Record<RecipeStatus, { label: string; tone: string; bg: string }> = {
  draft: { label: "草稿", tone: "var(--ink-3)", bg: "var(--surface-2)" },
  submitted: { label: "审核中", tone: "#b45309", bg: "rgba(245,158,11,.14)" },
  invited: { label: "运营邀请 · 待你授权", tone: "var(--accent)", bg: "var(--accent-soft)" },
  published: { label: "已上架", tone: "#047857", bg: "rgba(16,185,129,.14)" },
  rejected: { label: "已驳回", tone: "#b91c1c", bg: "rgba(239,68,68,.12)" },
  declined: { label: "已谢绝", tone: "var(--ink-3)", bg: "var(--surface-2)" },
};

export default function MyPublishedPage() {
  const router = useRouter();
  const [list, setList] = React.useState<DramaRecipe[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setList(await RecipesApi.listMine());
    } catch (e) {
      toast.error(aiErrorMessage(e, "加载失败"));
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
      toast.success(approve ? `已授权「${r.title}」进入创意市场` : `已谢绝「${r.title}」的精选邀请`);
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
        <ArrowLeft size={15} /> 返回创意市场
      </button>
      <div className="row" style={{ marginBottom: 18 }}>
        <div className="grow">
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>我发布的创意</h1>
          <div className="muted" style={{ marginTop: 4 }}>你发布到创意市场的作品 + 运营对你的精选邀请,都在这里</div>
        </div>
        <button type="button" className="btn btn-line btn-sm" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={14} /> 刷新
        </button>
      </div>

      {invites.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 20, border: "1.5px solid var(--accent)" }}>
          <div className="row gap-2" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)", background: "var(--accent-soft)" }}>
            <Boxes size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 800, fontSize: 14, color: "var(--accent)" }}>运营想精选你的作品 · {invites.length}</span>
          </div>
          <div className="col gap-2" style={{ padding: 14 }}>
            {invites.map((r) => (
              <div key={r.id} className="row gap-3" style={{ alignItems: "center", padding: 10, borderRadius: 10, background: "var(--surface-2)" }}>
                <span style={{ width: 40, height: 54, borderRadius: 7, flex: "none", background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})` }} />
                <div className="col grow" style={{ minWidth: 0, gap: 2 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.title}</div>
                  <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                    授权后将公开供他人套用,并署名「来自你」。{r.summary || r.data?.mainline || ""}
                  </div>
                </div>
                <div className="row gap-2" style={{ flex: "none" }}>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === r.id} onClick={() => void respond(r, false)}>
                    <X size={14} /> 谢绝
                  </button>
                  <button type="button" className="btn btn-grad btn-sm" disabled={busyId === r.id} onClick={() => void respond(r, true)}>
                    <Check size={14} /> {busyId === r.id ? "处理中…" : "授权精选"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
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
          <div style={{ fontWeight: 700 }}>你还没有发布过创意</div>
          <div className="faint" style={{ fontSize: 12.5 }}>在「已完成短剧」的成片预览里点「发布到创意市场」,通过审核后就会出现在创意市场。</div>
        </div>
      ) : (
        <div className="col gap-2">
          {mine.map((r) => {
            const m = STATUS_META[r.status] ?? STATUS_META.submitted;
            return (
              <div key={r.id} className="card row gap-3" style={{ padding: 12, alignItems: "center" }}>
                <span style={{ width: 40, height: 54, borderRadius: 7, flex: "none", overflow: "hidden", background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})` }}>
                  {r.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverImage} alt={r.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                </span>
                <div className="col grow" style={{ minWidth: 0, gap: 3 }}>
                  <div className="row gap-2" style={{ alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</span>
                    <span className="tag tag-gray" style={{ fontSize: 10.5 }}>{r.type}</span>
                    <span className="num faint" style={{ fontSize: 11 }}>{r.episodes} 集 · {r.ratio}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.summary || r.data?.mainline || "—"}
                  </div>
                  {r.status === "rejected" && r.reviewNote && (
                    <div style={{ fontSize: 11.5, color: "#b91c1c" }}>驳回原因：{r.reviewNote}</div>
                  )}
                </div>
                <div className="col" style={{ flex: "none", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: m.tone, background: m.bg, padding: "3px 10px", borderRadius: 999 }}>{m.label}</span>
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
