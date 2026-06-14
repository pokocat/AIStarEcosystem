"use client";

// 短视频新建控制台（v0.78）—— 首页「短视频 tab」与 /shorts/new 共用同一套，
// 取代旧的 ShortCreateDialog（其模版取的是写死的 SHORT_FORMATS，不是创意中心）。
//
// 模版真源 = 创意市场（已发布 DramaRecipe，单集 episodes≤1）。交互：
//   ① 点创意卡 → 预览弹窗（下方只一个「试试同款」）
//   ② 试试同款 → 以引用 chip 形态进 TipTap 对话框（DramaComposer），用户可再补主题
//   ③ 开始制作 → 扣一笔「进工作台」积分（admin 可配，默认 10）→ 进短视频工厂
//      · 带创意：applyRecipe（后端按创意风格 seed 草稿）+ 自由主题经 sessionStorage 带入
//      · 纯自由点子：直接进工厂新建草稿
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, RefreshCw, Sparkles, Zap } from "lucide-react";
import { CreditMark, dramaConfirm } from "@/components/drama-ui";
import { DramaComposer, type ComposerRef, type DramaComposerHandle } from "./composer";
import { PreviewModal } from "./preview-modal";
import { VideoCover } from "./video-cover";
import { RecipesApi } from "@/api";
import type { DramaRecipe } from "@/api/recipes";
import { useAsync } from "@/lib/drama-query";
import { useDramaCatalog } from "@/lib/use-drama-catalog";
import { useDramaConfig } from "@/lib/use-drama-config";
import { aiErrorMessage } from "@/lib/ai-error";
import { recipeBeats, recipeEstimate, recipePromptSeed, recipeTags } from "./recipe-preview";

/** 把一句话点子一次性带入短视频工厂（不入 URL）。 */
function stashIdea(text: string) {
  if (text && typeof window !== "undefined") sessionStorage.setItem("drama.shorts.idea", text);
}

