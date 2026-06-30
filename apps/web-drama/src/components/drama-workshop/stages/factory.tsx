"use client";

// 视频工厂 — 设计真源 v4 screens-factory-v4.jsx `FactoryStage4`:
// 每镜双路径(先渲首帧看效果·稳妥省抽卡 / 直接生成分镜视频·快),
// 流水:待渲 → 选首帧 → 首帧已锁 → 动态待验收 → 已成片;
// 生成设置栏(模型/画幅/分辨率 + @素材参考)。
import * as React from "react";
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
import { Avatar, CreditButton, EngineTag, Thumb } from "@/components/drama-ui";
import { StageHeader } from "../workbench";
import { GenSettingsBar } from "../gen-settings-bar";
import { MediaLightbox, type LightboxMedia } from "../media-lightbox";
import { matById, type BoardShot, type Material, type ProjectData } from "@/mocks/drama-workshop";
import type { WorkshopAction, WorkshopState } from "../workbench";
import { useShotRender, FLOW_ORDER, VARIATION_LABEL, type FlowKey, type RenderShot } from "../use-shot-render";
import type { StageContext } from "./stage-context";

const FRAME_COST = 2;
const CLIP_COST = 9;

const FLOW = [
  { key: "frame", no: 1, name: "生成首帧", sub: "可选 · 先定画面和人物", icon: ImageIcon, cost: FRAME_COST },
  { key: "clip", no: 2, name: "生成视频", sub: "基于首帧或直接出片", icon: Film, cost: CLIP_COST },
  { key: "done", no: 3, name: "验收成片", sub: "满意才入片，不满意只重做这镜", icon: Check, cost: 0 },
] as const;

