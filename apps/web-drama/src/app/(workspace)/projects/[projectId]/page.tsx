"use client";

export const dynamic = "force-dynamic";

// 短剧工作台 v4 — 沉浸式接管:短剧设定阶段走左阶段轨,逐集制作阶段走
// 左分集导航 + 顶部步骤页签(① 分镜 → ② 合成成片)。
// v0.64+:整套 ProjectData 由后端 /me/drama/projects/{id} 真实加载 + 保存。
import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { ProjectsApi } from "@/api";
import { useAsync } from "@/lib/drama-query";
import { useSaveStatus } from "@/lib/use-save-status";
import { SaveStatus } from "@/components/drama-workshop/save-status";
import { aiErrorMessage } from "@/lib/ai-error";
import { defaultOverlay, projectToStory, writeStoryToProject } from "@/lib/interactive-graph";
import { dramaConfirm } from "@/components/drama-ui";
import type { ProjectData } from "@/mocks/drama-workshop";
import {
  WorkshopShell,
  type WorkshopAction,
  type WorkshopState,
} from "@/components/drama-workshop/workbench";
import { useCharsAutosave } from "@/components/drama-workshop/workbench/use-chars-autosave";
import {
  adoptServerDoc,
  commitWorkbenchDoc,
  fetchWorkbenchDoc,
  getWorkbenchDoc,
  rebaseOntoLatest,
  trackWorkbenchSave,
  useWorkbenchDoc,
} from "@/components/drama-workshop/workbench/doc-store";
import {
  EpScriptStage,
  AssembleStage,
  BranchStage,
  SetupStage,
  type StageContext,
} from "@/components/drama-workshop/stages";

