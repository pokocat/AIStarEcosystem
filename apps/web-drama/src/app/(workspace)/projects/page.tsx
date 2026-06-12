"use client";

export const dynamic = "force-dynamic";

// 短剧工坊 — 设计真源 v4 app-v4.jsx `ProjectsHub`:
// 只收多集连续短剧(单集作品在「短视频工坊」);继续上次大卡 + 紧凑竖版网格。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Clock, PenTool, Wand2, Zap } from "lucide-react";
import { Thumb } from "@/components/drama-ui";
import { ProjectCard } from "@/components/drama-workshop/project-card";
import { stageNameByNo } from "@/components/drama-workshop/stages-config";
import { QuickCreateModal } from "@/components/drama-workshop/quick-create-modal";
import { WorkPreviewModal } from "@/components/drama-workshop/work-preview-modal";
import { CONTENT_TYPES, REVIEW_PENDING_COUNT, type DramaProjectSummary } from "@/mocks/drama-workshop";
import { ProjectsApi } from "@/api";
import { useAsync } from "@/lib/drama-query";

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
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<DramaProjectSummary | null>(null);

  const { data: projects, isLoading: loading, error, refetch } = useAsync(
    "/me/drama/projects",
    () => ProjectsApi.listProjects(),
  );
  const list = projects ?? [];

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
  const quickCreate = async (payload: { type: string; template: string; idea: string }) => {
    setQuickOpen(false);
    const ct = CONTENT_TYPES.find((t) => t.key === payload.type);
    const vertical = !ct || !/16:9/.test(ct.ratio);
    try {
      const detail = await ProjectsApi.createProject({
        title: (payload.idea || payload.template || ct?.name || "新短剧").slice(0, 24),
        type: ct?.name ?? "短剧",
        typeKey: payload.type,
        mode: "template",
        ratio: vertical ? "9:16" : "16:9",
        episodes: vertical ? 12 : 1,
        logline: payload.idea ?? "",
        coverFrom: ct?.from,
        coverTo: ct?.to,
      });
      toast.success("已套用模板立项,改改大纲就能用");
      router.push(`/projects/${detail.meta.id}?from=template`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "立项失败，请重试");
    }
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
            onClick={() => setQuickOpen(true)}
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
            接着做 <ArrowRight size={16} />
          </span>
        </button>
      )}

      {/* 剧本审阅入口(收进短剧工坊,不再占一级菜单) */}
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

      {/* 紧凑竖版网格 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 18, alignItems: "start" }}>
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
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

        {loading
          ? Array.from({ length: 5 }).map((_, i) => <ProjectCardSkeleton key={i} />)
          : rest.map((p, i) => <ProjectCard key={p.id} p={p} delay={i * 40} onOpen={openProject} />)}
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
          onScript={() => {
            const id = preview.id;
            setPreview(null);
            router.push(`/projects/${id}`);
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
              toast.error(e instanceof Error ? e.message : "衍生失败，请重试");
            }
          }}
        />
      )}
      {quickOpen && (
        <QuickCreateModal
          onClose={() => setQuickOpen(false)}
          onCreate={quickCreate}
          onGuided={() => router.push("/projects/new")}
        />
      )}
    </div>
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
