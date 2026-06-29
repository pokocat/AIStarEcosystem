"use client";

// 试玩走查弹窗（v0.79）—— 创作端验证工具（非播放器运行时）。
// 从起始集出发，像观众一样按选项走分支：命中互动点先判 condition，选项 setFlags 写回全局标记，
// 沿 nextVideoId 推进，直到结局。用来验证接线 / 条件 / 结局是否如预期，不做 timeupdate / 断点恢复。
import * as React from "react";
import { Play, X, RotateCcw, Flag, ArrowRight, CircleAlert } from "lucide-react";
import type { FlagValue, InteractionPoint, InteractiveStoryData } from "@/lib/interactive-types";
import { applySetFlags, evalCondition } from "@/lib/interactive-graph";

interface Props {
  open: boolean;
  data: InteractiveStoryData;
  onClose: () => void;
}

interface Step {
  episodeId: string;
  title: string;
  via?: string;
}

export function PlaythroughDialog({ open, data, onClose }: Props) {
  const byId = React.useMemo(() => new Map(data.episodes.map((e) => [e.episodeId, e])), [data]);
  const [flags, setFlags] = React.useState<Record<string, FlagValue>>({});
  const [currentId, setCurrentId] = React.useState<string>("");
  const [path, setPath] = React.useState<Step[]>([]);

  const reset = React.useCallback(() => {
    setFlags({ ...(data.globalFlags ?? {}) });
    setCurrentId(data.startEpisodeId);
    setPath(data.startEpisodeId && byId.get(data.startEpisodeId) ? [{ episodeId: data.startEpisodeId, title: byId.get(data.startEpisodeId)!.title }] : []);
  }, [data, byId]);

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  if (!open) return null;

  const cur = byId.get(currentId);
  // 当前集生效的互动点：按 triggerTime 升序，第一个 condition 通过且有选项的「选择」点。
  const activeInteraction: InteractionPoint | undefined = cur
    ? [...(cur.interactions ?? [])]
        .sort((a, b) => a.triggerTime - b.triggerTime)
        .find((it) => (it.uiConfig?.options?.length ?? 0) > 0 && evalCondition(it.condition, flags))
    : undefined;

  const goTo = (episodeId: string | null | undefined, via?: string) => {
    if (!episodeId || !byId.get(episodeId)) return;
    setCurrentId(episodeId);
    setPath((p) => [...p, { episodeId, title: byId.get(episodeId)!.title, via }]);
  };

  const pick = (text: string, nextVideoId: string | null, setFlagsPatch?: Record<string, FlagValue>) => {
    if (setFlagsPatch) setFlags((f) => applySetFlags(f, setFlagsPatch));
    goTo(nextVideoId, text);
  };

  const noStart = !data.startEpisodeId || !byId.get(data.startEpisodeId);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in col"
        style={{ width: 560, maxWidth: "94vw", maxHeight: "88vh", padding: 0, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-2" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <Play size={17} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 800, fontSize: 15 }}>试玩走查</span>
          <span className="faint" style={{ fontSize: 11 }}>模拟观众视角走查，验证连线 / 条件 / 结局</span>
          <span className="grow" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
            <RotateCcw size={13} /> 重新开始
          </button>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="scroll col gap-3" style={{ padding: 20, minHeight: 0 }}>
          {noStart ? (
            <div className="row gap-2" style={{ color: "var(--danger)", fontSize: 13 }}>
              <CircleAlert size={16} /> 还没有可用的起始集，无法试玩。
            </div>
          ) : !cur ? (
            <div className="faint">已结束。</div>
          ) : (
            <>
              {/* 全局标记状态 */}
              {Object.keys(flags).length > 0 && (
                <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                  {Object.entries(flags).map(([k, v]) => (
                    <span key={k} className="tag tag-gray num" style={{ fontSize: 10.5 }}>
                      {k} = {String(v)}
                    </span>
                  ))}
                </div>
              )}

              {/* 当前集 */}
              <div className="card col gap-2" style={{ padding: 16 }}>
                <div className="row gap-2">
                  {cur.isEnding && <Flag size={14} style={{ color: "#d97706" }} />}
                  <span style={{ fontWeight: 800, fontSize: 15 }}>{cur.title}</span>
                  <span className="faint num" style={{ fontSize: 11 }}>{cur.episodeId}</span>
                </div>
                {cur.synopsis && <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{cur.synopsis}</div>}
                {cur.videoUrl ? (
                  <video src={cur.videoUrl} controls muted playsInline style={{ width: "100%", maxHeight: 220, borderRadius: 10, background: "#000" }} />
                ) : (
                  <div className="faint" style={{ fontSize: 11.5 }}>（本集尚未生成成片，试玩仅模拟逻辑）</div>
                )}
              </div>

              {/* 结局 / 互动 / 续播 */}
              {cur.isEnding ? (
                <div
                  className="col center gap-2"
                  style={{ padding: "20px", background: "var(--accent-soft)", borderRadius: 12, textAlign: "center" }}
                >
                  <Flag size={22} style={{ color: "#d97706" }} />
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{cur.endingLabel || "结局"}</div>
                  <div className="faint" style={{ fontSize: 12 }}>这条线到此结束 · 共 {path.length} 集</div>
                </div>
              ) : activeInteraction ? (
                <div className="col gap-2">
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {activeInteraction.uiConfig.question}
                    {activeInteraction.uiConfig.countdownSec ? (
                      <span className="faint num" style={{ fontSize: 11, marginLeft: 6 }}>（限时 {activeInteraction.uiConfig.countdownSec}s）</span>
                    ) : null}
                  </div>
                  {activeInteraction.condition && (
                    <div className="faint num" style={{ fontSize: 10.5 }}>条件命中：{activeInteraction.condition}</div>
                  )}
                  {(activeInteraction.uiConfig.options ?? []).map((o) => {
                    const broken = !o.nextVideoId || !byId.get(o.nextVideoId);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className="btn btn-line"
                        style={{ justifyContent: "space-between", opacity: broken ? 0.6 : 1 }}
                        disabled={broken}
                        onClick={() => pick(o.text, o.nextVideoId, o.setFlags)}
                      >
                        <span>{o.text}</span>
                        <span className="row gap-1 faint" style={{ fontSize: 11 }}>
                          {o.setFlags && Object.keys(o.setFlags).length > 0 && (
                            <span className="num">{Object.entries(o.setFlags).map(([k, v]) => `${k}=${v}`).join(",")}</span>
                          )}
                          {broken ? <span style={{ color: "var(--danger)" }}>断点</span> : <ArrowRight size={13} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : cur.nextVideoId && byId.get(cur.nextVideoId) ? (
                <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => goTo(cur.nextVideoId, "续播")}>
                  续播下一集 <ArrowRight size={14} />
                </button>
              ) : (
                <div className="row gap-2" style={{ color: "var(--danger)", fontSize: 13 }}>
                  <CircleAlert size={16} /> 断点：本集既非结局，也无后续剧情。
                </div>
              )}

              {/* 路径 */}
              {path.length > 1 && (
                <div className="faint" style={{ fontSize: 11, lineHeight: 1.7 }}>
                  路径：{path.map((s, i) => (i === 0 ? s.title : `${s.via ? ` —[${s.via}]→ ` : " → "}${s.title}`)).join("")}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
