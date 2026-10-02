"use client";

export const dynamic = "force-dynamic";

// 模板广场（v0.75 起；v0.197 按 docs/drama-ux-copy-pass.md §2 统一叫法）—— 统一承载官方模板 + 创作者发布的模板。
// 数据真源 = 已发布的 DramaRecipe（origin: official=官方 / extracted=用户自助 / featured=运营精选）。
// 用户：浏览 + 「做同款」（多集 → 新建短剧，不花积分；单条 → 新建短视频草稿，扣开拍费，
//   走全站共用的 confirmShortStart 确认（阈值语义同 CreditButton）+ 幂等键）。
// 运营（后端授予的 operatorRole）：新建官方模板 + 邀请创作者公开作品。
// 子页「我发布的模板」= /templates/published。
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AlertCircle,
  Boxes,
  Check,
  Clock,
  Film,
  Flame,
  Plus,
  Search,
  Sparkles,
  Star,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, useAuth } from "@ai-star-eco/api-client";
import { RecipesApi } from "@/api";
import type { BuiltinRecipeInput, DramaRecipe, RecipeBeat, RecipeCandidate } from "@/api/recipes";
import { newClientRequestId } from "@/api/shorts";
import { CreditMark } from "@/components/drama-ui";
import { confirmShortStart, SHORT_START_LEAD } from "@/components/drama-workshop/short-start-confirm";
import { useDramaConfig } from "@/lib/use-drama-config";
import { CONTENT_TYPES } from "@/mocks/drama-workshop";
import { aiErrorMessage } from "@/lib/ai-error";
import { notifyWalletChanged } from "@/lib/use-wallet";
import { ModalShell } from "@/components/common/ModalShell";
import { ViewHeader } from "@/components/common";

type Scope = "all" | "official" | "user";

const isOfficial = (r: DramaRecipe) => r.origin === "official";
/** 单条模板（episodes ≤ 1）做同款 = 新建短视频草稿（扣开拍费）；多集 = 新建短剧（不花积分）。 */
const isShortRecipe = (r: DramaRecipe) => r.episodes <= 1;

/** AI 写分集剧情最多写到第几集（服务端 DramaProjectService#outlineAiDraft clamp 1..12，见 stages/outline.tsx）。 */
const AI_OUTLINE_MAX_EP = 12;

/**
 * 多集模板「包含什么」里分集那一行的小字：按 AI 真实能写到的集数说，超过第 12 集的要自己写。
 * beatN = 模板里写好钩子和转折的集数（从第 1 集起）。
 */
function episodeFillSub(beatN: number, episodes: number): string {
  if (beatN >= episodes) return "每一集都能改";
  const aiTo = Math.min(episodes, AI_OUTLINE_MAX_EP);
  const selfFrom = Math.max(beatN, AI_OUTLINE_MAX_EP) + 1; // 从这一集起 AI 写不了
  const selfPart = episodes > AI_OUTLINE_MAX_EP ? `第 ${selfFrom} 集起要自己写` : "";
  if (beatN >= aiTo) return selfPart; // 前 12 集都已写好，剩下的只能自己写
  if (beatN === 0) {
    return selfPart
      ? `AI 可以按故事主线写前 ${AI_OUTLINE_MAX_EP} 集的分集剧情，${selfPart}`
      : "分集剧情可以让 AI 按故事主线写";
  }
  const aiRange = beatN + 1 === aiTo ? `第 ${aiTo} 集` : `第 ${beatN + 1}–${aiTo} 集`;
  const aiPart = `${aiRange}可以让 AI 按故事主线补齐`;
  return selfPart ? `${aiPart}，${selfPart}` : aiPart;
}

