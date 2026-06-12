"use client";

export const dynamic = "force-dynamic";

// 短视频制作 — 设计真源 v4 screens-shorts-v4.jsx `ShortMaker` + `ShortShotCard`:
// 单屏两步:① AI 对话 + 口播脚本表 → ② 视频工厂逐镜出片 → 合成成片。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Clapperboard,
  Edit,
  Film,
  Image as ImageIcon,
  Play,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Editable, GenSkeleton, Thumb } from "@/components/drama-ui";
import { GenSettingsBar } from "@/components/drama-workshop/gen-settings-bar";
import { RefCell, RichScript, SubToggle } from "@/components/drama-workshop/script-refs";
import { matById, SHORT_FORMATS, type Material, type ShortFormat } from "@/mocks/drama-workshop";

type ShotFlow = "draft" | "frame" | "clip" | "done";

interface ShortShot {
  id: string;
  no: number;
  /** 时长(秒) */
  dur: number;
  /** 画面 / 视频脚本 */
  visual: string;
  /** 语音口播 */
  vo: string;
  engine: string;
  flow: ShotFlow;
  frameIdx: number;
  refs: Material[];
  sub: boolean;
}

interface ChatMsg {
  who: "ai" | "me";
  text: string;
}

const SV_TH: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--ink-3)",
  letterSpacing: ".05em",
  padding: "10px 14px",
  background: "var(--surface-2)",
  borderBottom: "1px solid var(--line)",
  whiteSpace: "nowrap",
};
const SV_TD: React.CSSProperties = {
  padding: "13px 14px",
  borderBottom: "1px solid var(--line-soft)",
  verticalAlign: "top",
  fontSize: 13,
  lineHeight: 1.7,
};

/* 单镜出片卡(竖屏) */
function ShortShotCard({
  s,
  fmt,
  busy,
  onFrame,
  onDirect,
  onClip,
  onDone,
}: {
  s: ShortShot;
  fmt: ShortFormat;
  busy: ShotFlow | null;
  onFrame: () => void;
  onDirect: () => void;
  onClip: () => void;
  onDone: () => void;
}) {
  const rendered = s.flow === "frame" || s.flow === "clip" || s.flow === "done";
  const isVideo = s.flow === "clip" || s.flow === "done";
  return (
    <div className="card col" style={{ padding: 0, overflow: "hidden", gap: 0 }}>
      <div style={{ position: "relative" }}>
        <Thumb
          from={rendered ? fmt.from : "#cbd5e1"}
          to={rendered ? fmt.to : "#94a3b8"}
          ratio="9/16"
          radius={0}
          stripes={!rendered}
          style={{ width: "100%" }}
        />
        <span
          className="num"
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            background: "rgba(0,0,0,.5)",
            color: "#fff",
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 5,
            fontWeight: 700,
          }}
        >
          #{s.no} · {s.dur}s
        </span>
        {busy && (
          <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center" }}>
            <span
              style={{
                width: 24,
                height: 24,
                border: "3px solid rgba(255,255,255,.4)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                animation: "drama-spin .7s linear infinite",
              }}
            />
          </span>
        )}
        {isVideo && !busy && (
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span
              style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.85)", display: "grid", placeItems: "center" }}
            >
              <Play size={15} style={{ color: "var(--ink)", marginLeft: 2 }} />
            </span>
          </span>
        )}
        {s.flow === "done" && (
          <span className="tag tag-green" style={{ position: "absolute", bottom: 6, left: 6 }}>
            <Check size={10} /> 验收
          </span>
        )}
        {s.flow === "frame" && !busy && (
          <span className="tag tag-accent" style={{ position: "absolute", bottom: 6, left: 6 }}>首帧</span>
        )}
      </div>
      <div className="col gap-2" style={{ padding: "9px 10px 10px" }}>
        <span style={{ fontSize: 11, lineHeight: 1.4, height: 31, overflow: "hidden", color: "var(--ink-2)" }}>{s.visual}</span>
        {s.flow === "draft" && (
          <div className="col gap-1">
            <button
              type="button"
              className="btn btn-grad btn-sm"
              style={{ height: 30, justifyContent: "center", fontSize: 11.5 }}
              disabled={!!busy}
              onClick={onFrame}
            >
              <ImageIcon size={12} /> 首帧 <span className="faint" style={{ fontSize: 9.5, color: "#fff", opacity: 0.8 }}>2</span>
            </button>
            <button
              type="button"
              className="btn btn-line btn-sm"
              style={{ height: 28, justifyContent: "center", fontSize: 11 }}
              disabled={!!busy}
              onClick={onDirect}
            >
              <Zap size={11} /> 直出视频 9
            </button>
          </div>
        )}
        {s.flow === "frame" && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ height: 30, justifyContent: "center", fontSize: 11.5 }}
            disabled={!!busy}
            onClick={onClip}
          >
            <Film size={12} /> 生成视频 <span className="faint" style={{ fontSize: 9.5, color: "#fff", opacity: 0.8 }}>7</span>
          </button>
        )}
        {s.flow === "clip" && (
          <button type="button" className="btn btn-primary btn-sm" style={{ height: 30, justifyContent: "center", fontSize: 11.5 }} onClick={onDone}>
            <Check size={12} /> 验收这镜
          </button>
        )}
        {s.flow === "done" && (
          <button type="button" className="chip" style={{ height: 28, justifyContent: "center", fontSize: 11 }}>
            <Check size={11} /> 已验收
          </button>
        )}
      </div>
    </div>
  );
}

