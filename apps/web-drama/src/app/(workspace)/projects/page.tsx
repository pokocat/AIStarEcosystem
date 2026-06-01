"use client";

export const dynamic = "force-dynamic";

// 我的短剧 — 短剧工坊首页（设计真源:screens-entry.jsx `HomeScreen`）。
// 新建按钮 → /projects/new(B4 创建流);项目卡 → /projects/<id>(B5 工作台)。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Layers, Plus, Sliders } from "lucide-react";
import { ProjectCard, STAGE_NAMES } from "@/components/drama-workshop";
import { PROJECTS, type DramaProjectSummary } from "@/mocks/drama-workshop";

export default function ProjectsHomePage() {
  return (
    <React.Suspense fallback={<HomeSkeleton />}>
      <ProjectsHomeInner />
    </React.Suspense>
  );
}

function ProjectsHomeInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [loading, setLoading] = React.useState(true);
  const [operator, setOperator] = React.useState(false);

  // 进入页面给一点骨架时间（与设计真源 final-home loading 行为一致）。
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  // 兼容旧链接 ?new=1 → 跳新建流
  React.useEffect(() => {
    if (sp.get("new") === "1") {
      router.replace("/projects/new");
    }
  }, [sp, router]);

  const openProject = (p: DramaProjectSummary) => router.push(`/projects/${p.id}`);
  const openNew = () => router.push("/projects/new");

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      {/* 标题区 + 顶部操作 */}
      <div
        className="row"
        style={{ marginBottom: 28, gap: 16, flexWrap: "wrap" }}
      >
        <div className="grow" style={{ minWidth: 280 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-.02em",
            }}
          >
            我的短剧
          </h1>
          <div className="muted" style={{ marginTop: 6 }}>
            从灵感到能直接开拍的成片配方,一条流水线搞定
          </div>
        </div>
        <div className="row gap-3">
          {/* 运营身份开关(演示,实际权限由后端 operatorRole 控制) */}
          <button
            type="button"
            className="chip static"
            title="切换运营身份(演示)"
            onClick={() => setOperator((v) => !v)}
            style={{
              background: operator ? "var(--accent-soft)" : "var(--surface-2)",
              color: operator ? "var(--accent)" : "var(--ink-3)",
            }}
          >
            <Sliders size={13} /> 运营身份 {operator ? "开" : "关"}
          </button>
          {operator && (
            <button type="button" className="btn btn-line btn-sm">
              <Layers size={15} /> 爆款拆解
            </button>
          )}
          <button
            type="button"
            className="btn btn-grad"
            style={{ height: 46, padding: "0 22px", fontSize: 15 }}
            onClick={openNew}
          >
            <Plus size={18} /> 新建短剧
          </button>
        </div>
      </div>

      {/* 网格 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))",
          gap: 20,
        }}
      >
        {/* 新建卡 */}
        <button
          type="button"
          onClick={openNew}
          className="col center"
          style={{
            aspectRatio: "3/4",
            borderRadius: "var(--radius)",
            border: "2px dashed var(--line)",
            color: "var(--ink-3)",
            gap: 10,
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
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "var(--accent-soft)",
              display: "grid",
              placeItems: "center",
              color: "var(--accent)",
            }}
          >
            <Plus size={26} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>开一部新剧</span>
        </button>

        {/* 项目卡 / 骨架 */}
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <ProjectCardSkeleton key={i} />)
          : PROJECTS.map((p, i) => (
              <ProjectCard
                key={p.id}
                p={p}
                delay={i * 40}
                stageNames={STAGE_NAMES}
                onOpen={openProject}
              />
            ))}
      </div>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="skel" style={{ aspectRatio: "3/2", borderRadius: 0 }} />
      <div style={{ padding: 14 }}>
        <div className="skel" style={{ height: 12, width: "60%", marginBottom: 10 }} />
        <div className="skel" style={{ height: 8, width: "100%", marginBottom: 8 }} />
        <div className="skel" style={{ height: 6, width: "40%" }} />
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div className="skel" style={{ height: 36, width: 180, marginBottom: 8 }} />
      <div className="skel" style={{ height: 16, width: 320, marginBottom: 28 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))",
          gap: 20,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
