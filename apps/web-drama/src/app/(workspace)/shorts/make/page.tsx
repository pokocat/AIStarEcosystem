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
  Plus,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { CreditButton, GenSkeleton, Thumb } from "@/components/drama-ui";
import { GenSettingsBar } from "@/components/drama-workshop/gen-settings-bar";
import { ShotFormCard, type FormShot, type ShotFlow } from "@/components/drama-workshop/shot-form";
import { SHORT_FORMATS, type Material, type ShortFormat } from "@/mocks/drama-workshop";
import { RenderApi, ShortDramaApi } from "@/api";
import type { ScriptMeta } from "@/api/short-drama";
import { aiErrorMessage } from "@/lib/ai-error";

// 整体短视频说明（meta）卡片里输入框/文本域的统一样式。
const META_INPUT: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13,
  lineHeight: 1.5,
  background: "var(--surface-2)",
  color: "var(--ink)",
  outline: "none",
  fontFamily: "inherit",
};

/** 把「整体短视频说明」拼成注入每镜提示词的前缀，统一全片风格 / 场景 / 主角。 */
function metaPromptPrefix(meta: ScriptMeta | null): string {
  if (!meta) return "";
  const parts = [
    meta.title?.trim() || "",
    meta.style?.length ? `风格：${meta.style.join("、")}` : "",
    meta.scene?.trim() ? `场景：${meta.scene.trim()}` : "",
    meta.character?.name?.trim()
      ? `主角：${meta.character.name.trim()}${meta.character.description?.trim() ? `（${meta.character.description.trim()}）` : ""}`
      : "",
  ].filter(Boolean);
  return parts.length ? `【整体设定】${parts.join("｜")}。` : "";
}

// 单镜各路径积分消耗(仅用于确认弹窗展示,真实计费在后台)
const SHORT_FRAME_COST = 2;
const SHORT_DIRECT_COST = 9;
const SHORT_CLIP_COST = 7;

/** 短视频分镜 = 结构化表单分镜 + 出镜引擎 */
interface ShortShot extends FormShot {
  engine: string;
  frameIdx: number;
}

