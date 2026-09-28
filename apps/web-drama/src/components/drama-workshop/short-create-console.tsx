"use client";

// 短视频新建控制台（v0.78）—— 首页「短视频 tab」与 /shorts/new 共用同一套，
// 取代旧的 ShortCreateDialog（其模版取的是写死的 SHORT_FORMATS，不是创意市场）。
//
// 模版真源 = 模板广场（已发布 DramaRecipe，单集 episodes≤1）。交互：
//   ① 点模板卡 → 预览弹窗（下方只一个「做同款」）
//   ② 做同款 → 以引用 chip 形态进 TipTap 对话框（DramaComposer），用户可再补主题（不花积分）
//   ③ 开始制作 → 扣一笔「进工作台」积分（admin 可配，默认 10）→ 进短视频工厂
//      · 带创意：applyRecipe（后端按创意风格 seed 草稿）+ 自由主题经 sessionStorage 带入
//      · 纯自由点子：直接进工厂新建草稿
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, ClipboardPaste, RefreshCw, Sparkles, Zap } from "lucide-react";
import { CreditMark } from "@/components/drama-ui";
import { SHORT_START_LEAD, confirmShortStart } from "./short-start-confirm";
import { DramaComposer, type ComposerRef, type DramaComposerHandle } from "./composer";
import { PreviewModal } from "./preview-modal";
import { VideoCover } from "./video-cover";
import { RecipesApi } from "@/api";
import { newClientRequestId } from "@/api/shorts";
import type { DramaRecipe } from "@/api/recipes";
import { useAsync } from "@/lib/drama-query";
import { useDramaCatalog } from "@/lib/use-drama-catalog";
import { HotTopicChips } from "@/components/drama-workshop/hot-topic-chips";
import { useDramaConfig } from "@/lib/use-drama-config";
import { aiErrorMessage } from "@/lib/ai-error";
import { notifyWalletChanged } from "@/lib/use-wallet";
import { recipeBeats, recipeEstimate, recipeTags } from "./recipe-preview";
import type { IdeaRec } from "@/mocks/drama-workshop";

/** 「随机来一个」的取法：推荐点子里跳过个人向（「把我自己的经历……」要用户自己填）和没写钩子的，
 *  按第 n 次点击轮流取一条的钩子；池子空时返回 null。按顺序而不是真随机：
 *  连点几下能看完整个池子，不会连着两次抽到同一条。 */
