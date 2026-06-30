"use client";

// 首页 · AI 开拍 — 设计真源 AI短剧工作台.dc.html：
// chatOff（落地）: 一句话点子 → 开始脑暴；近期热点 / 今日灵感 / 套爆款模板 / 跟 AI 聊出故事；
//                  爆款配方推荐 + 继续上次 + 继续脑暴。
// chatOn（?b=<id>）: 左 AI 脑暴对话 / 右 可编辑故事大纲 → 去制作（BrainstormStudio）。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Clock,
  Edit,
  Layers,
  RefreshCw,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import { stageNameByNo } from "@/components/drama-workshop/stages-config";
import { PreviewModal } from "@/components/drama-workshop/preview-modal";
import { VideoCover } from "@/components/drama-workshop/video-cover";
import { BrainstormStudio } from "@/components/drama-workshop/home/brainstorm-studio";
import { recipeBeats, recipeEstimate, recipePromptSeed, recipeTags } from "@/components/drama-workshop/recipe-preview";
import { BrainstormApi, ProjectsApi, RecipesApi } from "@/api";
import type { DramaRecipe } from "@/api/recipes";
import { useAsync } from "@/lib/drama-query";
import { useDramaCatalog } from "@/lib/use-drama-catalog";
import { aiErrorMessage } from "@/lib/ai-error";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export default function HomePage() {
  return (
    <React.Suspense fallback={<div style={{ minHeight: 200 }} />}>
      <DashboardSwitch />
    </React.Suspense>
  );
}

function DashboardSwitch() {
  const search = useSearchParams();
  const b = search?.get("b");
  if (b) return <BrainstormStudio id={b} />;
  return <HomeLanding />;
}

