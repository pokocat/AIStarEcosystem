"use client";

// 工作台外壳 v4 — 设计真源:app-v4.jsx `Workbench`。
// 项目设置阶段:左阶段轨;剧集制作阶段:左分集导航 + 顶部步骤页签。
// 右侧角色面板默认收起,把宽度留给剧本正文;≤1180px 分集轨收窄为图标轨。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@ai-star-eco/api-client";
import type { CharacterDef, ProjectData, DramaProjectSummary } from "@/mocks/drama-workshop";
import { ProjectTopbar } from "./project-topbar";
import { StageRail } from "./stage-rail";
import { EpisodeRail } from "./episode-rail";
import { StepTabs } from "./step-tabs";
import { CastPanel } from "./cast-panel";
import { RunAllDialog } from "./run-all-dialog";
import { EPISODE_STAGE_KEYS, type StageKey } from "../stages-config";

export interface WorkshopState {
  /** 当前阶段 */
  stage: StageKey;
  /** 当前剧集编号(剧集阶段用) */
  ep: number;
  /** 各阶段是否已锁定 */
  lockedStages: Partial<Record<StageKey, boolean>>;
  /** 角色当前状态(运行时可改) */
  chars: CharacterDef[];
  /** 当前余额(显示用;真正扣减仍由后端) */
  balance: number;
}

export type WorkshopAction =
  | { type: "jump"; stage: StageKey }
  | { type: "lock"; stage: StageKey; cost: number }
  | { type: "setEp"; ep: number }
  | { type: "bindAvatar"; charId: string; avatar?: string }
  | { type: "toggleRole"; charId: string }
  | { type: "spend"; n: number }
  | { type: "runAllComplete"; keys: StageKey[]; cost: number };

function reducer(state: WorkshopState, a: WorkshopAction): WorkshopState {
  switch (a.type) {
    case "jump":
      return { ...state, stage: a.stage };
    case "lock": {
      const already = !!state.lockedStages[a.stage];
      const ls = { ...state.lockedStages, [a.stage]: true };
      const order: StageKey[] = ["topic", "outline", "cast", "epscript", "factory", "prompt"];
      const next = order[order.indexOf(a.stage) + 1];
      return {
        ...state,
        lockedStages: ls,
        stage: next ?? a.stage,
        balance: already ? state.balance : Math.max(0, state.balance - a.cost),
      };
    }
    case "setEp":
      return { ...state, ep: a.ep };
    case "bindAvatar":
      return {
        ...state,
        chars: state.chars.map((c) =>
          c.id === a.charId
            ? { ...c, bound: true, refCount: c.refCount ?? 3, avatar: a.avatar ?? c.avatar }
            : c,
        ),
      };
    case "toggleRole":
      return {
        ...state,
        chars: state.chars.map((c) =>
          c.id === a.charId
            ? {
                ...c,
                role: c.role === "key" ? "extra" : "key",
                bound: c.role === "key" ? false : c.bound,
              }
            : c,
        ),
      };
    case "spend":
      return { ...state, balance: Math.max(0, state.balance - a.n) };
    case "runAllComplete": {
      const ls = { ...state.lockedStages };
      for (const k of a.keys) if (k !== "prompt") ls[k] = true;
      return {
        ...state,
        lockedStages: ls,
        stage: "prompt",
        balance: Math.max(0, state.balance - a.cost),
      };
    }
    default:
      return state;
  }
}

interface WorkshopShellProps {
  meta: DramaProjectSummary;
  data: ProjectData;
  /** 渲染中央工作区。基于当前 state.stage 返回对应阶段视图。 */
  renderStage: (props: { state: WorkshopState; dispatch: React.Dispatch<WorkshopAction> }) => React.ReactNode;
  initialStage?: StageKey;
}

export function WorkshopShell({ meta, data, renderStage, initialStage }: WorkshopShellProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [state, dispatch] = React.useReducer(reducer, undefined, () => ({
    stage: initialStage ?? ((meta.stage <= 3 ? "outline" : "epscript") as StageKey),
    ep: 1,
    lockedStages: {},
    chars: data.characters.map((c) => ({ ...c })),
    balance: 1280,
  }));
  // v4:角色面板默认收起,把宽度留给剧本正文
  const [castCollapsed, setCastCollapsed] = React.useState(true);
  const [runAllOpen, setRunAllOpen] = React.useState(false);
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1180px)");
    setNarrow(mq.matches);
    const fn = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const isEpisodeStage = EPISODE_STAGE_KEYS.includes(state.stage);

  const handleHome = () => router.push("/projects");
  const handleLogout = () => {
    logout();
    toast.success("已退出登录");
  };
  const handleRunAllComplete = (keys: StageKey[], cost: number) => {
    setRunAllOpen(false);
    dispatch({ type: "runAllComplete", keys, cost });
    toast.success("连跑完成 · 成片配方已就绪");
  };

  return (
    <div className="row" style={{ height: "100%", alignItems: "stretch" }}>
      {isEpisodeStage ? (
        <EpisodeRail
          ep={state.ep}
          total={data.projectInfo.episodes}
          episodes={data.episodes}
          slim={narrow}
          onEp={(n) => dispatch({ type: "setEp", ep: n })}
          onBack={() => dispatch({ type: "jump", stage: "outline" })}
        />
      ) : (
        <StageRail
          current={state.stage}
          locked={state.lockedStages}
          ep={state.ep}
          onJump={(s) => dispatch({ type: "jump", stage: s })}
          onHome={handleHome}
        />
      )}

      <div className="col grow" style={{ minWidth: 0 }}>
        <ProjectTopbar
          meta={meta}
          info={data.projectInfo}
          balance={state.balance}
          balancePulseKey={state.balance}
          hideMeta={narrow}
          onHome={handleHome}
          onRunAll={() => setRunAllOpen(true)}
          onLogout={handleLogout}
        />

        {isEpisodeStage && (
          <StepTabs
            stage={state.stage}
            ep={state.ep}
            locked={state.lockedStages}
            onJump={(s) => dispatch({ type: "jump", stage: s })}
          />
        )}

        <div className="grow" style={{ minHeight: 0, position: "relative", overflow: "hidden" }}>
          {renderStage({ state, dispatch })}
        </div>
      </div>

      {!(narrow && isEpisodeStage) && (
        <CastPanel
          chars={state.chars}
          collapsed={castCollapsed}
          onToggle={() => setCastCollapsed((v) => !v)}
          onBind={() => dispatch({ type: "jump", stage: "cast" })}
        />
      )}

      {runAllOpen && (
        <RunAllDialog
          current={state.stage}
          locked={state.lockedStages}
          onCancel={() => setRunAllOpen(false)}
          onComplete={handleRunAllComplete}
        />
      )}
    </div>
  );
}
