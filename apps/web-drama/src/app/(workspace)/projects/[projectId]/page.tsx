"use client";

export const dynamic = "force-dynamic";

// 短剧工作台 — 占位(B5 将填入完整的 6 阶段轨 + 顶部项目条 + 剧集切换器 +
// 中央工作区 + 右侧角色面板)。当前占位渲染项目信息 + 阶段轨预览。
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";
import { STAGES } from "@/components/drama-workshop";
import { getProjectData, PROJECTS } from "@/mocks/drama-workshop";
import { Thumb } from "@/components/drama-ui";

export default function ProjectWorkbenchStub() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const id = params?.projectId ?? "";
  const meta = PROJECTS.find((p) => p.id === id);
  const data = getProjectData(id);

  if (!meta || !data) {
    return (
      <div className="col center" style={{ minHeight: "60vh", gap: 14, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>没找到这部短剧</h1>
        <div className="muted">可能是链接过期了。回到我的短剧重新挑选一部。</div>
        <button type="button" className="btn btn-line" onClick={() => router.push("/projects")}>
          <ChevronLeft size={16} /> 返回我的短剧
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      {/* 头部:封面 + 项目信息 */}
      <div className="row gap-4 fade-up" style={{ marginBottom: 24, alignItems: "stretch" }}>
        <Thumb
          from={meta.cover.from}
          to={meta.cover.to}
          ratio={meta.ratio === "16:9" ? "16/10" : "3/2"}
          w={200}
          radius={16}
        />
        <div className="col grow" style={{ justifyContent: "center", gap: 8 }}>
          <div className="row gap-2">
            <span className="tag tag-gray">{meta.type}</span>
            <span
              className="tag"
              style={{
                background: meta.mode === "guided" ? "var(--accent-soft)" : "var(--accent-2-soft)",
                color: meta.mode === "guided" ? "var(--accent)" : "var(--accent-2)",
              }}
            >
              {meta.mode === "guided" ? "AI 引导" : "套用模板"}
            </span>
            <span className="grow" />
            <Link href="/projects" className="btn btn-ghost btn-sm">
              <ChevronLeft size={15} /> 返回
            </Link>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-.02em",
            }}
          >
            {data.projectInfo.title}
          </h1>
          <div className="faint num" style={{ fontSize: 13 }}>
            {data.projectInfo.episodes} 集 · {data.projectInfo.duration} ·{" "}
            {data.projectInfo.ratio}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
            {data.projectInfo.logline}
          </div>
        </div>
      </div>

      {/* 阶段轨预览 */}
      <div className="card" style={{ padding: 22 }}>
        <div className="row gap-2" style={{ marginBottom: 14 }}>
          <span className="tag tag-accent">即将上线</span>
          <span style={{ fontWeight: 700 }}>六阶段工作台</span>
        </div>
        <div className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
          顶部项目条 + 剧集切换器、左侧六阶段轨(进度 + 软锁可自由跳)、右侧常驻可折叠角色面板、中间专注区 —— 正在搭建(B5)。
        </div>
        <div className="col gap-2">
          {STAGES.map((s) => {
            const reached = s.no <= meta.stage;
            const current = s.no === meta.stage;
            return (
              <div
                key={s.key}
                className="row gap-3"
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: current ? "var(--accent-soft)" : "var(--surface-2)",
                  color: current ? "var(--accent)" : reached ? "var(--ink)" : "var(--ink-3)",
                  border: current
                    ? "1.5px solid var(--accent)"
                    : "1.5px solid transparent",
                }}
              >
                <span
                  className="num"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                    background: current
                      ? "var(--accent)"
                      : reached
                        ? "var(--surface)"
                        : "var(--surface)",
                    color: current ? "#fff" : reached ? "var(--ink)" : "var(--ink-3)",
                    fontSize: 13,
                    fontWeight: 700,
                    flex: "none",
                  }}
                >
                  {s.no}
                </span>
                <span style={{ fontWeight: current ? 700 : 600 }}>{s.name}</span>
                <span className="faint" style={{ fontSize: 11.5, fontWeight: 600 }}>
                  · {s.scope}{s.scopeHint ? "·" + s.scopeHint : ""}
                </span>
                <span className="grow" />
                {reached && s.no < meta.stage && (
                  <span className="faint num" style={{ fontSize: 11 }}>
                    <Lock size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
                    已锁
                  </span>
                )}
                {current && (
                  <span className="num" style={{ fontSize: 12, fontWeight: 700 }}>
                    当前
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
