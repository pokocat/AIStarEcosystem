"use client";

// 短剧设定（v0.88）— 设计稿 AI短剧工作台.dc.html `wbStageView`：
// 把「大纲分集」+「角色与场景」合并成一页（故事大纲 + 分集剧情 + 角色与场景），
// 左轨为两步流程（短剧设定 / 逐集制作）。所有内容均来自后端 ProjectData 并落库。
// v0.197：浮动按钮进的是当前那一集（与左轨「逐集制作」同一个去处），手机上变成贴底通栏
//（styles/pages/workbench.css `.wb-setup-cta`）。
import * as React from "react";
import { ArrowRight } from "lucide-react";
import type { WorkshopAction, WorkshopState } from "../workbench";
import type { ProjectData } from "@/mocks/drama-workshop";
import { OutlineStage } from "./outline";
import { CAST_SECTION_ID, CastStage } from "./cast";
import type { StageContext } from "./stage-context";

interface SetupStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  prefilled?: boolean;
  ctx: StageContext;
}

export function SetupStage({ state, dispatch, data, prefilled, ctx }: SetupStageProps) {
  const single = data.projectInfo.episodes === 1;
  const ep = state.ep || 1;

  // 设定页是「大纲 + 角色与场景」一整页，"outline" 与 "cast" 都落在这里。别处 jump 到 "cast"
  //（如分镜表「还没有场景图 · 去添加」）是要找角色与场景，滚到那一块，不停在页面顶部。
  React.useEffect(() => {
    if (state.stage !== "cast") return;
    const raf = requestAnimationFrame(() => {
      document.getElementById(CAST_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [state.stage]);

  const enterEpisode = async () => {
    try {
      // 按最新文档合并（不拿渲染时的 data 快照整份保存，免得盖掉刚写回的内容）。
      await ctx.patchData((prev) => ({ ...prev, characters: state.chars }), { stage: 4, progress: 50 });
    } catch {
      /* saveData 内部已提示，继续进逐集制作 */
    }
    dispatch({ type: "lock", stage: "outline" });
    dispatch({ type: "setEp", ep });
    dispatch({ type: "jump", stage: "epscript" });
  };

  return (
    <div className="scroll" style={{ height: "100%", position: "relative" }}>
      <div className="wb-setup-body" style={{ maxWidth: 960, margin: "0 auto", padding: "24px 32px 104px" }}>
        <div className="col gap-2" style={{ marginBottom: 4 }}>
          <div className="row gap-2">
            <span className="tag tag-accent">所有集通用</span>
          </div>
          <div className="row gap-2" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>短剧设定</h1>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {single ? "故事、人物在这儿定好，就可以去做这一集。" : "故事、分集、人物都在这儿定好，再一集一集往下做。"}
            </span>
          </div>
        </div>

        {/* 故事大纲 + 分集剧情 */}
        <OutlineStage state={state} dispatch={dispatch} data={data} prefilled={prefilled} ctx={ctx} />

        {/* 角色与场景 */}
        <CastStage state={state} dispatch={dispatch} data={data} ctx={ctx} />
      </div>

      {/* 浮动操作条（固定右下角；≤720 贴底通栏） */}
      <div
        className="wb-setup-cta"
        style={{
          position: "fixed",
          right: 24,
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
          {single ? "设定好了，去做这一集" : `设定好了，去做第 ${ep} 集`} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
