"use client";

// 视频工厂 — 设计真源 v4 screens-factory-v4.jsx `FactoryStage4`:
// 每镜双路径(先渲首帧看效果·稳妥省抽卡 / 直接生成分镜视频·快),
// 流水:待渲 → 选首帧 → 首帧已锁 → 动态待验收 → 已成片;
// 生成设置栏(模型/画幅/分辨率 + @素材参考)。
import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Film,
  Image as ImageIcon,
  Lock,
  Package,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { aiErrorMessage } from "@/lib/ai-error";
import { Avatar, CreditButton, EngineTag, Thumb } from "@/components/drama-ui";
import { StageHeader } from "../workbench";
import { GenSettingsBar } from "../gen-settings-bar";
import { getEpisodeDoc, matById, withEpisodeDoc, type BoardShot, type Material, type ProjectData } from "@/mocks/drama-workshop";
import type { WorkshopAction, WorkshopState } from "../workbench";
import { RenderApi } from "@/api";
import { useDramaConfig } from "@/lib/use-drama-config";
import type { StageContext } from "./stage-context";

const FRAME_COST = 2;
const CLIP_COST = 9;

type FlowKey = "draft" | "frame" | "frameLocked" | "clip" | "done";
const FLOW_ORDER: FlowKey[] = ["draft", "frame", "frameLocked", "clip", "done"];

const FLOW = [
  { key: "frame", no: 1, name: "首帧渲染", sub: "可选 · 先定画面构图人物,省抽卡", icon: ImageIcon, cost: FRAME_COST },
  { key: "clip", no: 2, name: "动态渲染", sub: "基于首帧或直接生成运动", icon: Film, cost: CLIP_COST },
  { key: "done", no: 3, name: "验收成片", sub: "满意才入片,不满意只重渲这镜", icon: Check, cost: 0 },
] as const;

interface FactoryShot extends BoardShot {
  sceneId: string;
  place: string;
  sceneNo: number;
  flow: FlowKey;
  frameIdx: number;
}

function shotColors(engine: BoardShot["engine"], dim?: boolean) {
  const a = engine === "avatar" ? { from: "#fb923c", to: "#f472b6" } : { from: "#94a3b8", to: "#64748b" };
  return dim
    ? { from: `color-mix(in oklch,${a.from} 38%, #cbd5e1)`, to: `color-mix(in oklch,${a.to} 38%, #94a3b8)` }
    : a;
}

interface FactoryStageProps {
  state: WorkshopState;
  dispatch: React.Dispatch<WorkshopAction>;
  data: ProjectData;
  ctx?: StageContext;
}

