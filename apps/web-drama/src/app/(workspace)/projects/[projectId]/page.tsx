"use client";

export const dynamic = "force-dynamic";

// 短剧工作台 v4 — 沉浸式接管:项目设置阶段走左阶段轨,剧集制作阶段走
// 左分集导航 + 顶部步骤页签(剧集脚本 → 视频工厂 → 成片配方)。
import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getProjectData, PROJECTS, type ProjectData } from "@/mocks/drama-workshop";
import {
  WorkshopShell,
  type WorkshopAction,
  type WorkshopState,
} from "@/components/drama-workshop/workbench";
import {
  CastStage,
  EpScriptStage,
  FactoryStage,
  OutlineStage,
  PromptStage,
  TopicStage,
} from "@/components/drama-workshop/stages";

export default function ProjectWorkbench() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const search = useSearchParams();
  const id = params?.projectId ?? "";
  const meta = PROJECTS.find((p) => p.id === id);
  const data = getProjectData(id);
  // 快速开剧 / 模板入口:?from=template → 大纲按"模板已预填"展示
  const fromTemplate = search?.get("from") === "template";

  if (!meta || !data) {
    return (
      <div className="col center" style={{ height: "100%", gap: 14, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>没找到这部短剧</h1>
        <div className="muted">可能是链接过期了。回到短剧工坊重新挑选一部。</div>
        <button
          type="button"
          className="btn btn-line"
          onClick={() => router.push("/projects")}
        >
          <ChevronLeft size={16} /> 返回短剧工坊
        </button>
      </div>
    );
  }

  return (
    <WorkshopShell
      meta={meta}
      data={data}
      initialStage={fromTemplate ? "outline" : meta.stage <= 3 ? "outline" : "epscript"}
      renderStage={({ state, dispatch }) => (
        <StageOutlet
          state={state}
          dispatch={dispatch}
          data={data}
          prefilled={fromTemplate || meta.mode === "template"}
        />
      )}
    />
  );
}

function StageOutlet({
  state,
  dispatch,
  data,
  prefilled,
}: {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  prefilled: boolean;
}) {
  switch (state.stage) {
    case "topic":
      return <TopicStage state={state} dispatch={dispatch} data={data} />;
    case "outline":
      return <OutlineStage state={state} dispatch={dispatch} data={data} prefilled={prefilled} />;
    case "cast":
      return <CastStage state={state} dispatch={dispatch} data={data} />;
    case "epscript":
      return <EpScriptStage state={state} dispatch={dispatch} data={data} />;
    case "factory":
      return <FactoryStage state={state} dispatch={dispatch} data={data} />;
    case "prompt":
      return <PromptStage state={state} dispatch={dispatch} data={data} />;
    default:
      return null;
  }
}