function HomeLanding() {
  const router = useRouter();
  const [idea, setIdea] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [sparkN, setSparkN] = React.useState(0);
  const [preview, setPreview] = React.useState<DramaRecipe | null>(null);
  const [applyingId, setApplyingId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const starting = React.useRef(false); // 防连点重复建脑暴
  const cat = useDramaCatalog(); // 运营可维护的「近期热点 / 创意推荐」
  // 热点可能配置很多条，首页只随机展示 3 条（每次进页随机一批，不随渲染抖动）。
  const hotPicks = React.useMemo(() => {
    const all = cat.hotTopics ?? [];
    if (all.length <= 3) return all;
    return [...all].sort(() => Math.random() - 0.5).slice(0, 3);
  }, [cat.hotTopics]);
  const recipesQ = useAsync("/me/drama/recipes/published", () => RecipesApi.listPublished());
  const publishedRecipes = recipesQ.data ?? [];
  // 首页爆款配方：优先官方首页位（rcp-official-home-*），取 6 条。
  const recipePool = [...publishedRecipes].sort(
    (a, b) => Number(b.id.startsWith("rcp-official-home-")) - Number(a.id.startsWith("rcp-official-home-")),
  );
  const recs = recipePool.length
    ? Array.from({ length: Math.min(6, recipePool.length) }).map((_, i) => recipePool[(page * 6 + i) % recipePool.length])
    : [];
  const projectsQ = useAsync("/me/drama/projects", () => ProjectsApi.listProjects());
  const main = projectsQ.data?.find((p) => p.episodes > 1) ?? projectsQ.data?.[0];
  const brainstormsQ = useAsync("/me/drama/brainstorms", () => BrainstormApi.listBrainstorms());
  const recentBrainstorms = (brainstormsQ.data ?? []).filter((x) => x.status === "draft").slice(0, 3);

  // 一句话点子 → 新建脑暴会话 → 进 chatOn（?b=id）。空点子也可开始（纯聊）。
  const startBrainstorm = async (seed?: string) => {
    if (starting.current) return;
    starting.current = true;
    try {
      const detail = await BrainstormApi.createBrainstorm(seed?.trim() || undefined);
      router.push(`/dashboard?b=${encodeURIComponent(detail.meta.id)}`);
    } catch (e) {
      starting.current = false;
      toast.error(aiErrorMessage(e, "开始脑暴失败，请重试"));
    }
  };
  const submit = () => {
    if (!idea.trim()) {
      inputRef.current?.focus();
      return;
    }
    void startBrainstorm(idea.trim());
  };
  const fillRec = (r: DramaRecipe) => {
    setIdea(recipePromptSeed(r));
    setPreview(null);
    inputRef.current?.focus();
  };
  const dailySpark = () => {
    const pool = recipePool.length ? recipePool : publishedRecipes;
    if (!pool.length) {
      inputRef.current?.focus();
      return;
    }
    const r = pool[sparkN % pool.length];
    setSparkN((n) => n + 1);
    setIdea(recipePromptSeed(r));
    inputRef.current?.focus();
  };
  const applyRecipe = async (r: DramaRecipe) => {
    setApplyingId(r.id);
    try {
      const out = await RecipesApi.applyRecipe(r);
      setPreview(null);
      if (out.kind === "short") {
        router.push(`/shorts/make?draft=${encodeURIComponent(out.shortId)}`);
        toast.success(`已套用「${r.title}」创意，前往短视频工坊继续`);
      } else {
        router.push(`/projects/${out.projectId}`);
        toast.success(`已套用「${r.title}」创意，已生成项目骨架`);
      }
    } catch (e) {
      toast.error(aiErrorMessage(e, "套用创意失败，请重试"));
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="scroll ws-flush" style={{ background: "var(--bg)" }}>
      <div style={{ position: "relative", overflow: "hidden", paddingBottom: 48 }}>
        <div className="home-blob home-blob-a" style={blob(-160, "18%", undefined, 420, "var(--accent)", 16)} />
        <div className="home-blob home-blob-b" style={blob(-100, undefined, "12%", 380, "var(--accent-2)", 13)} />
        <div className="home-blob home-blob-c" style={{ ...blob(60, "46%", undefined, 300, "var(--accent)", 10) }} />

        <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 40px 8px", position: "relative", textAlign: "center" }}>
          <div className="faint" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>{greeting()}，创作者</div>
          <h1 style={{ margin: 0, fontSize: 31, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}>
            还没想好做什么？
            <span style={{ background: "linear-gradient(120deg,var(--accent),var(--accent-2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              先跟 AI 聊聊
            </span>
          </h1>
          <div className="muted" style={{ marginTop: 8, fontSize: 14.5 }}>
            有个模糊的念头就够：一个画面、一句台词，或最近刷到的灵感。和 AI 一起脑暴，逐步发展成一部短剧
          </div>

          {/* 对话框 · 轻盈质感 */}
          <div
            className="col"
            style={{
              marginTop: 18,
              borderRadius: 20,
              overflow: "hidden",
              textAlign: "left",
              background: "var(--surface)",
              border: "1px solid var(--line-soft)",
              boxShadow: "0 18px 50px -24px color-mix(in oklch, var(--accent) 35%, transparent), 0 2px 8px rgba(20,10,50,.04)",
            }}
          >
            <textarea
              ref={inputRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="说说你的想法：一个画面、一句台词，或最近刷到的灵感…（没有头绪可点下方「今日灵感」）"
              style={{ width: "100%", minHeight: 76, border: "none", outline: "none", resize: "none", padding: "14px 18px 4px", fontSize: 14.5, lineHeight: 1.6, background: "transparent", fontFamily: "inherit" }}
            />

            {/* 近期热点：点一个填进输入框 */}
            <div className="row gap-2" style={{ padding: "4px 14px 0", flexWrap: "wrap", alignItems: "center" }}>
              <span className="row gap-1" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-2)", flex: "none" }}>
                <Zap size={12} /> 近期热点
              </span>
              {hotPicks.map((h) => (
                <button
                  key={h.label}
                  type="button"
                  className="chip"
                  style={{ height: 26, fontSize: 11.5, padding: "0 10px" }}
                  title={h.idea}
                  onClick={() => {
                    setIdea(h.idea);
                    inputRef.current?.focus();
                  }}
                >
                  {h.label}
                </button>
              ))}
            </div>

            <div className="row gap-2" style={{ padding: "10px 14px 12px", flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" className="chip" onClick={dailySpark} style={{ background: "var(--accent-soft)", color: "var(--accent)" }} title="AI 随机给一个创意">
                <Sparkles size={13} /> 今日灵感
              </button>
              <button type="button" className="chip" onClick={() => router.push("/templates")}>
                <Layers size={13} /> 套爆款模板
              </button>
              <button type="button" className="chip" onClick={() => void startBrainstorm()}>
                <Wand2 size={13} /> 跟 AI 聊出故事
              </button>
              <span className="grow" />
              <button type="button" className="btn btn-grad" onClick={submit} style={{ height: 40, padding: "0 22px", flex: "none" }}>
                <Wand2 size={16} /> 开始脑暴
              </button>
            </div>
          </div>

          {/* 继续脑暴（未完成的脑暴草稿） */}
          {recentBrainstorms.length > 0 && (
            <div className="row gap-2" style={{ marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <span className="faint" style={{ fontSize: 11.5, fontWeight: 700, alignSelf: "center" }}>继续脑暴</span>
              {recentBrainstorms.map((bs) => (
                <button
                  key={bs.id}
                  type="button"
                  className="chip"
                  onClick={() => router.push(`/dashboard?b=${encodeURIComponent(bs.id)}`)}
                  title={`${bs.messageCount} 条对话${bs.hasOutline ? " · 已出大纲" : ""}`}
                  style={{ maxWidth: 220 }}
                >
                  <Sparkles size={12} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bs.title}</span>
                </button>
              ))}
            </div>
          )}

          <div className="row" style={{ marginTop: 22, marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>没有灵感？看看热门配方</span>
            <span className="faint" style={{ fontSize: 12, marginLeft: 8 }}>点击卡片预览效果，或填入对话框继续编辑</span>
            <span className="grow" />
            {recipePool.length > 6 && (
              <button type="button" className="chip" onClick={() => setPage((p) => p + 1)}>
                <RefreshCw size={12} /> 换一批
              </button>
            )}
          </div>
        </div>

        {/* 封面式创意卡 */}
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 40px", position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(158px,1fr))", gap: 14 }}>
            {recs.map((r, i) => (
              <button
                key={r.id}
                type="button"
                className="card col fade-up"
                onClick={() => setPreview(r)}
                style={{ padding: 0, overflow: "hidden", textAlign: "left", animationDelay: i * 35 + "ms", transition: "transform .15s, box-shadow .15s" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-lg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                }}
              >
                <VideoCover from={r.cover.from} to={r.cover.to} src={r.coverImage} ratio="3/4" label="效果预览">
                  <span className="thumb-label" style={{ position: "absolute", top: 8, left: 8 }}>{r.type}</span>
                  <span className="thumb-label num" style={{ position: "absolute", top: 8, right: 8 }}>
                    {r.episodes > 1 ? `${r.episodes}集` : "单集"}
                  </span>
                </VideoCover>
                <div className="col gap-1" style={{ padding: "11px 13px 13px" }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{r.title}</div>
                  <div className="faint" style={{ fontSize: 12, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {r.summary || r.data?.mainline}
                  </div>
                </div>
              </button>
            ))}
            {recs.length === 0 && (
              <div className="card col gap-2" style={{ padding: 18, minHeight: 180, justifyContent: "center" }}>
                <Sparkles size={18} style={{ color: "var(--accent)" }} />
                <div style={{ fontWeight: 800 }}>正在同步创意市场</div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                  创意推荐现在直接来自创意市场；稍等片刻即可显示已上架创意。
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 继续上次（轻量入口，完整列表在「短剧工坊」） */}
        {main && (
          <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 40px 0", position: "relative" }}>
            <button
              type="button"
              className="card row gap-4 fade-up"
              onClick={() => router.push(`/projects/${main.id}`)}
              style={{ width: "100%", padding: 13, textAlign: "left", alignItems: "center" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-lg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
            >
              <Thumb from={main.cover.from} to={main.cover.to} w={42} ratio="9/16" radius={9} stripes={false} />
              <div className="col gap-1 grow" style={{ minWidth: 0 }}>
                <div className="row gap-2">
                  <span className="tag tag-accent">
                    <Clock size={11} /> 继续上次
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 14.5 }}>{main.title}</span>
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  上次做到「{stageNameByNo(main.stage)}」· {main.updated}更新
                </div>
              </div>
              <span className="btn btn-primary btn-sm" style={{ flex: "none" }}>
                继续制作 <ArrowRight size={14} />
              </span>
            </button>
          </div>
        )}
      </div>

      {preview && (
        <PreviewModal
          item={{
            cover: { from: preview.cover.from, to: preview.cover.to, src: preview.coverImage },
            previewVideo: preview.previewVideo,
            title: preview.title,
            cat: preview.type,
            desc: preview.summary || preview.data?.mainline || "套用后会生成可编辑的项目骨架。",
            personal: preview.id.startsWith("rcp-official-home-single-mother"),
            tags: recipeTags(preview),
            beats: recipeBeats(preview),
            estimate: recipeEstimate(preview),
            coverLabel: "效果预览 · 同题材成片片段",
          }}
          onClose={() => setPreview(null)}
          actions={[
            { label: "填入对话框编辑", icon: <Edit size={15} />, variant: "line", onClick: () => fillRec(preview) },
            {
              label: applyingId === preview.id ? "套用中…" : "套用并开拍",
              icon: <Zap size={15} />,
              variant: "grad",
              cost: 6,
              onClick: () => void applyRecipe(preview),
            },
          ]}
        />
      )}
    </div>
  );
}

function blob(top: number, left: string | undefined, right: string | undefined, size: number, color: string, pct: number): React.CSSProperties {
  return {
    position: "absolute",
    top,
    left,
    right,
    width: size,
    height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle, color-mix(in oklch, ${color} ${pct}%, transparent), transparent 70%)`,
    pointerEvents: "none",
  };
}
