"use client";

export const dynamic = "force-dynamic";

// 短剧工作台 v4 — 沉浸式接管:项目设置阶段走左阶段轨,剧集制作阶段走
// 左分集导航 + 顶部步骤页签(剧集脚本 → 视频工厂 → 成片配方)。
// v0.64+:整套 ProjectData 由后端 /me/drama/projects/{id} 真实加载 + 保存。
import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { ProjectsApi } from "@/api";
import * as InteractiveDramaApi from "@/api/interactive-drama";
import { aiErrorMessage } from "@/lib/ai-error";
import { useAsync } from "@/lib/drama-query";
import { useSaveStatus } from "@/lib/use-save-status";
import { SaveStatus } from "@/components/drama-workshop/save-status";
import type { ProjectData } from "@/mocks/drama-workshop";
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
  AssembleStage,
  TopicStage,
  type StageContext,
} from "@/components/drama-workshop/stages";

export default function ProjectWorkbench() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const search = useSearchParams();
  const id = params?.projectId ?? "";
  const fromTemplate = search?.get("from") === "template";

  const { data: detail, isLoading, error } = useAsync(
    `/me/drama/projects/${id}`,
    () => ProjectsApi.getProject(id),
  );

  // 整套文档保留一份可编辑副本，阶段内的 AI 生成 / 编辑乐观更新它，再落库。
  const [data, setData] = React.useState<ProjectData | null>(null);
  React.useEffect(() => {
    if (detail?.data) setData(detail.data);
  }, [detail]);

  // v0.76：统一保存状态机（指示器 + 离开提醒兜底）。所有阶段落库都经 saveData 漏斗。
  const { status: saveStatusValue, notifyEditing, track } = useSaveStatus();
  const saveData = React.useCallback<StageContext["saveData"]>(
    async (next, opts) => {
      setData(next);
      try {
        await track(() => ProjectsApi.saveProject(id, next, opts));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败，请重试");
        throw e;
      }
    },
    [id, track],
  );

  // 转换成互动剧：把本项目按大纲铺成剧集分支图，进互动剧编辑器（流程引擎）接分支。
  const handleConvertInteractive = React.useCallback(async () => {
    try {
      const s = await InteractiveDramaApi.convertProjectToInteractive(id);
      toast.success(`已转换为互动剧「${s.title}」，去接分支吧`);
      router.push(`/interactive/${s.id}`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "转换失败，请重试"));
    }
  }, [id, router]);

  if (isLoading || (!data && !error)) {
    return <WorkbenchLoading />;
  }
  if (error || !detail || !data) {
    return <WorkbenchNotFound onBack={() => router.push("/projects")} />;
  }

  return (
    <>
      <WorkshopShell
        meta={detail.meta}
        data={data}
        initialStage={fromTemplate ? "outline" : detail.meta.stage <= 3 ? "outline" : "epscript"}
        onConvertInteractive={handleConvertInteractive}
        renderStage={({ state, dispatch }) => (
          <StageOutlet
            state={state}
            dispatch={dispatch}
            data={data}
            prefilled={fromTemplate || detail.meta.mode === "template"}
            ctx={{ projectId: id, saveData, notifyEditing }}
          />
        )}
      />
      <SaveStatus status={saveStatusValue} />
    </>
  );
}

function StageOutlet({
  state,
  dispatch,
  data,
  prefilled,
  ctx,
}: {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  prefilled: boolean;
  ctx: StageContext;
}) {
  // 角色绑定 / 主配切换发生在 reducer（WorkshopState.chars）——变化时落库到 ProjectData.characters。
  const charsRef = React.useRef(state.chars);
  React.useEffect(() => {
    if (charsRef.current === state.chars) return;
    charsRef.current = state.chars;
    ctx.notifyEditing?.(); // 标脏：防抖落库前离开也会提醒
    const t = setTimeout(() => {
      void ctx.saveData({ ...data, characters: state.chars }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.chars]);

  switch (state.stage) {
    case "topic":
      return <TopicStage state={state} dispatch={dispatch} data={data} />;
    case "outline":
      return <OutlineStage state={state} dispatch={dispatch} data={data} prefilled={prefilled} ctx={ctx} />;
    case "cast":
      return <CastStage state={state} dispatch={dispatch} data={data} ctx={ctx} />;
    case "epscript":
      return <EpScriptStage state={state} dispatch={dispatch} data={data} ctx={ctx} />;
    case "factory":
      return <FactoryStage state={state} dispatch={dispatch} data={data} ctx={ctx} />;
    case "prompt":
      return <AssembleStage state={state} dispatch={dispatch} data={data} ctx={ctx} />;
    default:
      return null;
  }
}

function WorkbenchLoading() {
  return (
    <div className="col center" style={{ height: "100%", gap: 14 }}>
      <span
        aria-hidden
        style={{
          width: 34,
          height: 34,
          border: "3px solid var(--line)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "drama-spin .8s linear infinite",
        }}
      />
      <div className="muted" style={{ fontSize: 13 }}>正在打开短剧工作台…</div>
    </div>
  );
}

function WorkbenchNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="col center" style={{ height: "100%", gap: 14, textAlign: "center" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>没找到这部短剧</h1>
      <div className="muted">可能是链接过期或已删除。回到短剧工坊重新挑选一部。</div>
      <button type="button" className="btn btn-line" onClick={onBack}>
        <ChevronLeft size={16} /> 返回短剧工坊
      </button>
    </div>
  );
}
