"use client";

// 试玩走查弹窗（v0.79）—— 创作端验证工具（非播放器运行时）。
// 从起始集出发，像观众一样按选项走分支：命中互动点先判 condition，选项 setFlags 写回全局标记，
// 沿 nextVideoId 推进，直到结局。用来验证接线 / 条件 / 结局是否如预期，不做 timeupdate / 断点恢复。
import * as React from "react";
import { Play, X, RotateCcw, Flag, ArrowRight, CircleAlert } from "lucide-react";
import type { FlagValue, InteractionPoint, InteractiveStoryData } from "@/lib/interactive-types";
import { applySetFlags, epDisplayTitle, evalCondition } from "@/lib/interactive-graph";

/** 剧情状态的值：是否型显示「是 / 否」，不露 true / false。 */
const showFlag = (v: FlagValue) => (typeof v === "boolean" ? (v ? "是" : "否") : String(v));

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
    setPath(data.startEpisodeId && byId.get(data.startEpisodeId) ? [{ episodeId: data.startEpisodeId, title: epDisplayTitle(byId.get(data.startEpisodeId)!) }] : []);
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
    setPath((p) => [...p, { episodeId, title: epDisplayTitle(byId.get(episodeId)!), via }]);
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
        role="dialog"
        aria-modal="true"
        aria-label="试玩"
        style={{ width: 560, maxWidth: "100%", maxHeight: "88vh", padding: 0, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-2" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <Play size={17} style={{ color: "var(--accent)", flex: "none" }} />
          <span style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", flex: "none" }}>试玩</span>
          <span className="faint wb-play-sub" style={{ fontSize: 11, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title="像观众一样点一遍，看连线和结局对不对">
            像观众一样点一遍，看连线和结局对不对
          </span>
          <span className="grow" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset} style={{ flex: "none" }}>
            <RotateCcw size={13} /> <span className="ws-btn-label">重新开始</span>
          </button>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose} title="关闭" aria-label="关闭" style={{ flex: "none" }}>
            <X size={15} />
          </button>
        </div>

        <div className="scroll col gap-3" style={{ padding: 20, minHeight: 0 }}>
          {noStart ? (
            <div className="row gap-2" style={{ color: "var(--danger)", fontSize: 13 }}>
              <CircleAlert size={16} style={{ flex: "none" }} /> 还没设起始集，没法试玩。先选一集点「设为起始集」。
            </div>
          ) : !cur ? (
            <div className="faint">这条线走完了。</div>
          ) : (
            <>
              {/* 全局标记状态 */}
              {Object.keys(flags).length > 0 && (
                <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                  {Object.entries(flags).map(([k, v]) => (
                    <span key={k} className="tag tag-gray num" style={{ fontSize: 10.5, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${k}：${showFlag(v)}`}>
                      {k}：{showFlag(v)}
                    </span>
                  ))}
                </div>
              )}

              {/* 当前集 */}
              <div className="card col gap-2" style={{ padding: 16 }}>
                <div className="row gap-2">
                  {cur.isEnding && <Flag size={14} style={{ color: "#d97706" }} />}
                  <span style={{ fontWeight: 800, fontSize: 15, minWidth: 0 }}>{epDisplayTitle(cur)}</span>
                  <span className="faint num" style={{ fontSize: 11, flex: "none" }}>第 {cur.no} 集</span>
                </div>
                {cur.synopsis && <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{cur.synopsis}</div>}
                {cur.videoUrl ? (
                  <video src={cur.videoUrl} controls muted playsInline style={{ width: "100%", maxHeight: 220, borderRadius: 10, background: "#000" }} />
                ) : (
                  <div className="faint" style={{ fontSize: 11.5 }}>这一集还没成片，先按文字剧情走一遍。</div>
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
                  <div className="faint" style={{ fontSize: 12 }}>这条线到这里结束，一共看了 {path.length} 集</div>
                </div>
              ) : activeInteraction ? (
                <div className="col gap-2">
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {activeInteraction.uiConfig.question}
                    {activeInteraction.uiConfig.countdownSec ? (
                      <span className="faint num" style={{ fontSize: 11, marginLeft: 6 }}>（限时 {activeInteraction.uiConfig.countdownSec} 秒）</span>
                    ) : null}
                  </div>
                  {activeInteraction.condition && (
                    <div className="faint" style={{ fontSize: 10.5 }}>满足弹出条件，这个互动点弹出来了</div>
                  )}
                  {(activeInteraction.uiConfig.options ?? []).map((o) => {
                    const broken = !o.nextVideoId || !byId.get(o.nextVideoId);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className="btn btn-line"
                        style={{ justifyContent: "space-between", opacity: broken ? 0.6 : 1, height: "auto", minHeight: 38, whiteSpace: "normal", textAlign: "left" }}
                        disabled={broken}
                        onClick={() => pick(o.text, o.nextVideoId, o.setFlags)}
                      >
                        <span style={{ minWidth: 0 }}>{o.text}</span>
                        <span className="row gap-1 faint" style={{ fontSize: 11, flex: "none" }}>
                          {o.setFlags && Object.keys(o.setFlags).length > 0 && (
                            <span>记下 {Object.entries(o.setFlags).map(([k, v]) => `${k}：${showFlag(v)}`).join("，")}</span>
                          )}
                          {broken ? <span style={{ color: "var(--danger)" }}>没接上</span> : <ArrowRight size={13} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : cur.nextVideoId && byId.get(cur.nextVideoId) ? (
                <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => goTo(cur.nextVideoId)}>
                  看下一集 <ArrowRight size={14} />
                </button>
              ) : (
                <div className="row gap-2" style={{ color: "var(--danger)", fontSize: 13 }}>
                  <CircleAlert size={16} style={{ flex: "none" }} /> 没接上：这一集播完不接下一集，也不是结局集，观众会卡在这里。
                </div>
              )}

              {/* 路径 */}
              {path.length > 1 && (
                <div className="faint" style={{ fontSize: 11, lineHeight: 1.7 }}>
                  走过的路：{path.map((s, i) => (i === 0 ? s.title : `${s.via ? ` →（${s.via}）→ ` : " → "}${s.title}`)).join("")}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