type FactoryShot = RenderShot;

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
  const {
    cfg,
    shots,
    upd,
    sceneList,
    bindSceneRef,
    busyMap,
    chainConsistency,
    setChainConsistency,
    stat,
    pct,
    draftCount,
    renderFrame,
    renderDirect,
    renderClip,
    lockFrame,
    approve,
    reframe,
    decompose,
    batchFrame,
  } = useShotRender({
    data,
    ep: state.ep,
    chars: state.chars,
    ctx,
    onSpend: (n) => dispatch({ type: "spend", n }),
  });

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [refs, setRefs] = React.useState<Material[]>(() => {
    const bound = state.chars.find((c) => c.bound);
    const a1 = matById("a1");
    return bound && a1 ? [a1] : [];
  });

  const open = shots.find((s) => s.id === openId);

  return (
    <div className="row" style={{ height: "100%", alignItems: "stretch", position: "relative" }}>
      <div className="scroll grow" style={{ height: "100%" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 32px 64px" }}>
          <StageHeader
            no={5}
            scope="剧集"
            title={`第 ${state.ep} 集 · 视频工厂`}
            desc="每个镜头可选两种方式：稳妥路线先生成首帧，确认画面后再生成视频；追求效率可直接生成分镜视频。"
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
              confirmTitle="批量生成首帧"
              confirmBody={`为 ${draftCount} 个待生成镜头各出 4 版首帧。`}
              className="btn btn-line btn-sm"
              style={{ flex: "none" }}
              disabled={draftCount === 0}
            >
              <ImageIcon size={14} /> 全部先生成首帧
            </CreditButton>
          </div>

          {/* 生成设置:模型 / 画幅比 / 分辨率 + @素材参考 */}
          <GenSettingsBar defaultRatio="9:16" refs={refs} setRefs={setRefs} />

          {/* 镜间一致性承接开关：出首帧时额外参考「同场上一镜画面 + 场景参考图」 */}
          <label
            className="card row gap-3"
            style={{ padding: "10px 14px", marginBottom: 16, cursor: "pointer", alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={chainConsistency}
              onChange={(e) => setChainConsistency(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "var(--accent)", flex: "none" }}
            />
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>镜间一致性承接</div>
              <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.45 }}>
                出首帧时额外参考「同场上一镜画面 + 该场景参考图」，让人物 / 环境 / 光线在同一场内连贯；需要更强镜头差异时可关闭。
              </div>
            </div>
            <span
              className="tag"
              style={{
                flex: "none",
                background: chainConsistency ? "var(--accent-soft)" : "var(--surface-2)",
                color: chainConsistency ? "var(--accent)" : "var(--ink-3)",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {chainConsistency ? "已开启" : "已关闭"}
            </span>
          </label>

          {/* 场景参考绑定（P0-b）：给每场指定取景地参考图，本场所有镜头出图都会参考它 */}
          {chainConsistency && (data.scenes?.length ?? 0) > 0 && sceneList.length > 0 && (
            <div className="card col gap-2" style={{ padding: "12px 14px", marginBottom: 16 }}>
              <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <ImageIcon size={14} style={{ color: "var(--accent)" }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>场景参考绑定</span>
                <span className="faint" style={{ fontSize: 11.5 }}>
                  给每场指定取景地参考图，本场所有镜头出图都会参考它（缺省按场景名自动匹配）
                </span>
              </div>
              <div className="col gap-2">
                {sceneList.map((sc) => (
                  <div key={sc.id} className="row gap-2" style={{ alignItems: "center" }}>
                    <span className="tag tag-gray" style={{ flex: "none", fontSize: 11 }}>场{sc.sceneNo}</span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--ink-2)",
                        minWidth: 0,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sc.place}
                    </span>
                    <select
                      value={sc.sceneRefId}
                      onChange={(e) => void bindSceneRef(sc.id, e.target.value)}
                      style={{
                        flex: "none",
                        maxWidth: 180,
                        fontSize: 12,
                        padding: "5px 8px",
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--ink-1)",
                      }}
                    >
                      <option value="">自动匹配</option>
                      {(data.scenes ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.refUrl ? "" : "（无参考图）"}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 镜头网格 */}
          <div className="row gap-2" style={{ marginBottom: 12 }}>
            <Film size={15} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>本集镜头 · {shots.length}</span>
            <span className="faint" style={{ fontSize: 12 }}>点击镜头进入逐步出片</span>
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
                busy={busyMap[s.id] ?? null}
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
                {stat.done === stat.total && stat.total > 0 ? "本集镜头已全部成片" : "逐镜成片后，合成完整一集"}
              </div>
              <div className="faint" style={{ fontSize: 12.5 }}>已出片镜头会按场序与镜号拼接成完整一集，可直接分发</div>
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
          decomposeCost={cfg.prices.decompose + cfg.prices.frame}
          busy={busyMap[open.id] ?? null}
          onClose={() => setOpenId(null)}
          onRenderFrame={() => renderFrame(open.id)}
          onRenderDirect={() => renderDirect(open.id)}
          onDecompose={() => decompose(open.id)}
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
        <Spin /> 生成首帧…
      </span>
    );
  if (busy === "clip")
    return (
      <span className="tag tag-accent">
        <Spin /> 生成视频…
      </span>
    );
  const map: Record<FlowKey, [string, string]> = {
    draft: ["tag-gray", "待生成首帧"],
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
            confirmTitle="生成首帧"
            confirmBody="先生成一张画面预览，确认人物和构图后再出视频。"
            className="btn btn-grad btn-sm grow"
            title="先生成一张画面预览，确认人物和构图后再出视频"
            style={{ justifyContent: "center" }}
          >
            <ImageIcon size={13} /> 首帧
          </CreditButton>
          <CreditButton
            cost={clipCost}
            onConfirm={onRenderDirect}
            confirmTitle="直接生成视频"
            confirmBody="不先预览画面，直接生成这镜视频。"
            className="btn btn-line btn-sm grow"
            title="跳过首帧,直接生成分镜视频"
            style={{ justifyContent: "center" }}
          >
            <Zap size={13} /> 直接出片
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
          confirmTitle="生成视频"
          confirmBody="基于已锁定首帧生成这一镜视频。"
          className="btn btn-grad btn-sm grow"
          style={{ justifyContent: "center" }}
        >
          <Film size={13} /> 生成视频
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
  decomposeCost,
  busy,
  onClose,
  onRenderFrame,
  onRenderDirect,
  onDecompose,
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
  decomposeCost: number;
  busy: FlowKey | null;
  onClose: () => void;
  onRenderFrame: () => void;
  onRenderDirect: () => void;
  onDecompose: () => void;
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
  const [lightbox, setLightbox] = React.useState<LightboxMedia | null>(null);
  const openImage = (src?: string) => { if (src) setLightbox({ src, kind: "image" }); };

  const preview = () => {
    if (busy === "frame") return <RenderBusy label="正在生成 4 版首帧…" />;
    if (busy === "clip") return <RenderBusy label="正在基于锁定首帧生成视频…" />;
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
        <Thumb from={col.from} to={col.to} src={s.frameUrl ?? s.frameUrls?.[s.frameIdx]} ratio="9/16" radius={14} style={{ width: "100%", cursor: "zoom-in" }} title="点开看大图" onClick={() => openImage(s.frameUrl ?? s.frameUrls?.[s.frameIdx])}>
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
          <Thumb from={col.from} to={col.to} src={s.frameUrls?.[s.frameIdx] ?? s.frameUrl} ratio="9/16" radius={14} style={{ width: "100%", cursor: "zoom-in" }} title="点开看大图" onClick={() => openImage(s.frameUrls?.[s.frameIdx] ?? s.frameUrl)}>
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
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>还没生成首帧</span>
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
            {(s.motionDesc || s.ffDesc) && (
              <div className="col gap-1" style={{ marginTop: 2, paddingTop: 8, borderTop: "1px dashed var(--line)" }}>
                <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Sparkles size={12} style={{ color: "var(--accent)" }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700 }}>已拆镜（首尾帧）</span>
                  {s.variationType && (
                    <span className="tag tag-accent" style={{ fontSize: 10 }}>
                      变化 {VARIATION_LABEL[s.variationType] ?? s.variationType}
                    </span>
                  )}
                  {s.endFrameUrl && <span className="tag tag-gray" style={{ fontSize: 10 }}>含末帧</span>}
                </div>
                {s.motionDesc && (
                  <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.45 }}>运动：{s.motionDesc}</div>
                )}
              </div>
            )}
          </div>

          {/* 当前步骤提示 */}
          <div className="row gap-2" style={{ fontSize: 12, color: "var(--ink-3)", padding: "0 2px" }}>
            <Sparkles size={14} style={{ color: "var(--accent)", flex: "none", marginTop: 1 }} />
            <span>
              {s.flow === "draft" &&
                "可选两种方式：【首帧预览】先生成静帧，确认画面与人物形象后再生成视频；【直接生成】一步生成，适合空镜等低风险镜头。"}
              {s.flow === "frame" && "四版首帧任选其一，或重新生成一批；选定并锁定后，后续视频将基于该帧生成。"}
              {s.flow === "frameLocked" && "首帧已锁。现在生成视频，运动会基于这张固定画面生成，人物更稳定。"}
              {s.flow === "clip" && "视频已出。满意就验收入片；不满意可只重做这一镜，不影响别的镜头。"}
              {s.flow === "done" && "本镜已成片入库，可在成片合成里导出，或重新生成。"}
            </span>
          </div>
        </div>

        {/* 底部动作随步骤变化 */}
        <div className="col gap-2" style={{ padding: 14, borderTop: "1px solid var(--line-soft)" }}>
          {s.flow === "draft" && (
            <div className="col gap-2">
              <CreditButton cost={frameCost} onConfirm={onRenderFrame} confirmTitle="生成首帧" confirmBody="先生成一张画面预览，确认人物和构图后再出视频。" className="btn btn-grad" disabled={!!busy} markSize={15}>
                <ImageIcon size={15} /> 先生成首帧看效果 · 稳妥
              </CreditButton>
              <CreditButton cost={clipCost} onConfirm={onRenderDirect} confirmTitle="直接生成视频" confirmBody="不先预览画面，直接生成这镜视频。" className="btn btn-line" disabled={!!busy} style={{ justifyContent: "center" }} markSize={15}>
                <Zap size={15} /> 直接生成分镜视频 · 快
              </CreditButton>
              <CreditButton
                cost={decomposeCost}
                onConfirm={onDecompose}
                confirmTitle="AI 拆镜（首尾帧 + 运动）"
                confirmBody="把这镜画面拆成首帧 / 末帧静态快照 + 运动描述，并生成末帧关键帧图。之后出片用首+尾帧双关键帧，多镜一致性更稳。"
                className="btn btn-ghost btn-sm"
                disabled={!!busy}
                style={{ justifyContent: "center" }}
              >
                <Sparkles size={14} /> AI 拆镜 · 首尾帧更稳
              </CreditButton>
            </div>
          )}
          {s.flow === "frame" && (
            <div className="row gap-2">
              <CreditButton cost={frameCost} onConfirm={onReframe} confirmTitle="重新生成首帧" confirmBody="重新出 4 版首帧候选。" className="btn btn-line btn-sm grow" disabled={!!busy} style={{ justifyContent: "center" }}>
                <RefreshCw size={14} /> 换一批
              </CreditButton>
              <button type="button" className="btn btn-grad grow" onClick={onLockFrame} style={{ justifyContent: "center" }}>
                <Lock size={15} /> 锁定第 {s.frameIdx + 1} 版
              </button>
            </div>
          )}
          {s.flow === "frameLocked" && (
            <div className="row gap-2">
              <CreditButton cost={frameCost} onConfirm={onReframe} confirmTitle="重新生成首帧" confirmBody="改首帧会重新出 4 版候选。" className="btn btn-ghost btn-sm" disabled={!!busy} style={{ justifyContent: "center" }}>
                <ImageIcon size={14} /> 改首帧
              </CreditButton>
              <CreditButton cost={clipCost} onConfirm={onRenderClip} confirmTitle="生成视频" confirmBody="基于已锁定首帧生成这一镜视频。" className="btn btn-grad grow" disabled={!!busy} style={{ justifyContent: "center" }} markSize={15}>
                <Film size={15} /> 生成视频
              </CreditButton>
            </div>
          )}
          {s.flow === "clip" && (
            <div className="row gap-2">
              <CreditButton cost={clipCost} onConfirm={onRenderClip} confirmTitle="重新生成视频" confirmBody="重新生成这镜的视频。" className="btn btn-line btn-sm grow" disabled={!!busy} style={{ justifyContent: "center" }}>
                <RefreshCw size={14} /> 重新生成
              </CreditButton>
              <button type="button" className="btn btn-primary grow" onClick={onApprove} style={{ justifyContent: "center" }}>
                <Check size={15} /> 验收入片
              </button>
            </div>
          )}
          {s.flow === "done" && (
            <div className="row gap-2">
              <CreditButton cost={frameCost} onConfirm={onReframe} confirmTitle="重新生成" confirmBody="重新出首帧，这镜会回到挑首帧步骤。" className="btn btn-ghost btn-sm grow" style={{ justifyContent: "center" }}>
                <RefreshCw size={14} /> 重新生成
              </CreditButton>
              <button type="button" className="btn btn-line grow" onClick={onClose} style={{ justifyContent: "center" }}>
                <Check size={15} /> 完成
              </button>
            </div>
          )}
        </div>
      </aside>
      <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />
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
