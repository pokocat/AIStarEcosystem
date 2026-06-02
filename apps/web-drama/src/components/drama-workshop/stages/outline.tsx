"use client";

// 阶段 2 大纲分集 — 一句话剧情 + 主线 + AI 协作分集卡(钩子/梗概/beat,
// 可拖拽调序 / 重写)。
// 设计真源:screens-project.jsx `OutlineStage / EpisodeRow / Field`。
import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Edit,
  GripVertical,
  Layers,
  Link as LinkIcon,
  List,
  Lock,
  Plus,
} from "lucide-react";
import {
  AICollab,
  Field,
  GenSkeleton,
  useGen,
} from "@/components/drama-ui";
import { StageHeader } from "../workbench";
import type { WorkshopAction, WorkshopState } from "../workbench";
import type { EpisodeOutline, ProjectData } from "@/mocks/drama-workshop";
import { STAGE_BY_KEY } from "../stages-config";

interface OutlineStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  /** 模板模式:已预填,做"改而非建"的提示 */
  prefilled?: boolean;
}

export function OutlineStage({ state, dispatch, data, prefilled }: OutlineStageProps) {
  const initialPhase = state.lockedStages.outline ? "done" : "done"; // 默认已生成态,演示
  const { phase, run, retry } = useGen({ initial: initialPhase });
  const [eps, setEps] = React.useState<EpisodeOutline[]>(data.episodes);

  const reorderEp = (fromNo: number, toNo: number) =>
    setEps((arr) => {
      const f = arr.findIndex((x) => x.no === fromNo);
      const tIdx = arr.findIndex((x) => x.no === toNo);
      if (f < 0 || tIdx < 0 || f === tIdx) return arr;
      const next = [...arr];
      const [m] = next.splice(f, 1);
      next.splice(tIdx, 0, m);
      return next;
    });

  const stageCost = STAGE_BY_KEY.outline.cost;

  return (
    <div className="scroll" style={{ height: "100%" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 32px 64px" }}>
        <StageHeader
          no={2}
          scope="项目"
          title="大纲分集"
          desc="铺好人物小传、主线,再把故事拆成一集一集的钩子和梗概。"
          right={
            prefilled && (
              <span className="tag tag-pink">
                <Layers size={12} /> 模板已预填,改而非建
              </span>
            )
          }
        />

        {/* 主线 & 一句话设定 */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="row gap-2" style={{ marginBottom: 14 }}>
            <LinkIcon size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 700 }}>主线 &amp; 一句话设定</span>
          </div>
          <div className="col gap-3">
            <Field label="一句话剧情">{data.projectInfo.logline}</Field>
            <Field label="主线走向">
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {data.projectInfo.mainline.split(" → ").map((s, i, arr) => (
                  <React.Fragment key={`${s}-${i}`}>
                    <span className="chip static">{s}</span>
                    {i < arr.length - 1 && (
                      <ArrowRight size={13} style={{ color: "var(--ink-3)" }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </Field>
          </div>
        </div>

        {/* 分集 AI 协作块 */}
        <AICollab
          title="分集梗概"
          hint="一集一卡,每集都有黄金 3 秒钩子和卡点"
          cost={stageCost}
          generating={phase === "gen"}
          done={phase === "done"}
          error={phase === "error"}
          locked={state.lockedStages.outline}
          onGenerate={run}
          onRetry={retry}
          onLock={() =>
            dispatch({ type: "lock", stage: "outline", cost: stageCost })
          }
        >
          {phase === "idle" && (
            <div
              className="col center"
              style={{ padding: "30px 0", textAlign: "center", gap: 12 }}
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
                <List size={26} />
              </div>
              <div className="muted" style={{ maxWidth: 320, fontSize: 13.5 }}>
                点右上「AI 起草」,根据你的主线生成 {data.projectInfo.episodes}{" "}
                集的钩子与梗概。
              </div>
            </div>
          )}
          {phase === "gen" && (
            <GenSkeleton
              lines={4}
              label={`正在按主线铺 ${data.projectInfo.episodes} 集钩子…`}
            />
          )}
          {phase === "done" && (
            <div className="col gap-3">
              {eps.map((e, i) => (
                <EpisodeRow
                  key={e.no}
                  e={e}
                  delay={i * 50}
                  prefilled={prefilled}
                  onReorder={reorderEp}
                  onRewrite={() =>
                    toast.success(`已为第 ${e.no} 集重写梗概`)
                  }
                />
              ))}
              <button
                type="button"
                className="btn btn-line"
                style={{ alignSelf: "flex-start", marginTop: 4 }}
              >
                <Plus size={15} /> 加一集
              </button>
            </div>
          )}
        </AICollab>
      </div>
    </div>
  );
}

function EpisodeRow({
  e,
  delay,
  prefilled,
  onReorder,
  onRewrite,
}: {
  e: EpisodeOutline;
  delay: number;
  prefilled?: boolean;
  onReorder?: (fromNo: number, toNo: number) => void;
  onRewrite?: () => void;
}) {
  const [hover, setHover] = React.useState(false);
  const [over, setOver] = React.useState(false);
  return (
    <div
      className="card fade-up"
      style={{
        padding: 16,
        animationDelay: delay + "ms",
        position: "relative",
        borderLeft: prefilled ? "3px solid var(--accent-2)" : undefined,
        boxShadow: over ? "0 0 0 2px var(--accent)" : undefined,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(ev) => {
        ev.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(ev) => {
        ev.preventDefault();
        setOver(false);
        const fromNo = Number(ev.dataTransfer.getData("text/plain"));
        if (fromNo && fromNo !== e.no) onReorder?.(fromNo, e.no);
      }}
    >
      <div className="row gap-3" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: "none", textAlign: "center" }}>
          <span
            draggable
            title="拖拽调序"
            onDragStart={(ev) => {
              ev.dataTransfer.setData("text/plain", String(e.no));
              ev.dataTransfer.effectAllowed = "move";
            }}
            style={{
              cursor: "grab",
              color: "var(--ink-3)",
              display: "block",
              marginBottom: 2,
            }}
          >
            <GripVertical size={14} />
          </span>
          <div
            className="num"
            style={{
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1,
              color: "var(--accent)",
            }}
          >
            {String(e.no).padStart(2, "0")}
          </div>
          {e.locked && (
            <Lock size={12} style={{ color: "var(--ink-3)", marginTop: 4 }} />
          )}
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--line)" }} />
        <div className="grow">
          <div className="row gap-2" style={{ marginBottom: 5, flexWrap: "wrap" }}>
            <span className="tag tag-accent">{e.beat}</span>
            {prefilled && (
              <span className="tag tag-pink">
                <Layers size={11} /> 模板已填
              </span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>
            {e.hook}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{e.synopsis}</div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{
            opacity: hover ? 1 : 0,
            transition: "opacity .15s",
            flex: "none",
          }}
          onClick={onRewrite}
        >
          <Edit size={14} /> 重写梗概
        </button>
      </div>
    </div>
  );
}