export default function ShortMakerPage() {
  return (
    <React.Suspense fallback={<div className="col ws-flush" style={{ background: "var(--bg)" }} />}>
      <ShortMakerInner />
    </React.Suspense>
  );
}

function ShortMakerInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const fmtKey = sp.get("fmt") ?? "sell";
  const idea = sp.get("idea");
  const reopen = sp.get("reopen");
  const fmt = SHORT_FORMATS.find((f) => f.key === fmtKey) ?? SHORT_FORMATS[0];

  const [step, setStep] = React.useState<"script" | "factory">("script");
  const [phase, setPhase] = React.useState<"gen" | "done">("done");
  const title = reopen || idea || fmt.sample;

  const init = React.useCallback((): ShortShot[] => {
    return fmt.beats.map((b, i) => {
      const isAv = b.engine === "avatar";
      const beatRefs = (isAv ? [matById("a1"), matById("mp1")] : [matById("r1")]).filter((m): m is Material => m != null);
      let visual = b.visual;
      if (isAv && beatRefs.length && visual.includes("数字人")) visual = visual.replace("数字人", "[参考1] ");
      return { ...b, id: "sh" + i, no: i + 1, flow: "draft" as ShotFlow, frameIdx: 0, refs: beatRefs, sub: true, visual };
    });
  }, [fmt]);

  const [shots, setShots] = React.useState<ShortShot[]>(init);
  const [busy, setBusy] = React.useState<{ id: string; to: ShotFlow } | null>(null);
  const [refs, setRefs] = React.useState<Material[]>([]); // @数字人参考
  const initIdea = idea || reopen || fmt.sample;
  const [chat, setChat] = React.useState<ChatMsg[]>(() => [
    { who: "ai", text: "说说你这条短视频想表达什么,我来帮你写口播脚本、拆好分镜。" },
    { who: "me", text: initIdea },
    { who: "ai", text: `好的,我按这个思路出了一版脚本——共 ${fmt.beats.length} 个镜头,右侧可直接改。想调节节奏、换钩子或口吻,跟我说就行。` },
  ]);
  const [draft, setDraft] = React.useState("");

  const total = shots.reduce((a, s) => a + s.dur, 0);
  const doneCount = shots.filter((s) => s.flow === "done").length;

  const regen = () => {
    setPhase("gen");
    setTimeout(() => {
      setShots(init());
      setPhase("done");
      toast.success("口播脚本和分镜已生成,改满意就去出片");
    }, 1300);
  };
  const QUICK = ["口吻再口语一点", "开头加个更狠的钩子", "缩到 20 秒内", "多一点产品特写"];
  const sendChat = (text: string) => {
    const t = (text || "").trim();
    if (!t || phase === "gen") return;
    setChat((c) => [...c, { who: "me", text: t }]);
    setDraft("");
    setPhase("gen");
    setTimeout(() => {
      setShots(init());
      setPhase("done");
      setChat((c) => [...c, { who: "ai", text: "改好了——右侧脚本已更新,你再看看还哪里要调?" }]);
    }, 1200);
  };
  const updShot = (id: string, patch: Partial<ShortShot>) =>
    setShots((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const render = (id: string, to: ShotFlow, _cost: number) => {
    setBusy({ id, to });
    setTimeout(() => {
      setBusy(null);
      updShot(id, { flow: to });
      toast.success(to === "frame" ? "首帧已出,确认后再生成视频" : "镜头视频已生成");
    }, 1500);
  };

  const STEP_META: { key: "script" | "factory"; no: number; name: string; icon: React.ElementType }[] = [
    { key: "script", no: 1, name: "口播脚本", icon: Clapperboard },
    { key: "factory", no: 2, name: "视频工厂", icon: ImageIcon },
  ];

  return (
    <div className="col ws-flush" style={{ minHeight: 0, background: "var(--bg)", position: "relative" }}>
      {/* 顶栏 */}
      <header
        className="row"
        style={{ height: 58, padding: "0 24px", borderBottom: "1px solid var(--line)", background: "var(--surface)", gap: 14, flex: "none" }}
      >
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/shorts")} style={{ flex: "none" }}>
          <ChevronLeft size={15} /> 工坊
        </button>
        <span
          style={{ width: 24, height: 32, borderRadius: 6, background: `linear-gradient(135deg,${fmt.from},${fmt.to})`, flex: "none" }}
        />
        <div className="col" style={{ minWidth: 0, gap: 1 }}>
          <span style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }}>
            {title}
          </span>
          <span className="faint num" style={{ fontSize: 11 }}>{fmt.name} · 竖屏 9:16 · 约 {total}s</span>
        </div>
        {/* 步骤切换 */}
        <span className="grow" />
        <div className="row" style={{ background: "var(--surface-2)", borderRadius: 999, padding: 3, gap: 2, flex: "none" }}>
          {STEP_META.map((s) => {
            const on = step === s.key;
            const SIcon = s.icon;
            return (
              <button
                key={s.key}
                type="button"
                className="chip"
                onClick={() => setStep(s.key)}
                style={{
                  height: 28,
                  background: on ? "var(--surface)" : "transparent",
                  color: on ? "var(--accent)" : "var(--ink-3)",
                  boxShadow: on ? "var(--shadow-sm)" : "none",
                }}
              >
                <span className="num" style={{ fontSize: 10.5, opacity: 0.7 }}>{s.no}</span> <SIcon size={12} /> {s.name}
              </button>
            );
          })}
        </div>
      </header>

      {/* 脚本步:左 AI 对话 / 右 生成脚本 · 工厂步:居中滚动 */}
      {step === "script" ? (
        <div className="row grow" style={{ minHeight: 0, alignItems: "stretch" }}>
          {/* 左:AI 对话 */}
          <div className="col" style={{ width: 380, flex: "none", borderRight: "1px solid var(--line)", background: "var(--surface)", minHeight: 0 }}>
            <div className="row gap-2" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)", flex: "none" }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                  color: "#fff",
                }}
              >
                <Sparkles size={14} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>AI 脚本助手</span>
              <span className="faint" style={{ fontSize: 11 }}>聊出你要的脚本</span>
            </div>
            <div className="scroll grow col gap-3" style={{ minHeight: 0, padding: "14px 16px" }}>
              {chat.map((m, i) => (
                <div key={i} className="row" style={{ justifyContent: m.who === "me" ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      maxWidth: "86%",
                      padding: "9px 12px",
                      borderRadius: 13,
                      fontSize: 13,
                      lineHeight: 1.6,
                      background: m.who === "me" ? "linear-gradient(135deg,var(--accent),var(--accent-2))" : "var(--surface-2)",
                      color: m.who === "me" ? "#fff" : "var(--ink)",
                      borderBottomRightRadius: m.who === "me" ? 4 : 13,
                      borderBottomLeftRadius: m.who === "me" ? 13 : 4,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {phase === "gen" && (
                <div className="row" style={{ justifyContent: "flex-start" }}>
                  <div className="row gap-2" style={{ padding: "9px 12px", borderRadius: 13, background: "var(--surface-2)" }}>
                    <span
                      style={{
                        width: 13,
                        height: 13,
                        border: "2px solid var(--line)",
                        borderTopColor: "var(--accent)",
                        borderRadius: "50%",
                        animation: "drama-spin .7s linear infinite",
                      }}
                    />
                    <span className="faint" style={{ fontSize: 12 }}>正在重写脚本…</span>
                  </div>
                </div>
              )}
            </div>
            <div className="col gap-2" style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--line-soft)", flex: "none" }}>
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                {QUICK.map((q) => (
                  <button key={q} type="button" className="chip" style={{ fontSize: 11.5 }} disabled={phase === "gen"} onClick={() => sendChat(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <div className="row gap-2" style={{ alignItems: "flex-end" }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat(draft);
                    }
                  }}
                  placeholder="告诉 AI 怎么改…"
                  rows={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 40,
                    maxHeight: 110,
                    border: "1.5px solid var(--line)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontSize: 13,
                    outline: "none",
                    resize: "none",
                    background: "var(--surface-2)",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  className="btn btn-grad btn-icon"
                  style={{ width: 40, height: 40, flex: "none" }}
                  disabled={phase === "gen" || !draft.trim()}
                  onClick={() => sendChat(draft)}
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </div>

          {/* 右:生成的脚本 */}
          <div className="scroll grow" style={{ minHeight: 0, background: "var(--bg)" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "22px 28px 110px" }}>
              <div className="row gap-2" style={{ marginBottom: 14 }}>
                <Clapperboard size={16} style={{ color: "var(--accent)" }} />
                <span style={{ fontWeight: 800, fontSize: 16 }}>口播脚本</span>
                <span className="faint num" style={{ fontSize: 12 }}>{shots.length} 镜 · 约 {total}s</span>
                <span className="grow" />
                <button type="button" className="chip" disabled={phase === "gen"} onClick={regen}>
                  <RefreshCw size={12} /> 重新生成
                </button>
              </div>
              {phase === "gen" ? (
                <div className="card" style={{ padding: 18 }}>
                  <GenSkeleton lines={4} label="正在写口播稿并拆分镜…" />
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                      <thead>
                        <tr>
                          <th style={{ ...SV_TH, width: 56 }}>镜号</th>
                          <th style={{ ...SV_TH, width: "44%" }}>视频脚本</th>
                          <th style={SV_TH}>语音</th>
                          <th style={{ ...SV_TH, width: 58 }}>字幕</th>
                          <th style={{ ...SV_TH, width: 108 }}>参考</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shots.map((s) => (
                          <tr key={s.id}>
                            <td style={{ ...SV_TD, whiteSpace: "nowrap" }}>
                              <span className="num" style={{ fontWeight: 800, color: "var(--accent)", fontSize: 13 }}>#{s.no}</span>
                              <div className="faint num" style={{ fontSize: 10.5, marginTop: 2 }}>{s.dur}s</div>
                            </td>
                            <td style={{ ...SV_TD, fontSize: 13.5 }}>
                              <RichScript
                                text={s.visual}
                                refs={s.refs}
                                onCommit={(v) => updShot(s.id, { visual: v })}
                                placeholder="点击编写视频脚本…"
                              />
                            </td>
                            <td style={SV_TD}>
                              <span style={{ color: "var(--ink)" }}>
                                “<Editable block value={s.vo} placeholder="语音口播…" onCommit={(v) => updShot(s.id, { vo: v })} style={{ display: "inline" }} />”
                              </span>
                            </td>
                            <td style={SV_TD}>
                              <SubToggle on={s.sub !== false} onToggle={() => updShot(s.id, { sub: s.sub === false })} />
                            </td>
                            <td style={SV_TD}>
                              <RefCell refs={s.refs} onChange={(next) => updShot(s.id, { refs: next })} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="row gap-2" style={{ padding: "10px 14px", borderTop: "1px solid var(--line-soft)", background: "var(--surface-2)" }}>
                    <Edit size={12} style={{ color: "var(--ink-3)" }} />
                    <span className="faint" style={{ fontSize: 11.5 }}>
                      视频脚本、语音点击即可改 · 脚本里用 [参考N] 引用右侧选的素材 · 也可让左侧 AI 整体重写
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="scroll grow" style={{ minHeight: 0 }}>
          <div style={{ maxWidth: 880, margin: "0 auto", padding: "22px 32px 110px" }}>
            {/* —— 视频工厂 —— */}
            <GenSettingsBar defaultRatio="9:16" refs={refs} setRefs={setRefs} />
            <div className="card row gap-3" style={{ padding: "13px 16px", marginBottom: 16 }}>
              <ImageIcon size={17} style={{ color: "var(--accent)" }} />
              <div className="grow">
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>逐镜出片 · 两条路任选</div>
                <div className="faint" style={{ fontSize: 11.5 }}>稳妥:先渲首帧锁画面再出视频,省抽卡;赶时间:直接生成镜头视频</div>
              </div>
              <span className="tag tag-gray num">{doneCount}/{shots.length} 已成片</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14 }}>
              {shots.map((s) => (
                <ShortShotCard
                  key={s.id}
                  s={s}
                  fmt={fmt}
                  busy={busy && busy.id === s.id ? busy.to : null}
                  onFrame={() => render(s.id, "frame", 2)}
                  onDirect={() => render(s.id, "clip", 9)}
                  onClip={() => render(s.id, "clip", 7)}
                  onDone={() => updShot(s.id, { flow: "done" })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 悬浮 CTA */}
      <div
        className="row gap-2 pop-in"
        style={{
          position: "absolute",
          right: 26,
          bottom: 22,
          zIndex: 20,
          background: "var(--surface)",
          padding: 10,
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--line-soft)",
        }}
      >
        {step === "script" ? (
          <>
            <span className="faint" style={{ fontSize: 11.5, alignSelf: "center", paddingLeft: 4 }}>脚本满意?</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setStep("factory")}>
              <ImageIcon size={13} /> 去视频工厂
            </button>
          </>
        ) : doneCount === shots.length ? (
          <button
            type="button"
            className="btn btn-grad"
            onClick={() => {
              toast.success("短视频已合成,可在「我的短视频」查看");
              router.push("/shorts");
            }}
          >
            <Check size={15} /> 合成成片 · 完成
          </button>
        ) : (
          <span className="row gap-2" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", padding: "4px 6px" }}>
            <ImageIcon size={14} /> 把 {shots.length - doneCount} 个镜头出完即可合成
          </span>
        )}
      </div>
    </div>
  );
}
