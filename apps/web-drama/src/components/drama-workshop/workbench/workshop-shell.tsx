"use client";

// 工作台外壳 v4 — 设计真源:app-v4.jsx `Workbench`。
// 短剧设定阶段:左阶段轨;逐集制作阶段:左分集导航 + 顶部步骤页签。
// 右侧角色面板默认收起,把宽度留给剧本正文;≤1180px 分集轨收窄为图标轨。
//
// v0.197 响应式（docs/drama-ux-copy-pass.md §5.2-2，样式在 styles/pages/workbench.css）：
//   · ≤860 左阶段轨隐藏，顶栏下出一条横向阶段切换（StageBar）；
//   · 角色面板只在逐集制作阶段出现（设定页自己有完整的角色区）；≤1180 收进顶栏「角色」按钮打开的抽屉；
//   · ≤720 分集轨隐藏，步骤页签左侧「第 N 集」变成集选择器。
// v0.197 余额：读真实钱包（useWallet），不再在 reducer 里写死 1280、本地做减法 —— 扣费真值在后端。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@ai-star-eco/api-client";
import { getEpisodeDoc, type CharacterDef, type ProjectData, type DramaProjectSummary } from "@/mocks/drama-workshop";
import { useWallet, notifyWalletChanged } from "@/lib/use-wallet";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { ProjectTopbar } from "./project-topbar";
import { StageBar, StageRail } from "./stage-rail";
import { EpisodeRail, type EpisodeStatus } from "./episode-rail";
import { StepTabs } from "./step-tabs";
import { CastPanel } from "./cast-panel";
import { AvatarPicker, bindAvatarToChars, unbindAvatar } from "../stages/cast/avatar-picker";
import { EPISODE_STAGE_KEYS, type StageKey } from "../stages-config";
import { useRegisterWorkbenchDispatch } from "./live-dispatch";

export interface WorkshopState {
  /** 当前阶段 */
  stage: StageKey;
  /** 当前剧集编号(剧集阶段用) */
  ep: number;
  /** 各阶段是否已确认（只在本次打开期间有效，不落库） */
  lockedStages: Partial<Record<StageKey, boolean>>;
  /** 角色当前状态(运行时可改) */
  chars: CharacterDef[];
}

export type WorkshopAction =
  | { type: "jump"; stage: StageKey }
  /** cost 仅为兼容旧调用保留；余额不在前端算。 */
  | { type: "lock"; stage: StageKey; cost?: number }
  | { type: "setEp"; ep: number }
  | { type: "bindAvatar"; charId: string; avatar?: string }
  | { type: "toggleRole"; charId: string }
  | { type: "setChars"; chars: CharacterDef[] }
  /**
   * 只改一个角色的几个字段，按 reducer 里的最新角色表合并。
   * 上传 / 出图这种要等几秒的操作回写用它：用点击那一刻的 state.chars 整表 setChars，
   * 会把等待期间对别的角色的改动盖掉。
   */
  | { type: "patchChar"; charId: string; patch: Partial<CharacterDef> }
  /**
   * 「花了积分」的通知。v0.197 起不再本地扣减：外壳收到后只让钱包重读一次（notifyWalletChanged）。
   * n 保留只为不改调用方。
   */
  | { type: "spend"; n: number };

