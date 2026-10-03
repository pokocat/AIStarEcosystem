"use client";

export const dynamic = "force-dynamic";

// 我的短剧 — 设计真源 v4 app-v4.jsx `ProjectsHub`:
// 只收多集连续短剧(单条作品在「我的短视频」);继续上次大卡 + 紧凑竖版网格。
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Clapperboard, Clock, Layers, Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@ai-star-eco/api-client";
import { Thumb, dramaConfirm } from "@/components/drama-ui";
import { ProjectCard } from "@/components/drama-workshop/project-card";
import { stageNameByNo } from "@/components/drama-workshop/stages-config";
import { WorkPreviewModal } from "@/components/drama-workshop/work-preview-modal";
import { PublishCreativeCenterModal } from "@/components/drama-workshop/publish-creative-center-modal";
import { ViewHeader } from "@/components/common";
import { type DramaProjectSummary } from "@/mocks/drama-workshop";
import { ProjectsApi, RecipesApi } from "@/api";
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
  // 发布成模板前先说清会发生什么（与「我的短视频」同一个弹窗），确认后才提交审核。
  const [publishTarget, setPublishTarget] = React.useState<DramaProjectSummary | null>(null);

  // revalidateOnMount：每次回到列表后台静默刷新，确保刚新建 / 照着新建 / 做同款的短剧立刻出现在列表。
  const { data: projects, isLoading: loading, error, refetch } = useAsync(
    "/me/drama/projects",
    () => ProjectsApi.listProjects(),
    { revalidateOnMount: true },
  );
  // 只收多集连续短剧；单条作品（宣传片 / 自传 / 口播等）归「我的短视频」，避免串档。
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

  // v0.197：三处「新建短剧」都去 /projects/new（写一句故事直接新建；还没想清楚的，
  // 那一页有「先和 AI 聊聊」）。此前直接建一段聊天并跳首页，侧栏高亮跳回「首页」、返回键回首页。
  const newDrama = () => router.push("/projects/new");

  // 已完成的短剧:先看成片预览,再决定打开还是照着新建一部
  const openProject = (p: DramaProjectSummary) => {
    if (p.done) setPreview(p);
    else router.push(`/projects/${p.id}`);
  };

  // 软删（移到回收站）：二次确认 → 软删 → 刷新列表（30 天内可在回收站恢复）。
  const softDelete = async (p: DramaProjectSummary) => {
    const ok = await dramaConfirm({
      title: "移到回收站",
      body: `《${p.title}》会放进回收站，30 天内随时能恢复，到期自动清除。`,
      tone: "danger",
      confirmLabel: "移到回收站",
      cancelLabel: "再想想",
    });
    if (!ok) return;
    try {
      await ProjectsApi.deleteProject(p.id);
      invalidate("/me/drama/projects");
      invalidate("/me/drama/projects/trash");
      toast.success("已移到回收站", { action: { label: "去回收站", onClick: () => router.push("/trash?tab=drama") } });
    } catch (e) {
      toast.error(aiErrorMessage(e, "没删掉，请重试"));
    }
  };
  const publishRecipe = async () => {
    const src = publishTarget;
    if (!src || extracting) return;
    setExtracting(true);
    try {
      await RecipesApi.extractFromProject(src.id);
      setPublishTarget(null);
      setPreview(null);
      invalidate("/me/drama/recipes"); // 刷新「我发布的模板」
      toast.success(`已提交《${src.title}》，平台审核通过后会出现在模板广场，别人可以做同款`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "没发布成功，请重试"));
    } finally {
      setExtracting(false);
    }
  };
  const mainUpdated = main ? formatDateTime(main.updatedAt, "") : "";
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <ViewHeader
          title={
            <>
              我的{" "}
              <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, paddingRight: "0.12em" }}>
                短剧
              </span>
            </>
          }
          meta={
            <>
              这里放你的多集短剧。只做一条短视频的话，去
              <Link href="/shorts" style={{ color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap" }}>「我的短视频」</Link>。
            </>
          }
          action={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ height: 44, padding: "0 14px" }}
                onClick={() => router.push("/trash?tab=drama")}
                title="回收站"
              >
                <Trash2 size={16} /> 回收站
              </button>
              <button
                type="button"
                className="btn btn-grad"
                style={{ height: 44, padding: "0 20px" }}
                onClick={newDrama}
              >
                <Plus size={16} /> 新建短剧
              </button>
            </>
          }
        />
      </div>

      {/* 加载失败 */}
      {!!error && !loading && (
        <div className="card col center" style={{ padding: 28, gap: 12, textAlign: "center", marginBottom: 20 }}>
          <div className="muted" style={{ fontSize: 13.5 }} title={error instanceof Error ? error.message : undefined}>
            短剧列表没加载出来，点下面重新加载
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={refetch}>重新加载</button>
        </div>
      )}

      {/* 继续上次 */}
      {main && !loading && (
        <button
          type="button"
          className="card row gap-4 fade-up hm-proj-continue"
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
            ratio={main.ratio === "16:9" ? "16/10" : "9/16"}
            radius={11}
            stripes={false}
            style={{ width: main.ratio === "16:9" ? 96 : 56, flex: "none" }}
          />
          <div className="col gap-2 grow" style={{ minWidth: 0 }}>
            <div className="row gap-2" style={{ minWidth: 0, flexWrap: "wrap" }}>
              <span className="tag tag-accent" style={{ flex: "none" }}>
                <Clock size={11} /> {main.done ? "最近完成" : "继续上次"}
              </span>
              <span title={main.title} style={{ fontWeight: 800, fontSize: 17, minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {main.title}
              </span>
              <span className="tag tag-gray" style={{ flex: "none" }}>{main.type}</span>
            </div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ whiteSpace: "nowrap" }}>做到「{stageNameByNo(main.stage)}」</span>
              {mainUpdated && " "}
              {mainUpdated && <span style={{ whiteSpace: "nowrap", marginLeft: 6 }}>更新于 {mainUpdated}</span>}
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
          <span className="btn btn-primary hm-proj-continue-btn" style={{ flex: "none" }}>
            {main.done ? "看成片" : "继续制作"} <ArrowRight size={16} />
          </span>
        </button>
      )}

      {/* 已加载且暂无短剧：显示明确的空状态（不再只剩一张虚线卡，避免看起来像一直在加载） */}
      {!loading && !error && list.length === 0 ? (
        <EmptyProjects onCreate={newDrama} onBrowse={() => router.push("/templates")} />
      ) : (
        /* 紧凑竖版网格（stretch 让「新建短剧」卡与短剧卡片等高） */
        <div className="hm-proj-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(156px, 1fr))", gap: 16, alignItems: "stretch" }}>
          <button
            type="button"
            onClick={newDrama}
            className="col center hm-proj-new"
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
              <Plus size={23} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>新建短剧</span>
            <span className="faint" style={{ fontSize: 11 }}>新建不花积分</span>
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
            metaLine: [preview.type, `共 ${preview.episodes} 集`, formatDateTime(preview.updatedAt, "") && `更新于 ${formatDateTime(preview.updatedAt)}`]
              .filter(Boolean)
              .join(" · "),
            durLabel: `${preview.episodes} 集`,
          }}
          onClose={() => setPreview(null)}
          scriptLabel="打开这部剧"
          deriveLabel="照这部新建一部"
          extractLabel="发布成模板"
          extracting={extracting}
          onScript={() => {
            const id = preview.id;
            setPreview(null);
            router.push(`/projects/${id}`);
          }}
          onExtract={() => setPublishTarget(preview)}
          onDerive={async () => {
            const src = preview;
            setPreview(null);
            try {
              // 只带过去类型、集数、画幅和封面色；剧情、角色、分镜都不复制（toast 照实说）。
              const detail = await ProjectsApi.createProject({
                title: `${src.title}（同款）`,
                type: src.type,
                typeKey: src.typeKey,
                mode: "guided",
                ratio: src.ratio,
                episodes: src.episodes,
                coverFrom: src.cover.from,
                coverTo: src.cover.to,
              });
              invalidate("/me/drama/projects");
              toast.success(`已新建一部：类型、集数、画幅和《${src.title}》一样，故事大纲要重新写`);
              router.push(`/projects/${detail.meta.id}`);
            } catch (e) {
              toast.error(aiErrorMessage(e, "没建成，请重试"));
            }
          }}
        />
      )}

      {publishTarget && (
        <PublishCreativeCenterModal
          kind="series"
          title={publishTarget.title}
          publishing={extracting}
          onClose={() => {
            if (!extracting) setPublishTarget(null);
          }}
          onConfirm={() => void publishRecipe()}
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
          写一句故事就能新建，不花积分。建好后写分集剧情、逐集拆分镜，一步步做到成片；也可以去模板广场做同款。
        </div>
      </div>
      <div className="row gap-3" style={{ flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" className="btn btn-grad" style={{ height: 44, padding: "0 22px" }} onClick={onCreate}>
          <Plus size={16} /> 新建短剧
        </button>
        <button type="button" className="btn btn-line" style={{ height: 44, padding: "0 18px" }} onClick={onBrowse}>
          <Layers size={16} /> 去模板广场
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
      <div className="hm-proj-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(156px, 1fr))", gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