export function ShortCreateConsole({
  variant = "home",
  initialIdea = "",
}: {
  /** home = 嵌在首页短视频 tab（无返回头/大标题，由首页提供）；standalone = /shorts/new 独立页。 */
  variant?: "home" | "standalone";
  initialIdea?: string;
}) {
  const router = useRouter();
  const composerRef = React.useRef<DramaComposerHandle>(null);
  const inFlight = React.useRef(false); // 同步在途守门：确认弹窗 + 回车可能并发触发，防双扣费
  const [idea, setIdea] = React.useState(initialIdea);
  const [picked, setPicked] = React.useState<DramaRecipe | null>(null);
  const [preview, setPreview] = React.useState<DramaRecipe | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [sparkN, setSparkN] = React.useState(0);

  const cat = useDramaCatalog();
  const cfg = useDramaConfig();
  const recipesQ = useAsync("/me/drama/recipes/published", () => RecipesApi.listPublished());
  const shortRecipes = (recipesQ.data ?? []).filter((r) => r.episodes <= 1);
  const recs = shortRecipes.length
    ? Array.from({ length: Math.min(6, shortRecipes.length) }).map((_, i) => shortRecipes[(page * 6 + i) % shortRecipes.length])
    : [];

  const canStart = idea.trim().length > 0 || !!picked;
  const refs: ComposerRef[] = picked
    ? [{ id: picked.id, kind: "recipe", label: picked.title, sub: picked.type, from: picked.cover.from, to: picked.cover.to }]
    : [];

  const setComposerText = (text: string) => {
    setIdea(text);
    composerRef.current?.setText(text);
  };

  const dailySpark = () => {
    const pool = shortRecipes.length ? shortRecipes : recipesQ.data ?? [];
    if (!pool.length) {
      composerRef.current?.focus();
      return;
    }
    const r = pool[sparkN % pool.length];
    setSparkN((n) => n + 1);
    setComposerText(recipePromptSeed(r));
  };

  /** 试试同款：把创意以引用 chip 形态挂进对话框（不自动填正文，留给用户写自己的主题）。 */
  const tryRecipe = (r: DramaRecipe) => {
    setPicked(r);
    setPreview(null);
    window.setTimeout(() => composerRef.current?.focus(), 0);
    toast.success(`已带入「${r.title}」创意 —— 可再补一句你的主题，或直接开始制作`);
  };

  const start = async () => {
    if (inFlight.current) return; // 同步守门，确认弹窗 + 回车并发也只跑一次
    const text = idea.trim();
    if (!canStart) {
      composerRef.current?.focus();
      return;
    }
    inFlight.current = true;
    setStarting(true);
    try {
      if (picked) {
        // 带创意：后端按创意风格 seed 草稿（含扣费）；自由主题经 sessionStorage 带入工厂。
        const out = await RecipesApi.applyRecipe(picked);
        stashIdea(text);
        if (out.kind === "short") {
          router.push(`/shorts/make?draft=${encodeURIComponent(out.shortId)}`);
        } else {
          router.push(`/projects/${out.projectId}`); // 单集理应回 short；多集兜底跳项目
        }
      } else {
        // 纯自由点子：进工厂新建草稿（扣费在后端 createShort）。
        stashIdea(text);
        router.push("/shorts/make");
      }
      // 成功即导航离开，保持 inFlight=true 不重置（避免离开过程中再触发）。
    } catch (e) {
      inFlight.current = false;
      setStarting(false);
      toast.error(aiErrorMessage(e, "套用创意失败，请重试"));
    }
  };

  /** 进工作台前的统一扣费确认 —— 按钮点击与对话框回车共用，保证「一次确认 + 一次扣费」。 */
  const confirmAndStart = async () => {
    if (inFlight.current || starting) return;
    if (!canStart) {
      composerRef.current?.focus();
      return;
    }
    const cost = cfg.prices.shortEntry;
    // 与 CreditButton 同款：消耗 ≥ 阈值才弹确认；低于阈值小额免打扰直接执行。
    if (cost >= cfg.confirmThreshold) {
      const ok = await dramaConfirm({
        cost,
        title: "开始制作短视频",
        body: "进工作台后 AI 先出口播脚本和分镜，本次消耗如下。",
        confirmLabel: "确认生成",
      });
      if (!ok) return;
    }
    await start();
  };

  return (
    <div className={variant === "standalone" ? "scroll ws-flush" : undefined} style={variant === "standalone" ? { background: "var(--bg)" } : undefined}>
      <div style={variant === "standalone" ? { position: "relative", overflow: "hidden", minHeight: "100%", paddingBottom: 48 } : undefined}>
        {variant === "standalone" && (
          <>
            <div className="home-blob home-blob-a" style={blob(-150, "20%", undefined, 400, "var(--accent)", 16)} />
            <div className="home-blob home-blob-b" style={blob(-90, undefined, "14%", 360, "var(--accent-2)", 13)} />
            <div style={{ position: "relative", maxWidth: 880, margin: "0 auto", padding: "16px 24px 0" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/shorts")}>
                <ChevronLeft size={16} /> 返回短视频工坊
              </button>
            </div>
            <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 28px 0", textAlign: "center", position: "relative" }}>
              <div className="faint" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>新建一条短视频</div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}>
                说句话，AI 出口播脚本和
                <span style={{ background: "linear-gradient(120deg,var(--accent),var(--accent-2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                  分镜
                </span>
              </h1>
              <div className="muted" style={{ marginTop: 8, fontSize: 14.5 }}>
                单条速成 · 竖屏 9:16。从下方<strong style={{ color: "var(--ink-2)" }}>创意推荐</strong>挑个同款定调，再说想法更准。
              </div>
            </div>
          </>
        )}

        <div style={{ maxWidth: variant === "standalone" ? 700 : 760, margin: "0 auto", padding: variant === "standalone" ? "14px 28px 0" : "0", position: "relative", textAlign: "left" }}>
          {/* 对话框 */}
          <div
            className="col"
            style={{
              borderRadius: 20,
              overflow: "hidden",
              background: "var(--surface)",
              border: "1px solid var(--line-soft)",
              boxShadow: "0 18px 50px -24px color-mix(in oklch, var(--accent) 35%, transparent), 0 2px 8px rgba(20,10,50,.04)",
            }}
          >
            <DramaComposer
              ref={composerRef}
              defaultText={initialIdea}
              placeholder="说说你这条短视频想表达什么…例如:一支熬夜也能撑住的精华,油皮姐妹真的别错过（挑个创意「试试同款」可定调风格）"
              refs={refs}
              onRemoveRef={() => setPicked(null)}
              onChange={setIdea}
              onSubmit={() => void confirmAndStart()}
              minHeight={72}
            />

            {/* 近期热点:点一个填进对话框 */}
            <div className="row gap-2" style={{ padding: "4px 14px 0", flexWrap: "wrap", alignItems: "center" }}>
              <span className="row gap-1" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-2)", flex: "none" }}>
                <Zap size={12} /> 近期热点
              </span>
              {cat.hotTopics.map((h) => (
                <button key={h.label} type="button" className="chip" style={{ height: 26, fontSize: 11.5, padding: "0 10px" }} title={h.idea} onClick={() => setComposerText(h.idea)}>
                  {h.label}
                </button>
              ))}
            </div>

            <div className="row gap-2" style={{ padding: "10px 14px 12px", flexWrap: "wrap" }}>
              <button type="button" className="chip" onClick={dailySpark} style={{ background: "var(--accent-soft)", color: "var(--accent)" }} title="随机填个示例点子">
                <Sparkles size={13} /> 给我灵感
              </button>
              <span className="faint" style={{ fontSize: 11, alignSelf: "center" }}>随机来一个</span>
              <span className="grow" />
              <button
                type="button"
                className="btn btn-grad"
                style={{ height: 40, padding: "0 22px", flex: "none", opacity: canStart && !starting ? 1 : 0.5, cursor: canStart && !starting ? "pointer" : "not-allowed" }}
                disabled={!canStart || starting}
                onClick={() => void confirmAndStart()}
              >
                <Zap size={16} /> {starting ? "进入中…" : "开始制作"} <CreditMark tone="inherit" size={15} />
              </button>
            </div>
          </div>

          {/* 创意推荐(创意市场单集创意) */}
          <div className="row" style={{ marginTop: 22, marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>创意推荐</span>
            <span className="faint" style={{ fontSize: 12, marginLeft: 8 }}>点卡片看成片预览,「试试同款」带进对话框就做</span>
            <span className="grow" />
            {shortRecipes.length > 6 && (
              <button type="button" className="chip" onClick={() => setPage((p) => p + 1)}>
                <RefreshCw size={12} /> 换一批
              </button>
            )}
          </div>

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
                  <span className="thumb-label num" style={{ position: "absolute", top: 8, right: 8 }}>单集</span>
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
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>创意推荐直接来自创意市场；稍等片刻即可显示已上架的单集创意。</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {preview && (
        <PreviewModal
          item={{
            cover: { from: preview.cover.from, to: preview.cover.to, src: preview.coverImage },
            previewVideo: preview.previewVideo,
            title: preview.title,
            cat: preview.type,
            desc: preview.summary || preview.data?.mainline || "试试同款后会按这个创意的风格帮你拆主题。",
            tags: recipeTags(preview),
            beats: recipeBeats(preview),
            estimate: recipeEstimate(preview),
            coverLabel: "效果预览 · 同款成片片段",
          }}
          onClose={() => setPreview(null)}
          actions={[
            { label: "试试同款", icon: <Zap size={15} />, variant: "grad", onClick: () => tryRecipe(preview) },
          ]}
        />
      )}
    </div>
  );
}

/** 氛围光斑（standalone hero 背景）。 */
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