/** 「做同款」按钮文案：写清去向，单条的带钻石标记，多集的注明新建不花积分。 */
function ApplyLabel({ r, applying }: { r: DramaRecipe; applying: boolean }) {
  if (applying) return <>正在准备…</>;
  if (isShortRecipe(r)) {
    return (
      <>
        做同款短视频 <CreditMark tone="inherit" size={13} />
      </>
    );
  }
  return (
    <>
      做同款短剧
      <span style={{ fontSize: "0.82em", fontWeight: 500, opacity: 0.85 }}>（新建不花积分）</span>
    </>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const cfg = useDramaConfig();
  // 运营操作（新建官方模板 / 邀请创作者公开作品）仅对后端授予运营身份的账号显示。
  const showOperator = !!user?.operatorRole;
  // 单条模板做同款会扣开拍费：同一个模板失败重试沿用同一把幂等键，服务端按 (owner,key) 查重只扣一笔。
  const requestIds = React.useRef(new Map<string, string>());

  const [recipes, setRecipes] = React.useState<DramaRecipe[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<Scope>("all");
  const [filter, setFilter] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [applying, setApplying] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<DramaRecipe | null>(null);
  const [showBuiltin, setShowBuiltin] = React.useState(false);
  const [showCandidates, setShowCandidates] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecipes(await RecipesApi.listPublished());
    } catch (e) {
      setError(aiErrorMessage(e, "模板没加载出来，请重试"));
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const officialN = recipes.filter(isOfficial).length;
  const userN = recipes.length - officialN;
  const inScope = (r: DramaRecipe) => scope === "all" || (scope === "official" ? isOfficial(r) : !isOfficial(r));
  const typeKeys = Array.from(new Set(recipes.filter(inScope).map((r) => r.typeKey)));
  const list = recipes.filter(
    (r) =>
      inScope(r) &&
      (filter === "all" || r.typeKey === filter) &&
      (!q ||
        r.title.includes(q) ||
        (r.summary || "").includes(q) ||
        (r.authorName || "").includes(q) ||
        (r.data?.hooks || []).some((h) => h.includes(q))),
  );

  const busy = React.useRef(false);
  const apply = async (r: DramaRecipe) => {
    if (applying || busy.current) return;
    busy.current = true; // 同步守门：确认弹窗打开期间再点别的卡片不会叠出第二个弹窗
    try {
      await applyInner(r);
    } finally {
      busy.current = false;
    }
  };
  const applyInner = async (r: DramaRecipe) => {
    const short = isShortRecipe(r);
    if (short) {
      // 单条模板会扣一笔开拍费：确认弹窗、按钮和免打扰阈值都走全站共用的那一份（与 /shorts/new 一致）。
      const ok = await confirmShortStart(cfg, SHORT_START_LEAD.fromTemplate);
      if (!ok) return;
    }
    setApplying(r.id);
    let key = requestIds.current.get(r.id);
    if (short && !key) {
      key = newClientRequestId();
      requestIds.current.set(r.id, key);
    }
    try {
      const res = await RecipesApi.applyRecipe(r, short ? key : undefined);
      requestIds.current.delete(r.id);
      if (res.kind === "short") {
        notifyWalletChanged(); // 建草稿这一步扣了开拍费，顶栏余额跟着重读（与首页同一入口一致）
        toast.success(`已按「${r.title}」的风格新建短视频草稿`);
        router.push(`/shorts/make?draft=${encodeURIComponent(res.shortId)}`);
      } else {
        toast.success(`已按「${r.title}」新建短剧，故事框架已经填好，接着改就行`);
        router.push(`/projects/${res.projectId}`);
      }
    } catch (e) {
      // 失败保留幂等键：再点一次重试，服务端不会扣第二笔。
      // 单条的请求可能已经在服务端扣过费才失败（如超时），余额以服务端为准重读一次。
      if (short) notifyWalletChanged();
      toast.error(aiErrorMessage(e, "没做成同款，请重试"));
    } finally {
      setApplying(null);
    }
  };

  const scopeTabs: [Scope, string, number][] = [
    ["all", "全部", recipes.length],
    ["official", "官方", officialN],
    ["user", "创作者发布", userN],
  ];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <ViewHeader
          eyebrow="官方和创作者发布的模板"
          title={
            <>
              模板{" "}
              <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
                广场
              </span>
            </>
          }
          meta={`多集模板：新建一部短剧并填好故事框架，新建不花积分。单条模板：照它的风格做一条短视频，开始制作扣 ${cfg.prices.shortEntry} 积分。`}
          action={
            <>
              <button
                type="button"
                className="btn btn-line"
                style={{ height: 40, flex: "none" }}
                onClick={() => router.push("/templates/published")}
              >
                <Boxes size={15} /> 我发布的模板 <ArrowRight size={14} />
              </button>
              {showOperator && (
                <>
                  <button type="button" className="btn btn-line" style={{ height: 40, flex: "none" }} onClick={() => setShowCandidates(true)}>
                    <UserPlus size={15} /> 邀请创作者公开作品
                  </button>
                  <button type="button" className="btn btn-grad" style={{ height: 40, flex: "none" }} onClick={() => setShowBuiltin(true)}>
                    <Plus size={15} /> 新建官方模板
                  </button>
                </>
              )}
            </>
          }
        />
      </div>

      <div className="row mk-tpl-toolbar" style={{ marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          {scopeTabs.map(([k, label, n]) => {
            const on = scope === k;
            return (
              <button
                key={k}
                onClick={() => {
                  setScope(k);
                  setFilter("all");
                }}
                className="row gap-2"
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 13.5,
                  flex: "none",
                  border: on ? "2px solid var(--accent)" : "1.5px solid var(--line)",
                  background: on ? "var(--accent-soft)" : "var(--surface)",
                  color: on ? "var(--accent)" : "var(--ink-2)",
                }}
              >
                {k === "official" && <Star size={14} />}
                {k === "user" && <Users size={14} />}
                {label} <span className="num faint" style={{ fontSize: 11.5, fontWeight: 600 }}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="grow mk-tpl-grow" />
        <div className="row card mk-tpl-search" style={{ padding: "0 14px", height: 40, width: 240, gap: 8, borderRadius: 999, flex: "none" }}>
          <Search size={16} style={{ color: "var(--ink-3)", flex: "none" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜模板名、作者或钩子"
            aria-label="搜索模板"
            style={{ border: "none", outline: "none", background: "transparent", flex: 1, minWidth: 0, fontSize: 13.5 }}
          />
        </div>
      </div>

      {typeKeys.length > 1 && (
        <div className="row gap-2" style={{ flexWrap: "wrap", marginBottom: 20 }}>
          <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>
            全部类型 · {list.length}
          </button>
          {typeKeys.map((k) => {
            const name = CONTENT_TYPES.find((c) => c.key === k)?.name ?? recipes.find((r) => r.typeKey === k)?.type ?? k;
            return (
              <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
                {name}
              </button>
            );
          })}
        </div>
      )}

      {error && !loading && (
        <div className="card row" style={{ padding: 16, marginBottom: 18, gap: 12, justifyContent: "space-between", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13.5 }}>{error}</span>
          <button type="button" className="btn btn-line btn-sm" style={{ flex: "none" }} onClick={() => void load()}>重试</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(248px,1fr))", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="skel" style={{ aspectRatio: "16/9", borderRadius: 0 }} />
              <div style={{ padding: 14 }}>
                <div className="skel" style={{ height: 12, width: "60%", marginBottom: 10 }} />
                <div className="skel" style={{ height: 8, width: "100%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 && !error ? (
        <div className="card col center" style={{ padding: 40, gap: 8, textAlign: "center" }}>
          <Boxes size={26} style={{ color: "var(--ink-3)" }} />
          {recipes.length > 0 ? (
            <>
              <div style={{ fontWeight: 700 }}>没有符合条件的模板</div>
              <div className="faint" style={{ fontSize: 12.5 }}>换个关键词，或者清掉筛选</div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => { setQ(""); setFilter("all"); setScope("all"); }}>清除筛选</button>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700 }}>还没有模板</div>
              <div className="faint" style={{ fontSize: 12.5, maxWidth: 420, lineHeight: 1.6 }}>
                {showOperator
                  ? "点「新建官方模板」加一个，或者邀请创作者公开作品。"
                  : "做好的短剧或短视频，可以在成片预览里点「发布成模板」，审核通过后会出现在这里。"}
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(248px,1fr))", gap: 16, alignItems: "start" }}>
          {list.map((r, i) => (
            <RecipeCard
              key={r.id}
              r={r}
              delay={i * 28}
              applying={applying === r.id}
              onPreview={() => setDetail(r)}
              onApply={() => void apply(r)}
            />
          ))}
        </div>
      )}

      {detail && (
        <RecipeDetailModal
          r={detail}
          applying={applying === detail.id}
          onClose={() => setDetail(null)}
          onApply={() => {
            const r = detail;
            setDetail(null);
            void apply(r);
          }}
        />
      )}
      {showBuiltin && (
        <BuiltinCreateModal
          onClose={() => setShowBuiltin(false)}
          onCreated={() => {
            setShowBuiltin(false);
            void load();
          }}
        />
      )}
      {showCandidates && <CandidatesModal onClose={() => setShowCandidates(false)} />}
    </div>
  );
}

/* ── 模板卡片 ─────────────────────────────────────────────────────────────────── */
function SourceBadge({ r }: { r: DramaRecipe }) {
  if (isOfficial(r)) {
    return (
      <span className="tag tag-accent row gap-1" style={{ fontSize: 10.5 }}>
        <Star size={10} /> 官方
      </span>
    );
  }
  return (
    <span
      className="tag tag-gray"
      title={`来自 @${r.authorName || "创作者"}`}
      style={{ fontSize: 10.5, maxWidth: 160, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}
    >
      来自 @{r.authorName || "创作者"}
    </span>
  );
}

function RecipeCard({
  r,
  delay,
  applying,
  onPreview,
  onApply,
}: {
  r: DramaRecipe;
  delay: number;
  applying: boolean;
  onPreview: () => void;
  onApply: () => void;
}) {
  return (
    <div
      className="card col fade-up"
      onClick={onPreview}
      style={{ padding: 0, overflow: "hidden", gap: 0, animationDelay: delay + "ms", cursor: "pointer", transition: "transform .15s, box-shadow .15s" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--shadow-lg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div style={{ aspectRatio: "16/9", background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})`, position: "relative" }}>
        {r.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.coverImage} alt={r.title} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <span style={{ position: "absolute", top: 8, left: 8, zIndex: 1 }}>
          <SourceBadge r={r} />
        </span>
        <span className="thumb-label num" style={{ position: "absolute", top: 8, right: 8 }}>
          {r.episodes > 1 ? `${r.episodes} 集` : "单条"}
        </span>
        {r.useCount > 0 && (
          <span className="num" style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,.5)", color: "#fff", fontSize: 10.5, padding: "1px 6px", borderRadius: 6 }}>
            {r.useCount} 人用过
          </span>
        )}
      </div>
      <div className="col" style={{ padding: 14, gap: 9, flex: 1 }}>
        <div className="row gap-2" style={{ alignItems: "center" }}>
          <span title={r.title} style={{ fontWeight: 800, fontSize: 15, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
          <span className="tag tag-gray" title={r.type} style={{ fontSize: 10.5, flex: "none", maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.type}</span>
        </div>
        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {r.summary || r.data?.mainline || "—"}
        </div>
        <button
          type="button"
          className="btn btn-grad btn-sm"
          style={{ justifyContent: "center", marginTop: "auto" }}
          disabled={applying}
          onClick={(e) => {
            e.stopPropagation();
            onApply();
          }}
        >
          <Zap size={14} /> <ApplyLabel r={r} applying={applying} />
        </button>
      </div>
    </div>
  );
}

function RecipePreviewHeroVideo({ r }: { r: DramaRecipe }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [state, setState] = React.useState<"loading" | "playing" | "error">("loading");

  React.useEffect(() => {
    setState("loading");
    const video = ref.current;
    if (!video || !r.previewVideo) return;
    video.muted = true;
    video.defaultMuted = true;
    const timer = window.setTimeout(() => {
      void video.play().catch(() => setState("error"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [r.previewVideo]);

  const playSilently = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    void video.play().then(() => setState("playing")).catch(() => setState("error"));
  };
  // 加载失败时原地重试（不再把签名过的源地址外链给用户：过期后就是 403）。
  const retry = () => {
    const video = ref.current;
    if (!video) return;
    setState("loading");
    video.load();
    playSilently();
  };

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={ref}
        src={r.previewVideo}
        poster={r.coverImage || undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        aria-label={`${r.title} 范例视频`}
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const ratio = video.videoWidth / video.videoHeight;
            video.parentElement?.style.setProperty("--preview-aspect", String(ratio));
            video.parentElement?.style.setProperty("--preview-max-h", ratio < 1 ? "min(68vh, 520px)" : "min(58vh, 360px)");
          }
          playSilently();
        }}
        onLoadedData={playSilently}
        onCanPlay={playSilently}
        onPlaying={() => setState("playing")}
        onError={() => setState("error")}
        onContextMenu={(e) => e.preventDefault()}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000", pointerEvents: "none" }}
      />
      {state === "error" && (
        <div className="col center" style={{ position: "absolute", inset: 0, zIndex: 3, gap: 8, padding: 20, textAlign: "center", color: "#fff", background: "rgba(0,0,0,.58)" }}>
          <AlertCircle size={22} />
          <span style={{ fontSize: 13, fontWeight: 800 }}>范例视频没加载出来</span>
          <button type="button" className="btn btn-sm" onClick={retry} style={{ background: "rgba(255,255,255,.92)", color: "var(--ink)", pointerEvents: "auto" }}>
            重试
          </button>
        </div>
      )}
    </>
  );
}

/* ── 模板详情弹窗（editorial · 只读 + 做同款） ──────────────────────────────────────
   编辑/精品向：媒体 hero 上叠标题+作者（gradient scrim）；下方简介/内容双 tab。
   硬约束：不外露 payload（beats/characters/notes/mainline 原文），内容 tab 只给「做同款后你会得到什么」的计数能力清单，
   而且只列模板里真有的东西（没有角色设定就不说有）。 */
function RecipeDetailModal({ r, applying, onClose, onApply }: { r: DramaRecipe; applying: boolean; onClose: () => void; onApply: () => void }) {
  const cfg = useDramaConfig();
  const [tab, setTab] = React.useState<"intro" | "content">("intro");

  const portrait = !/16\s*:\s*9/.test(r.ratio); // 竖屏剧（9:16 等）hero 更高
  const ratioMatch = r.ratio.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
  const fallbackAspect = ratioMatch ? Number(ratioMatch[1]) / Number(ratioMatch[2]) : portrait ? 9 / 16 : 16 / 9;
  const updatedIso = r.updatedAt || r.publishedAt;

  // 内容 tab：做同款后你会得到什么（计数 + 能力，不外露具体文字）。
  // 单条模板 → 短视频草稿（短视频一律竖屏 9:16，模板自己的画幅不带过去）；多集模板 → 新建短剧，文案各自如实。
  const isShort = isShortRecipe(r);
  const beatN = r.data?.beats?.length ?? 0;
  const charN = r.data?.characters?.length ?? 0;
  const hasMainline = !!r.data?.mainline;
  const features: { label: string; sub: string }[] = isShort
    ? [
        { label: "风格已经定好", sub: "AI 按这个风格写口播脚本、拆分镜" },
        { label: "一条竖屏短视频", sub: "做出来是 9:16 竖屏。在短视频制作页里逐镜生成视频，最后合成成片" },
        r.previewVideo
          ? { label: "有范例视频", sub: "上面就是照这个模板做出来的样子，换成你的主题再做一条" }
          : { label: "你只要说主题", sub: "写清产品或主题，AI 照这个风格写脚本、排镜头" },
      ]
    : [
        hasMainline
          ? { label: "故事主线", sub: "不带具体人名地名的故事走向，新建后填进这部剧的「故事大纲」" }
          : { label: "写法已经定好", sub: "新建后 AI 照这个写法写故事大纲" },
        beatN > 0
          ? { label: `${beatN} 集写好了钩子和转折`, sub: episodeFillSub(beatN, r.episodes) }
          : { label: `${r.episodes} 集`, sub: `新建后按这个集数排好。${episodeFillSub(0, r.episodes)}` },
        ...(charN > 0 ? [{ label: `${charN} 个角色设定`, sub: "新建后带进这部剧，想换成自己的角色也行" }] : []),
        { label: `${r.ratio} 画幅`, sub: "这部剧按这个画幅出图和视频。分镜要到逐集制作时再生成" },
      ];

  return (
    <ModalShell onClose={onClose} label={r.title} overlayZIndex={90} className="card pop-in col mk-modal" style={{ width: 560, maxWidth: "100%", maxHeight: "92vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
      {/* ── 媒体 hero ── */}
      <div
        className="mk-tpl-hero"
        style={{
          position: "relative",
          flex: "none",
          width: "100%",
          aspectRatio: `var(--preview-aspect, ${fallbackAspect})`,
          minHeight: portrait ? 260 : 190,
          maxHeight: `var(--preview-max-h, ${portrait ? "min(68vh, 520px)" : "min(58vh, 360px)"})`,
          background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})`,
          overflow: "hidden",
        }}
      >
        {r.previewVideo ? (
          <RecipePreviewHeroVideo r={r} />
        ) : (
          <>
            {r.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.coverImage} alt={r.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            {/* 底部渐变 scrim，承托叠加标题 */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.34) 0%,rgba(0,0,0,0) 32%,rgba(0,0,0,0) 50%,rgba(0,0,0,.72) 100%)" }} />

            {/* 叠加：源标 +「暂无范例视频」小标 + 关闭（不再在封面正中写字，16:9 封面上会和标题叠在一起） */}
            <span className="row gap-1" style={{ position: "absolute", top: 12, left: 12, right: 52, flexWrap: "wrap", alignItems: "center" }}>
              <SourceBadge r={r} />
              <span className="row gap-1" style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,.42)", padding: "2px 7px", borderRadius: 6 }}>
                <Film size={11} /> 暂无范例视频
              </span>
            </span>
            <button type="button" aria-label="关闭" onClick={onClose} className="btn btn-icon btn-sm" style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,.9)" }}>
              <X size={16} />
            </button>

            {/* 左下：社会证明徽标 —— 醒目「N 人用过」（嫁接 market 版） */}
            {r.useCount > 0 && (
              <span
                className="row gap-1 num"
                style={{ position: "absolute", left: 12, bottom: 12, zIndex: 2, alignItems: "center", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, boxShadow: "0 4px 14px rgba(0,0,0,.28)" }}
              >
                <Flame size={13} fill="currentColor" /> {r.useCount} 人用过
              </span>
            )}

            {/* 叠加：作者署名 + 大标题（editorial 杂志层级） */}
            <div className="col" style={{ position: "absolute", left: 18, right: 18, bottom: r.useCount > 0 ? 44 : 14, gap: 2 }}>
              {!isOfficial(r) && (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,.85)", textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>
                  @{r.authorName || "创作者"}
                </span>
              )}
              <span style={{ fontSize: portrait ? 22 : 20, fontWeight: 800, letterSpacing: "-.02em", color: "#fff", lineHeight: 1.2, textShadow: "0 2px 10px rgba(0,0,0,.5)" }}>
                {r.title}
              </span>
            </div>
          </>
        )}
        {r.previewVideo && (
          <>
            <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", background: "linear-gradient(180deg,rgba(0,0,0,.42) 0%,rgba(0,0,0,.08) 38%,rgba(0,0,0,.12) 58%,rgba(0,0,0,.76) 100%)" }} />
            <span style={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}>
              <SourceBadge r={r} />
            </span>
            <button type="button" aria-label="关闭" onClick={onClose} className="btn btn-icon btn-sm" style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,.9)", zIndex: 2 }}>
              <X size={16} />
            </button>
            {r.useCount > 0 && (
              <span
                className="row gap-1 num"
                style={{ position: "absolute", left: 12, bottom: 12, zIndex: 2, alignItems: "center", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999, boxShadow: "0 4px 14px rgba(0,0,0,.28)" }}
              >
                <Flame size={13} fill="currentColor" /> {r.useCount} 人用过
              </span>
            )}
            <div className="col" style={{ position: "absolute", left: 18, right: 18, bottom: r.useCount > 0 ? 44 : 14, gap: 2, zIndex: 2 }}>
              {!isOfficial(r) && (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,.85)", textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>
                  @{r.authorName || "创作者"}
                </span>
              )}
              <span style={{ fontSize: portrait ? 22 : 20, fontWeight: 800, letterSpacing: "-.02em", color: "#fff", lineHeight: 1.2, textShadow: "0 2px 10px rgba(0,0,0,.5)" }}>
                {r.title}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── tab 栏（下划线选中指示） ── */}
      <div className="row" style={{ flex: "none", padding: "0 20px", borderBottom: "1px solid var(--line-soft)", gap: 22 }}>
        {([["intro", "简介"], ["content", "包含什么"]] as const).map(([k, label]) => {
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              style={{
                position: "relative",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "13px 0",
                fontSize: 13.5,
                fontWeight: on ? 800 : 600,
                color: on ? "var(--ink)" : "var(--ink-3)",
                fontFamily: "inherit",
                transition: "color .15s",
              }}
            >
              {label}
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -1,
                  height: 2.5,
                  borderRadius: 99,
                  background: on ? "linear-gradient(120deg,var(--accent),var(--accent-2))" : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* ── tab 正文 ── */}
      <div className="scroll col" style={{ padding: "18px 20px 20px", minHeight: 0, gap: 16 }}>
        {tab === "intro" ? (
          <>
            {r.summary ? (
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "var(--ink)", fontWeight: 450 }}>{r.summary}</p>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>作者没写简介。做同款以后所有内容都能改。</p>
            )}

            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <span className="tag tag-accent" style={{ fontSize: 11.5 }}>{r.type}</span>
              <span className="tag tag-gray" style={{ fontSize: 11.5 }}>{r.episodes > 1 ? `${r.episodes} 集短剧` : "单条短视频"}</span>
              <span className="tag tag-gray num" style={{ fontSize: 11.5 }}>{isShort ? "竖屏 9:16" : r.ratio}</span>
              {r.useCount > 0 && (
                <span className="tag tag-gray num row gap-1" style={{ fontSize: 11.5 }}>
                  <Users size={11} /> {r.useCount} 人用过
                </span>
              )}
            </div>

            {updatedIso && (
              <div className="row gap-1 faint num" style={{ fontSize: 11.5, marginTop: 2 }}>
                <Clock size={12} /> 更新于 {formatDateTime(updatedIso)}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>
              {isShort ? "做同款会新建一条短视频草稿，带着下面这些，每一项都能改：" : "做同款会新建一部短剧，带着下面这些，每一项都能改："}
            </p>
            <div className="col" style={{ gap: 2 }}>
              {features.map((f, i) => (
                <div key={i} className="row gap-3" style={{ alignItems: "flex-start", padding: "11px 12px", borderRadius: 12, background: i % 2 ? "transparent" : "var(--surface-2)" }}>
                  <span className="center" style={{ width: 22, height: 22, borderRadius: 999, flex: "none", marginTop: 1, background: "var(--accent-soft)", color: "var(--accent)" }}>
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <div className="col" style={{ gap: 2, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{f.label}</span>
                    <span className="faint" style={{ fontSize: 12, lineHeight: 1.5 }}>{f.sub}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="row gap-2" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", alignItems: "center" }}>
              <Sparkles size={14} style={{ flex: "none" }} />
              <span style={{ fontSize: 12, lineHeight: 1.5, fontWeight: 600 }}>
                {/* 单条模板做同款只带风格，不复制原作者的脚本（RecipesApi.applyRecipe → 空草稿 + 风格说明），别说「能看到原文」 */}
                {isShort
                  ? "做同款只带上这个模板的风格，不带原作者的口播脚本。脚本由 AI 按你的主题重新写，写好后在短视频制作页里能改。"
                  : "模板里的剧情原文这里不展示。做同款后在这部短剧的「短剧设定」里能看到、能改。"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── 底部动作：源标 + 关闭 + 主 CTA（下面一行小字写清花不花积分） ── */}
      <div className="col" style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", gap: 6, flex: "none" }}>
        <div className="row gap-3" style={{ alignItems: "center" }}>
          <span className="mk-tpl-foot-src" style={{ flex: "none", minWidth: 0 }}>
            <SourceBadge r={r} />
          </span>
          <div className="row gap-2" style={{ flex: 1, minWidth: 0, justifyContent: "flex-end", alignItems: "stretch" }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: "none" }}>关闭</button>
            <button type="button" className="btn btn-grad" disabled={applying} onClick={onApply} style={{ flex: 1, minWidth: 0, maxWidth: 260, justifyContent: "center", fontWeight: 800, fontSize: 14.5 }}>
              <Zap size={16} /> {applying ? "正在准备…" : isShort ? <>做同款短视频 <CreditMark tone="inherit" size={14} /></> : "做同款短剧"}
            </button>
          </div>
        </div>
        <div className="faint" style={{ fontSize: 11.5, textAlign: "right" }}>
          {isShort
            ? `开始制作扣 ${cfg.prices.shortEntry} 积分${cfg.prices.shortEntry >= cfg.confirmThreshold ? "，点了会先确认" : ""}`
            : "新建不花积分，之后让 AI 写剧情、拆分镜、出图和视频时按次扣"}
        </div>
      </div>
    </ModalShell>
  );
}

/* ── 运营：新建官方模板 ───────────────────────────────────────────────────────── */
const PALS: [string, string][] = [
  ["#7c3aed", "#ec4899"],
  ["#db2777", "#9333ea"],
  ["#3b82f6", "#8b5cf6"],
  ["#f59e0b", "#ef4444"],
  ["#10b981", "#22d3ee"],
];

function BuiltinCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const types = CONTENT_TYPES.filter((t) => t.key !== "custom");
  const [typeKey, setTypeKey] = React.useState(types[0]?.key ?? "style");
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [single, setSingle] = React.useState(false);
  const [eps, setEps] = React.useState("24");
  const [mainline, setMainline] = React.useState("");
  const [beats, setBeats] = React.useState<RecipeBeat[]>([]);
  const [pal, setPal] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  const ok = title.trim().length > 0;
  const addBeat = () => setBeats((b) => [...b, { no: b.length + 1, hook: "", beat: "" }]);
  const setBeat = (i: number, patch: Partial<RecipeBeat>) =>
    setBeats((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const delBeat = (i: number) => setBeats((b) => b.filter((_, j) => j !== i).map((x, j) => ({ ...x, no: j + 1 })));

  const submit = async () => {
    if (!ok || saving) return;
    const ct = types.find((t) => t.key === typeKey);
    const vertical = !ct || !/16:9/.test(ct.ratio ?? "9:16");
    const input: BuiltinRecipeInput = {
      title: title.trim(),
      summary: summary.trim(),
      type: ct?.name ?? "风格短片",
      typeKey,
      ratio: vertical ? "9:16" : "16:9",
      episodes: single ? 1 : Math.max(2, Number(eps) || 12),
      mainline: mainline.trim(),
      beats: beats.filter((b) => b.hook.trim() || b.beat.trim()),
      coverFrom: PALS[pal][0],
      coverTo: PALS[pal][1],
    };
    setSaving(true);
    try {
      const r = await RecipesApi.createBuiltin(input);
      toast.success(`官方模板「${r.title}」已公开`);
      onCreated();
    } catch (e) {
      toast.error(aiErrorMessage(e, "创建失败，请重试"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} label="新建官方模板" overlayZIndex={95} className="card pop-in col mk-modal" style={{ width: 560, maxWidth: "100%", maxHeight: "90vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
        <div className="row gap-3" style={{ padding: "16px 20px 12px", flex: "none" }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: "linear-gradient(135deg,var(--accent),var(--accent-2))", display: "grid", placeItems: "center", flex: "none" }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>新建官方模板</div>
            <div className="faint" style={{ fontSize: 12 }}>保存后直接公开，所有人都能做同款</div>
          </div>
          <span className="tag tag-accent" style={{ flex: "none" }}>官方</span>
          <button className="btn btn-icon btn-ghost btn-sm" aria-label="关闭" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="scroll col gap-4" style={{ padding: "4px 20px 16px", minHeight: 0 }}>
          <div className="col gap-2">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>封面配色</span>
            <div className="row gap-3">
              <div style={{ width: 70, aspectRatio: single ? "16/9" : "3/4", borderRadius: 10, background: `linear-gradient(150deg,${PALS[pal][0]},${PALS[pal][1]})`, flex: "none" }} />
              <div className="row gap-1" style={{ flexWrap: "wrap", alignContent: "flex-start" }}>
                {PALS.map((p, i) => (
                  <button key={i} onClick={() => setPal(i)} style={{ width: 24, height: 24, borderRadius: 7, background: `linear-gradient(135deg,${p[0]},${p[1]})`, border: pal === i ? "2px solid var(--ink)" : "2px solid transparent" }} />
                ))}
              </div>
            </div>
          </div>
          <Field label="模板名称">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="比如：都市逆袭·三幕式" style={inp} />
          </Field>
          <Field label="一句话说明（适合拍什么、爽点在哪）">
            <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="强钩子开局 + 中段反转 + 末集双线收束" style={inp} />
          </Field>
          <Field label="所属类型">
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {types.map((t) => (
                <button key={t.key} className={"chip" + (typeKey === t.key ? " on" : "")} onClick={() => setTypeKey(t.key)}>{t.name}</button>
              ))}
            </div>
          </Field>
          <div className="row gap-3" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <button className={"chip" + (!single ? " on" : "")} onClick={() => setSingle(false)}>多集短剧</button>
            <button className={"chip" + (single ? " on" : "")} onClick={() => setSingle(true)}>单条短视频</button>
            {!single && (
              <div className="row gap-2" style={{ alignItems: "center" }}>
                <span className="faint" style={{ fontSize: 12 }}>集数</span>
                <input type="number" min="2" value={eps} onChange={(e) => setEps(e.target.value)} style={{ ...inp, width: 70, height: 34 }} />
              </div>
            )}
          </div>
          <Field label="故事主线（不写具体人名地名，别人做同款时 AI 照它写故事大纲）">
            <textarea value={mainline} onChange={(e) => setMainline(e.target.value)} placeholder="小人物谷底翻盘：屈辱开局 → 隐藏底牌 → 步步反杀 → 高光收束" style={{ ...inp, height: 64, padding: "10px 12px", resize: "vertical" }} />
          </Field>
          <Field label={`每集钩子和转折（选填 · ${beats.length}）`}>
            <div className="col gap-2">
              {beats.map((b, i) => (
                <div key={i} className="row gap-2" style={{ alignItems: "center" }}>
                  <span className="num faint" style={{ fontSize: 12, width: 42, flex: "none" }}>第 {b.no} 集</span>
                  <input value={b.hook} onChange={(e) => setBeat(i, { hook: e.target.value })} placeholder="钩子" className="mk-tpl-beat-hook" style={{ ...inp, height: 32, width: 120, flex: "none" }} />
                  <input value={b.beat} onChange={(e) => setBeat(i, { beat: e.target.value })} placeholder="这一集的转折" style={{ ...inp, height: 32, flex: 1, minWidth: 0 }} />
                  <button className="btn btn-icon btn-ghost btn-sm" aria-label="删掉这一集" onClick={() => delBeat(i)}><X size={14} /></button>
                </div>
              ))}
              <button className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} onClick={addBeat}>
                <Plus size={13} /> 再加一集
              </button>
            </div>
          </Field>
        </div>
        <div className="row gap-3" style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", justifyContent: "flex-end", flex: "none" }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-grad" disabled={!ok || saving} style={{ opacity: ok ? 1 : 0.5 }} onClick={() => void submit()}>
            <Check size={15} /> {saving ? "保存中…" : "保存并公开"}
          </button>
        </div>
    </ModalShell>
  );
}

/* ── 运营：邀请创作者公开作品（对方同意后署名公开） ─────────────────────────────────────────── */
function CandidatesModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = React.useState<RecipeCandidate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [invited, setInvited] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let alive = true;
    RecipesApi.listCandidates()
      .then((r) => alive && setItems(r))
      .catch((e) => alive && (toast.error(aiErrorMessage(e, "作品列表没加载出来，请重试")), setItems([])))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const doInvite = async (c: RecipeCandidate) => {
    if (busyId) return;
    setBusyId(c.projectId);
    try {
      await RecipesApi.invite(c.projectId);
      setInvited((s) => new Set(s).add(c.projectId));
      toast.success(`已邀请 @${c.authorName}，对方同意后模板会公开`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "邀请失败，请重试"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ModalShell onClose={onClose} label="邀请创作者公开作品" overlayZIndex={95} className="card pop-in col mk-modal" style={{ width: 600, maxWidth: "100%", maxHeight: "88vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
        <div className="row gap-3" style={{ padding: "16px 20px 12px", flex: "none", borderBottom: "1px solid var(--line-soft)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)", flex: "none" }}>
            <UserPlus size={18} />
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>邀请创作者公开作品</div>
            <div className="faint" style={{ fontSize: 12 }}>选一部作品发邀请，对方同意后署 TA 的名字公开到模板广场</div>
          </div>
          <button className="btn btn-icon btn-ghost btn-sm" aria-label="关闭" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="scroll col gap-2" style={{ padding: 16, minHeight: 0 }}>
          {loading ? (
            <span className="muted" style={{ fontSize: 13 }}>正在加载作品…</span>
          ) : items.length === 0 ? (
            <span className="faint" style={{ fontSize: 13 }}>暂时没有能邀请的作品（对方要先写好故事大纲）。</span>
          ) : (
            items.map((c) => {
              const done = invited.has(c.projectId);
              const locked = c.hasRecipe && !done;
              return (
                <div key={c.projectId} className="row gap-3 mk-tpl-cand" style={{ padding: 10, borderRadius: 10, background: "var(--surface-2)", alignItems: "center" }}>
                  <span style={{ width: 40, height: 54, borderRadius: 7, flex: "none", background: `linear-gradient(140deg,${c.cover.from},${c.cover.to})` }} />
                  <div className="col grow" style={{ minWidth: 0, gap: 2 }}>
                    <div className="row gap-2" style={{ alignItems: "center" }}>
                      <span title={c.title} style={{ fontWeight: 700, fontSize: 13.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                      <span className="tag tag-gray" style={{ fontSize: 10.5, flex: "none" }}>{c.type}</span>
                    </div>
                    <div className="faint num" style={{ fontSize: 11.5 }}>来自 @{c.authorName} · {c.episodes} 集 · {c.ratio}</div>
                  </div>
                  {done ? (
                    <span className="tag tag-accent" style={{ flex: "none" }}><Check size={12} /> 已邀请</span>
                  ) : locked ? (
                    <span className="tag tag-gray" style={{ flex: "none" }}>已在审核或已公开</span>
                  ) : (
                    <button type="button" className="btn btn-grad btn-sm" style={{ flex: "none" }} disabled={busyId === c.projectId} onClick={() => void doInvite(c)}>
                      <UserPlus size={13} /> {busyId === c.projectId ? "发送中…" : "发邀请"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
    </ModalShell>
  );
}

const inp: React.CSSProperties = {
  height: 40,
  border: "1.5px solid var(--line)",
  borderRadius: 11,
  padding: "0 12px",
  fontSize: 13.5,
  outline: "none",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontFamily: "inherit",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="col gap-1">
      <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>{label}</span>
      {children}
    </div>
  );
}
