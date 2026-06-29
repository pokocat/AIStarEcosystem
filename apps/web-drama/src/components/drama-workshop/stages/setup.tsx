"use client";

// 短剧设定（v0.88）— 设计稿 AI短剧工作台.dc.html `wbStageView`：
// 把「大纲分集」+「角色与场景」合并成一页（剧情大纲 + 分集剧情 + 角色与场景设定），
// 左轨为两步流程（短剧设定 / 剧集工作台）。所有内容均来自后端 ProjectData 并落库。
import * as React from "react";
import { Check } from "lucide-react";
import type { WorkshopAction, WorkshopState } from "../workbench";
import type { ProjectData } from "@/mocks/drama-workshop";
import { OutlineStage } from "./outline";
import { CastStage } from "./cast";
import type { StageContext } from "./stage-context";

interface SetupStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  prefilled?: boolean;
  ctx: StageContext;
}

export function SetupStage({ state, dispatch, data, prefilled, ctx }: SetupStageProps) {
  const enterEpisode = async () => {
    try {
      await ctx.saveData({ ...data, characters: state.chars }, { stage: 4, progress: 50 });
    } catch {
      /* saveData 内部已提示，继续进剧集工作台 */
    }
    dispatch({ type: "lock", stage: "outline", cost: 0 });
    dispatch({ type: "setEp", ep: 1 });
    dispatch({ type: "jump", stage: "epscript" });
  };

  return (
    <div className="scroll" style={{ height: "100%", position: "relative" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 32px 104px" }}>
        <div className="col gap-2" style={{ marginBottom: 4 }}>
          <div className="row gap-2">
            <span className="tag tag-gray">项目设置</span>
            <span className="tag tag-accent">跨集共享</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>短剧设定</h1>
          <div className="muted" style={{ fontSize: 13.5 }}>
            一页把这部剧定下来：讲什么故事、每集怎么勾人、主角长什么样 —— 改好了再一集集拍。
          </div>
        </div>

        {/* 剧情大纲 + 分集剧情 */}
        <OutlineStage embedded state={state} dispatch={dispatch} data={data} prefilled={prefilled} ctx={ctx} />

        {/* 角色与场景设定 */}
        <CastStage embedded state={state} dispatch={dispatch} data={data} ctx={ctx} />
      </div>

      {/* 浮动操作条（固定右下角） */}
      <div
        style={{
          position: "fixed",
          right: 80,
          bottom: 24,
          zIndex: 40,
          display: "flex",
          gap: 12,
          background: "color-mix(in oklch, var(--surface) 84%, transparent)",
          backdropFilter: "blur(8px)",
          padding: "10px 12px",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--line-soft)",
        }}
      >
        <button type="button" onClick={() => void enterEpisode()} className="btn btn-primary">
          <Check size={16} /> 锁定，进剧集工作台
        </button>
      </div>
    </div>
  );
}
