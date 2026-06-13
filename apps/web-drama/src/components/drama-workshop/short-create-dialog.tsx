"use client";

// 新建短视频 · 对话框 + 短视频模版浮层 —— 与短剧新建一致的体验：
// 居中 AI 对话框（说句话 → 出口播脚本/分镜），对话框「上方」悬浮一层「短视频模版」浮层
// （口播带货 / 知识科普 / 剧情钩子 / 数字人播报 / 热点二创…，运营可维护）。
// 选模版后以 pill 回填对话框，提交 → 进短视频工厂（/shorts/make）逐镜出片。
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronUp, Layers, Sparkles, Wand2, X } from "lucide-react";
import { VideoCover } from "@/components/drama-workshop/video-cover";
import { PreviewModal } from "@/components/drama-workshop/preview-modal";
import { SHORT_FORMATS, SHORT_IDEAS, type ShortFormat } from "@/mocks/drama-workshop";

export function ShortCreateDialog({ initialIdea = "" }: { initialIdea?: string }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const [idea, setIdea] = React.useState(initialIdea);
  const [picked, setPicked] = React.useState<ShortFormat | null>(null);
  const [previewFmt, setPreviewFmt] = React.useState<ShortFormat | null>(null); // 先预览，确认后才套用
  const [overlayOpen, setOverlayOpen] = React.useState(true); // 默认展开，模版直接可见（短视频新建以挑模版为主）；可收起为 pill
  const [sparkN, setSparkN] = React.useState(0);

  // 用静态 SHORT_FORMATS —— 与首页 / 短视频工厂（/shorts/make）同源，避免选了运营自定义格式后在工厂里落不到、回退到口播带货的偏差。
  const formats = SHORT_FORMATS;
  const hasFormats = formats.length > 0;
  const canSubmit = idea.trim().length > 0 || !!picked;

  const spark = () => {
    if (!SHORT_IDEAS.length) return;
    setIdea(SHORT_IDEAS[sparkN % SHORT_IDEAS.length]);
    setSparkN((n) => n + 1);
    inputRef.current?.focus();
  };

  const pick = (f: ShortFormat) => {
    setPicked(f);
    setOverlayOpen(false); // 收起浮层，模版以 pill 落进对话框
    inputRef.current?.focus();
  };

  const start = () => {
    if (!canSubmit) {
      inputRef.current?.focus();
      return;
    }
    // v0.73 修：点子经 sessionStorage 一次性带入（不入 URL）；没选模版就不带 fmt（别假装套了口播带货）。
    const seed = idea.trim();
    if (seed && typeof window !== "undefined") sessionStorage.setItem("drama.shorts.idea", seed);
    const q = picked?.key ? `?fmt=${encodeURIComponent(picked.key)}` : "";
    router.push(`/shorts/make${q}`);
  };

  return (
    <div className="scroll ws-flush" style={{ background: "var(--bg)" }}>
      <div style={{ position: "relative", overflow: "hidden", minHeight: "100%", paddingBottom: 56 }}>
        <div className="home-blob home-blob-a" style={blob(-150, "20%", undefined, 400, "var(--accent)", 16)} />
        <div className="home-blob home-blob-b" style={blob(-90, undefined, "14%", 360, "var(--accent-2)", 13)} />
        <div className="home-blob home-blob-c" style={blob(70, "48%", undefined, 280, "var(--accent)", 10)} />

        <div style={{ position: "relative", maxWidth: 880, margin: "0 auto", padding: "16px 24px 0" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/shorts")}>
            <ChevronLeft size={16} /> 返回短视频工坊
          </button>
        </div>

        <div style={{ maxWidth: 700, margin: "0 auto", padding: "22px 28px 4px", textAlign: "center", position: "relative" }}>
          <div className="faint" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>新建一条短视频</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}>
            说句话，AI 出口播脚本和
            <span
              style={{
                background: "linear-gradient(120deg,var(--accent),var(--accent-2))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              分镜
            </span>
          </h1>
          <div className="muted" style={{ marginTop: 8, fontSize: 14.5 }}>
            单条速成 · 竖屏 9:16。先从上方<strong style={{ color: "var(--ink-2)" }}>挑个爆款模版</strong>定调，再说想法更准。
          </div>
        </div>

        <div style={{ maxWidth: 700, margin: "0 auto", padding: "14px 28px 0", position: "relative" }}>
          {/* —— 短视频模版浮层（无模版时整体不渲染） —— */}
          {hasFormats &&
            (overlayOpen ? (
              <div
                className="card pop-in col"
                style={{ padding: 0, overflow: "hidden", marginBottom: 12, boxShadow: "var(--shadow-lg)", border: "1px solid var(--line)" }}
              >
                <div className="row gap-2" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
                  <span className="icon-badge" style={{ width: 30, height: 30, borderRadius: 9 }}>
                    <Layers size={16} />
                  </span>
                  <div className="grow col" style={{ gap: 1 }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5 }}>短视频模版</span>
                    <span className="faint" style={{ fontSize: 11 }}>挑一个爆款样式，AI 按它出脚本与分镜节拍</span>
                  </div>
                  <button type="button" className="btn btn-icon btn-ghost btn-sm" title="收起" onClick={() => setOverlayOpen(false)}>
                    <ChevronUp size={15} />
                  </button>
                </div>

                <div className="row scroll gap-3" style={{ padding: "12px 16px 16px", overflowX: "auto", alignItems: "stretch" }}>
                  {formats.map((f) => {
                    const on = picked?.key === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setPreviewFmt(f)}
                        className="col"
                        style={{
                          flex: "none",
                          width: 150,
                          textAlign: "left",
                          borderRadius: 14,
                          overflow: "hidden",
                          padding: 0,
                          cursor: "pointer",
                          background: "var(--surface)",
                          border: on ? "2px solid var(--accent)" : "1px solid var(--line)",
                          boxShadow: on ? "var(--shadow-accent)" : "none",
                          transition: "border-color .15s, box-shadow .15s, transform .15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                      >
                        <VideoCover from={f.from} to={f.to} ratio="3/4">
                          <span className="thumb-label" style={{ position: "absolute", top: 8, left: 8 }}>{f.tip}</span>
                          <span className="thumb-label num" style={{ position: "absolute", top: 8, right: 8 }}>{f.dur}s</span>
                        </VideoCover>
                        <div className="col gap-1" style={{ padding: "9px 11px 11px" }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{f.name}</div>
                          <div
                            className="faint"
                            style={{
                              fontSize: 11,
                              lineHeight: 1.45,
                              height: 32,
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {f.sample}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="card row gap-2"
                onClick={() => setOverlayOpen(true)}
                style={{ width: "100%", padding: "11px 16px", marginBottom: 12, boxShadow: "var(--shadow-lg)", border: "1px solid var(--line)", cursor: "pointer", textAlign: "left" }}
              >
                <span className="icon-badge" style={{ width: 28, height: 28, borderRadius: 8 }}>
                  <Layers size={15} />
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, flex: "none" }}>短视频模版</span>
                <span className="faint" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {picked ? `已选 · ${picked.name}` : "挑一个爆款样式定调"}
                </span>
                <span className="grow" />
                <ChevronDown size={16} style={{ color: "var(--ink-3)", flex: "none" }} />
              </button>
            ))}

          {/* —— 对话框 —— */}
          <div
            className="col"
            style={{
              borderRadius: 20,
              overflow: "hidden",
              textAlign: "left",
              background: "var(--surface)",
              border: "1px solid var(--line-soft)",
              boxShadow: "0 18px 50px -24px color-mix(in oklch, var(--accent) 35%, transparent), 0 2px 8px rgba(20,10,50,.04)",
            }}
          >
            {picked && (
              <div className="row" style={{ padding: "12px 16px 0" }}>
                <span
                  className="row gap-2"
                  style={{ maxWidth: "100%", background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 999, padding: "5px 8px 5px 5px" }}
                >
                  <span
                    style={{ width: 28, height: 19, borderRadius: 5, flex: "none", background: `linear-gradient(135deg, ${picked.from}, ${picked.to})` }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {picked.name} · {picked.tip}
                  </span>
                  <button
                    type="button"
                    title="移除模版"
                    onClick={() => setPicked(null)}
                    className="row"
                    style={{ flex: "none", cursor: "pointer", color: "inherit", background: "transparent", border: "none", padding: 0 }}
                  >
                    <X size={13} />
                  </button>
                </span>
              </div>
            )}

            <textarea
              ref={inputRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  start();
                }
              }}
              placeholder={
                picked
                  ? `想加点你的特色?可不填…例如:${picked.sample}`
                  : `说说你这条短视频想表达什么…比如:${formats[0]?.sample ?? "一句话点子"}`
              }
              style={{
                width: "100%",
                minHeight: 76,
                border: "none",
                outline: "none",
                resize: "none",
                padding: "14px 18px 4px",
                fontSize: 14.5,
                lineHeight: 1.6,
                background: "transparent",
                fontFamily: "inherit",
                color: "var(--ink)",
              }}
            />

            <div className="row gap-2" style={{ padding: "8px 14px 12px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="chip"
                onClick={spark}
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                title="随机给一个示例点子"
              >
                <Sparkles size={13} /> 给我灵感
              </button>
              <span className="grow" />
              <button
                type="button"
                className="btn btn-grad"
                disabled={!canSubmit}
                onClick={start}
                style={{ height: 40, padding: "0 22px", flex: "none", opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}
              >
                <Wand2 size={16} /> 开始制作
              </button>
            </div>
          </div>

          <div className="faint" style={{ fontSize: 11.5, textAlign: "center", marginTop: 12 }}>
            进短视频工厂逐镜出片 · 首帧 / 视频按次计费，单条竖屏 9:16
          </div>
        </div>
      </div>

      {previewFmt && (
        <PreviewModal
          item={{
            cover: { from: previewFmt.from, to: previewFmt.to },
            title: previewFmt.name,
            cat: previewFmt.tip,
            desc: previewFmt.sample,
            coverLabel: "成片预览 · 同格式样片",
            beatsLabel: "分镜节拍 · 套用后逐镜可改",
            beats: (() => {
              let acc = 0;
              return previewFmt.beats.map((b) => {
                const r = { range: `${acc}-${acc + b.dur}s`, beat: b.visual.slice(0, 18), est: `${b.dur}s` };
                acc += b.dur;
                return r;
              });
            })(),
          }}
          onClose={() => setPreviewFmt(null)}
          actions={[
            {
              label: "用这个模版",
              icon: <Wand2 size={15} />,
              variant: "grad",
              onClick: () => {
                const f = previewFmt;
                setPreviewFmt(null);
                pick(f);
              },
            },
          ]}
        />
      )}
    </div>
  );
}

/** 氛围光斑样式（hero 背景）。 */
function blob(top: number, left: string | undefined, right: string | undefined, size: number, color: string, pct: number): React.CSSProperties {
  return {
    position: "absolute",
    top,
    left,
    right,
    width: size,
    height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle, color-mix(in oklch, ${color} ${pct}%, transparent), transparent 70%)`,
    pointerEvents: "none",
  };
}