export function pickSparkIdea(ideas: readonly IdeaRec[], n: number): string | null {
  const pool = ideas.filter((r) => !r.personal && r.hook?.trim()); // 运营配的 JSON 可能缺字段
  if (!pool.length) return null;
  return pool[n % pool.length].hook;
}

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
  // 幂等键：失败重试沿用同一个，服务端按它查重，避免重复扣开拍费（网络层丢响应时的双扣）。
  const requestIdRef = React.useRef<string | null>(null);
  const [idea, setIdea] = React.useState(initialIdea);
  const [picked, setPicked] = React.useState<DramaRecipe | null>(null);
  const [preview, setPreview] = React.useState<DramaRecipe | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [sparkN, setSparkN] = React.useState(0);

  const cat = useDramaCatalog();
  const cfg = useDramaConfig();
  const recipesQ = useAsync("/me/drama/recipes/published", () => RecipesApi.listPublished());
  const [needIdea, setNeedIdea] = React.useState(false);
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
    setNeedIdea(false);
    composerRef.current?.setText(text);
  };

  // 「随机来一个」：按顺序轮流从运营维护的推荐点子里取一条（与新建短剧 create-dialog 同一个池子）。
  // 以前取的是模板的风格描述（recipePromptSeed），填进去的是「怎么拍」而不是「拍什么」。
  const dailySpark = () => {
    const hook = pickSparkIdea(cat.ideas, sparkN);
    if (!hook) {
      composerRef.current?.focus();
      return;
    }
    setSparkN((n) => n + 1);
    setComposerText(hook);
  };

  /** 做同款：把模板以引用 chip 形态挂进对话框（不自动填正文，留给用户写自己的主题）。这一步不花积分。 */
  const tryRecipe = (r: DramaRecipe) => {
    setPicked(r);
    setNeedIdea(false);
    setPreview(null);
    window.setTimeout(() => composerRef.current?.focus(), 0);
    toast.success(`已选好「${r.title}」模板。再写一句你想拍什么，或者直接点「开始制作」`);
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
    // 两条分支都扣同一笔开拍费，都要带幂等键：失败重试沿用同一把，服务端按 (owner,key) 查重。
    if (!requestIdRef.current) requestIdRef.current = newClientRequestId();
    try {
      if (picked) {
        // 带创意：后端按创意风格 seed 草稿（含扣费）；自由主题经 sessionStorage 带入工厂。
        const out = await RecipesApi.applyRecipe(picked, requestIdRef.current);
        notifyWalletChanged(); // 这一步已经扣了开拍费
        stashIdea(text);
        if (out.kind === "short") {
          router.push(`/shorts/make?draft=${encodeURIComponent(out.shortId)}`);
        } else {
          router.push(`/projects/${out.projectId}`); // 单集理应回 short；多集兜底跳项目
        }
      } else {
        // 纯自由点子：进工厂新建草稿（扣费在后端 createShort）。
        // 草稿由 /shorts/make 的网关创建，幂等键随 sessionStorage 一并带过去。
        stashIdea(text);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("drama.shorts.createKey", requestIdRef.current);
        }
        router.push("/shorts/make");
      }
      // 成功即导航离开，保持 inFlight=true 不重置（避免离开过程中再触发）。
    } catch (e) {
      inFlight.current = false;
      setStarting(false);
      toast.error(aiErrorMessage(e, "没能开始制作，请重试"));
    }
  };

  /** 进工作台前的统一扣费确认 —— 按钮点击与对话框回车共用，保证「一次确认 + 一次扣费」。 */
  const confirmAndStart = async () => {
    if (inFlight.current || starting) return;
    if (!canStart) {
      // 按钮不置灰：空着点一下就地说明要做什么（手机上没有 hover，title 看不到）。
      setNeedIdea(true);
      composerRef.current?.focus();
      return;
    }
    // 扣费确认全站只走 confirmShortStart（阈值语义与 CreditButton 一致：低于阈值直接放行）。
    const ok = await confirmShortStart(cfg, SHORT_START_LEAD.fromIdea);
    if (!ok) return;
    await start();
  };

  return (
    <div className={variant === "standalone" ? "scroll ws-flush" : undefined} style={variant === "standalone" ? { background: "var(--bg)" } : undefined}>
      <div style={variant === "standalone" ? { position: "relative", overflow: "hidden", minHeight: "100%", paddingBottom: 48 } : undefined}>
        {variant === "standalone" && (
          <>
            <div className="home-blob home-blob-a" style={blob(-150, "20%", undefined, 400, "var(--accent)", 16)} />
            <div className="home-blob home-blob-b" style={blob(-90, undefined, "14%", 360, "var(--accent-2)", 13)} />
            <div className="se-new-back-row" style={{ position: "relative", maxWidth: 880, margin: "0 auto" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/shorts")}>
                <ChevronLeft size={16} /> 返回我的短视频
              </button>
            </div>
            <div className="se-new-hero" style={{ maxWidth: 700, margin: "0 auto", textAlign: "center", position: "relative" }}>
              <div className="faint" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>从一句话开始</div>
              <h1 className="se-new-hero-title" style={{ margin: 0, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}>
                <span className="se-new-keep">写一句想法，</span>
                <span className="se-new-keep">
                  AI 写好脚本和
                  <span style={{ background: "linear-gradient(120deg,var(--accent),var(--accent-2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                    分镜
                  </span>
                </span>
              </h1>
              <div className="muted" style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.7, textWrap: "pretty" }}>
                做出来是一条竖屏 9:16 的短视频。想要某种风格，在下面挑一个<strong style={{ color: "var(--ink-2)" }}>模板</strong>「做同款」。
              </div>
            </div>
          </>
        )}

        <div className={variant === "standalone" ? "se-new-body" : undefined} style={{ maxWidth: variant === "standalone" ? 700 : 760, margin: "0 auto", padding: variant === "standalone" ? undefined : "0", position: "relative", textAlign: "left" }}>
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
              placeholder="想拍什么？例如：一支熬夜也能撑住的精华，油皮姐妹别错过"
              refs={refs}
              onRemoveRef={() => setPicked(null)}
              onChange={(v) => {
                setIdea(v);
                if (v.trim()) setNeedIdea(false);
              }}
              onSubmit={() => void confirmAndStart()}
              minHeight={72}
            />

            {/* 近期热点:点一个填进对话框。不打乱顺序：服务端渲染和浏览器随机结果不同会报 hydration 错。 */}
            <HotTopicChips topics={cat.hotTopics} onPick={setComposerText} />

            <div className="row gap-2" style={{ padding: "10px 14px 12px", flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" className="chip" onClick={dailySpark} style={{ background: "var(--accent-soft)", color: "var(--accent)" }} title="按顺序从推荐点子里取一条填进去">
                <Sparkles size={13} /> 随机来一个
              </button>
              <span className="grow" />
              <button
                type="button"
                className="btn btn-grad"
                style={{ height: 40, padding: "0 22px", flex: "none", opacity: canStart && !starting ? 1 : 0.6, cursor: starting ? "not-allowed" : "pointer" }}
                disabled={starting}
                aria-busy={starting}
                onClick={() => void confirmAndStart()}
              >
                <Zap size={16} /> {starting ? "正在打开…" : "开始制作"} <CreditMark tone="inherit" size={15} label={cfg.prices.shortEntry} />
              </button>
            </div>
            {needIdea && !canStart && (
              <div className="faint" role="status" style={{ padding: "0 14px 12px", fontSize: 12, textAlign: "right", color: "var(--accent-2)" }}>
                先写一句想拍什么，或者从下面的模板里选一个
              </div>
            )}
          </div>

          {/* v0.143：已经写好整段脚本的用户走「粘贴写好的脚本」，不必在这里再跟 AI 聊一遍 */}
          <button
            type="button"
            className="row gap-2 se-new-paste-entry"
            onClick={() => router.push("/shorts/prompt")}
          >
            <ClipboardPaste size={15} style={{ color: "var(--accent-2)", flex: "none" }} />
            <span className="se-new-paste-title" style={{ fontWeight: 700, fontSize: 13 }}>已经写好脚本？</span>
            <span
              className="faint se-new-paste-desc"
              title="粘贴写好的脚本、分镜稿或 AI 视频提示词，AI 按原文拆成分镜，拆解免费"
            >
              粘贴进来，AI 按原文拆成分镜，拆解免费
            </span>
            <ArrowRight className="se-new-paste-arrow" size={15} style={{ color: "var(--ink-3)", flex: "none" }} />
          </button>

          {/* 短视频模板（模板广场里的单条短视频模板） */}
          <div className="row se-new-recs-head" style={{ marginTop: 22, marginBottom: 12, alignItems: "center", flexWrap: "wrap", columnGap: 8, rowGap: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13.5, flex: "none" }}>短视频模板</span>
            <span className="faint se-new-recs-hint" style={{ fontSize: 12, minWidth: 0 }}>点开看范例视频，选「做同款」就按这个模板来写</span>
            <span className="grow" />
            {shortRecipes.length > 6 && (
              <button type="button" className="chip" style={{ flex: "none" }} onClick={() => setPage((p) => p + 1)}>
                <RefreshCw size={12} /> 换一批
              </button>
            )}
          </div>

          <div className="se-new-recs-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(158px,1fr))", gap: 14 }}>
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
                <VideoCover from={r.cover.from} to={r.cover.to} src={r.coverImage} ratio="3/4" label={r.previewVideo ? "范例视频" : undefined}>
                  <span
                    className="thumb-label"
                    style={{ position: "absolute", top: 8, left: 8, maxWidth: "calc(100% - 16px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={r.type}
                  >
                    {r.type}
                  </span>
                </VideoCover>
                <div className="col gap-1" style={{ padding: "11px 13px 13px", minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.title}>{r.title}</div>
                  <div className="faint" style={{ fontSize: 12, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {r.summary || r.data?.mainline}
                  </div>
                </div>
              </button>
            ))}
            {/* 三种空态分开说：还在加载 / 没加载出来 / 加载好了但一条都没有。 */}
            {recs.length === 0 && recipesQ.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card col" style={{ padding: 0, overflow: "hidden", gap: 0 }} aria-hidden>
                  <div className="skel" style={{ width: "100%", aspectRatio: "3/4", borderRadius: 0 }} />
                  <div className="col gap-1" style={{ padding: "11px 13px 13px" }}>
                    <div className="skel" style={{ height: 12, width: "70%" }} />
                    <div className="skel" style={{ height: 9, width: "45%" }} />
                  </div>
                </div>
              ))}
            {recs.length === 0 && !recipesQ.isLoading && (
              <div className="card col gap-2 se-new-recs-empty" style={{ padding: 18, minHeight: 140, justifyContent: "center" }}>
                <Sparkles size={18} style={{ color: "var(--accent)" }} />
                {recipesQ.error ? (
                  <>
                    <div style={{ fontWeight: 800 }}>模板没加载出来</div>
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>不选模板也行，直接在上面写一句就能开始。</div>
                    <button type="button" className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} onClick={recipesQ.refetch}>
                      <RefreshCw size={12} /> 重新加载
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 800 }}>还没有短视频模板</div>
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>不选也行，直接在上面写一句就能开始。</div>
                  </>
                )}
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
            desc: preview.summary || preview.data?.mainline || "选「做同款」后，AI 按这个模板的风格写你的内容。",
            tags: recipeTags(preview),
            beats: recipeBeats(preview),
            estimate: recipeEstimate(preview),
            coverLabel: "范例视频",
          }}
          onClose={() => setPreview(null)}
          actions={[
            // 这一步只是选好模板、不花积分，所以不带积分标记；扣费在「开始制作」那一步确认。
            { label: "做同款", icon: <Zap size={15} />, variant: "grad", onClick: () => tryRecipe(preview) },
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
