"use client";

// 阶段 1 选题立项 — 立项起点已在新建时完成,这里随时回看与微调。
// 设计真源:app.jsx `TopicStub`。
import * as React from "react";
import { ArrowRight, Link as LinkIcon } from "lucide-react";
import { Field, Meta } from "@/components/drama-ui";
import { StageHeader } from "../workbench";
import type { WorkshopAction, WorkshopState } from "../workbench";
import type { ProjectData } from "@/mocks/drama-workshop";

interface TopicStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
}

export function TopicStage({ data, dispatch }: TopicStageProps) {
  // 一句话点子立项的项目没有 topicCards（只有 projectInfo）；老的引导/模板项目才有。
  // 两种都要稳：标题回退 projectInfo，主线 / 选题字段按存在性渲染。
  const top = data.topicCards.find((t) => t.selected) ?? data.topicCards[0];
  const title = top?.title ?? data.projectInfo.title ?? "未命名短剧";
  const logline = data.projectInfo.logline?.trim();
  const mainline = data.projectInfo.mainline?.trim();
  return (
    <div className="scroll" style={{ height: "100%" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 32px" }}>
        <StageHeader
          no={1}
          scope="项目"
          title="选题立项"
          desc="立项起点已在新建时完成,这里随时回看与微调。"
        />
        <div className="card" style={{ padding: 22 }}>
          <div className="row gap-3" style={{ marginBottom: 14 }}>
            <span className="tag tag-accent">已选方向</span>
            <span style={{ fontWeight: 800, fontSize: 17 }}>{title}</span>
          </div>
          {logline ? <Field label="一句话剧情">{logline}</Field> : null}
          {mainline ? (
            <>
              <div style={{ height: 14 }} />
              <Field label="主线走向">
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {mainline.split(" → ").map((s, i, arr) => (
                    <React.Fragment key={`${s}-${i}`}>
                      <span className="chip static">{s}</span>
                      {i < arr.length - 1 && (
                        <ArrowRight size={13} style={{ color: "var(--ink-3)" }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </Field>
            </>
          ) : null}
          {top ? (
            <>
              <div style={{ height: 14 }} />
              <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
                <Meta label="黄金 3 秒" v={top.hook} />
                <Meta label="节奏" v={top.pace} />
                <Meta label="受众" v={top.audience} />
              </div>
            </>
          ) : null}
          {!logline && !mainline && !top ? (
            <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>
              这部短剧从一句话点子立项 —— 主线与选题方向还没填,直接去铺大纲让 AI 展开整季剧情。
            </div>
          ) : null}
          <div
            className="row"
            style={{ justifyContent: "flex-end", marginTop: 18, gap: 10 }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="重新立项(回到新建流)"
              onClick={() => {
                /* B8:跳新建流 */
              }}
            >
              <LinkIcon size={14} /> 重新立项
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => dispatch({ type: "jump", stage: "outline" })}
            >
              去铺大纲 <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