export function workshopReducer(state: WorkshopState, a: WorkshopAction): WorkshopState {
  switch (a.type) {
    case "jump":
      return { ...state, stage: a.stage };
    case "lock": {
      const ls = { ...state.lockedStages, [a.stage]: true };
      const order: StageKey[] = ["topic", "outline", "cast", "epscript", "prompt"];
      const next = order[order.indexOf(a.stage) + 1];
      return { ...state, lockedStages: ls, stage: next ?? a.stage };
    }
    case "setEp":
      return { ...state, ep: a.ep };
    case "setChars":
      return { ...state, chars: a.chars.map((c) => ({ ...c })) };
    case "patchChar":
      return { ...state, chars: state.chars.map((c) => (c.id === a.charId ? { ...c, ...a.patch } : c)) };
    case "bindAvatar":
      return {
        ...state,
        chars: state.chars.map((c) =>
          c.id === a.charId ? { ...c, bound: true, avatar: a.avatar ?? c.avatar } : c,
        ),
      };
    case "toggleRole":
      // 主要角色 → 配角：解绑数字人（连 id 和那张图一起清，定妆照 / 多角度参考图留着）；配角 → 主要角色：原样。
      return {
        ...state,
        chars: state.chars.map((c) =>
          c.id !== a.charId ? c : c.role === "key" ? { ...unbindAvatar(c), role: "extra" } : { ...c, role: "key" },
        ),
      };
    case "spend":
      return state;
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
  /**
   * v0.79：把当前线性项目转换为互动剧（启用分支叠加层并落库）；非互动剧项目的左轨展示入口。
   * v0.197：先弹确认，返回 true 表示真的转了（外壳才跳到互动编排）。
   */
  onConvertInteractive?: () => Promise<boolean>;
  /** v0.89：顶栏右侧状态槽（保存状态指示器），渲染在余额左侧。 */
  headerRight?: React.ReactNode;
}

/** 某一集做到哪了：按真实产物算（合成过成片 / 拆过分镜 / 还没开始）。 */
function episodeStatus(data: ProjectData, no: number): EpisodeStatus {
  const docs = data.episodeDocs;
  const hasDocs = !!docs && Object.keys(docs).length > 0;
  const doc = docs?.[String(no)];
  if (doc?.assembled?.url) return { label: "已合成成片", tone: "done" };
  // 旧项目没有 episodeDocs 时，只有 legacy storyboard 对应的那一集算数（getEpisodeDoc 会把它借给每一集）。
  const board = doc?.storyboard ?? (!hasDocs && data.storyboard?.ep === no ? getEpisodeDoc(data, no).storyboard : undefined);
  const shots = (board?.scenes ?? []).reduce((n, s) => n + (s.shots?.length ?? 0), 0);
  if (shots > 0) return { label: `已拆 ${shots} 镜`, tone: "progress" };
  return { label: "还没开始", tone: "idle" };
}

export function WorkshopShell({ meta, data, renderStage, initialStage, onConvertInteractive, headerRight }: WorkshopShellProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const { wallet } = useWallet();
  const [state, rawDispatch] = React.useReducer(workshopReducer, undefined, () => ({
    stage: initialStage ?? ((meta.stage <= 3 ? "outline" : "epscript") as StageKey),
    ep: 1,
    lockedStages: {},
    chars: data.characters.map((c) => ({ ...c })),
  }));
  // 花了积分 → 让所有 useWallet() 重读一次（通用顶栏、本顶栏都会跟着变），不在前端做减法。
  const dispatch = React.useCallback<React.Dispatch<WorkshopAction>>((a) => {
    if (a.type === "spend") {
      notifyWalletChanged();
      return;
    }
    rawDispatch(a);
  }, []);
  // 登记成「这部短剧现在挂着的工作台」：已卸载组件迟到的生成结果（重新生成角色等）发到这里，屏幕才跟得上。
  useRegisterWorkbenchDispatch(meta.id, dispatch);

  // v4:角色面板默认收起,把宽度留给剧本正文
  const [castCollapsed, setCastCollapsed] = React.useState(true);
  // ≤1180：角色面板收进抽屉（CSS 控制谁显示；这里只管抽屉开没开）
  const [castDrawer, setCastDrawer] = React.useState(false);
  // 在角色面板里点「绑定数字人」：原地打开选择器，不切阶段。
  const [binding, setBinding] = React.useState<CharacterDef | null>(null);
  const drawerRef = React.useRef<HTMLDivElement | null>(null);
  useModalA11y(drawerRef, () => setCastDrawer(false), castDrawer);
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1180px)");
    setNarrow(mq.matches);
    const fn = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const isEpisodeStage = EPISODE_STAGE_KEYS.includes(state.stage);
  const interactive = !!data.interactive?.enabled;
  // 互动剧从「互动编排」点「制作本集」进来，返回也要回互动编排，而不是短剧设定。
  const backStage: StageKey = interactive ? "branch" : "outline";
  const backLabel = interactive ? "互动编排" : "短剧设定";

  // 离开逐集制作时收起抽屉，免得回来时它还开着。
  React.useEffect(() => {
    if (!isEpisodeStage) setCastDrawer(false);
  }, [isEpisodeStage]);

  const handleHome = () => router.push("/projects");
  const handleLogout = () => {
    logout();
    toast.success("已退出登录");
  };
  const handleConvert = onConvertInteractive
    ? () => {
        void (async () => {
          const ok = await onConvertInteractive();
          if (ok) dispatch({ type: "jump", stage: "branch" });
        })();
      }
    : undefined;

  const castPanelProps = {
    chars: state.chars,
    onBind: (c: CharacterDef) => setBinding(c),
  };

  return (
    <div className="row wb-shell" style={{ height: "100%", alignItems: "stretch", minWidth: 0 }}>
      {isEpisodeStage ? (
        <EpisodeRail
          ep={state.ep}
          total={data.projectInfo.episodes}
          episodes={data.episodes}
          slim={narrow}
          backTo={interactive ? "branch" : "setup"}
          statusOf={(no) => episodeStatus(data, no)}
          onEp={(n) => dispatch({ type: "setEp", ep: n })}
          onBack={() => dispatch({ type: "jump", stage: backStage })}
          onAddMore={() => {
            dispatch({ type: "jump", stage: "outline" });
            // 回到设定页后直接滚到「补齐剩下的分集」那张卡（outline.tsx #wb-fill-rest）
            window.setTimeout(() => document.getElementById("wb-fill-rest")?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
          }}
        />
      ) : (
        <StageRail
          meta={meta}
          current={state.stage}
          locked={state.lockedStages}
          ep={state.ep}
          episodes={data.projectInfo.episodes}
          interactive={interactive}
          onConvert={handleConvert}
          onJump={(s) => dispatch({ type: "jump", stage: s })}
          onHome={handleHome}
        />
      )}

      <div className="col grow" style={{ minWidth: 0 }}>
        <ProjectTopbar
          meta={meta}
          info={data.projectInfo}
          balance={wallet ? wallet.totalBalance : null}
          balancePulseKey={wallet?.totalBalance}
          hideMeta={narrow}
          statusSlot={headerRight}
          onHome={handleHome}
          onLogout={handleLogout}
          onBalance={() => router.push("/wallet")}
          onOpenCast={isEpisodeStage ? () => setCastDrawer(true) : undefined}
          railKind={isEpisodeStage ? "episode" : "stage"}
        />

        {!isEpisodeStage && (
          <StageBar
            current={state.stage}
            ep={state.ep}
            interactive={interactive}
            onConvert={handleConvert}
            onJump={(s) => dispatch({ type: "jump", stage: s })}
          />
        )}

        {isEpisodeStage && (
          <StepTabs
            stage={state.stage}
            ep={state.ep}
            locked={state.lockedStages}
            onJump={(s) => dispatch({ type: "jump", stage: s })}
            episodes={data.episodes}
            onEp={(n) => dispatch({ type: "setEp", ep: n })}
            onBack={() => dispatch({ type: "jump", stage: backStage })}
            backLabel={backLabel}
          />
        )}

        <div className="grow" style={{ minHeight: 0, position: "relative", overflow: "hidden" }}>
          {renderStage({ state, dispatch })}
        </div>
      </div>

      {/* 角色面板：只在逐集制作阶段；>1180 贴右侧，≤1180 由 CSS 藏起来、改走顶栏「角色」抽屉 */}
      {isEpisodeStage && (
        <CastPanel
          {...castPanelProps}
          collapsed={castCollapsed}
          onToggle={() => setCastCollapsed((v) => !v)}
        />
      )}
      {isEpisodeStage && castDrawer && (
        <div className="wb-cast-drawer-overlay" onClick={() => setCastDrawer(false)}>
          <div ref={drawerRef} className="wb-cast-drawer" role="dialog" aria-modal="true" aria-label="角色" onClick={(e) => e.stopPropagation()}>
            <CastPanel {...castPanelProps} collapsed={false} inDrawer onToggle={() => setCastDrawer(false)} />
          </div>
        </div>
      )}

      {binding && (
        <AvatarPicker
          char={binding}
          onClose={() => setBinding(null)}
          onConfirm={(charId, picked) => {
            dispatch({ type: "setChars", chars: bindAvatarToChars(state.chars, charId, picked) });
            setBinding(null);
            toast.success(`已给「${binding.name}」绑定数字人，之后每一集都用这张脸`);
          }}
        />
      )}
    </div>
  );
}