export function FactoryStage({ state, dispatch, data, ctx }: FactoryStageProps) {
  const cfg = useDramaConfig();
  const build = React.useCallback((): FactoryShot[] => {
    const list: FactoryShot[] = [];
    const doc = getEpisodeDoc(data, state.ep);
    doc.storyboard.scenes.forEach((sc, si) => {
      const place = doc.script.scenes.find((x) => x.id === sc.id)?.place ?? `场景 ${si + 1}`;
      sc.shots.forEach((sh) =>
        list.push({
          ...sh,
          sceneId: sc.id,
          place,
          sceneNo: si + 1,
          // 持久化的 flow 优先；老数据回退 done→clip / 其余 draft
          flow: (sh.flow as FlowKey) ?? (sh.done ? "clip" : "draft"),
          frameIdx: 0,
        }),
      );
    });
    return list;
  }, [data, state.ep]);

  const [shots, setShots] = React.useState<FactoryShot[]>(build);
  React.useEffect(() => {
    setShots(build());
  }, [state.ep, build]);
  const upd = (id: string, patch: Partial<FactoryShot>) =>
    setShots((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  /** 落库：把工厂镜头的渲染态写回 ProjectData.storyboard（缺 ctx 时跳过）。 */
  const persistShots = React.useCallback(
    async (arr: FactoryShot[]) => {
      if (!ctx) return;
      const byId = new Map(arr.map((s) => [s.id, s]));
      const doc = getEpisodeDoc(data, state.ep);
      const scenes = doc.storyboard.scenes.map((sc) => ({
        ...sc,
        shots: sc.shots.map((sh) => {
          const f = byId.get(sh.id);
          if (!f) return sh;
          return {
            ...sh,
            flow: f.flow,
            done: f.flow === "done",
            frameUrls: f.frameUrls,
            frameUrl: f.frameUrl,
            videoUrl: f.videoUrl,
            jobId: f.jobId,
          };
        }),
      }));
      await ctx.saveData(
        withEpisodeDoc(data, state.ep, { ...doc, storyboard: { ...doc.storyboard, scenes } }),
      );
    },
    [ctx, data, state.ep],
  );

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<{ id: string; to: FlowKey } | null>(null);
  const [refs, setRefs] = React.useState<Material[]>(() => {
    const bound = state.chars.find((c) => c.bound);
    const a1 = matById("a1");
    return bound && a1 ? [a1] : [];
  });

  const stat = {
    total: shots.length,
    framed: shots.filter((s) => FLOW_ORDER.indexOf(s.flow) >= FLOW_ORDER.indexOf("frameLocked")).length,
    done: shots.filter((s) => s.flow === "done").length,
  };
  const pct = stat.total ? Math.round((stat.done / stat.total) * 100) : 0;
  const draftCount = shots.filter((s) => s.flow === "draft").length;

  /** 镜头 → 生成提示词（画面 + 镜头参数 + 台词 + 角色参考名）。 */
  // v0.72：出图/出片提示词模板在 server 端（drama.frame_image / drama.clip_video，admin 可改）。
  // 这里只产出填充用的结构化 vars；可选片段（台词/出场人物）仍在前端按是否存在拼成整句，
  // 与 v0.71 文本 prompt 的 {{xxxClause}} 同规则。
  const shotVars = (s: FactoryShot): Record<string, string> => {
    const castNames = (s.cast ?? [])
      .map((cid) => state.chars.find((c) => c.id === cid)?.name)
      .filter(Boolean)
      .join("、");
    return {
      visual: s.desc || s.place || "",
      size: s.size || "",
      move: s.move || "",
      lineClause: s.line?.text ? `台词：${s.line.text}。` : "",
      castClause: castNames ? `出场人物：${castNames}。` : "",
      styleSuffix: `${data.projectInfo.type}风格。`,
    };
  };

  /** 首帧渲染（真实图像生成，出 4 版候选）。 */
  const renderFrame = async (id: string) => {
    const s = shots.find((x) => x.id === id);
    if (!s || busy) return;
    setBusy({ id, to: "frame" });
    try {
      const frames = await RenderApi.renderFrame({
        kind: "shot",
        vars: shotVars(s),
        ratio: data.projectInfo.ratio,
        count: 4,
      });
      const next = shots.map((x) =>
        x.id === id
          ? { ...x, flow: "frame" as FlowKey, frameUrls: frames.map((f) => f.url), frameIdx: 0, frameUrl: undefined, videoUrl: undefined }
          : x,
      );
      setShots(next);
      await persistShots(next);
      dispatch({ type: "spend", n: cfg.prices.frame });
      toast.success(`首帧已出 ${frames.length} 版,挑一版锁定`);
    } catch (e) {
      toast.error(aiErrorMessage(e, "首帧渲染失败，请稍后重试"));
    } finally {
      setBusy(null);
    }
  };

  /** 视频渲染（直出或基于已锁首帧；异步任务 + 轮询）。 */
  const renderVideo = async (id: string, useFrame: boolean) => {
    const s = shots.find((x) => x.id === id);
    if (!s || busy) return;
    setBusy({ id, to: "clip" });
    try {
      const job = await RenderApi.renderClip({
        kind: "shot",
        vars: shotVars(s),
        name: `第${state.ep}集 镜${s.no}`,
        durationSec: s.dur,
        ratio: data.projectInfo.ratio,
        projectId: ctx?.projectId,
        frameUrl: useFrame ? s.frameUrl ?? s.frameUrls?.[s.frameIdx] : undefined,
      });
      const done = await RenderApi.pollClipJob(job.id, { timeoutMs: 240_000 });
      if (done.status === "failed") throw new Error(done.error_message || "视频生成失败，请重试");
      const next = shots.map((x) =>
        x.id === id ? { ...x, flow: "clip" as FlowKey, videoUrl: done.video_url ?? undefined, jobId: job.id } : x,
      );
      setShots(next);
      await persistShots(next);
      dispatch({ type: "spend", n: cfg.prices.clip });
      toast.success("动态已渲染,验收看看");
    } catch (e) {
      toast.error(aiErrorMessage(e, "视频生成失败，请稍后重试"));
    } finally {
      setBusy(null);
    }
  };

  const renderDirect = (id: string) => void renderVideo(id, false);
  const renderClip = (id: string) => void renderVideo(id, true);
  const lockFrame = (id: string) => {
    const next = shots.map((x) =>
      x.id === id ? { ...x, flow: "frameLocked" as FlowKey, frameUrl: x.frameUrls?.[x.frameIdx] ?? x.frameUrl } : x,
    );
    setShots(next);
    void persistShots(next);
    toast.success("首帧已锁,动态渲染会严格基于它");
  };
  const approve = (id: string) => {
    const next = shots.map((x) => (x.id === id ? { ...x, flow: "done" as FlowKey } : x));
    setShots(next);
    void persistShots(next);
    toast.success("本镜验收通过,已入片");
  };
  const reframe = (id: string) => void renderFrame(id);

  /** 批量首帧：顺序逐镜渲染（控制真实模型请求节奏）。 */
  const batchFrame = async () => {
    const drafts = shots.filter((s) => s.flow === "draft");
    if (!drafts.length) {
      toast.success("没有待渲首帧的镜头");
      return;
    }
    let okCount = 0;
    let cur = shots;
    for (const d of drafts) {
      setBusy({ id: d.id, to: "frame" });
      try {
        const frames = await RenderApi.renderFrame({
          kind: "shot",
          vars: shotVars(d),
          ratio: data.projectInfo.ratio,
          count: 4,
        });
        cur = cur.map((x) =>
          x.id === d.id ? { ...x, flow: "frame" as FlowKey, frameUrls: frames.map((f) => f.url), frameIdx: 0 } : x,
        );
        setShots(cur);
        dispatch({ type: "spend", n: cfg.prices.frame });
        okCount++;
      } catch (e) {
        toast.error(`镜 ${d.no} 首帧失败：${aiErrorMessage(e, "未知错误")}`);
        break;
      }
    }
    setBusy(null);
    if (okCount > 0) {
      await persistShots(cur);
      toast.success(`已为 ${okCount} 个镜头各出 4 版首帧`);
    }
  };

  const open = shots.find((s) => s.id === openId);

  return (
    <div className="row" style={{ height: "100%", alignItems: "stretch", position: "relative" }}>
      <div className="scroll grow" style={{ height: "100%" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 32px 64px" }}>
          <StageHeader
            no={5}
            scope="剧集"
            title={`第 ${state.ep} 集 · 视频工厂`}
            desc="每镜两条路自己选:稳妥路线先渲首帧锁画面再出视频,抽卡风险低;赶时间就直接生成分镜视频。"
          />

          {/* 流程说明条(窄口自动堆叠) */}
          <div
            className="card"
            style={{
              padding: 0,
              marginBottom: 16,
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(216px, 1fr))",
              gap: 1,
              background: "var(--line-soft)",
            }}
          >
            {FLOW.map((f) => {
              const FIcon = f.icon;
              return (
                <div key={f.key} className="row gap-3" style={{ padding: "14px 16px", minWidth: 0, background: "var(--surface)" }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      flex: "none",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <FIcon size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row gap-2">
                      <span className="num faint" style={{ fontSize: 11, fontWeight: 700 }}>{f.no}</span>
                      <span style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap" }}>{f.name}</span>
                    </div>
                    <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.4 }}>{f.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 进度 + 批量 */}
          <div className="card row gap-4" style={{ padding: 16, marginBottom: 16 }}>
            <div className="col gap-1" style={{ flex: "none" }}>
              <span className="num" style={{ fontSize: 26, fontWeight: 800, color: "var(--accent)" }}>
                {stat.done}
                <span className="faint" style={{ fontSize: 15, fontWeight: 600 }}>/{stat.total}</span>
              </span>
              <span className="faint" style={{ fontSize: 11.5 }}>镜头已成片</span>
            </div>
            <div className="grow col gap-2" style={{ minWidth: 0 }}>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                <span className="faint">
                  首帧已锁 <b className="num" style={{ color: "var(--ink-2)" }}>{stat.framed}</b> · 成片{" "}
                  <b className="num" style={{ color: "#15803d" }}>{stat.done}</b>
                </span>
                <span className="num" style={{ fontWeight: 700, color: "var(--accent)" }}>{pct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: pct + "%",
                    borderRadius: 99,
                    background: "linear-gradient(90deg,var(--accent),var(--accent-2))",
                    transition: "width .4s",
                  }}
                />
              </div>
            </div>
            <CreditButton
              cost={draftCount * cfg.prices.frame}
              onConfirm={batchFrame}
              confirmTitle="批量渲染首帧"
              confirmBody={`为 ${draftCount} 个待渲镜头各出 4 版首帧。`}
              className="btn btn-line btn-sm"
              style={{ flex: "none" }}
              disabled={draftCount === 0}
            >
              <ImageIcon size={14} /> 全部待渲先出首帧
            </CreditButton>
          </div>

          {/* 生成设置:模型 / 画幅比 / 分辨率 + @素材参考 */}
          <GenSettingsBar defaultRatio="9:16" refs={refs} setRefs={setRefs} />

          {/* 镜头网格 */}
          <div className="row gap-2" style={{ marginBottom: 12 }}>
            <Film size={15} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>本集镜头 · {shots.length}</span>
            <span className="faint" style={{ fontSize: 12 }}>点任意镜头进入逐步渲染</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(186px,1fr))", gap: 14 }}>
            {shots.map((s, i) => (
              <FactoryCard
                key={s.id}
                s={s}
                i={i}
                frameCost={cfg.prices.frame}
                clipCost={cfg.prices.clip}
                active={openId === s.id}
                busy={busy && busy.id === s.id ? busy.to : null}
                onOpen={() => setOpenId(s.id)}
                onRenderFrame={() => renderFrame(s.id)}
                onRenderDirect={() => renderDirect(s.id)}
                onRenderClip={() => renderClip(s.id)}
                onApprove={() => approve(s.id)}
              />
            ))}
          </div>

          {/* 收尾:进配方 */}
          <div
            className="card row gap-3"
            style={{ marginTop: 22, padding: 16, background: stat.done === stat.total && stat.total > 0 ? "var(--accent-soft)" : "var(--surface)" }}
          >
            {stat.done === stat.total && stat.total > 0 ? (
              <Check size={20} style={{ color: "var(--accent)", flex: "none" }} />
            ) : (
              <Package size={20} style={{ color: "var(--accent)", flex: "none" }} />
            )}
            <div className="grow">
              <div style={{ fontWeight: 700 }}>
                {stat.done === stat.total && stat.total > 0 ? "本集镜头全部成片 🎉" : "逐镜成片后,一键拼成完整片"}
              </div>
              <div className="faint" style={{ fontSize: 12.5 }}>已出片镜头会按场序与镜号拼接成完整一集,产物落 CDN 可直接分发</div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={stat.total === 0}
              onClick={() => dispatch({ type: "jump", stage: "prompt" })}
            >
              去成片合成 <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <FactoryDrawer
          s={open}
          chars={state.chars}
          frameCost={cfg.prices.frame}
          clipCost={cfg.prices.clip}
          busy={busy && busy.id === open.id ? busy.to : null}
          onClose={() => setOpenId(null)}
          onRenderFrame={() => renderFrame(open.id)}
          onRenderDirect={() => renderDirect(open.id)}
          onLockFrame={() => lockFrame(open.id)}
          onReframe={() => reframe(open.id)}
          onPickFrame={(idx) => upd(open.id, { frameIdx: idx })}
          onRenderClip={() => renderClip(open.id)}
          onApprove={() => approve(open.id)}
        />
      )}
    </div>
  );
}

/* 流水状态标签 */
function FlowBadge({ flow, busy }: { flow: FlowKey; busy: FlowKey | null }) {
  if (busy === "frame")
    return (
      <span className="tag tag-accent">
        <Spin /> 渲首帧…
      </span>
    );
  if (busy === "clip")
    return (
      <span className="tag tag-accent">
        <Spin /> 渲动态…
      </span>
    );
  const map: Record<FlowKey, [string, string]> = {
    draft: ["tag-gray", "待渲首帧"],
    frame: ["tag-amber", "选首帧"],
    frameLocked: ["tag-accent", "首帧已锁"],
    clip: ["tag-amber", "待验收"],
    done: ["tag-green", "已成片"],
  };
  const [cls, label] = map[flow] ?? map.draft;
  return (
    <span className={"tag " + cls}>
      {flow === "done" && <Check size={11} />}
      {label}
    </span>
  );
}
function Spin() {
  return (
    <span
      aria-hidden
      style={{
        width: 11,
        height: 11,
        border: "2px solid color-mix(in oklch, currentColor 35%, transparent)",
        borderTopColor: "currentColor",
        borderRadius: "50%",
        display: "inline-block",
        animation: "drama-spin .7s linear infinite",
      }}
    />
  );
}

/* 工厂镜头卡 */
function FactoryCard({
  s,
  i,
  frameCost,
  clipCost,
  active,
  busy,
  onOpen,
  onRenderFrame,
  onRenderDirect,
  onRenderClip,
  onApprove,
}: {
  s: FactoryShot;
  i: number;
  frameCost: number;
  clipCost: number;
  active: boolean;
  busy: FlowKey | null;
  onOpen: () => void;
  onRenderFrame: () => void;
  onRenderDirect: () => void;
  onRenderClip: () => void;
  onApprove: () => void;
}) {
  const rendered = FLOW_ORDER.indexOf(s.flow) >= FLOW_ORDER.indexOf("frame");
  const col = shotColors(s.engine, !rendered);
  const primary = () => {
    if (s.flow === "draft")
      return (
        <>
          <CreditButton
            cost={frameCost}
            onConfirm={onRenderFrame}
            confirmTitle="渲染首帧"
            confirmBody="先渲首帧锁画面,稳妥省抽卡。"
            className="btn btn-grad btn-sm grow"
            title="先渲首帧锁画面,稳妥省抽卡"
            style={{ justifyContent: "center" }}
          >
            <ImageIcon size={13} /> 首帧
          </CreditButton>
          <CreditButton
            cost={clipCost}
            onConfirm={onRenderDirect}
            confirmTitle="直接生成视频"
            confirmBody="跳过首帧,直接生成这镜分镜视频。"
            className="btn btn-line btn-sm grow"
            title="跳过首帧,直接生成分镜视频"
            style={{ justifyContent: "center" }}
          >
            <Zap size={13} /> 直出
          </CreditButton>
        </>
      );
    if (s.flow === "frame")
      return (
        <button type="button" className="btn btn-primary btn-sm grow" style={{ justifyContent: "center" }} onClick={onOpen}>
          挑首帧 <ArrowRight size={13} />
        </button>
      );
    if (s.flow === "frameLocked")
      return (
        <CreditButton
          cost={clipCost}
          onConfirm={onRenderClip}
          confirmTitle="渲染动态"
          confirmBody="基于已锁定首帧渲染动态视频。"
          className="btn btn-grad btn-sm grow"
          style={{ justifyContent: "center" }}
        >
          <Film size={13} /> 渲动态
        </CreditButton>
      );
    if (s.flow === "clip")
      return (
        <button
          type="button"
          className="btn btn-primary btn-sm grow"
          style={{ justifyContent: "center" }}
          onClick={(e) => {
            e.stopPropagation();
            onApprove();
          }}
        >
          <Check size={13} /> 验收
        </button>
      );
    return (
      <button type="button" className="btn btn-line btn-sm grow" style={{ justifyContent: "center" }} onClick={onOpen}>
        <Film size={13} /> 回看
      </button>
    );
  };
  return (
    <div
      className="card col fade-up"
      style={{
        padding: 0,
        overflow: "hidden",
        animationDelay: i * 35 + "ms",
        border: active ? "2px solid var(--accent)" : s.flow === "done" ? "1px solid #86efac" : "1px solid var(--line-soft)",
      }}
    >
      <button type="button" style={{ position: "relative", display: "block", width: "100%" }} onClick={onOpen}>
        <Thumb from={col.from} to={col.to} src={s.frameUrl ?? s.frameUrls?.[0]} ratio="9/13" radius={0} style={{ width: "100%" }} stripes={!rendered}>
          {rendered && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.85)",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 3px 10px rgba(0,0,0,.2)",
                }}
              >
                {FLOW_ORDER.indexOf(s.flow) >= FLOW_ORDER.indexOf("clip") ? (
                  <svg width="13" height="13" viewBox="0 0 14 14">
                    <path d="M4 2.5v9l7.5-4.5z" fill="var(--accent)" />
                  </svg>
                ) : (
                  <ImageIcon size={15} style={{ color: "var(--accent)" }} />
                )}
              </span>
            </div>
          )}
          {!rendered && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.85)" }}>
              <Film size={22} />
            </div>
          )}
        </Thumb>
        <span
          className="num"
          style={{
            position: "absolute",
            top: 7,
            left: 7,
            background: "rgba(0,0,0,.5)",
            color: "#fff",
            fontSize: 10.5,
            padding: "2px 7px",
            borderRadius: 6,
            fontWeight: 700,
          }}
        >
          #{s.no} · 场{s.sceneNo}
        </span>
        <span
          className="num"
          style={{
            position: "absolute",
            bottom: 7,
            right: 7,
            background: "rgba(0,0,0,.5)",
            color: "#fff",
            fontSize: 10,
            padding: "2px 6px",
            borderRadius: 6,
            fontWeight: 700,
          }}
        >
          {s.dur}s
        </span>
        <div style={{ position: "absolute", top: 7, right: 7 }}>
          <FlowBadge flow={s.flow} busy={busy} />
        </div>
      </button>
      <div className="col gap-2" style={{ padding: 11 }}>
        <div style={{ fontSize: 12, lineHeight: 1.45, height: 34, overflow: "hidden", color: "var(--ink-2)" }}>
          {s.desc || "（无描述）"}
        </div>
        <div className="row gap-2">
          <EngineTag engine={s.engine} />
        </div>
        <div className="row gap-2">{primary()}</div>
      </div>
    </div>
  );
}

