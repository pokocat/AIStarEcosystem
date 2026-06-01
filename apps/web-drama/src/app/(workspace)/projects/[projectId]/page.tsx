"use client";

export const dynamic = "force-dynamic";

// 短剧工作台 — 沉浸式接管,自带 StageRail + 顶部项目条 + EpisodeStrip +
// CastPanel + 中央阶段视图。
// 各阶段内容(topic/outline/cast/script/board/prompt)由 B6/B7 填入完整组件,
// 当前 B5 给出 stub:每个阶段一张占位卡,验收外壳布局。
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Sparkles } from "lucide-react";
import { getProjectData, PROJECTS, type ProjectData } from "@/mocks/drama-workshop";
import {
  StageHeader,
  WorkshopShell,
  type WorkshopAction,
  type WorkshopState,
} from "@/components/drama-workshop/workbench";
import type { StageKey } from "@/components/drama-workshop";
import { CastStage, OutlineStage, TopicStage } from "@/components/drama-workshop/stages";

export default function ProjectWorkbench() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const id = params?.projectId ?? "";
  const meta = PROJECTS.find((p) => p.id === id);
  const data = getProjectData(id);

  if (!meta || !data) {
    return (
      <div className="col center" style={{ height: "100%", gap: 14, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>没找到这部短剧</h1>
        <div className="muted">可能是链接过期了。回到我的短剧重新挑选一部。</div>
        <button
          type="button"
          className="btn btn-line"
          onClick={() => router.push("/projects")}
        >
          <ChevronLeft size={16} /> 返回我的短剧
        </button>
      </div>
    );
  }

  return (
    <WorkshopShell
      meta={meta}
      data={data}
      initialStage={meta.stage <= 3 ? "outline" : "script"}
      renderStage={({ state, dispatch }) => (
        <StageOutlet state={state} dispatch={dispatch} data={data} prefilled={meta.mode === "template"} />
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
    default:
      return <StageStub state={state} dispatch={dispatch} />;
  }
}

// 各阶段占位 — B6/B7 将以真实组件替换。
const STAGE_META: Record<
  StageKey,
  { no: number; scope: "项目" | "剧集"; title: string; desc: string }
> = {
  topic:   { no: 1, scope: "项目", title: "选题立项",     desc: "立项起点已在新建时完成,这里随时回看与微调。" },
  outline: { no: 2, scope: "项目", title: "大纲分集",     desc: "铺好人物小传、主线,再把故事拆成一集一集的钩子和梗概。" },
  cast:    { no: 3, scope: "项目", title: "角色与资产", desc: "给关键角色绑定一个数字人分身锁住形象 —— 这是跨集一致性和真人脸的地基。" },
  script:  { no: 4, scope: "剧集", title: "单集剧本",     desc: "把这一集写成一个个场景。点任意文字即可直接编辑。" },
  board:   { no: 5, scope: "剧集", title: "分镜工作台", desc: "按剧本场景逐场拆镜。描述、台词点击即改,景别运镜在精修栏点选。" },
  prompt:  { no: 6, scope: "剧集", title: "成片配方",     desc: "逐镜整理好,可直接喂给视频大模型开拍。" },
};

function StageStub({
  state,
  dispatch,
}: {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
}) {
  const m = STAGE_META[state.stage];
  const titleWithEp =
    m.scope === "剧集" ? `第 ${state.ep} 集 · ${m.title.replace(/^.*·\s*/, "")}` : m.title;
  return (
    <div className="scroll" style={{ height: "100%" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 32px 64px" }}>
        <StageHeader no={m.no} scope={m.scope} title={titleWithEp} desc={m.desc} />
        <div
          className="card col center"
          style={{ padding: "60px 24px", gap: 14, textAlign: "center" }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 20,
              background: "var(--accent-soft)",
              display: "grid",
              placeItems: "center",
              color: "var(--accent)",
            }}
          >
            <Sparkles size={28} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              「{m.title}」工作区
            </div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 4, maxWidth: 380 }}>
              {m.desc}
            </div>
          </div>
          <div className="row gap-3">
            {state.lockedStages[state.stage] ? (
              <span className="tag tag-accent">已锁定</span>
            ) : (
              <button
                type="button"
                className="btn btn-grad"
                onClick={() =>
                  dispatch({ type: "lock", stage: state.stage, cost: 0 })
                }
              >
                <Sparkles size={15} /> 演示:锁定本阶段并进入下一步
              </button>
            )}
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
            真正的「{m.title}」交互将在{" "}
            {m.scope === "项目" ? "B6" : "B7"} 批次填入。
          </div>
        </div>
      </div>
    </div>
  );
}