interface ChatMsg {
  who: "ai" | "me";
  text: string;
}

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
        {isVideo && s.videoUrl ? (
          <video
            src={s.videoUrl}
            muted
            playsInline
            preload="metadata"
            style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", background: "#000", display: "block" }}
          />
        ) : (
          <Thumb
            from={rendered ? fmt.from : "#cbd5e1"}
            to={rendered ? fmt.to : "#94a3b8"}
            src={s.frameUrl ?? s.frameUrls?.[0]}
            ratio="9/16"
            radius={0}
            stripes={!rendered}
            style={{ width: "100%" }}
          />
        )}
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
            <CreditButton
              cost={SHORT_FRAME_COST}
              onConfirm={onFrame}
              confirmTitle="渲染首帧"
              confirmBody="先渲首帧锁画面,稳妥省抽卡。"
              className="btn btn-grad btn-sm"
              style={{ height: 30, justifyContent: "center", fontSize: 11.5 }}
              disabled={!!busy}
              markSize={12}
            >
              <ImageIcon size={12} /> 首帧
            </CreditButton>
            <CreditButton
              cost={SHORT_DIRECT_COST}
              onConfirm={onDirect}
              confirmTitle="直接生成视频"
              confirmBody="跳过首帧,直接生成这镜分镜视频。"
              className="btn btn-line btn-sm"
              style={{ height: 28, justifyContent: "center", fontSize: 11 }}
              disabled={!!busy}
              markSize={11}
            >
              <Zap size={11} /> 直出视频
            </CreditButton>
          </div>
        )}
        {s.flow === "frame" && (
          <CreditButton
            cost={SHORT_CLIP_COST}
            onConfirm={onClip}
            confirmTitle="生成视频"
            confirmBody="基于已选首帧生成动态视频。"
            className="btn btn-primary btn-sm"
            style={{ height: 30, justifyContent: "center", fontSize: 11.5 }}
            disabled={!!busy}
            markSize={12}
          >
            <Film size={12} /> 生成视频
          </CreditButton>
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
  // v0.66:诚实 idle 起步 —— 不再用 fmt.beats / fmt.sample 伪造分镜和「已聊过」的对话。
  // 空脚本 + 仅一句 AI 引导;真带入点子(来自首页/重开)才自动跑一次真实生成。
  const [phase, setPhase] = React.useState<"idle" | "gen" | "done">("idle");
  const realIdea = idea || reopen; // 仅当真带入点子时非空
  const title = realIdea || fmt.name;

  // 套模版上下文：把模版的分镜节拍 / 口播结构作为 AI 生成参考，喂进对话流（提示词/skill 加载）。
  const templateRef = fmt.beats?.length
    ? `「${fmt.name}」模版（${fmt.beats.length} 镜 · 约 ${fmt.dur}s）：` +
      fmt.beats.map((b, i) => `镜${i + 1}(${b.dur}s) 画面:${b.visual} 口播:${b.vo}`).join("；")
    : "";
  // 开场即把模版「装进」对话里：用户一眼看到套了哪个模版、AI 会照什么节拍来。
  const tplIntro = reopen
    ? "接着改这条短视频 —— 告诉我要怎么调,我重写口播和分镜。"
    : fmt.beats?.length
      ? `已套用【${fmt.name}】模版 —— 我照它的爆款节拍（${fmt.beats.length} 镜 · 约 ${fmt.dur}s）帮你拆,说说你的主题/产品就行。`
      : "说说你这条短视频想表达什么,我来帮你写口播脚本、拆好分镜。";

  const [shots, setShots] = React.useState<ShortShot[]>([]);
  // 整体短视频说明（标题 / 风格 / 场景 / 主角）—— AI 先定调，统领分镜与逐镜出片。
  const [meta, setMeta] = React.useState<ScriptMeta | null>(null);
  const [busy, setBusy] = React.useState<{ id: string; to: ShotFlow } | null>(null);
  const [refs, setRefs] = React.useState<Material[]>([]); // @数字人参考
  const [chat, setChat] = React.useState<ChatMsg[]>(() =>
    realIdea
      ? [
          { who: "ai", text: tplIntro },
          { who: "me", text: realIdea },
        ]
      : [{ who: "ai", text: tplIntro }],
  );
  const [draft, setDraft] = React.useState("");

  const total = shots.reduce((a, s) => a + s.dur, 0);
  const doneCount = shots.filter((s) => s.flow === "done").length;

  /** 真实 AI 生成口播脚本（DRAMA_SCRIPT_DRAFT）→ 映射为结构化分镜表。 */
  const runScript = async (instruction?: string, aiReply?: string) => {
    if (phase === "gen") return;
    setPhase("gen");
    try {
      const theme = instruction ? `${title}。要求：${instruction}` : title;
      const drafts = await ShortDramaApi.aiDraftScripts({
        theme,
        genre: fmt.name,
        durationSec: total || fmt.dur || 30,
        count: 1,
        reference: templateRef,
      });
      const script = drafts[0];
      if (!script || !script.scenes?.length) throw new Error("AI 没有产出可用脚本，请换个说法重试");
      setMeta(script.meta ?? null);
      setShots(
        script.scenes.map((sc, i) => ({
          id: "sh" + Date.now() + "_" + i,
          no: i + 1,
          dur: Math.max(2, sc.duration_sec || 4),
          visual: sc.shot || sc.summary || "",
          size: i === 0 ? "中近景" : "中景",
          move: i === 0 ? "推近" : "固定",
          voWho: "口播",
          voText: sc.dialogue ?? "",
          sfx: "",
          bgm: "",
          fx: "",
          refs: [],
          sub: true,
          flow: "draft" as ShotFlow,
          engine: "avatar",
          frameIdx: 0,
        })),
      );
      setPhase("done");
      if (aiReply) setChat((c) => [...c, { who: "ai", text: aiReply }]);
      toast.success("口播脚本和分镜已生成,改满意就去出片");
    } catch (e) {
      setPhase("done");
      const msg = aiErrorMessage(e, "脚本生成失败，请稍后重试");
      setChat((c) => [...c, { who: "ai", text: `生成失败：${msg}` }]);
      toast.error(msg);
    }
  };
  const regen = () => void runScript();

  // 真带入点子时,自动跑一次真实生成（不伪造结果；失败会在对话里显示真实错误）。
  const autoGenRef = React.useRef(false);
  React.useEffect(() => {
    if (realIdea && !autoGenRef.current) {
      autoGenRef.current = true;
      void runScript();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realIdea]);

  const QUICK = ["口吻再口语一点", "开头加个更狠的钩子", "缩到 20 秒内", "多一点产品特写"];
  const sendChat = (text: string) => {
    const t = (text || "").trim();
    if (!t || phase === "gen") return;
    setChat((c) => [...c, { who: "me", text: t }]);
    setDraft("");
    void runScript(t, "改好了——右侧脚本已更新,你再看看还哪里要调?");
  };
  const updShot = (id: string, patch: Partial<ShortShot>) =>
    setShots((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  /** 单镜真实渲染：frame=首帧（图像），clip=视频（异步任务 + 轮询）。 */
  const render = async (id: string, to: ShotFlow, _cost: number) => {
    const shot = shots.find((s) => s.id === id);
    if (!shot || busy) return;
    setBusy({ id, to });
    // 把「整体短视频说明」注入每镜提示词，保证风格 / 场景 / 主角跨镜一致 —— 出片更准确。
    const metaCtx = metaPromptPrefix(meta);
    try {
      if (to === "frame") {
        const frames = await RenderApi.renderFrame({
          kind: "short",
          vars: { metaPrefix: metaCtx, visual: shot.visual, styleSuffix: `竖屏短视频画面，${fmt.name}风格。` },
          ratio: "9:16",
          count: 1,
        });
        updShot(id, { flow: "frame", frameUrls: frames.map((f) => f.url), frameUrl: frames[0]?.url });
        toast.success("首帧已出,确认后再生成视频");
      } else {
        const job = await RenderApi.renderClip({
          kind: "short",
          vars: {
            metaPrefix: metaCtx, visual: shot.visual,
            lineClause: shot.voText ? `口播：${shot.voText}` : "", styleSuffix: `竖屏短视频，${fmt.name}风格。`,
          },
          name: `${fmt.name} 镜${shot.no}`,
          durationSec: shot.dur,
          ratio: "9:16",
          frameUrl: shot.frameUrl,
        });
        const done = await RenderApi.pollClipJob(job.id, { timeoutMs: 240_000 });
        if (done.status === "failed") throw new Error(done.error_message || "视频生成失败，请重试");
        updShot(id, { flow: "clip", videoUrl: done.video_url ?? undefined, jobId: job.id });
        toast.success("镜头视频已生成");
      }
    } catch (e) {
      toast.error(aiErrorMessage(e, "渲染失败，请稍后重试"));
    } finally {
      setBusy(null);
    }
  };

  const STEP_META: { key: "script" | "factory"; no: number; name: string; icon: React.ElementType }[] = [
    { key: "script", no: 1, name: "分镜脚本", icon: Clapperboard },
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

          {/* 右:结构化分镜脚本(表单式 · 带时间线) */}
          <div className="scroll grow" style={{ minHeight: 0, background: "var(--bg)" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "22px 28px 110px" }}>
              <div className="row gap-2" style={{ marginBottom: 14 }}>
                <Clapperboard size={16} style={{ color: "var(--accent)" }} />
                <span style={{ fontWeight: 800, fontSize: 16 }}>分镜脚本</span>
                <span className="faint num" style={{ fontSize: 12 }}>{shots.length} 镜 · 约 {total}s · 时间线自动累计</span>
                <span className="grow" />
                <button type="button" className="chip" disabled={phase === "gen" || shots.length === 0} onClick={regen}>
                  <RefreshCw size={12} /> 重新生成
                </button>
              </div>

              {/* 整体短视频说明：AI 先定调，统领分镜与逐镜出片，可直接改 */}
              {meta && (
                <div className="card col gap-3" style={{ padding: 16, marginBottom: 16 }}>
                  <div className="row gap-2" style={{ alignItems: "center" }}>
                    <Sparkles size={15} style={{ color: "var(--accent)" }} />
                    <span style={{ fontWeight: 800, fontSize: 14 }}>整体短视频说明</span>
                    <span className="faint" style={{ fontSize: 11 }}>AI 先定调 · 分镜与出片都据此保持一致，可直接改</span>
                  </div>
                  <div className="col gap-1">
                    <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>标题</span>
                    <input
                      value={meta.title ?? ""}
                      onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                      placeholder="一句话标题"
                      style={META_INPUT}
                    />
                  </div>
                  <div className="col gap-1">
                    <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>风格</span>
                    <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                      {meta.style?.length ? (
                        meta.style.map((s, i) => (
                          <span
                            key={i}
                            className="chip static"
                            style={{ height: 24, fontSize: 11.5, background: "var(--accent-soft)", color: "var(--accent)" }}
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="faint" style={{ fontSize: 12 }}>—</span>
                      )}
                    </div>
                  </div>
                  <div className="col gap-1">
                    <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>主场景</span>
                    <textarea
                      value={meta.scene ?? ""}
                      onChange={(e) => setMeta({ ...meta, scene: e.target.value })}
                      placeholder="主场景一句话描述"
                      rows={2}
                      style={{ ...META_INPUT, resize: "none" }}
                    />
                  </div>
                  <div className="col gap-1">
                    <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>主角</span>
                    <input
                      value={meta.character?.name ?? ""}
                      onChange={(e) => setMeta({ ...meta, character: { ...(meta.character ?? { name: "", description: "" }), name: e.target.value } })}
                      placeholder="角色名"
                      style={META_INPUT}
                    />
                    <textarea
                      value={meta.character?.description ?? ""}
                      onChange={(e) => setMeta({ ...meta, character: { ...(meta.character ?? { name: "", description: "" }), description: e.target.value } })}
                      placeholder="形象与性格一句话"
                      rows={2}
                      style={{ ...META_INPUT, resize: "none" }}
                    />
                  </div>
                </div>
              )}

              {phase === "gen" ? (
                <div className="card" style={{ padding: 18 }}>
                  <GenSkeleton lines={4} label="正在写口播稿并拆分镜…" />
                </div>
              ) : shots.length === 0 ? (
                <div className="card col center" style={{ padding: "48px 24px", textAlign: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
                    <Clapperboard size={26} />
                  </div>
                  <div className="muted" style={{ maxWidth: 340, fontSize: 13.5 }}>
                    左边跟 AI 说一句你的想法,它就帮你写口播脚本、拆好分镜 —— 改满意了再去出片。
                  </div>
                </div>
              ) : (
                <div className="col gap-3">
                  {shots.map((s2, i) => (
                    <ShotFormCard
                      key={s2.id}
                      s={s2}
                      start={shots.slice(0, i).reduce((a, x) => a + (x.dur || 0), 0)}
                      colors={s2.flow === "draft" ? { from: "#cbd5e1", to: "#94a3b8" } : { from: fmt.from, to: fmt.to }}
                      speakerOptions={["口播", "旁白"]}
                      busy={busy && busy.id === s2.id ? busy.to : null}
                      onPatch={(patch) => updShot(s2.id, patch)}
                      onDelete={() => setShots((arr) => arr.filter((x) => x.id !== s2.id).map((x, j) => ({ ...x, no: j + 1 })))}
                      onRenderFrame={() => render(s2.id, "frame", 2)}
                      onRenderDirect={() => render(s2.id, "clip", 9)}
                      onRenderClip={() => render(s2.id, "clip", 7)}
                      onApprove={() => updShot(s2.id, { flow: "done" })}
                    />
                  ))}
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    style={{ alignSelf: "flex-start" }}
                    onClick={() =>
                      setShots((arr) => [
                        ...arr,
                        { id: "add" + Date.now(), no: arr.length + 1, dur: 4, visual: "", size: "中景", move: "固定", voWho: "口播", voText: "", sfx: "", bgm: "", fx: "", refs: [], sub: true, flow: "draft", engine: "fx", frameIdx: 0 },
                      ])
                    }
                  >
                    <Plus size={14} /> 加一镜
                  </button>
                  <div className="row gap-2" style={{ padding: "4px 2px" }}>
                    <Edit size={12} style={{ color: "var(--ink-3)" }} />
                    <span className="faint" style={{ fontSize: 11.5 }}>所有字段点击即可改 · 画面里输入 @ 引用素材 · 也可让左侧 AI 整体重写</span>
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
        ) : shots.length > 0 && doneCount === shots.length ? (
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
