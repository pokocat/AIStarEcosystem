"use client";

// 工作台外壳 — 集成 StageRail + 顶部项目条 + EpisodeStrip + 中央工作区 +
// 右侧角色面板。每个 stage 内容由外部传入(B6/B7 填)。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@ai-star-eco/api-client";
import type { CharacterDef, ProjectData, DramaProjectSummary } from "@/mocks/drama-workshop";
import { ProjectTopbar } from "./project-topbar";
import { StageRail } from "./stage-rail";
import { EpisodeStrip } from "./episode-strip";
import { CastPanel } from "./cast-panel";
import type { StageKey } from "../stages-config";

export interface WorkshopState {
  /** 当前阶段 */
  stage: StageKey;
  /** 当前剧集编号(④⑤⑥ 用) */
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
  | { type: "spend"; n: number };

function reducer(state: WorkshopState, a: WorkshopAction): WorkshopState {
  switch (a.type) {
    case "jump":
      return { ...state, stage: a.stage };
    case "lock": {
      const already = !!state.lockedStages[a.stage];
      const ls = { ...state.lockedStages, [a.stage]: true };
      const order: StageKey[] = ["topic", "outline", "cast", "script", "board", "prompt"];
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
    default:
      return state;
  }
}

interface WorkshopShellProps {
  meta: DramaProjectSummary;
  data: ProjectData;
  /**
   * 渲染中央工作区。基于当前 state.stage 返回对应阶段视图。
   * 由 page.tsx 注入(B6/B7 将填入各阶段真实组件;当前 B5 注入 stub)。
   */
  renderStage: (props: { state: WorkshopState; dispatch: React.Dispatch<WorkshopAction> }) => React.ReactNode;
  /** 是否显示剧集概览带(仅 script/board/prompt 阶段) */
  initialStage?: StageKey;
}

const EPISODE_STAGES: StageKey[] = ["script", "board", "prompt"];

export function WorkshopShell({ meta, data, renderStage, initialStage }: WorkshopShellProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [state, dispatch] = React.useReducer(reducer, undefined, () => ({
    stage: initialStage ?? (meta.stage <= 3 ? "outline" : "script") as StageKey,
    ep: 1,
    lockedStages: {},
    chars: data.characters.map((c) => ({ ...c })),
    balance: 1280,
  }));
  const [castCollapsed, setCastCollapsed] = React.useState(false);

  const isEpisodeStage = EPISODE_STAGES.includes(state.stage);

  const handleHome = () => router.push("/projects");
  const handleLogout = () => {
    logout();
    toast.success("已退出登录");
  };
  const handleRunAll = () => {
    toast.success("一键连跑:即将上线(B8)");
  };

  return (
    <div className="row" style={{ height: "100%", alignItems: "stretch" }}>
      <StageRail
        current={state.stage}
        locked={state.lockedStages}
        onJump={(s) => dispatch({ type: "jump", stage: s })}
        onHome={handleHome}
      />

      <div className="col grow" style={{ minWidth: 0 }}>
        <ProjectTopbar
          meta={meta}
          info={data.projectInfo}
          balance={state.balance}
          balancePulseKey={state.balance}
          onHome={handleHome}
          onRunAll={handleRunAll}
          onLogout={handleLogout}
        />

        {isEpisodeStage && (
          <EpisodeStrip
            ep={state.ep}
            total={data.projectInfo.episodes}
            episodes={data.episodes}
            onChange={(n) => dispatch({ type: "setEp", ep: n })}
          />
        )}

        <div className="grow" style={{ minHeight: 0, position: "relative", overflow: "hidden" }}>
          {renderStage({ state, dispatch })}
        </div>
      </div>

      <CastPanel
        chars={state.chars}
        collapsed={castCollapsed}
        onToggle={() => setCastCollapsed((v) => !v)}
        onBind={() => dispatch({ type: "jump", stage: "cast" })}
      />
    </div>
  );
}