export default function ProjectWorkbench() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const search = useSearchParams();
  const id = params?.projectId ?? "";
  const fromTemplate = search?.get("from") === "template";

  // 读服务端文档：带上发起时的本地状态，读回来时由 adoptServerDoc 决定能不能替换本地（见 doc-store.ts）。
  // revalidateOnMount：回到列表再点进来时，缓存那份只用来先画出来，同时后台再读一次。
  const { data: detail, isLoading, error } = useAsync(
    `/me/drama/projects/${id}`,
    () => fetchWorkbenchDoc(id, () => ProjectsApi.getProject(id)),
    { revalidateOnMount: true },
  );

  // 整套文档：本标签页里这部短剧的唯一一份最新文档（模块级，见 doc-store.ts 头注释）。
  // 以前放在本页的 state 里、按 useAsync 缓存初始化：回到列表再点进来，拿到的是第一次打开时的那份，
  // 上一次存的东西在界面上全没了，下一次保存还会把旧文档整份写回服务端。
  const data = useWorkbenchDoc(id);

  // v0.76：统一保存状态机（指示器 + 离开提醒兜底）。所有阶段落库都经 commit 漏斗。
  const { status: saveStatusValue, notifyEditing, track } = useSaveStatus();
  const saveStatusRef = React.useRef(saveStatusValue);
  saveStatusRef.current = saveStatusValue;
  React.useEffect(() => {
    if (!detail?.data) return;
    // 有还没落库的改动（防抖窗口里）时不拿服务端那份替换：分镜页按文档重建本地状态，会把正在改的冲掉。
    if (getWorkbenchDoc(id) && saveStatusRef.current === "dirty") return;
    adoptServerDoc(id, detail, detail.data);
  }, [id, detail]);
  const commit = React.useCallback(
    async (next: ProjectData, opts?: { stage?: number; progress?: number }) => {
      // 先同步换掉最新文档：同一轮里接连两次 patchData（如出图回写 + 角色自动保存）要一个叠一个，
      // 不能都拿渲染前那份去合并、后一个把前一个盖掉。已卸载页面迟到的写入也合并到同一份上。
      commitWorkbenchDoc(id, next);
      try {
        await trackWorkbenchSave(id, () => track(() => ProjectsApi.saveProject(id, next, opts)));
      } catch (e) {
        toast.error(aiErrorMessage(e, "保存失败，请稍后重试"));
        throw e;
      }
    },
    [id, track],
  );
  // 整份保存：调用方（合成成片、分镜防抖）是拿渲染时的 data 拼出来的。等待期间右侧角色面板原地绑了数字人、
  // 或者别的集写回了分镜 / 成片，旧快照会把它们写回旧值（v0.197 复核：界面还显示已绑定，刷新就没了）。
  // 这里先回正到最新文档上：调用方没改、只是原样带过来的旧值换回最新值，真改了的照常写（stale-save.ts）。
  const saveData = React.useCallback<StageContext["saveData"]>(
    (next, opts) => commit(rebaseOntoLatest(id, next), opts),
    [id, commit],
  );
  // 按最新文档合并后保存：异步操作（场景出图/上传回写等）用它，避免并发保存/陈旧闭包覆盖结果。
  // 它本来就是在最新文档上算的，不回正（它删掉的字段是真删）。
  const patchData = React.useCallback<StageContext["patchData"]>(
    async (patch, opts) => {
      const cur = getWorkbenchDoc(id);
      if (!cur) return;
      await commit(patch(cur), opts);
    },
    [id, commit],
  );
  // v0.197 评审 WB3：ctx 以前每次渲染都是新对象，依赖它的防抖保存（互动编排）每次渲染都重排一次，
  // 保存 → 文档变了 → 重渲染 → 又排一次，改一次就一直存。这四个成员本身都是稳定的，ctx 也就稳定。
  const ctx = React.useMemo<StageContext>(
    () => ({ projectId: id, saveData, patchData, notifyEditing }),
    [id, saveData, patchData, notifyEditing],
  );

  if (isLoading || (!data && !error)) {
    return <WorkbenchLoading />;
  }
  if (error || !detail || !data) {
    return <WorkbenchNotFound onBack={() => router.push("/projects")} />;
  }

  // v0.79：互动剧项目进工作台直接落在「互动编排」中枢（剧集图 + 制作入口都在这里）。
  const isInteractive = detail.meta.mode === "interactive" || !!detail.data.interactive?.enabled;

  return (
    <WorkshopShell
      meta={detail.meta}
      data={data}
      headerRight={<SaveStatus status={saveStatusValue} />}
      initialStage={isInteractive ? "branch" : fromTemplate ? "outline" : detail.meta.stage <= 3 ? "outline" : "epscript"}
      onConvertInteractive={
        isInteractive
          ? undefined
          : async () => {
              // v0.197：转换不可逆、且会改集数（互动剧按分支图算集数），先说清楚再转。
              const written = data.episodes.length;
              const planned = data.projectInfo.episodes;
              const ok = await dramaConfirm({
                title: "转换为互动剧？",
                body: (
                  <div className="col gap-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <div>观众看到某一集时会弹出选项，按他们的选择走向不同的集和结局。</div>
                    <div>
                      {written > 0
                        ? written === planned
                          ? `互动剧的集数按分支图算，现在的 ${written} 集会串成一条线，最后一集当结局，之后可以加分支。`
                          : `互动剧的集数按分支图算：现在写好剧情的是 ${written} 集（原计划 ${planned} 集），转换后按 ${written} 集算，之后可以在分支图里加集。`
                        : "现在还没有分集剧情，转换后在分支图里一集一集加，或者让 AI 按片名生成一张。"}
                    </div>
                    <div style={{ fontWeight: 700 }}>转换后不能改回普通短剧。</div>
                  </div>
                ),
                confirmLabel: "转换为互动剧",
                cancelLabel: "先不转",
              });
              if (!ok) return false;
              try {
                // 按分支图落一次（集数改成分支图里的集数）。之前这一步只挂上 overlay，集数要等互动编排
                // 第一次自动保存才改过来 —— 而那次保存其实是 WB3 的「一直在存」顺带做的。
                await patchData((prev) => {
                  const withOverlay: ProjectData = { ...prev, interactive: defaultOverlay(prev) };
                  return writeStoryToProject(withOverlay, projectToStory(withOverlay));
                });
              } catch {
                return false; // saveData 已提示「保存失败」；没存上就别跳过去
              }
              toast.success("已转换为互动剧，可以开始加互动点了");
              return true;
            }
      }
      renderStage={({ state, dispatch }) => (
        <StageOutlet
          state={state}
          dispatch={dispatch}
          data={data}
          prefilled={fromTemplate || detail.meta.mode === "template"}
          ctx={ctx}
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
  ctx,
}: {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  prefilled: boolean;
  ctx: StageContext;
}) {
  // 角色绑定 / 主配切换发生在 reducer（WorkshopState.chars）——变化时落库到 ProjectData.characters。
  // 按最新文档合并、离开前补存（v0.197 评审 WB2，见 use-chars-autosave.ts 头注释）。
  useCharsAutosave(state.chars, ctx);

  switch (state.stage) {
    // v0.88：选题/大纲/角色场景合并为「短剧设定」单页（设计稿 wbStageView）。
    case "topic":
    case "outline":
    case "cast":
      return <SetupStage state={state} dispatch={dispatch} data={data} prefilled={prefilled} ctx={ctx} />;
    case "epscript":
      // key=集号：切集时卸载/重挂载本集实例，触发本集 flush + 干净重建（修跨集防抖覆盖）。
      return <EpScriptStage key={state.ep} state={state} dispatch={dispatch} data={data} ctx={ctx} />;
    case "prompt":
      return <AssembleStage state={state} dispatch={dispatch} data={data} ctx={ctx} />;
    case "branch":
      return <BranchStage state={state} dispatch={dispatch} data={data} ctx={ctx} />;
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
      <div className="muted" style={{ fontSize: 13 }}>正在打开这部短剧…</div>
    </div>
  );
}

function WorkbenchNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="col center" style={{ height: "100%", gap: 14, textAlign: "center", padding: "0 16px" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>没找到这部短剧</h1>
      <div className="muted">链接可能过期了，或者这部短剧已经删除。</div>
      <button type="button" className="btn btn-line" onClick={onBack}>
        <ChevronLeft size={16} /> 返回我的短剧
      </button>
    </div>
  );
}
