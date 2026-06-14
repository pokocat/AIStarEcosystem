"use client";

export const dynamic = "force-dynamic";

// 创意市场（v0.75）—— 统一承载「官方内置创意」+「用户发布的创意」。
// 数据真源 = 已发布的 DramaRecipe（origin: official=官方 / extracted=用户自助 / featured=运营精选）。
// 用户：浏览 + 「套用开拍」（预填新项目，建-时选）。
// 运营（operatorRole 或运营身份开关）：新建内置创意 + 从用户作品精选（邀请授权）。
// 子页「我发布的创意」= /templates/published。
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  Check,
  Clock,
  Film,
  Flame,
  Play,
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
import { useAuth } from "@ai-star-eco/api-client";
import { RecipesApi } from "@/api";
import type { BuiltinRecipeInput, DramaRecipe, RecipeBeat, RecipeCandidate } from "@/api/recipes";
import { CONTENT_TYPES } from "@/mocks/drama-workshop";
import { useOperator } from "@/lib/use-operator";
import { aiErrorMessage } from "@/lib/ai-error";
import { ModalShell } from "@/components/common/ModalShell";

type Scope = "all" | "official" | "user";

const isOfficial = (r: DramaRecipe) => r.origin === "official";

export default function TemplatesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [operator] = useOperator();
  const showOperator = !!user?.operatorRole || operator;

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
      setError(aiErrorMessage(e, "创意市场加载失败，请稍后重试"));
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

  const scopeTabs: [Scope, string, number][] = [
    ["all", "全部", recipes.length],
    ["official", "官方内置", officialN],
    ["user", "用户作品", userN],
  ];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 18, gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 260 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>创意市场</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            验证过的爆款创意 —— 官方内置 + 创作者发布,挑一个「套用开拍」预填新剧
          </div>
        </div>
        <div className="grow" />
        <button
          type="button"
          className="btn btn-line"
          style={{ height: 40, flex: "none" }}
          onClick={() => router.push("/templates/published")}
        >
          <Boxes size={15} /> 我发布的创意 <ArrowRight size={14} />
        </button>
        {showOperator && (
          <>
            <button type="button" className="btn btn-line" style={{ height: 40, flex: "none" }} onClick={() => setShowCandidates(true)}>
              <UserPlus size={15} /> 从用户作品精选
            </button>
            <button type="button" className="btn btn-grad" style={{ height: 40, flex: "none" }} onClick={() => setShowBuiltin(true)}>
              <Plus size={15} /> 新建内置创意
            </button>
          </>
        )}
      </div>

      <div className="row" style={{ marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div className="row gap-2">
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
        <div className="grow" />
        <div className="row card" style={{ padding: "0 14px", height: 40, width: 240, gap: 8, borderRadius: 999, flex: "none" }}>
          <Search size={16} style={{ color: "var(--ink-3)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜创意 / 作者 / 钩子…"
            style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 13.5 }}
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
          <div style={{ fontWeight: 700 }}>这里还没有创意</div>
          <div className="faint" style={{ fontSize: 12.5 }}>
            {showOperator ? "用「新建内置创意」铺点官方种子，或从用户作品里精选。" : "创作者发布、运营精选的爆款创意会陆续出现在这里。"}
          </div>
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

/* ── 创意卡片 ─────────────────────────────────────────────────────────────────── */
function SourceBadge({ r }: { r: DramaRecipe }) {
  if (isOfficial(r)) {
    return (
      <span className="tag tag-accent row gap-1" style={{ fontSize: 10.5 }}>
        <Star size={10} /> 官方
      </span>
    );
  }
  return (
    <span className="tag tag-gray" style={{ fontSize: 10.5 }}>
      来自 @{r.authorName || "用户"}
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
          {r.episodes > 1 ? `${r.episodes} 集` : "单集"}
        </span>
        {r.useCount > 0 && (
          <span className="num" style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,.5)", color: "#fff", fontSize: 10.5, padding: "1px 6px", borderRadius: 6 }}>
            {r.useCount} 人用过
          </span>
        )}
      </div>
      <div className="col" style={{ padding: 14, gap: 9, flex: 1 }}>
        <div className="row gap-2" style={{ alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 15, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
          <span className="tag tag-gray" style={{ fontSize: 10.5, flex: "none" }}>{r.type}</span>
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
          <Zap size={14} /> {applying ? "套用中…" : "套用开拍"}
        </button>
      </div>
    </div>
  );
}

/* ── 创意详情弹窗（editorial · 只读 + 套用） ──────────────────────────────────────
   编辑/精品向：媒体 hero 上叠标题+作者（gradient scrim）；下方简介/内容双 tab。
   硬约束：不外露 payload（beats/characters/notes/mainline 原文），内容 tab 只给「套用后你会得到什么」的计数能力清单。 */
function RecipeDetailModal({ r, applying, onClose, onApply }: { r: DramaRecipe; applying: boolean; onClose: () => void; onApply: () => void }) {
  const [tab, setTab] = React.useState<"intro" | "content">("intro");
  const [playing, setPlaying] = React.useState(false);

  const portrait = !/16\s*:\s*9/.test(r.ratio); // 竖屏剧（9:16 等）hero 更高
  const heroH = portrait ? 280 : 196;
  const fmtTime = (s: string | null) =>
    s ? new Date(s).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\//g, "-") : null;
  const updated = fmtTime(r.updatedAt) || fmtTime(r.publishedAt);

  // 内容 tab：套用后你会得到什么（计数 + 能力，不外露具体文字）
  const beatN = r.data?.beats?.length ?? 0;
  const charN = r.data?.characters?.length ?? 0;
  const hasMethod = !!r.data?.mainline || beatN > 0;
  const features: { label: string; sub: string }[] = [
    { label: "主线骨架", sub: hasMethod ? "可迁移的故事主线，套用后自动展开到你的项目" : "完整创作方法已内置，套用后自动铺好大纲" },
    beatN > 0
      ? { label: `${beatN} 段分集节拍`, sub: "逐集钩子与转折骨架，开拍前可逐条改写" }
      : { label: r.episodes > 1 ? `${r.episodes} 集分集结构` : "单集节拍结构", sub: "套用后按集铺好分场骨架" },
    charN > 0
      ? { label: `${charN} 个角色原型`, sub: "人设原型自动入项目，替换成你的角色即可" }
      : { label: "角色原型方案", sub: "套用后给出可改写的人设原型" },
    { label: "完整分镜方案", sub: `${r.ratio} 画幅 · 套用后进六阶段工作台直接出图出片` },
  ];

  return (
    <ModalShell onClose={onClose} label={r.title} overlayZIndex={90} className="card pop-in col" style={{ width: 560, maxWidth: "94vw", maxHeight: "92vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
      {/* ── 媒体 hero ── */}
      <div style={{ position: "relative", flex: "none", height: heroH, background: `linear-gradient(140deg,${r.cover.from},${r.cover.to})`, overflow: "hidden" }}>
        {playing && r.previewVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={r.previewVideo}
            poster={r.coverImage || undefined}
            controls
            autoPlay
            playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: portrait ? "contain" : "cover", background: "#000" }}
          />
        ) : (
          <>
            {r.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.coverImage} alt={r.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            {/* 底部渐变 scrim，承托叠加标题 */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.34) 0%,rgba(0,0,0,0) 32%,rgba(0,0,0,0) 50%,rgba(0,0,0,.72) 100%)" }} />

            {/* 播放态：有视频→可点击的大播放钮；无视频→占位 */}
            {r.previewVideo ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label="播放范例视频"
                className="center"
                style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <span
                  className="center"
                  style={{ width: 58, height: 58, borderRadius: 999, background: "rgba(255,255,255,.92)", boxShadow: "0 6px 22px rgba(0,0,0,.28)", transition: "transform .15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                >
                  <Play size={22} fill="var(--ink)" color="var(--ink)" style={{ marginLeft: 3 }} />
                </span>
              </button>
            ) : (
              <div className="col center" style={{ position: "absolute", inset: 0, gap: 8 }}>
                <span className="center" style={{ width: 50, height: 50, borderRadius: 999, background: "rgba(255,255,255,.22)", backdropFilter: "blur(2px)" }}>
                  <Film size={20} color="#fff" />
                </span>
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.92)", fontWeight: 600, textShadow: "0 1px 3px rgba(0,0,0,.4)" }}>范例视频整理中</span>
              </div>
            )}

            {/* 叠加：源标 + 关闭 */}
            <span style={{ position: "absolute", top: 12, left: 12 }}>
              <SourceBadge r={r} />
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
                  @{r.authorName || "用户"}
                </span>
              )}
              <span style={{ fontSize: portrait ? 22 : 20, fontWeight: 800, letterSpacing: "-.02em", color: "#fff", lineHeight: 1.2, textShadow: "0 2px 10px rgba(0,0,0,.5)" }}>
                {r.title}
              </span>
            </div>
          </>
        )}
        {playing && r.previewVideo && (
          <button type="button" aria-label="关闭" onClick={onClose} className="btn btn-icon btn-sm" style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,.9)", zIndex: 2 }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── tab 栏（下划线选中指示） ── */}
      <div className="row" style={{ flex: "none", padding: "0 20px", borderBottom: "1px solid var(--line-soft)", gap: 22 }}>
        {([["intro", "简介"], ["content", "套用你会得到什么"]] as const).map(([k, label]) => {
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
              <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>一套验证过的创作配方，套用后自动铺好大纲与分集骨架。</p>
            )}

            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <span className="tag tag-accent" style={{ fontSize: 11.5 }}>{r.type}</span>
              <span className="tag tag-gray" style={{ fontSize: 11.5 }}>{r.episodes > 1 ? `${r.episodes} 集` : "单集短片"}</span>
              <span className="tag tag-gray num" style={{ fontSize: 11.5 }}>{r.ratio}</span>
              {r.useCount > 0 && (
                <span className="tag tag-gray num row gap-1" style={{ fontSize: 11.5 }}>
                  <Users size={11} /> {r.useCount} 人用过
                </span>
              )}
            </div>

            {updated && (
              <div className="row gap-1 faint num" style={{ fontSize: 11.5, marginTop: 2 }}>
                <Clock size={12} /> 最近更新 {updated}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>
              一键套用,以下创作方法会自动展开到你的新项目,接着改就能开拍 ——
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
              <span style={{ fontSize: 12, lineHeight: 1.5, fontWeight: 600 }}>具体剧本细节不在此预览,套用后在工作台里逐条可见、可改。</span>
            </div>
          </>
        )}
      </div>

      {/* ── 底部动作：源标 + 关闭 + 强化主 CTA ── */}
      <div className="row gap-3" style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", alignItems: "center", flex: "none" }}>
        <span style={{ flex: "none" }}>
          <SourceBadge r={r} />
        </span>
        <div className="row gap-2" style={{ flex: 1, justifyContent: "flex-end", alignItems: "stretch" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: "none" }}>关闭</button>
          <button type="button" className="btn btn-grad" disabled={applying} onClick={onApply} style={{ flex: 1, maxWidth: 200, justifyContent: "center", fontWeight: 800, fontSize: 15 }}>
            <Zap size={16} /> {applying ? "套用中…" : "套用开拍"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ── 运营：新建内置创意 ───────────────────────────────────────────────────────── */
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
      toast.success(`内置创意「${r.title}」已上架创意市场`);
      onCreated();
    } catch (e) {
      toast.error(aiErrorMessage(e, "创建失败，请重试"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} label="新建内置创意" overlayZIndex={95} className="card pop-in col" style={{ width: 560, maxWidth: "94vw", maxHeight: "90vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
        <div className="row gap-3" style={{ padding: "16px 20px 12px", flex: "none" }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: "linear-gradient(135deg,var(--accent),var(--accent-2))", display: "grid", placeItems: "center", flex: "none" }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 16 }}>新建内置创意</div>
            <div className="faint" style={{ fontSize: 12 }}>运营身份 · 直接上架,所有人都能一键套用</div>
          </div>
          <span className="tag tag-accent" style={{ flex: "none" }}>官方</span>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
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
          <Field label="创意名称">
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
            <button className={"chip" + (single ? " on" : "")} onClick={() => setSingle(true)}>单集短视频</button>
            {!single && (
              <div className="row gap-2" style={{ alignItems: "center" }}>
                <span className="faint" style={{ fontSize: 12 }}>集数</span>
                <input type="number" min="2" value={eps} onChange={(e) => setEps(e.target.value)} style={{ ...inp, width: 70, height: 34 }} />
              </div>
            )}
          </div>
          <Field label="主线骨架（去具体化的可迁移主线，喂给套用者的大纲 AI）">
            <textarea value={mainline} onChange={(e) => setMainline(e.target.value)} placeholder="小人物谷底翻盘：屈辱开局 → 隐藏底牌 → 步步反杀 → 高光收束" style={{ ...inp, height: 64, padding: "10px 12px", resize: "vertical" }} />
          </Field>
          <Field label={`分集节拍（可选 · ${beats.length}）`}>
            <div className="col gap-2">
              {beats.map((b, i) => (
                <div key={i} className="row gap-2" style={{ alignItems: "center" }}>
                  <span className="num faint" style={{ fontSize: 12, width: 30, flex: "none" }}>第{b.no}集</span>
                  <input value={b.hook} onChange={(e) => setBeat(i, { hook: e.target.value })} placeholder="钩子" style={{ ...inp, height: 32, width: 120, flex: "none" }} />
                  <input value={b.beat} onChange={(e) => setBeat(i, { beat: e.target.value })} placeholder="节拍 / 转折" style={{ ...inp, height: 32, flex: 1 }} />
                  <button className="btn btn-icon btn-ghost btn-sm" onClick={() => delBeat(i)}><X size={14} /></button>
                </div>
              ))}
              <button className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} onClick={addBeat}>
                <Plus size={13} /> 加一段节拍
              </button>
            </div>
          </Field>
        </div>
        <div className="row gap-3" style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", justifyContent: "flex-end", flex: "none" }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-grad" disabled={!ok || saving} style={{ opacity: ok ? 1 : 0.5 }} onClick={() => void submit()}>
            <Check size={15} /> {saving ? "上架中…" : "上架到创意市场"}
          </button>
        </div>
    </ModalShell>
  );
}

/* ── 运营：从用户作品精选（邀请授权） ─────────────────────────────────────────── */
function CandidatesModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = React.useState<RecipeCandidate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [invited, setInvited] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let alive = true;
    RecipesApi.listCandidates()
      .then((r) => alive && setItems(r))
      .catch((e) => alive && (toast.error(aiErrorMessage(e, "候选加载失败")), setItems([])))
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
      toast.success(`已向 @${c.authorName} 发出精选邀请,待对方授权后进创意市场`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "邀请失败，请重试"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ModalShell onClose={onClose} label="从用户作品精选" overlayZIndex={95} className="card pop-in col" style={{ width: 600, maxWidth: "94vw", maxHeight: "88vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
        <div className="row gap-3" style={{ padding: "16px 20px 12px", flex: "none", borderBottom: "1px solid var(--line-soft)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)", flex: "none" }}>
            <UserPlus size={18} />
          </div>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 16 }}>从用户作品精选</div>
            <div className="faint" style={{ fontSize: 12 }}>挑一部创作者的作品发起邀请 · 对方授权后署名「来自@TA」进创意市场</div>
          </div>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="scroll col gap-2" style={{ padding: 16, minHeight: 0 }}>
          {loading ? (
            <span className="muted" style={{ fontSize: 13 }}>正在加载候选作品…</span>
          ) : items.length === 0 ? (
            <span className="faint" style={{ fontSize: 13 }}>暂无可精选的用户作品（需对方已铺好大纲）。</span>
          ) : (
            items.map((c) => {
              const done = invited.has(c.projectId);
              const locked = c.hasRecipe && !done;
              return (
                <div key={c.projectId} className="row gap-3" style={{ padding: 10, borderRadius: 10, background: "var(--surface-2)", alignItems: "center" }}>
                  <span style={{ width: 40, height: 54, borderRadius: 7, flex: "none", background: `linear-gradient(140deg,${c.cover.from},${c.cover.to})` }} />
                  <div className="col grow" style={{ minWidth: 0, gap: 2 }}>
                    <div className="row gap-2" style={{ alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{c.title}</span>
                      <span className="tag tag-gray" style={{ fontSize: 10.5 }}>{c.type}</span>
                    </div>
                    <div className="faint num" style={{ fontSize: 11.5 }}>来自 @{c.authorName} · {c.episodes} 集 · {c.ratio}</div>
                  </div>
                  {done ? (
                    <span className="tag tag-accent" style={{ flex: "none" }}><Check size={12} /> 已邀请</span>
                  ) : locked ? (
                    <span className="tag tag-gray" style={{ flex: "none" }}>已在市场流程中</span>
                  ) : (
                    <button type="button" className="btn btn-grad btn-sm" style={{ flex: "none" }} disabled={busyId === c.projectId} onClick={() => void doInvite(c)}>
                      <UserPlus size={13} /> {busyId === c.projectId ? "发送中…" : "邀请精选"}
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
