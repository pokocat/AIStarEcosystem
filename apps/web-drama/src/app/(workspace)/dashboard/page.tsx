"use client";

// 首页 — 设计真源 AI短剧工作台.dc.html：
// chatOff（落地）: 居中对话框是「还没想好」的那条路（一句话点子 → 开始聊，空着也能聊）；
//                  正下方「已经想好了？直接开始」三张卡直达新建短剧 / 一句话做短视频 / 粘贴脚本；
//                  再往下是继续上次 + 热门模板（与模板广场同源）。
// chatOn（?b=<id>）: 对话 / 可编辑故事大纲 → 新建短剧或开始制作（BrainstormStudio）。
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  ClipboardPaste,
  Clock,
  Clapperboard,
  Edit,
  RefreshCw,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { formatDateTime } from "@ai-star-eco/api-client";
import { CreditMark, Thumb } from "@/components/drama-ui";
import { stageNameByNo } from "@/components/drama-workshop/stages-config";
import { PreviewModal } from "@/components/drama-workshop/preview-modal";
import { VideoCover } from "@/components/drama-workshop/video-cover";
import { BrainstormStudio, type StudioFrom } from "@/components/drama-workshop/home/brainstorm-studio";
import { SHORT_START_LEAD, confirmShortStart } from "@/components/drama-workshop/short-start-confirm";
import { recipeBeats, recipeEstimate, recipePromptSeed, recipeTags } from "@/components/drama-workshop/recipe-preview";
import { BrainstormApi, ProjectsApi, RecipesApi } from "@/api";
import type { DramaRecipe } from "@/api/recipes";
import { newClientRequestId } from "@/api/shorts";
import { useAsync } from "@/lib/drama-query";
import { useDramaConfig } from "@/lib/use-drama-config";
import { useDramaCatalog } from "@/lib/use-drama-catalog";
import { notifyWalletChanged } from "@/lib/use-wallet";
import { HotTopicChips } from "@/components/drama-workshop/hot-topic-chips";
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
  const from: StudioFrom = search?.get("from") === "projects" ? "projects" : "home";
  if (b) return <BrainstormStudio key={b} id={b} from={from} />;
  return <HomeLanding />;
}

