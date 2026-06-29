"use client";

export const dynamic = "force-dynamic";

// 短剧工坊 — 设计真源 v4 app-v4.jsx `ProjectsHub`:
// 只收多集连续短剧(单集作品在「短视频工坊」);继续上次大卡 + 紧凑竖版网格。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Clapperboard, Clock, Layers, Sparkles, Trash2 } from "lucide-react";
import { Thumb, dramaConfirm } from "@/components/drama-ui";
import { ProjectCard } from "@/components/drama-workshop/project-card";
import { stageNameByNo } from "@/components/drama-workshop/stages-config";
import { WorkPreviewModal } from "@/components/drama-workshop/work-preview-modal";
import { type DramaProjectSummary } from "@/mocks/drama-workshop";
import { BrainstormApi, ProjectsApi, RecipesApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { aiErrorMessage } from "@/lib/ai-error";

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

  // revalidateOnMount：每次回到工坊后台静默刷新，确保刚新建 / 衍生 / 套用的短剧立刻出现在列表。
  const { data: projects, isLoading: loading, error, refetch } = useAsync(
    "/me/drama/projects",
    () => ProjectsApi.listProjects(),
    { revalidateOnMount: true },
  );
  // 只收多集连续短剧；单集作品（宣传片 / 自传 / 口播等）归「短视频工坊」，避免串档。
  const list = (projects ?? []).filter((p) => p.episodes > 1);

  // 兼容旧链接 ?new=1 → 跳新建流
  React.useEffect(() => {
    if (sp.get("new") === "1") {
      router.replace("/projects/new");
    }
  }, [sp, router]);

  // 最近更新的项目额外用「继续上次」大卡置顶做快捷入口；网格仍展示全部短剧
  // （含最近的那部）——避免「刚新建的短剧只在大卡里、网格里找不到」的困惑。
  const main = list[0];

  // v0.89：新建入口收敛为「一个入口 → 脑暴对话框」（不再在入口处分「从零 / 套模板」）。
  // 与首页「跟 AI 聊出故事」同一条链路：建一条脑暴会话，进对话界面边聊边定选题 / 形态。
  const starting = React.useRef(false);
  const startBrainstorm = async () => {
    if (starting.current) return;
    starting.current = true;
    try {
      const detail = await BrainstormApi.createBrainstorm();
      router.push(`/dashboard?b=${encodeURIComponent(detail.meta.id)}`);
    } catch (e) {
      starting.current = false;
      toast.error(aiErrorMessage(e, "新建失败，请稍后重试"));
    }
  };

  // 已完成的短剧:先看成片预览,再决定看脚本还是衍生
  const openProject = (p: DramaProjectSummary) => {
    if (p.done) setPreview(p);
    else router.push(`/projects/${p.id}`);
  };

  // 软删（移到回收站）：二次确认 → 软删 → 刷新列表（30 天内可在回收站恢复）。
  const softDelete = async (p: DramaProjectSummary) => {
    const ok = await dramaConfirm({
      title: "移到回收站",
      body: `《${p.title}》将移入回收站，30 天后彻底删除，期间可随时恢复。`,
      tone: "danger",
      confirmLabel: "移到回收站",
      cancelLabel: "再想想",
    });
    if (!ok) return;
    try {
      await ProjectsApi.deleteProject(p.id);
      invalidate("/me/drama/projects");
      invalidate("/me/drama/projects/trash");
      toast.success("已移到回收站");
    } catch (e) {
      toast.error(aiErrorMessage(e, "删除失败，请稍后重试"));
    }
  };
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
        <div className="grow" style={{ minWidth: 280 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>短剧工坊</h1>
          <div className="muted" style={{ marginTop: 4 }}>管理你的多集短剧，随时继续创作。</div>
        </div>
        <div className="row gap-3">
          <button
            type="button"
            className="btn btn-ghost"
            style={{ height: 44, padding: "0 14px" }}
            onClick={() => router.push("/projects/trash")}
            title="回收站"
          >
            <Trash2 size={16} /> 回收站
          </button>
          <button
            type="button"
            className="btn btn-grad"
            style={{ height: 44, padding: "0 20px" }}
            onClick={() => void startBrainstorm()}
          >
            <Sparkles size={16} /> 新建短剧
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

      {/* 继续上次 */}
      {main && !loading && (
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
            继续制作 <ArrowRight size={16} />
          </span>
        </button>
      )}

      {/* 已加载且暂无短剧：显示明确的空状态（不再只剩一张虚线卡，避免看起来像一直在加载） */}
      {!loading && !error && list.length === 0 ? (
        <EmptyProjects onCreate={() => void startBrainstorm()} onBrowse={() => router.push("/templates")} />
      ) : (
        /* 紧凑竖版网格（stretch 让「新建短剧」卡与短剧卡片等高） */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(156px, 1fr))", gap: 16, alignItems: "stretch" }}>
          <button
            type="button"
            onClick={() => void startBrainstorm()}
            className="col center"
            style={{
              height: "100%",
              minHeight: 240,
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
              <Sparkles size={23} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>新建短剧</span>
            <span className="faint" style={{ fontSize: 11 }}>从想法到成片</span>
          </button>

          {loading
            ? Array.from({ length: 5 }).map((_, i) => <ProjectCardSkeleton key={i} />)
            : list.map((p, i) => (
                <ProjectCard key={p.id} p={p} delay={i * 40} onOpen={openProject} onDelete={softDelete} />
              ))}
        </div>
      )}

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
    </div>
  );
}

function EmptyProjects({ onCreate, onBrowse }: { onCreate: () => void; onBrowse: () => void }) {
  return (
    <div
      className="col center fade-up"
      style={{
        padding: "60px 32px",
        gap: 18,
        textAlign: "center",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--line-soft)",
        background:
          "radial-gradient(120% 90% at 50% -10%, color-mix(in oklch, var(--accent) 7%, var(--surface)), var(--surface))",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
          display: "grid",
          placeItems: "center",
          color: "#fff",
          boxShadow: "var(--shadow-accent)",
        }}
      >
        <Clapperboard size={30} />
      </div>
      <div className="col gap-2" style={{ maxWidth: 400 }}>
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.01em" }}>还没有短剧</div>
        <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
          从一个想法开始，和 AI 一起完成选题、剧本、分镜到成片。
        </div>
      </div>
      <div className="row gap-3" style={{ flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" className="btn btn-grad" style={{ height: 44, padding: "0 22px" }} onClick={onCreate}>
          <Sparkles size={16} /> 新建短剧
        </button>
        <button type="button" className="btn btn-line" style={{ height: 44, padding: "0 18px" }} onClick={onBrowse}>
          <Layers size={16} /> 浏览创意市场
        </button>
      </div>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="skel" style={{ aspectRatio: "1/1", borderRadius: 0 }} />
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(156px, 1fr))", gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
