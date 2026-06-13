"use client";

// 创意库（v0.73 抽 skill 飞轮）—— 平台运营发布的「爆款可复用配方」。
// 用户「套用」即用配方预填一个新项目（mainline + 分集骨架），直接进工作台接着做。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes, Zap } from "lucide-react";
import { RecipesApi } from "@/api";
import type { DramaRecipe } from "@/api/recipes";
import { aiErrorMessage } from "@/lib/ai-error";

export function RecipeLibrarySection() {
  const router = useRouter();
  const [recipes, setRecipes] = React.useState<DramaRecipe[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [applying, setApplying] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    RecipesApi.listPublished()
      .then((r) => alive && setRecipes(r))
      .catch(() => alive && setRecipes([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const apply = async (r: DramaRecipe) => {
    if (applying) return;
    setApplying(r.id);
    try {
      const { projectId } = await RecipesApi.applyRecipe(r.id);
      toast.success(`已套用「${r.title}」,大纲骨架已铺好,接着改就能开拍`);
      router.push(`/projects/${projectId}`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "套用失败，请稍后重试"));
    } finally {
      setApplying(null);
    }
  };

  if (loading || recipes.length === 0) return null; // 无已发布配方则不占位

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
      <div className="row gap-2" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-soft)" }}>
        <Boxes size={16} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 800, fontSize: 14.5 }}>创意库 · 爆款模板</span>
        <span className="faint" style={{ fontSize: 12 }}>平台从爆款短剧抽出的可复用配方 · 一键套用预填新剧</span>
      </div>
      <div className="row" style={{ gap: 12, padding: 14, overflowX: "auto", flexWrap: "nowrap" }}>
        {recipes.map((r) => (
          <div
            key={r.id}
            className="col"
            style={{ width: 220, flex: "none", border: "1px solid var(--line-soft)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}
          >
            <div style={{ height: 84, background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})`, position: "relative" }}>
              <span className="thumb-label" style={{ position: "absolute", top: 8, left: 8 }}>{r.type}</span>
              {r.useCount > 0 && (
                <span className="num" style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,.5)", color: "#fff", fontSize: 10.5, padding: "1px 6px", borderRadius: 6 }}>
                  {r.useCount} 人用过
                </span>
              )}
            </div>
            <div className="col gap-1" style={{ padding: "10px 12px 12px", flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>{r.title}</div>
              <div
                className="faint"
                style={{ fontSize: 11.5, lineHeight: 1.5, flex: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {r.summary || r.data.mainline}
              </div>
              <button
                type="button"
                className="btn btn-grad btn-sm"
                style={{ justifyContent: "center", marginTop: 6 }}
                disabled={applying === r.id}
                onClick={() => void apply(r)}
              >
                <Zap size={13} /> {applying === r.id ? "套用中…" : "套用开拍"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