function HomeLanding() {
  const router = useRouter();
  const [idea, setIdea] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [sparkN, setSparkN] = React.useState(0);
  const [preview, setPreview] = React.useState<DramaRecipe | null>(null);
  const cfg = useDramaConfig();
  const [applyingId, setApplyingId] = React.useState<string | null>(null);
  // 单条模板「做同款」会扣开拍费：同一个模板的重试沿用同一把幂等键，服务端只扣一笔。
  const applyKeys = React.useRef(new Map<string, string>());
  // 问候语依赖本机时间：放到挂载后算，避免服务端 / 浏览器时区不同导致 hydration 报错。
  const [hello, setHello] = React.useState("");
  React.useEffect(() => setHello(greeting()), []);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const starting = React.useRef(false); // 防连点重复建对话
  const cat = useDramaCatalog(); // 运营可维护的「近期热点 / 推荐点子」
  const recipesQ = useAsync("/me/drama/recipes/published", () => RecipesApi.listPublished());
  const publishedRecipes = recipesQ.data ?? [];
  // 首页热门模板：优先官方首页位（rcp-official-home-*），取 6 条。
  const recipePool = [...publishedRecipes].sort(
    (a, b) => Number(b.id.startsWith("rcp-official-home-")) - Number(a.id.startsWith("rcp-official-home-")),
  );
  const recs = recipePool.length
    ? Array.from({ length: Math.min(6, recipePool.length) }).map((_, i) => recipePool[(page * 6 + i) % recipePool.length])
    : [];
  const projectsQ = useAsync("/me/drama/projects", () => ProjectsApi.listProjects(), { revalidateOnMount: true });
  const main = projectsQ.data?.find((p) => p.episodes > 1) ?? projectsQ.data?.[0];
  const brainstormsQ = useAsync("/me/drama/brainstorms", () => BrainstormApi.listBrainstorms(), { revalidateOnMount: true });
  const recentBrainstorms = (brainstormsQ.data ?? []).filter((x) => x.status === "draft").slice(0, 3);

  // 一句话点子 → 新建一段对话 → 进 chatOn（?b=id）。输入框空着也能开始（纯聊）。
  const startChat = async (seed?: string) => {
    if (starting.current) return;
    starting.current = true;
    try {
      const detail = await BrainstormApi.createBrainstorm(seed?.trim() || undefined);
      router.push(`/dashboard?b=${encodeURIComponent(detail.meta.id)}`);
    } catch (e) {
      starting.current = false;
      toast.error(aiErrorMessage(e, "没能开始对话，请重试"));
    }
  };
  const submit = () => void startChat(idea.trim());
  const fillRec = (r: DramaRecipe) => {
    setIdea(recipePromptSeed(r));
    setPreview(null);
    inputRef.current?.focus();
  };
  // 「随机来一个」：按顺序轮流从运营维护的推荐点子里取一条填进输入框（不是 AI 生成的）。
  // 与新建短剧页同一个池子（catalog.ideas），也不和下面的热门模板卡重复。
  const randomIdea = () => {
    const pool = cat.ideas.filter((x) => !x.personal && x.hook);
    if (!pool.length) {
      inputRef.current?.focus();
      return;
    }
    const r = pool[sparkN % pool.length];
    setSparkN((n) => n + 1);
    setIdea(r.hook);
    inputRef.current?.focus();
  };
  const applyRecipe = async (r: DramaRecipe) => {
    if (applyingId) return;
    setApplyingId(r.id);
    const single = r.episodes <= 1;
    let key: string | undefined;
    if (single) {
      key = applyKeys.current.get(r.id) ?? newClientRequestId();
      applyKeys.current.set(r.id, key);
    }
    try {
      const out = await RecipesApi.applyRecipe(r, key);
      setPreview(null);
      if (out.kind === "short") {
        notifyWalletChanged();
        applyKeys.current.delete(r.id);
        router.push(`/shorts/make?draft=${encodeURIComponent(out.shortId)}`);
        toast.success(`已按「${r.title}」建好短视频草稿`);
      } else {
        router.push(`/projects/${out.projectId}`);
        toast.success(`已按「${r.title}」建好短剧，先看看故事大纲`);
      }
    } catch (e) {
      toast.error(aiErrorMessage(e, "没做成同款，请重试"));
    } finally {
      setApplyingId(null);
    }
  };

  const mainUpdated = main ? formatDateTime(main.updatedAt, "") : "";

  return (
    <div className="scroll ws-flush" style={{ background: "var(--bg)" }}>
      <div style={{ position: "relative", overflow: "hidden", paddingBottom: 48 }}>
        <div className="home-blob home-blob-a" style={blob(-160, "18%", undefined, 420, "var(--accent)", 16)} />
        <div className="home-blob home-blob-b" style={blob(-100, undefined, "12%", 380, "var(--accent-2)", 13)} />
        <div className="home-blob home-blob-c" style={{ ...blob(60, "46%", undefined, 300, "var(--accent)", 10) }} />

        <div className="hm-hero" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 40px 8px", position: "relative", textAlign: "center" }}>
          <div className="faint" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8, minHeight: 20 }}>{hello}</div>
          <h1 className="hm-title" style={{ margin: 0, fontSize: 31, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}>
            <span style={{ display: "inline-block" }}>还没想好做什么？</span>
            <span style={{ display: "inline-block", background: "linear-gradient(120deg,var(--accent),var(--accent-2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              先跟 AI 聊聊
            </span>
          </h1>
          <div className="muted" style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.6 }}>
            说一句想法，AI 陪你聊出故事大纲，再选做成多集短剧还是单条短视频。聊天和生成大纲都不花积分。
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
              placeholder="比如：外卖小哥捡到一份手稿，发现是失踪作家的遗作"
              style={{ width: "100%", minHeight: 76, border: "none", outline: "none", resize: "none", padding: "14px 18px 4px", fontSize: 14.5, lineHeight: 1.6, background: "transparent", fontFamily: "inherit", color: "var(--ink)" }}
            />

            {/* 近期热点：点一个填进输入框 */}
            <HotTopicChips
              topics={cat.hotTopics}
              max={3}
              shuffle
              onPick={(idea) => {
                setIdea(idea);
                inputRef.current?.focus();
              }}
            />

            <div className="row gap-2 hm-composer-actions" style={{ padding: "10px 14px 12px", flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" className="chip" onClick={randomIdea} style={{ background: "var(--accent-soft)", color: "var(--accent)" }} title="从推荐点子里轮流挑一条填进输入框">
                <Sparkles size={13} /> 随机来一个
              </button>
              <span className="grow" />
              <button type="button" className="btn btn-grad hm-cta-main" onClick={submit} style={{ height: 40, padding: "0 22px", flex: "none" }}>
                <Wand2 size={16} /> 开始聊
              </button>
            </div>
          </div>

          {/* 没聊完的对话 */}
          {recentBrainstorms.length > 0 && (
            <div className="row gap-2" style={{ marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <span className="faint" style={{ fontSize: 11.5, fontWeight: 700, alignSelf: "center" }}>接着聊</span>
              {recentBrainstorms.map((bs) => (
                <button
                  key={bs.id}
                  type="button"
                  className="chip"
                  onClick={() => router.push(`/dashboard?b=${encodeURIComponent(bs.id)}`)}
                  title={`${bs.title}（聊了 ${bs.messageCount} 条${bs.hasOutline ? "，大纲已生成" : ""}）`}
                  style={{ maxWidth: 220, minWidth: 0 }}
                >
                  <Sparkles size={12} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{bs.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 已经想好了？直接开始 */}
        <div className="hm-section" style={{ maxWidth: 1000, margin: "0 auto", padding: "26px 40px 0", position: "relative" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>已经想好了？直接开始</div>
          <div className="hm-direct">
            <DirectCard
              href="/projects/new"
              icon={<Clapperboard size={17} />}
              title="做一部多集短剧"
              sub="写一句故事，建好后写分集剧情、逐集拆分镜"
              cost="新建不花积分"
            />
            <DirectCard
              href="/shorts/new"
              icon={<Zap size={17} />}
              title="从一句话做短视频"
              sub="写一句想法，AI 写口播脚本和分镜"
              cost={`开始制作扣 ${cfg.prices.shortEntry} 积分`}
              costMark
            />
            <DirectCard
              href="/shorts/prompt"
              icon={<ClipboardPaste size={17} />}
              title="粘贴写好的脚本"
              sub="脚本、分镜稿、AI 视频提示词都可以，AI 按原文拆成分镜"
              cost="拆成分镜免费"
            />
          </div>
        </div>

        {/* 继续上次（轻量入口，完整列表在「我的短剧」） */}
        {main && (
          <div className="hm-section" style={{ maxWidth: 1000, margin: "0 auto", padding: "22px 40px 0", position: "relative" }}>
            <button
              type="button"
              className="card row fade-up hm-continue"
              onClick={() => router.push(`/projects/${main.id}`)}
              style={{ width: "100%", padding: 13, textAlign: "left", alignItems: "center", gap: 14 }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-lg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
            >
              <Thumb from={main.cover.from} to={main.cover.to} ratio="9/16" radius={9} stripes={false} style={{ width: 42, flex: "none" }} />
              <div className="col gap-1 grow" style={{ minWidth: 0 }}>
                <div className="row gap-2" style={{ minWidth: 0 }}>
                  <span className="tag tag-accent" style={{ flex: "none" }}>
                    <Clock size={11} /> 继续上次
                  </span>
                  <span title={main.title} style={{ fontWeight: 800, fontSize: 14.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {main.title}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  <span style={{ whiteSpace: "nowrap" }}>做到「{stageNameByNo(main.stage)}」</span>
                  {mainUpdated && " "}
              {mainUpdated && <span style={{ whiteSpace: "nowrap", marginLeft: 6 }}>更新于 {mainUpdated}</span>}
                </div>
              </div>
              <span className="btn btn-primary btn-sm hm-continue-btn" style={{ flex: "none" }}>
                {main.done ? "打开看看" : "继续制作"} <ArrowRight size={14} />
              </span>
            </button>
          </div>
        )}

        {/* 热门模板（与模板广场同源） */}
        <div className="hm-section" style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 40px 0", position: "relative" }}>
          <div className="row hm-recs-head" style={{ marginBottom: 12, gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>热门模板</span>
            <span className="faint hm-recs-hint" style={{ fontSize: 12 }}>点开看范例，可以直接做同款，也能填进输入框再改</span>
            <span className="grow" />
            {recipePool.length > 6 && (
              <button type="button" className="chip" onClick={() => setPage((p) => p + 1)}>
                <RefreshCw size={12} /> 换一批
              </button>
            )}
            <Link href="/templates" className="chip" style={{ textDecoration: "none" }}>
              去模板广场看全部 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="hm-recs" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(158px,1fr))", gap: 14 }}>
            {recs.map((r, i) => (
              <button
                key={r.id}
                type="button"
                className="card col fade-up"
                onClick={() => setPreview(r)}
                style={{ padding: 0, overflow: "hidden", textAlign: "left", animationDelay: i * 35 + "ms", transition: "transform .15s, box-shadow .15s", minWidth: 0 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-lg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                }}
              >
                <VideoCover from={r.cover.from} to={r.cover.to} src={r.coverImage} ratio="3/4" label={r.previewVideo ? "有范例视频" : undefined}>
                  <span className="thumb-label" style={{ position: "absolute", top: 8, left: 8, maxWidth: "calc(100% - 64px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.type}</span>
                  <span className="thumb-label num" style={{ position: "absolute", top: 8, right: 8, whiteSpace: "nowrap" }}>
                    {r.episodes > 1 ? `${r.episodes} 集` : "单条"}
                  </span>
                </VideoCover>
                <div className="col gap-1" style={{ padding: "11px 13px 13px", minWidth: 0 }}>
                  <div title={r.title} style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  <div className="faint" style={{ fontSize: 12, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {r.summary || r.data?.mainline}
                  </div>
                </div>
              </button>
            ))}
            {recs.length === 0 && (
              <div className="card col gap-2" style={{ padding: 18, minHeight: 160, justifyContent: "center" }}>
                <Sparkles size={18} style={{ color: "var(--accent)" }} />
                {recipesQ.isLoading ? (
                  <div style={{ fontWeight: 800 }}>正在加载热门模板</div>
                ) : recipesQ.error ? (
                  <>
                    <div style={{ fontWeight: 800 }}>热门模板没加载出来</div>
                    <button type="button" className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} onClick={recipesQ.refetch}>
                      重新加载
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 800 }}>暂时还没有模板</div>
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>模板广场上架了新模板，会先出现在这里。</div>
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
            desc:
              preview.summary ||
              preview.data?.mainline ||
              (preview.episodes > 1 ? "做同款会建好一部短剧，故事大纲可以直接改。" : "做同款会按这个模板的风格写脚本和分镜。"),
            personal: preview.id.startsWith("rcp-official-home-single-mother"),
            tags: recipeTags(preview),
            beats: recipeBeats(preview),
            estimate: recipeEstimate(preview),
          }}
          onClose={() => setPreview(null)}
          actions={[
            { label: "填进输入框再改", icon: <Edit size={15} />, variant: "line", onClick: () => fillRec(preview) },
            (preview.episodes ?? 0) > 1
              ? {
                  // 多集模板做同款 = 新建一部短剧，不花积分：不挂钻石、不弹扣费确认。
                  label: applyingId === preview.id ? "正在建…" : "做同款短剧（新建不花积分）",
                  icon: <Clapperboard size={15} />,
                  variant: "grad",
                  disabled: !!applyingId,
                  onClick: () => void applyRecipe(preview),
                }
              : {
                  // 单条模板做同款 = 开始制作短视频（扣 shortEntry）：确认走全站共享的 confirmShortStart，带幂等键。
                  label: applyingId === preview.id ? "正在建…" : "做同款",
                  icon: <Zap size={15} />,
                  variant: "grad",
                  cost: cfg.prices.shortEntry,
                  confirm: () => confirmShortStart(cfg, SHORT_START_LEAD.fromTemplate),
                  disabled: !!applyingId,
                  onClick: () => void applyRecipe(preview),
                },
          ]}
        />
      )}
    </div>
  );
}

function DirectCard({
  href,
  icon,
  title,
  sub,
  cost,
  costMark,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  cost: string;
  costMark?: boolean;
}) {
  return (
    <Link href={href} className="card col hm-direct-card" style={{ padding: "13px 14px", gap: 6, textDecoration: "none", color: "inherit", minWidth: 0 }}>
      <div className="row gap-2" style={{ alignItems: "center", minWidth: 0 }}>
        <span className="icon-badge" style={{ width: 30, height: 30, borderRadius: 9, flex: "none" }}>{icon}</span>
        <span style={{ fontWeight: 800, fontSize: 14, minWidth: 0 }}>{title}</span>
        <span className="grow" />
        <ArrowRight size={15} style={{ color: "var(--ink-3)", flex: "none" }} />
      </div>
      <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{sub}</div>
      <div className="row gap-1" style={{ fontSize: 11.5, fontWeight: 700, color: costMark ? "var(--accent-2)" : "var(--ink-3)", alignItems: "center" }}>
        {costMark && <CreditMark size={12} />}
        {cost}
      </div>
    </Link>
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
