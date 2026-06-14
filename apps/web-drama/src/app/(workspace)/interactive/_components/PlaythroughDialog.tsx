"use client";

// 试玩走查 —— 创作端验证工具：从起始集像观众一样走一遍，在互动点做选择，看走到哪条分支 /
// 哪个结局。用来确认分支接得对不对。可点开已生成的成片抽查（复用 MediaLightbox）。
// 这不是面向观众的播放器（无预加载 / 无缝切流 / 自动续播）—— 仅供创作者结构走查。

import * as React from "react";
import { AlertTriangle, ArrowRight, Flag, GitBranch, Play, RotateCcw } from "lucide-react";
import { Dialog } from "@/components/common";
import { Button, Chip } from "@/components/premium";
import { MediaLightbox, type LightboxMedia } from "@/components/drama-workshop/media-lightbox";
import { episodeTitle } from "@/lib/interactive-graph";
import type { InteractiveSeries } from "@/api/interactive-drama";

interface Step {
  episodeId: string;
  via?: string; // 走到这一集是因为选了哪个选项
}

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  series: InteractiveSeries;
}

export function PlaythroughDialog({ open, onOpenChange, series }: Props) {
  const byId = React.useMemo(() => new Map(series.episodes.map((e) => [e.id, e])), [series.episodes]);
  const [path, setPath] = React.useState<Step[]>([]);
  const [media, setMedia] = React.useState<LightboxMedia | null>(null);

  const reset = React.useCallback(() => {
    setPath(series.start_episode_id ? [{ episodeId: series.start_episode_id }] : []);
  }, [series.start_episode_id]);

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const current = path.length ? byId.get(path[path.length - 1].episodeId) ?? null : null;
  const flow = !current ? "none" : current.is_ending ? "ending" : current.interaction ? "interactive" : current.next_episode_id ? "linear" : "dead";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="试玩走查 · 验证分支"
      description="像观众一样从起始集走一遍：在互动点做选择，看会走到哪条分支、哪个结局。用来确认分支接得对不对。"
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button variant="secondary" onClick={reset}>
            <RotateCcw size={13} /> 重新走查
          </Button>
        </>
      }
    >
      {!current ? (
        <div style={{ fontSize: 13, color: "var(--danger)", padding: "8px 0" }}>
          起始集缺失，请先在编辑器里设置起始集。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 当前集 */}
          <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "16px 18px", background: "var(--surface-2)" }}>
            <div className="row gap-2" style={{ flexWrap: "wrap", marginBottom: 8 }}>
              <span className="faint" style={{ fontSize: 11, fontWeight: 700 }}>第 {path.length} 步</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{current.title}</span>
              {current.branch_label && <Chip tone="violet">{current.branch_label}</Chip>}
            </div>
            {current.synopsis && <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>{current.synopsis}</div>}
            <div className="row gap-2" style={{ marginTop: 10 }}>
              {current.video_url ? (
                <Button variant="secondary" size="sm" onClick={() => setMedia({ src: current.video_url!, kind: "video" })}>
                  <Play size={12} /> 播放本集
                </Button>
              ) : (
                <span className="row gap-1" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                  <Play size={12} /> 本集尚未生成视频
                </span>
              )}
            </div>
          </div>

          {/* 流转 */}
          {flow === "ending" && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div className="row gap-2" style={{ justifyContent: "center", fontSize: 15, fontWeight: 700, color: "var(--accent-2)" }}>
                <Flag size={16} /> 走查完成 · {current.ending_label || "结局"}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>这条路径走到了一个结局。</div>
            </div>
          )}

          {flow === "interactive" && current.interaction && (
            <div>
              <div className="row gap-2" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
                <GitBranch size={15} style={{ color: "var(--accent)" }} />
                {current.interaction.prompt || "（未填互动问题）"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {current.interaction.choices.map((c) => {
                  const exists = !!c.next_episode_id && byId.has(c.next_episode_id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={!exists}
                      onClick={() => exists && setPath((p) => [...p, { episodeId: c.next_episode_id, via: c.label }])}
                      className="row gap-2"
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--line-2)",
                        background: exists ? "var(--surface)" : "var(--surface-2)",
                        color: exists ? "var(--ink)" : "var(--ink-3)",
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: exists ? "pointer" : "not-allowed",
                        textAlign: "left",
                      }}
                    >
                      <span>{c.label || "（未命名选项）"}</span>
                      <span className="row gap-1" style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 500 }}>
                        {exists ? episodeTitle(series, c.next_episode_id) : "目标缺失"}
                        <ArrowRight size={12} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {flow === "linear" && (
            <Button
              variant="primary"
              size="md"
              onClick={() => current.next_episode_id && setPath((p) => [...p, { episodeId: current.next_episode_id! }])}
              disabled={!current.next_episode_id || !byId.has(current.next_episode_id)}
            >
              下一集 · {episodeTitle(series, current.next_episode_id)} <ArrowRight size={14} />
            </Button>
          )}

          {flow === "dead" && (
            <div className="row gap-2" style={{ fontSize: 12.5, color: "var(--warning)", padding: "8px 0" }}>
              <AlertTriangle size={14} /> 这一集没有后续（既不是结局，也没有互动或下一集）—— 剧情会断在这里。
            </div>
          )}

          {/* 走查路径 */}
          {path.length > 1 && (
            <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 10, fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.8 }}>
              <span style={{ fontWeight: 700 }}>走查路径：</span>
              {path.map((s, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ color: "var(--accent)" }}> →{s.via ? `（选「${s.via}」）` : ""} </span>}
                  {episodeTitle(series, s.episodeId)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <MediaLightbox media={media} onClose={() => setMedia(null)} />
    </Dialog>
  );
}
