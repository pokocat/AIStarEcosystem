"use client";

export const dynamic = "force-dynamic";

// 短剧工坊 — 设计真源 v4 app-v4.jsx `ProjectsHub`:
// 只收多集连续短剧(单集作品在「短视频工坊」);继续上次大卡 + 紧凑竖版网格。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Clock, Flag, GitBranch, Layers, PenTool, Sparkles, Wand2, Zap } from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import { ProjectCard } from "@/components/drama-workshop/project-card";
import { stageNameByNo } from "@/components/drama-workshop/stages-config";
import { WorkPreviewModal } from "@/components/drama-workshop/work-preview-modal";
import { REVIEW_PENDING_COUNT, type DramaProjectSummary } from "@/mocks/drama-workshop";
import { ProjectsApi, RecipesApi } from "@/api";
import * as InteractiveDramaApi from "@/api/interactive-drama";
import type { InteractiveSeriesSummary } from "@/api/interactive-drama";
import { useAsync, invalidate } from "@/lib/drama-query";
import { aiErrorMessage } from "@/lib/ai-error";
import { AiDraftDialog } from "../interactive/_components/AiDraftDialog";
import { NewSeriesDialog } from "../interactive/_components/NewSeriesDialog";

export default function ProjectsHubPage() {
  return (
    <React.Suspense fallback={<HubSkeleton />}>
      <ProjectsHubInner />
    </React.Suspense>
  );
}

function ProjectsHubInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [preview, setPreview] = React.useState<DramaProjectSummary | null>(null);
  const [extracting, setExtracting] = React.useState(false);

  const { data: projects, isLoading: loading, error, refetch } = useAsync(
    "/me/drama/projects",
    () => ProjectsApi.listProjects(),
  );
  // 只收多集连续短剧；单集作品（宣传片 / 自传 / 口播等）归「短视频工坊」，避免串档。
  const list = (projects ?? []).filter((p) => p.episodes > 1);

  // 互动剧整合进短剧工坊：同列表以「互动剧」标签展示 + 按类型筛选（不再单独一级页面）。
  const { data: interactiveData } = useAsync("/me/interactive/series", () =>
    InteractiveDramaApi.listSeries(),
  );
  const interactiveList = interactiveData ?? [];
  const [filter, setFilter] = React.useState<"all" | "drama" | "interactive">(() => {
    const f = sp.get("filter");
    return f === "interactive" || f === "drama" ? f : "all";
  });
  const [showAiDraft, setShowAiDraft] = React.useState(false);
  const [showNewInteractive, setShowNewInteractive] = React.useState(false);

  // 把一部短剧转换成互动剧 → 进互动剧编辑器（流程引擎）接分支。
  async function handleConvert(p: DramaProjectSummary) {
    try {
      const s = await InteractiveDramaApi.convertProjectToInteractive(p.id);
      invalidate("/me/interactive/series");
      toast.success(`已转换为互动剧「${s.title}」，去接分支吧`);
      router.push(`/interactive/${s.id}`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "转换失败，请重试"));
    }
  }

  // 兼容旧链接 ?new=1 → 跳新建流
  React.useEffect(() => {
    if (sp.get("new") === "1") {
      router.replace("/projects/new");
    }
  }, [sp, router]);

  // 最近更新的作为「继续上次」大卡，其余进网格。
  const main = list[0];
  const rest = list.slice(1);

  // 已完成的短剧:先看成片预览,再决定看脚本还是衍生
  const openProject = (p: DramaProjectSummary) => {
    if (p.done) setPreview(p);
    else router.push(`/projects/${p.id}`);
  };
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
        <div className="grow" style={{ minWidth: 280 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>短剧工坊</h1>
          <div className="muted" style={{ marginTop: 4 }}>你的多集连续短剧都在这里 —— 点卡片接着做</div>
        </div>
        <div className="row gap-3">
          <button
            type="button"
            className="btn btn-line"
            style={{ height: 44, padding: "0 18px" }}
            onClick={() => router.push("/projects/new")}
          >
            <Wand2 size={16} /> 从零开剧
          </button>
          <button
            type="button"
            className="btn btn-grad"
            style={{ height: 44, padding: "0 18px" }}
            onClick={() => router.push("/projects/new?focus=template")}
          >
            <Zap size={16} /> 套模板开剧
          </button>
        </div>
      </div>

      {/* 加载失败 */}
      {!!error && !loading && (
        <div className="card col center" style={{ padding: 28, gap: 12, textAlign: "center", marginBottom: 20 }}>
          <div className="muted" style={{ fontSize: 13.5 }}>
            短剧列表加载失败 —— {error instanceof Error ? error.message : "请稍后重试"}
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={refetch}>重新加载</button>
        </div>
      )}

      {/* 类型筛选 + 互动剧创建（互动剧整合进本列表，以标签区分） */}
      <div className="row" style={{ gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {(
          [
            ["all", "全部"],
            ["drama", "短剧"],
            ["interactive", "互动剧"],
          ] as const
        ).map(([k, label]) => {
          const active = filter === k;
          const count =
            k === "drama" ? list.length : k === "interactive" ? interactiveList.length : list.length + interactiveList.length;
          return (
            <button key={k} type="button" onClick={() => setFilter(k)} className="row gap-1" style={chipStyle(active)}>
              {label}
              <span className="num" style={{ opacity: 0.6 }}>{count}</span>
            </button>
          );
        })}
        <span className="grow" />
        <button type="button" className="btn btn-line btn-sm" onClick={() => setShowAiDraft(true)}>
          <Sparkles size={14} /> AI 起草互动剧
        </button>
        <button type="button" className="btn btn-line btn-sm" onClick={() => setShowNewInteractive(true)}>
          <GitBranch size={14} /> 新建互动剧
        </button>
      </div>

      {/* 继续上次 */}
      {filter !== "interactive" && main && !loading && (
        <button
          type="button"
          className="card row gap-4 fade-up"
          onClick={() => openProject(main)}
          style={{ width: "100%", padding: 16, marginBottom: 24, textAlign: "left", alignItems: "center" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "var(--shadow-lg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "var(--shadow-sm)";
          }}
        >
          <Thumb
            from={main.cover.from}
            to={main.cover.to}
            w={72}
            ratio={main.ratio === "16:9" ? "16/10" : "9/16"}
            radius={11}
            stripes={false}
          />
          <div className="col gap-2 grow" style={{ minWidth: 0 }}>
            <div className="row gap-2">
              <span className="tag tag-accent">
                <Clock size={11} /> 继续上次
              </span>
              <span style={{ fontWeight: 800, fontSize: 17 }}>{main.title}</span>
              <span className="tag tag-gray">{main.type}</span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              上次做到「{stageNameByNo(main.stage)}」· {main.updated}更新
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", maxWidth: 420 }}>
              <div
                style={{
                  height: "100%",
                  width: main.progress + "%",
                  borderRadius: 99,
                  background: "linear-gradient(90deg,var(--accent),var(--accent-2))",
                }}
              />
            </div>
          </div>
          <span className="btn btn-primary" style={{ flex: "none" }}>
            接着做 <ArrowRight size={16} />
          </span>
        </button>
      )}

      {/* 剧本审阅入口(收进短剧工坊,不再占一级菜单) */}
      {filter !== "interactive" && (
      <button
        type="button"
        className="card row gap-3 fade-up"
        onClick={() => router.push("/review")}
        style={{ width: "100%", padding: "11px 16px", marginBottom: 20, textAlign: "left", alignItems: "center" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-lg)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        }}
      >
        <span style={{ width: 34, height: 34, borderRadius: 11, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)", flex: "none" }}>
          <PenTool size={17} />
        </span>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>剧本审阅</span>
        <span className="faint" style={{ fontSize: 12 }}>跨项目待审剧本集中过目,原地通读、原地通过</span>
        <span className="grow" />
        {REVIEW_PENDING_COUNT > 0 && (
          <span className="num" style={{ minWidth: 18, height: 18, padding: "0 6px", borderRadius: 99, background: "var(--accent-2)", color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center" }}>
            {REVIEW_PENDING_COUNT}
          </span>
        )}
        <span className="btn btn-line btn-sm" style={{ flex: "none" }}>去审阅 <ArrowRight size={13} /></span>
      </button>
      )}

      {/* 紧凑竖版网格 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 18, alignItems: "start" }}>
        {filter !== "interactive" && (
        <button
          type="button"
          onClick={() => router.push("/projects/new?focus=template")}
          className="col center"
          style={{
            aspectRatio: "3/4",
            borderRadius: "var(--radius)",
            border: "2px dashed var(--line)",
            color: "var(--ink-3)",
            gap: 9,
            background: "var(--surface)",
            transition: "border-color .18s, color .18s",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--line)";
            e.currentTarget.style.color = "var(--ink-3)";
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              background: "var(--accent-soft)",
              display: "grid",
              placeItems: "center",
              color: "var(--accent)",
            }}
          >
            <Zap size={23} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>开一部新的</span>
          <span className="faint" style={{ fontSize: 11 }}>套爆款模板·免大纲费</span>
        </button>
        )}

        {filter !== "interactive" &&
          (loading
            ? Array.from({ length: 5 }).map((_, i) => <ProjectCardSkeleton key={i} />)
            : rest.map((p, i) => (
                <ProjectCard key={p.id} p={p} delay={i * 40} onOpen={openProject} onConvert={handleConvert} />
              )))}
        {filter !== "drama" &&
          interactiveList.map((s, i) => (
            <InteractiveCard key={s.id} s={s} delay={i * 40} onOpen={() => router.push(`/interactive/${s.id}`)} />
          ))}
        {filter === "interactive" && interactiveList.length === 0 && (
          <div className="muted" style={{ gridColumn: "1 / -1", padding: "20px 4px", fontSize: 13 }}>
            还没有互动剧 —— 用上方「AI 起草互动剧」开始，或在任意短剧卡片点「转互动剧」。
          </div>
        )}
      </div>

      {preview && (
        <WorkPreviewModal
          item={{
            title: preview.title,
            cover: preview.cover,
            ratio: preview.ratio,
            metaLine: `${preview.type} · 全 ${preview.episodes} 集 · ${preview.updated}更新`,
            durLabel: `${preview.episodes} 集`,
          }}
          onClose={() => setPreview(null)}
          scriptLabel="切到脚本视图"
          deriveLabel="衍生新剧"
          extracting={extracting}
          onScript={() => {
            const id = preview.id;
            setPreview(null);
            router.push(`/projects/${id}`);
          }}
          onExtract={async () => {
            if (extracting) return;
            const src = preview;
            setExtracting(true);
            try {
              await RecipesApi.extractFromProject(src.id);
              setPreview(null);
              toast.success(`已把《${src.title}》发布到创意市场,运营审核通过后公开可套用`);
            } catch (e) {
              toast.error(aiErrorMessage(e, "发布失败，请稍后重试"));
            } finally {
              setExtracting(false);
            }
          }}
          onDerive={async () => {
            const src = preview;
            setPreview(null);
            try {
              const detail = await ProjectsApi.createProject({
                title: `${src.title} · 衍生`,
                type: src.type,
                typeKey: src.typeKey,
                mode: "template",
                ratio: src.ratio,
                episodes: src.episodes,
                coverFrom: src.cover.from,
                coverTo: src.cover.to,
              });
              toast.success(`已按《${src.title}》的结构衍生新剧,大纲可直接改`);
              router.push(`/projects/${detail.meta.id}?from=template`);
            } catch (e) {
              toast.error(aiErrorMessage(e, "衍生失败，请重试"));
            }
          }}
        />
      )}

      <AiDraftDialog
        open={showAiDraft}
        onOpenChange={setShowAiDraft}
        onCreated={(s) => {
          invalidate("/me/interactive/series");
          toast.success(`AI 已起草互动剧「${s.title}」`);
          router.push(`/interactive/${s.id}`);
        }}
      />
      <NewSeriesDialog
        open={showNewInteractive}
        onOpenChange={setShowNewInteractive}
        onCreated={(s) => {
          invalidate("/me/interactive/series");
          toast.success(`已创建互动剧「${s.title}」`);
          router.push(`/interactive/${s.id}`);
        }}
      />
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    border: active ? "1px solid var(--accent)" : "1px solid var(--line-2)",
    background: active ? "var(--accent-soft)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--ink-2)",
    fontSize: 13,
    fontWeight: active ? 700 : 600,
    cursor: "pointer",
  };
}

function InteractiveCard({ s, onOpen, delay = 0 }: { s: InteractiveSeriesSummary; onOpen: () => void; delay?: number }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      className="card col fade-up"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 0,
        overflow: "hidden",
        textAlign: "left",
        animationDelay: delay + "ms",
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow-sm)",
        transition: "transform .18s, box-shadow .18s",
        cursor: "pointer",
      }}
    >
      <div style={{ position: "relative" }}>
        <Thumb from="#8b5cf6" to="#e11d48" ratio="3/4" radius={0} stripes style={{ width: "100%" }}>
          <div style={{ position: "absolute", inset: 0, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="tag" style={{ background: "rgba(255,255,255,.92)", color: "var(--accent-2)", fontWeight: 800 }}>
                <GitBranch size={11} /> 互动剧
              </span>
              <span className="tag" style={{ background: "rgba(255,255,255,.85)", color: s.status === "ready" ? "#15803d" : "var(--ink-2)" }}>
                {s.status === "ready" ? "就绪" : "草稿"}
              </span>
            </div>
            <div style={{ color: "#fff" }}>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.01em", textShadow: "0 1px 8px rgba(0,0,0,.25)" }}>{s.title}</div>
            </div>
          </div>
        </Thumb>
      </div>
      <div className="col gap-2" style={{ padding: 14 }}>
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          <span className="tag tag-gray">{s.genre}</span>
        </div>
        <div className="row gap-3 faint" style={{ fontSize: 11.5, flexWrap: "wrap" }}>
          <span className="row gap-1"><Layers size={12} /> {s.episode_count} 集</span>
          <span className="row gap-1"><GitBranch size={12} /> {s.branch_count} 互动点</span>
          <span className="row gap-1"><Flag size={12} /> {s.ending_count} 结局</span>
          <span className="row gap-1"><Sparkles size={12} /> {s.ready_count}/{s.episode_count} 已生成</span>
        </div>
      </div>
    </button>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="skel" style={{ aspectRatio: "3/4", borderRadius: 0 }} />
      <div style={{ padding: 14 }}>
        <div className="skel" style={{ height: 12, width: "60%", marginBottom: 10 }} />
        <div className="skel" style={{ height: 8, width: "100%", marginBottom: 8 }} />
        <div className="skel" style={{ height: 6, width: "40%" }} />
      </div>
    </div>
  );
}

function HubSkeleton() {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="skel" style={{ height: 32, width: 180, marginBottom: 8 }} />
      <div className="skel" style={{ height: 16, width: 320, marginBottom: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 18 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