/* 单镜流水抽屉:首帧候选 → 锁定 → 动态 → 验收 */
function FactoryDrawer({
  s,
  chars,
  frameCost,
  clipCost,
  busy,
  onClose,
  onRenderFrame,
  onRenderDirect,
  onLockFrame,
  onReframe,
  onPickFrame,
  onRenderClip,
  onApprove,
}: {
  s: FactoryShot;
  chars: WorkshopState["chars"];
  frameCost: number;
  clipCost: number;
  busy: FlowKey | null;
  onClose: () => void;
  onRenderFrame: () => void;
  onRenderDirect: () => void;
  onLockFrame: () => void;
  onReframe: () => void;
  onPickFrame: (idx: number) => void;
  onRenderClip: () => void;
  onApprove: () => void;
}) {
  const at = FLOW_ORDER.indexOf(s.flow);
  const col = shotColors(s.engine);
  const cast = (s.cast ?? []).map((id) => chars.find((c) => c.id === id)).filter(Boolean);
  const frameVariants = [0, 1, 2, 3];

  const preview = () => {
    if (busy === "frame") return <RenderBusy label="正在渲染 4 版首帧…" />;
    if (busy === "clip") return <RenderBusy label="正在基于锁定首帧渲染动态…" />;
    if (at >= FLOW_ORDER.indexOf("clip")) {
      if (s.videoUrl) {
        return (
          <video
            src={s.videoUrl}
            controls
            playsInline
            style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", borderRadius: 14, background: "#000", display: "block" }}
          />
        );
      }
      return (
        <Thumb from={col.from} to={col.to} src={s.frameUrl ?? s.frameUrls?.[s.frameIdx]} ratio="9/16" radius={14} style={{ width: "100%" }}>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(255,255,255,.9)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,.25)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 14 14">
                <path d="M4 2.5v9l7.5-4.5z" fill="var(--accent)" />
              </svg>
            </span>
          </div>
          <span className="thumb-label" style={{ position: "absolute", left: 10, bottom: 10 }}>动态成片 · {s.dur}s</span>
        </Thumb>
      );
    }
    if (at >= FLOW_ORDER.indexOf("frame")) {
      const locked = at >= FLOW_ORDER.indexOf("frameLocked");
      return (
        <div className="col gap-2">
          <Thumb from={col.from} to={col.to} src={s.frameUrls?.[s.frameIdx] ?? s.frameUrl} ratio="9/16" radius={14} style={{ width: "100%" }}>
            <span className="thumb-label" style={{ position: "absolute", left: 10, bottom: 10 }}>
              {locked ? "已锁首帧 · 第 " + (s.frameIdx + 1) + " 版" : "首帧预览 · 第 " + (s.frameIdx + 1) + " 版"}
            </span>
            {locked && (
              <span
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 0 0 2px #fff",
                  color: "#fff",
                }}
              >
                <Lock size={12} />
              </span>
            )}
          </Thumb>
          {!locked && (
            <div className="row gap-2">
              {(s.frameUrls?.length ? s.frameUrls.map((_, i) => i) : frameVariants).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onPickFrame(v)}
                  style={{
                    flex: 1,
                    borderRadius: 9,
                    overflow: "hidden",
                    border: s.frameIdx === v ? "2px solid var(--accent)" : "2px solid transparent",
                    position: "relative",
                  }}
                >
                  <Thumb from={col.from} to={col.to} src={s.frameUrls?.[v]} ratio="9/13" radius={0} style={{ width: "100%" }} />
                  <span
                    className="num"
                    style={{
                      position: "absolute",
                      top: 3,
                      left: 4,
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#fff",
                      textShadow: "0 1px 2px rgba(0,0,0,.5)",
                    }}
                  >
                    {v + 1}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <Thumb from={col.from} to={col.to} ratio="9/16" radius={14} stripes style={{ width: "100%" }}>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.9)" }}>
          <div className="col center gap-2">
            <Film size={32} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>还没渲首帧</span>
          </div>
        </div>
      </Thumb>
    );
  };

  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.18)", zIndex: 30 }} onClick={onClose} />
      <aside
        className="col slide-in-r"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 420,
          maxWidth: "94%",
          background: "var(--surface)",
          borderLeft: "1px solid var(--line)",
          zIndex: 31,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)" }}>
          <span className="num tag tag-accent" style={{ marginRight: 8 }}>第 {s.no} 镜 · 场{s.sceneNo}</span>
          <FlowBadge flow={s.flow} busy={busy} />
          <span className="grow" />
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        {/* 步骤指示 */}
        <div className="row" style={{ padding: "12px 18px 4px", gap: 0 }}>
          {FLOW.map((f, i) => {
            const done =
              (f.key === "frame" && at >= FLOW_ORDER.indexOf("frameLocked")) ||
              (f.key === "clip" && at >= FLOW_ORDER.indexOf("done")) ||
              (f.key === "done" && s.flow === "done");
            const cur =
              (f.key === "frame" && (s.flow === "frame" || s.flow === "frameLocked")) ||
              (f.key === "clip" && s.flow === "clip") ||
              (f.key === "done" && s.flow === "done");
            return (
              <React.Fragment key={f.key}>
                <div className="col center gap-1" style={{ flex: "none" }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      background: done || cur ? "var(--accent)" : "var(--surface-2)",
                      color: done || cur ? "#fff" : "var(--ink-3)",
                    }}
                  >
                    {done ? <Check size={13} /> : f.no}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: cur ? 700 : 600, color: cur ? "var(--accent)" : "var(--ink-3)" }}>{f.name}</span>
                </div>
                {i < FLOW.length - 1 && (
                  <div className="grow" style={{ height: 2, background: done ? "var(--accent)" : "var(--line)", margin: "13px 4px 0" }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="col gap-3 scroll grow" style={{ padding: 18, minHeight: 0 }}>
          {preview()}

          {/* 镜头信息 */}
          <div className="card col gap-2" style={{ padding: 12, background: "var(--surface-2)", border: "none" }}>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>{s.desc}</div>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <span className="tag tag-gray">{s.size}</span>
              <span className="tag tag-gray">{s.move}</span>
              <span className="tag tag-gray num">{s.dur}s</span>
              <EngineTag engine={s.engine} />
            </div>
            {cast.length > 0 && (
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                {cast.map((c) => (
                  <span
                    key={c!.id}
                    className="row"
                    style={{ padding: "3px 9px 3px 3px", borderRadius: 999, background: "var(--accent-soft)", gap: 5 }}
                  >
                    <Avatar theme={c!.avatar} size={20} bound={c!.bound} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)" }}>{c!.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 当前步骤提示 */}
          <div className="row gap-2" style={{ fontSize: 12, color: "var(--ink-3)", padding: "0 2px" }}>
            <Sparkles size={14} style={{ color: "var(--accent)", flex: "none", marginTop: 1 }} />
            <span>
              {s.flow === "draft" &&
                "两条路自己选:【首帧预览】先出静帧便宜快,把画面和人物长相定准再出视频,避开大多数抽卡翻车;【直接生成】一步到位,适合空镜等低风险镜头。"}
              {s.flow === "frame" && "四版首帧任挑一版,或换一批重渲。选定后锁定,动态渲染会严格继承这一帧。"}
              {s.flow === "frameLocked" && "首帧已锁。现在渲动态,运动会基于这张固定画面生成,人物不会跑形。"}
              {s.flow === "clip" && "动态已出。满意就验收入片;不满意可只重渲这一镜,不影响别的镜头。"}
              {s.flow === "done" && "本镜已成片入库,可在成片配方里导出,或回炉重渲。"}
            </span>
          </div>
        </div>

        {/* 底部动作随步骤变化 */}
        <div className="col gap-2" style={{ padding: 14, borderTop: "1px solid var(--line-soft)" }}>
          {s.flow === "draft" && (
            <div className="col gap-2">
              <CreditButton cost={frameCost} onConfirm={onRenderFrame} confirmTitle="渲染首帧" confirmBody="先渲首帧锁画面,稳妥省抽卡。" className="btn btn-grad" disabled={!!busy} markSize={15}>
                <ImageIcon size={15} /> 先渲首帧看效果 · 稳妥
              </CreditButton>
              <CreditButton cost={clipCost} onConfirm={onRenderDirect} confirmTitle="直接生成视频" confirmBody="跳过首帧,直接生成这镜分镜视频。" className="btn btn-line" disabled={!!busy} style={{ justifyContent: "center" }} markSize={15}>
                <Zap size={15} /> 直接生成分镜视频 · 快
              </CreditButton>
            </div>
          )}
          {s.flow === "frame" && (
            <div className="row gap-2">
              <CreditButton cost={frameCost} onConfirm={onReframe} confirmTitle="重渲首帧" confirmBody="重新出 4 版首帧候选。" className="btn btn-line btn-sm grow" disabled={!!busy} style={{ justifyContent: "center" }}>
                <RefreshCw size={14} /> 换一批
              </CreditButton>
              <button type="button" className="btn btn-grad grow" onClick={onLockFrame} style={{ justifyContent: "center" }}>
                <Lock size={15} /> 锁定第 {s.frameIdx + 1} 版
              </button>
            </div>
          )}
          {s.flow === "frameLocked" && (
            <div className="row gap-2">
              <CreditButton cost={frameCost} onConfirm={onReframe} confirmTitle="重渲首帧" confirmBody="改首帧会重新出 4 版候选。" className="btn btn-ghost btn-sm" disabled={!!busy} style={{ justifyContent: "center" }}>
                <ImageIcon size={14} /> 改首帧
              </CreditButton>
              <CreditButton cost={clipCost} onConfirm={onRenderClip} confirmTitle="渲染动态" confirmBody="基于已锁定首帧渲染动态视频。" className="btn btn-grad grow" disabled={!!busy} style={{ justifyContent: "center" }} markSize={15}>
                <Film size={15} /> 渲染动态
              </CreditButton>
            </div>
          )}
          {s.flow === "clip" && (
            <div className="row gap-2">
              <CreditButton cost={clipCost} onConfirm={onRenderClip} confirmTitle="重渲动态" confirmBody="重新渲染这镜的动态视频。" className="btn btn-line btn-sm grow" disabled={!!busy} style={{ justifyContent: "center" }}>
                <RefreshCw size={14} /> 重渲动态
              </CreditButton>
              <button type="button" className="btn btn-primary grow" onClick={onApprove} style={{ justifyContent: "center" }}>
                <Check size={15} /> 验收入片
              </button>
            </div>
          )}
          {s.flow === "done" && (
            <div className="row gap-2">
              <CreditButton cost={frameCost} onConfirm={onReframe} confirmTitle="回炉重渲" confirmBody="重新出首帧,这镜会回到挑首帧步骤。" className="btn btn-ghost btn-sm grow" style={{ justifyContent: "center" }}>
                <RefreshCw size={14} /> 回炉重渲
              </CreditButton>
              <button type="button" className="btn btn-line grow" onClick={onClose} style={{ justifyContent: "center" }}>
                <Check size={15} /> 完成
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function RenderBusy({ label }: { label: string }) {
  return (
    <div
      className="col center gap-3"
      style={{ aspectRatio: "9/16", borderRadius: 14, background: "var(--surface-2)", border: "1.5px dashed var(--line)" }}
    >
      <span
        aria-hidden
        style={{
          width: 34,
          height: 34,
          border: "3px solid var(--line)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "drama-spin .8s linear infinite",
        }}
      />
      <span className="faint" style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
    </div>
  );
}
