"use client";

// 分镜表（v0.88）— 设计稿 AI短剧工作台.dc.html「剧集脚本 · 分镜表」平铺表格。
// 列：镜号（含时长）/ 首帧 / 画面内容 / 景别·运镜 / 台词·音频 / 特效氛围。所有单元格结构化可编辑、落库；
// 首帧 4 态（待生成→生成中→首帧→视频）+ 点首帧开「AI 改图」对话式迭代（复用 render/frame + ref 图）。
// v0.197：表格宽度收到 ~820（时长并进镜号列、首帧列收窄），容器 <820 时每一镜变成一张卡片
// （styles/pages/episode.css 的 .ep-sb 容器查询），手机和 1024 平板上不再靠横向滚动藏列。
import * as React from "react";
import { toast } from "sonner";
import { ArrowRight, Check, Clapperboard, Image as ImageIcon, Play, Plus, RefreshCw, Sparkles, Wand2, X } from "lucide-react";
import { CreditButton, CreditMark, Editable, GenFramePlaceholder, Thumb, dramaConfirm } from "@/components/drama-ui";
import { MediaLightbox, type LightboxMedia } from "./media-lightbox";
import { AiImageEditModal } from "./ai-image-edit-modal";
import type { FormShot, ShotFlow } from "./shot-form";
import type { SceneAsset } from "@/mocks/drama-workshop";
import { CharacterMentionInput, type MentionChar } from "./character-mention-input";

const FRAME_COST = 2; // 首帧默认价（drama.credit.frame）；视频价走 material.video-generate 由 props 传入
// 运动幅度（拆镜 variation_type）用户友好文案，仅用于 hover 提示，不直接暴露 small/medium/large 黑话。
const VARI: Record<string, string> = { small: "小幅", medium: "中幅", large: "大幅" };

// C-1 参考生效回报的用户友好文案（不暴露 role/reason 内部枚举原值，§跨 app 约定）。
const REF_ROLE_LABEL: Record<string, string> = {
  ref: "参考图", character: "角色定妆照", scene: "场景图",
  prev_last_frame: "上一镜的最后一帧", first_frame: "首帧", last_frame: "尾帧",
};
const REF_REASON_LABEL: Record<string, string> = {
  local_unfetchable: "这张图模型读不到，没用上",
  model_no_flf: "当前视频模型不支持尾帧，这张没用上",
  model_no_image_input: "当前模型只能按文字生成，用不了参考图",
  over_max_refs: "超过这个模型能用的参考图张数，多出来的没用上",
  empty: "参考图是空的",
};

/** 「参考图用上 N/M 张」chip：仅在有参考被过滤时显示（全部生效则不打扰）；被过滤项与原因放 hover 提示。 */
function AppliedRefsChip({ refs }: { refs?: import("@/api/render").AppliedRefs }) {
  if (!refs || refs.requested === 0 || refs.applied >= refs.requested) return null;
  const droppedLines = refs.items
    .filter((it) => !it.applied)
    .map((it) => `· ${REF_ROLE_LABEL[it.role] ?? "参考图"}：${REF_REASON_LABEL[it.reason ?? ""] ?? "没用上"}`);
  return (
    <div
      className="row"
      style={{ gap: 3, alignItems: "center", fontSize: 9, color: "var(--warn, #d97706)", maxWidth: 118, minWidth: 0 }}
      title={`上次生成只用上了 ${refs.applied}/${refs.requested} 张参考图：\n${droppedLines.join("\n")}`}
    >
      <ImageIcon size={9} style={{ flex: "none" }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>参考图用上 {refs.applied}/{refs.requested} 张</span>
    </div>
  );
}

function fmtT(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

export interface SbScene { id: string; place: string; mood: string; sceneRefId?: string }

/** 挂在 CreditButton onConfirm 上的动作：返回 Promise 时 CreditButton 等它结束再刷新余额，
 *  所以这些回调把动作的 Promise 一路交回去，别在中间用 void 吞掉。 */
type PaidActionResult = void | Promise<unknown>;

export interface StoryboardTableProps {
  scenes: SbScene[];
  /** 项目级场景资产（可上传/AI 生成）——供每场绑定场景参考图，保障场景一致性。 */
  sceneAssets?: SceneAsset[];
  /** 本集角色——画面内容 @提及菜单来源；内联提及即本镜出场人物（写入 shot.cast）。 */
  characters?: MentionChar[];
  /** 首帧/视频/拆镜真实单价；驱动按钮展示与确认阈值。frameCost 按所选图片模型算（renderCreditCost），也是 AI 改图的单价。 */
  frameCost?: number;
  clipCost?: number;
  /** 按这一镜（时长）和所选视频模型算的视频价；传了就用它，不传用 clipCost。 */
  clipCostFor?: (shot: FormShot) => number;
  splitCost?: number;
  /** 补尾帧的总价（拆镜 decompose + 尾帧出图 frame）。 */
  endFrameCost?: number;
  /** 只重画尾帧的价（动作描述上次已补好，只差尾帧图）= 图片单价。 */
  endFrameRetryCost?: number;
  /** 分镜表上选的图片模型：AI 改图用同一个，价格才对得上 frameCost。 */
  imageEndpointId?: string;
  /**
   * 候选模型（含单价）还没读到时的停用原因（priceBlockReason）。有值时出首帧 / 生成视频 / 补尾帧 / AI 改图
   * 这些按模型计价的入口都停用：这时的 frameCost / clipCost 是全局价，服务端却按默认模型的价扣。
   */
  priceBlock?: string | null;
  /** AI 改写这一镜的单价（drama.credit.shot-rewrite）。 */
  rewriteCost?: number;
  shotsMap: Record<string, FormShot[]>;
  speakerOptions: string[];
  locked?: boolean;
  busyMap: Record<string, ShotFlow | null | undefined>;
  starts: Map<string, number>;
  genScene: string | null;
  onUpdScene: (i: number, patch: Partial<SbScene>) => void;
  onUpdShot: (sceneId: string, shotId: string, patch: Partial<FormShot>) => void;
  onDelShot: (sceneId: string, shotId: string) => void;
  onAddShot: (sceneId: string, sceneIdx: number) => void;
  onGenShots: (sceneId: string, sceneIdx: number) => PaidActionResult;
  onRender: (sceneId: string, shotId: string, kind: "frame" | "direct" | "clip") => PaidActionResult;
  onApprove: (sceneId: string, shotId: string) => void;
  /** 只重新生成这一镜的视频（保留首帧和尾帧）。传了才显示「重新生成视频」。 */
  onRedoClip?: (sceneId: string, shotId: string) => PaidActionResult;
  /** AI 改图回填：把新版首帧落到该镜（调用方要一并去掉旧尾帧图，见 openAiEdit）。 */
  onFrameEdited: (sceneId: string, shotId: string, frameUrl: string) => void;
  /** v0.97：AI 拆镜（首/末帧 + 运动 + 变化等级）。界面上叫「补尾帧」。 */
  onDecompose: (sceneId: string, shotId: string) => PaidActionResult;
  /** v0.97 P5：行级就地改写本镜（按指令只改这一镜）。 */
  onRewriteShot?: (sceneId: string, shotId: string, instruction: string) => PaidActionResult;
  /** 正在改写的镜 id（显示 busy）。 */
  rewritingId?: string | null;
  /**
   * 出片（生成视频 / 直接出片）前的一致性问题即时求值。返回非空 → CreditButton 弹单个 danger 确认
   * （费用 + 警告合并），替代此前「费用弹窗 + 一致性弹窗」两个叠加弹窗。不传（如短视频线）则无警告。
   */
  getClipWarnings?: (sceneId: string, shot: FormShot) => string[];
  /** 项目里还没有任何场景图时，场次行给一个「去添加」入口（跳到短剧设定的角色与场景）。 */
  onGoSceneAssets?: () => void;
}

export function StoryboardTable(props: StoryboardTableProps) {
  const { scenes, shotsMap, speakerOptions, locked, busyMap, starts, genScene } = props;
  const [edit, setEdit] = React.useState<{ sceneId: string; sceneNo: number; shot: FormShot } | null>(null);
  const hasSceneAssets = (props.sceneAssets?.length ?? 0) > 0;
  // 补过尾帧的镜头改首帧：尾帧图是照着现在这张首帧画的，改了就对不上。先说清楚再打开改图；
  // 真改成了（onFrameEdited）由调用方去掉旧尾帧图。动作描述是按画面文字写的，留着 ——
  // 改完点「重画尾帧」照新首帧再画一张，只按出一张图扣积分，不用把拆镜再付一遍。
  // 只是打开看看、没改就关掉，尾帧不会丢。
  const openAiEdit = async (sceneId: string, sceneNo: number, shot: FormShot) => {
    if (props.priceBlock) {
      toast(props.priceBlock);
      return;
    }
    if (shot.endFrameUrl) {
      const ok = await dramaConfirm({
        tone: "danger",
        title: "改首帧的话，尾帧要重画",
        body: "这一镜补过尾帧，尾帧是照着现在这张首帧画的。改了首帧，旧尾帧会去掉，改完可以点「重画尾帧」照新首帧再画一张，只扣出一张图的积分。已花的积分不退。只打开看看、没改就关掉的话，尾帧不会丢。",
        confirmLabel: "继续改首帧",
        cancelLabel: "先不改",
      });
      if (!ok) return;
    }
    setEdit({ sceneId, sceneNo, shot });
  };

  return (
    <div className="card ep-sb" style={{ padding: 0, overflow: "hidden" }}>
      <div className="ep-sb-scroll">
        <table className="ep-sb-table">
          <thead>
            <tr>
              <th className="ep-sb-th ep-sb-col-no" style={{ textAlign: "center" }}>镜号</th>
              <th className="ep-sb-th ep-sb-col-frame" style={{ textAlign: "center" }} title="首帧是这一镜视频的第一张画面。先出首帧确认人物和构图，再生成视频">首帧</th>
              <th className="ep-sb-th ep-sb-col-visual">画面内容</th>
              <th className="ep-sb-th ep-sb-col-cam">景别 · 运镜</th>
              <th className="ep-sb-th ep-sb-col-audio">台词 · 音频</th>
              <th className="ep-sb-th ep-sb-col-fx">特效氛围</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((sc, i) => {
              const shots = shotsMap[sc.id] ?? [];
              return (
                <React.Fragment key={sc.id}>
                  {/* 场分隔行 */}
                  <tr className="ep-sb-scene">
                    <td colSpan={6}>
                      <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap", rowGap: 6 }}>
                        <span className="num tag tag-accent" style={{ flex: "none" }}>场 {i + 1}</span>
                        <span style={{ fontWeight: 700, fontSize: 12.5, minWidth: 0 }}>
                          <Editable value={sc.place} placeholder="场景，如：内景 · 公寓 · 深夜" onCommit={(v) => props.onUpdScene(i, { place: v })} />
                        </span>
                        <span className="tag tag-gray" style={{ flex: "none" }}>
                          <Editable value={sc.mood} placeholder="氛围" onCommit={(v) => props.onUpdScene(i, { mood: v })} />
                        </span>
                        <span className="grow" />
                        {hasSceneAssets && (() => {
                          const bound = props.sceneAssets!.find((a) => a.id === sc.sceneRefId);
                          return (
                            <span className="row" style={{ gap: 4, alignItems: "center", flex: "none" }} title="这场每一镜出首帧时都会参考这张场景图，让同一场的环境看起来一样">
                              {bound?.refUrl && <img src={bound.refUrl} alt="场景图" style={{ width: 22, height: 14, objectFit: "cover", borderRadius: 3, border: "1px solid var(--line)" }} />}
                              <span className="faint" style={{ fontSize: 10.5 }}>场景图</span>
                              <select
                                className="ep-sb-select"
                                value={sc.sceneRefId ?? ""}
                                aria-label="这场用哪张场景图"
                                onChange={(e) => props.onUpdScene(i, { sceneRefId: e.target.value || undefined })}
                                style={{ fontSize: 10.5, height: 23, borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink-1)", maxWidth: 140, padding: "0 4px" }}
                              >
                                <option value="">不用场景图</option>
                                {props.sceneAssets!.map((a) => (
                                  <option key={a.id} value={a.id}>{a.name}{a.refUrl ? "" : "（还没有图）"}</option>
                                ))}
                              </select>
                            </span>
                          );
                        })()}
                        {!hasSceneAssets && !locked && props.onGoSceneAssets && (
                          <button
                            type="button"
                            className="chip ep-sb-chip"
                            style={{ height: 23, fontSize: 10.5, flex: "none" }}
                            title="场景图让同一场每一镜的环境看起来一样。在「短剧设定」的「角色与场景」里添加"
                            onClick={props.onGoSceneAssets}
                          >
                            还没有场景图 · 去添加
                          </button>
                        )}
                        {shots.length > 0 && <span className="faint num" style={{ fontSize: 11, flex: "none" }}>{shots.length} 镜 · {shots.reduce((a, x) => a + x.dur, 0)} 秒</span>}
                        {!locked && shots.length > 0 && (
                          <button type="button" className="chip ep-sb-chip" style={{ height: 23, fontSize: 10.5, flex: "none" }} onClick={() => props.onAddShot(sc.id, i)}>
                            <Plus size={11} /> 加一镜
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* 还没有分镜：手动加一镜 / 让 AI 拆 */}
                  {shots.length === 0 && genScene !== sc.id && (
                    <tr className="ep-sb-empty">
                      <td colSpan={6}>
                        {!locked ? (
                          <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                            <button type="button" className="btn btn-line btn-sm" onClick={() => props.onAddShot(sc.id, i)}>
                              <Plus size={13} /> 加一镜
                            </button>
                            <CreditButton
                              cost={props.splitCost ?? 6}
                              onConfirm={() => props.onGenShots(sc.id, i)}
                              confirmTitle="让 AI 拆分镜"
                              confirmBody="AI 按这场的剧情和台词拆成几个镜头，拆完每一镜都能改。这场如果还没写内容，会先加一个空白镜头，不扣积分。"
                              confirmLabel="开始拆"
                              className="btn btn-primary btn-sm"
                            >
                              <Wand2 size={13} /> 让 AI 拆分镜
                            </CreditButton>
                            <span className="faint" style={{ fontSize: 11, minWidth: 0, flex: "1 1 200px" }}>
                              按这场的剧情和台词拆成几个镜头，<span className="num">{props.splitCost ?? 6}</span> 积分
                            </span>
                          </div>
                        ) : <span className="faint" style={{ fontSize: 12 }}>这场还没有分镜</span>}
                      </td>
                    </tr>
                  )}
                  {genScene === sc.id && (
                    <tr className="ep-sb-empty"><td colSpan={6}><div className="skel" style={{ height: 40 }} /></td></tr>
                  )}
                  {/* 分镜行 */}
                  {shots.map((s) => (
                    <ShotRow
                      key={s.id}
                      s={s}
                      start={starts.get(s.id) ?? 0}
                      busy={busyMap[s.id] ?? null}
                      locked={locked}
                      speakerOptions={speakerOptions}
                      characters={props.characters ?? []}
                      frameCost={props.frameCost}
                      clipCost={props.clipCostFor ? props.clipCostFor(s) : props.clipCost}
                      endFrameCost={props.endFrameCost}
                      endFrameRetryCost={props.endFrameRetryCost}
                      priceBlock={props.priceBlock}
                      rewriteCost={props.rewriteCost}
                      onPatch={(patch) => props.onUpdShot(sc.id, s.id, patch)}
                      onDelete={() => props.onDelShot(sc.id, s.id)}
                      onRender={(kind) => props.onRender(sc.id, s.id, kind)}
                      onApprove={() => props.onApprove(sc.id, s.id)}
                      onRedoClip={props.onRedoClip ? () => props.onRedoClip!(sc.id, s.id) : undefined}
                      onAiEdit={() => void openAiEdit(sc.id, i + 1, s)}
                      onDecompose={() => props.onDecompose(sc.id, s.id)}
                      onPick={(url) => props.onUpdShot(sc.id, s.id, { frameUrl: url })}
                      rewriting={props.rewritingId === s.id}
                      onRewrite={props.onRewriteShot ? (ins) => props.onRewriteShot!(sc.id, s.id, ins) : undefined}
                      getClipWarnings={props.getClipWarnings ? () => props.getClipWarnings!(sc.id, s) : undefined}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit && (() => {
        // 和正常出首帧（epscript sceneClauseFor）带同一句「场景：地点，氛围。」，改图时模型才知道这是哪儿。
        const sc = scenes.find((x) => x.id === edit.sceneId);
        const sceneName = [sc?.place?.trim(), sc?.mood?.trim()].filter(Boolean).join("，") || undefined;
        return (
        <AiImageEditModal
          tag={`场 ${edit.sceneNo} · 第 ${edit.shot.no} 镜`}
          openingText={`这是第 ${edit.shot.no} 镜的首帧。想怎么改直接说，比如「换成夜景」「人物回头」「色调暖一点」。`}
          baseDesc={edit.shot.visual || "分镜画面"}
          initialUrl={edit.shot.frameUrl ?? edit.shot.frameUrls?.[0]}
          ratio="9:16"
          kind="shot"
          sceneName={sceneName}
          cost={props.frameCost ?? FRAME_COST}
          endpointId={props.imageEndpointId}
          chips={["换成夜景", "人物回头", "换暖色调", "背景虚化", "光线更有质感"]}
          onClose={() => setEdit(null)}
          onCommit={(f) => { props.onFrameEdited(edit.sceneId, edit.shot.id, f.url); }}
        />
        );
      })()}
    </div>
  );
}

const REWRITE_CHIPS = ["加个反转", "更紧凑", "换个机位", "冲突更强", "补一句台词"];

function ShotRow({
  s, start, busy, locked, speakerOptions, characters, frameCost, clipCost, endFrameCost, endFrameRetryCost, priceBlock, rewriteCost,
  onPatch, onDelete, onRender, onApprove, onRedoClip, onAiEdit, onDecompose, onPick, rewriting, onRewrite, getClipWarnings,
}: {
  s: FormShot; start: number; busy: ShotFlow | null; locked?: boolean; speakerOptions: string[]; characters: MentionChar[];
  frameCost?: number; clipCost?: number; endFrameCost?: number; endFrameRetryCost?: number; priceBlock?: string | null; rewriteCost?: number;
  onPatch: (patch: Partial<FormShot>) => void; onDelete: () => void;
  onRender: (kind: "frame" | "direct" | "clip") => PaidActionResult; onApprove: () => void; onRedoClip?: () => PaidActionResult; onAiEdit: () => void;
  onDecompose: () => PaidActionResult; onPick: (url: string) => void;
  rewriting?: boolean; onRewrite?: (instruction: string) => PaidActionResult;
  getClipWarnings?: () => string[];
}) {
  const [rwOpen, setRwOpen] = React.useState(false);
  const [rwText, setRwText] = React.useState("");
  const rwCost = rewriteCost ?? 2;
  const hasMedia = !!(s.frameUrl || s.frameUrls?.length || s.videoUrl);
  const submitRw = (text: string): PaidActionResult => {
    const t = text.trim();
    if (!t || !onRewrite) return;
    const pending = onRewrite(t);
    setRwText("");
    setRwOpen(false);
    return pending;
  };
  // 改写只换这一镜的文字；已生成的首帧 / 视频不动（界面要说实话，别让人以为画面会跟着变）。
  const rwBody = (ins: string) => (
    <>
      AI 会按「{ins}」重写这一镜的画面内容、景别、运镜和台词，原来的文字会被替换。
      {hasMedia ? "已生成的首帧和视频不会跟着变，想让画面跟上新文字要重新生成。" : ""}
    </>
  );
  const whoList = speakerOptions.includes(s.voWho) || !s.voWho ? speakerOptions : [s.voWho, ...speakerOptions];
  const badge =
    s.flow === "done" ? <span className="tag tag-green" style={{ fontSize: 8.5, padding: "0 5px", height: 15 }}>已确认</span>
    : s.flow === "frame" ? <span className="tag tag-amber" style={{ fontSize: 8.5, padding: "0 5px", height: 15 }}>已出首帧</span>
    : s.flow === "clip" ? <span className="tag tag-amber" style={{ fontSize: 8.5, padding: "0 5px", height: 15 }}>待确认</span>
    : <span className="tag tag-gray" style={{ fontSize: 8.5, padding: "0 5px", height: 15 }}>待生成</span>;
  return (
    <tr className="ep-sb-shot" data-shot-id={s.id}>
      <td className="ep-sb-no">
        <div className="ep-sb-no-in">
          <div className="num ep-sb-no-n">{s.no}</div>
          <div className="num ep-sb-no-t" title="这一镜在本集里的起止时间">
            <span>{fmtT(start)}</span><span className="ep-sb-no-dash">–</span><span>{fmtT(start + (s.dur || 0))}</span>
          </div>
          <label className="ep-sb-dur">
            <input type="number" min={1} max={60} value={s.dur} disabled={locked} aria-label="这一镜多少秒"
              onChange={(e) => onPatch({ dur: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })} />
            <span className="faint">秒</span>
          </label>
          <div className="ep-sb-no-badge">{badge}</div>
          <span className="ep-sb-no-grow" />
          <div className="ep-sb-acts">
            {!locked && onRewrite && (
              <button
                type="button"
                className="ep-sb-iconbtn"
                title={`AI 改写这一镜（${rwCost} 积分）`}
                aria-label="AI 改写这一镜"
                aria-expanded={rwOpen}
                onClick={() => setRwOpen((v) => !v)}
                disabled={rewriting}
                style={{ color: rwOpen ? "var(--accent)" : "var(--ink-3)" }}
              >
                <Wand2 size={13} />
              </button>
            )}
            {!locked && (
              <button type="button" className="ep-sb-iconbtn" title="删除这一镜" aria-label="删除这一镜" onClick={onDelete}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </td>
      <td className="ep-sb-frame">
        <ShotFrameCell
          s={s}
          busy={busy}
          onRender={onRender}
          onApprove={onApprove}
          onRedoClip={onRedoClip ? () => onRedoClip() : undefined}
          onAiEdit={onAiEdit}
          onDecompose={onDecompose}
          onPick={onPick}
          frameCost={frameCost}
          clipCost={clipCost}
          endFrameCost={endFrameCost}
          endFrameRetryCost={endFrameRetryCost}
          priceBlock={priceBlock}
          getClipWarnings={getClipWarnings}
        />
      </td>
      <td className="ep-sb-visual" data-label="画面内容">
        {/* v0.98：@提及富文本——输入 @ 选角色成内联 chip，chip 即本镜出场人物（→ shot.cast → 首帧喂角色参考图锁脸）。 */}
        <CharacterMentionInput
          value={s.visual}
          characters={characters}
          disabled={locked}
          onChange={(visual, cast) => onPatch({ visual, cast })}
        />
        {/* v0.97 P5：行级就地改写本镜（指令 + 快捷 chip，只改这一镜，替代整篇推倒重写的浮窗） */}
        {rwOpen && onRewrite && (
          <div className="col gap-2" style={{ marginTop: 8, padding: 8, borderRadius: 10, background: "var(--accent-soft)", border: "1px solid var(--line-soft)" }}>
            <div className="row gap-1" style={{ alignItems: "center", minWidth: 0 }}>
              <Sparkles size={11} style={{ color: "var(--accent)", flex: "none" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", flex: "none" }}>AI 改写这一镜</span>
              <span className="row faint" style={{ fontSize: 10.5, gap: 2, alignItems: "center", minWidth: 0 }}>
                <CreditMark size={10} /> 每次 <span className="num">{rwCost}</span> 积分
              </span>
              {rewriting && <span className="faint" style={{ fontSize: 10.5 }}>改写中…</span>}
              <span className="grow" />
              <button type="button" className="ep-sb-iconbtn" aria-label="收起改写" title="收起" onClick={() => setRwOpen(false)}><X size={12} /></button>
            </div>
            <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
              {REWRITE_CHIPS.map((c) => (
                <CreditButton
                  key={c}
                  cost={rwCost}
                  alwaysConfirm
                  disabled={rewriting}
                  onConfirm={() => submitRw(c)}
                  confirmTitle="AI 改写这一镜？"
                  confirmBody={rwBody(c)}
                  confirmLabel="改写"
                  className="chip ep-sb-chip"
                  style={{ height: 24, fontSize: 10.5 }}
                  markSize={10}
                >
                  {c}
                </CreditButton>
              ))}
            </div>
            <div className="row gap-1">
              <input
                value={rwText}
                disabled={rewriting}
                placeholder="或者直接说想怎么改"
                aria-label="想怎么改这一镜"
                onChange={(e) => setRwText(e.target.value)}
                style={{ flex: 1, minWidth: 0, height: 28, border: "1px solid var(--line)", borderRadius: 7, fontSize: 12, padding: "0 8px", outline: "none", background: "var(--surface)" }}
              />
              <CreditButton
                cost={rwCost}
                alwaysConfirm
                disabled={rewriting || !rwText.trim()}
                onConfirm={() => submitRw(rwText)}
                confirmTitle="AI 改写这一镜？"
                confirmBody={rwBody(rwText.trim())}
                confirmLabel="改写"
                className="btn btn-grad btn-sm"
                style={{ height: 28, fontSize: 11, padding: "0 10px", flex: "none" }}
                markSize={10}
              >
                改写
              </CreditButton>
            </div>
          </div>
        )}
      </td>
      {/* 卡片模式下不加 data-label：格子里自带「景别」「运镜」两个小标题 */}
      <td className="ep-sb-cam">
        <div className="col gap-2" style={{ fontSize: 12 }}>
          <div className="col" style={{ gap: 1 }}><span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>景别</span>
            <Editable className="edit-field" value={s.size} placeholder="如：中景" onCommit={(v) => onPatch({ size: v })} style={{ padding: "2px 5px" }} /></div>
          <div className="col" style={{ gap: 1 }}><span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>运镜</span>
            <Editable className="edit-field" value={s.move} placeholder="如：缓慢推近" onCommit={(v) => onPatch({ move: v })} style={{ padding: "2px 5px" }} /></div>
        </div>
      </td>
      <td className="ep-sb-audio" data-label="台词 · 音频">
        <div className="row gap-1" style={{ alignItems: "center", marginBottom: 3 }}>
          <select className="ep-sb-select" value={s.voWho || speakerOptions[0]} disabled={locked} aria-label="谁来说这句" onChange={(e) => onPatch({ voWho: e.target.value })}
            style={{ height: 22, border: "1px solid var(--line)", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "var(--surface-2)", color: "var(--accent)", outline: "none", maxWidth: 110 }}>
            {whoList.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <Editable block value={s.voText} placeholder="这一镜的台词，没有就留空" onCommit={(v) => onPatch({ voText: v })}
          className="edit-field" style={{ display: "block", fontSize: 12.5, lineHeight: 1.6, padding: "3px 6px", background: "var(--accent-soft)", borderRadius: 8 }} />
        <div className="col" style={{ gap: 1, marginTop: 7, fontSize: 11, color: "var(--ink-2)" }}>
          <span className="row gap-1"><span className="faint" style={{ fontWeight: 700, flex: "none" }}>音效</span>
            <Editable className="edit-field" value={s.sfx} placeholder="如：雨声、脚步声" onCommit={(v) => onPatch({ sfx: v })} style={{ flex: 1, minWidth: 0 }} /></span>
          <span className="row gap-1"><span className="faint" style={{ fontWeight: 700, flex: "none" }}>BGM</span>
            <Editable className="edit-field" value={s.bgm} placeholder="如：弦乐渐入，没有就留空" onCommit={(v) => onPatch({ bgm: v })} style={{ flex: 1, minWidth: 0 }} /></span>
        </div>
      </td>
      <td className="ep-sb-fx" data-label="特效氛围">
        <Editable block value={s.fx} placeholder="如：慢放、闪白、冷色调" onCommit={(v) => onPatch({ fx: v })}
          className="edit-field muted" style={{ display: "block", fontSize: 12, lineHeight: 1.6, padding: "3px 5px" }} />
      </td>
    </tr>
  );
}

/** 首帧渲染单元（紧凑版，表格用）。短剧分镜表 + 短视频分镜表共用。
 *  v0.97：项目表额外传 onPick（2 张首帧挑选）+ onDecompose（补尾帧 → 首/尾帧双联），短视频表可不传。
 *  v0.197：onRedoClip 传了才显示「重新生成」（只重做视频，首帧和尾帧保留）。 */
export function ShotFrameCell({ s, busy, onRender, onApprove, onRedoClip, onAiEdit, onDecompose, onPick, frameCost = FRAME_COST, clipCost = 30, endFrameCost, endFrameRetryCost, priceBlock, getClipWarnings }: {
  s: FormShot; busy: ShotFlow | null;
  onRender: (kind: "frame" | "direct" | "clip") => PaidActionResult; onApprove: () => void; onAiEdit: () => void;
  /** 只重新生成这一镜的视频（保留首帧和尾帧）。flow==='clip' 时与「就用这版」并排，flow==='done' 时与「从头重做」并排。 */
  onRedoClip?: (id: string) => PaidActionResult;
  onDecompose?: () => PaidActionResult; onPick?: (url: string) => void;
  /** 首帧/视频真实单价（首帧 drama.credit.frame；视频沿用带货线 material.video-generate，默认 30）。 */
  frameCost?: number; clipCost?: number;
  /** 补尾帧总价（拆镜 + 尾帧出图）；不传按首帧价 + 3 估。 */
  endFrameCost?: number;
  /** 只重画尾帧（动作描述已有、尾帧图没画出来）的价；不传按首帧价。 */
  endFrameRetryCost?: number;
  /** 模型价格还没读到时的停用原因：有值 → 出首帧 / 生成视频 / 补尾帧这些按模型计价的按钮停用，title 写原因。 */
  priceBlock?: string | null;
  /** 出片（生成视频 / 直接出片）前的一致性问题即时求值；非空 → CreditButton 弹单个 danger 确认。短视频线不传。 */
  getClipWarnings?: () => string[];
}) {
  const isVideo = s.flow === "clip" || s.flow === "done";
  const frameSrc = s.frameUrl ?? s.frameUrls?.[0];
  const [lb, setLb] = React.useState<LightboxMedia | null>(null);
  const [scrub, setScrub] = React.useState(false); // 首帧→尾帧 hover 预演
  const hasDual = s.flow === "frame" && !!frameSrc && !!s.endFrameUrl;
  const efCost = endFrameCost ?? frameCost + 3;
  // 有动作描述、没有尾帧图（上次尾帧没画出来，或改首帧时去掉了旧尾帧）→ 按钮变「重画尾帧」，
  // 只重试出图这一步（epscript decompose 的 retryOnly 同一条件）。
  const endFrameRetry = !!(s.motionDesc && s.lfDesc?.trim() && !s.endFrameUrl);
  const efShownCost = endFrameRetry ? (endFrameRetryCost ?? frameCost) : efCost;
  // 最小宽度而不是定宽：按钮里是 图标 + 文字 + 积分钻石，定宽 92 装不下时图标和钻石会画到边框外。
  const btnWide: React.CSSProperties = { height: 26, minWidth: 92, padding: "0 8px", justifyContent: "center", fontSize: 11, whiteSpace: "nowrap" };
  // 按模型计价的按钮在价格没读到时一律停用（报价会低于实扣），title 说明原因。
  const priced = priceBlock ? { disabled: true, title: priceBlock } : {};
  const redoBtn = onRedoClip ? (
    <CreditButton
      {...priced}
      cost={clipCost}
      alwaysConfirm
      getWarnings={getClipWarnings}
      onConfirm={() => onRedoClip(s.id)}
      confirmTitle="重新生成这一镜的视频？"
      confirmBody={`${frameSrc ? (s.endFrameUrl ? "保留首帧和尾帧，" : "保留首帧，") : ""}重新生成这一镜的视频。现在这条视频会被新的替换，已花的积分不退。`}
      confirmLabel="重新生成"
      className="btn btn-line btn-sm sfc-btn"
      style={{ ...btnWide, fontSize: 10.5 }}
      markSize={10}
    >
      <RefreshCw size={10} /> 重新生成
    </CreditButton>
  ) : null;
  return (
    <div className="col sfc" style={{ alignItems: "center", gap: 6 }}>
      {busy ? (
        <GenFramePlaceholder width={62} height={96} radius={9} />
      ) : s.flow === "draft" ? (
        <div className="col center" style={{ width: 62, height: 96, borderRadius: 9, border: "1.5px dashed var(--line)", background: "var(--surface-2)", color: "var(--ink-3)", gap: 4, flex: "none" }}>
          <ImageIcon size={17} /><span style={{ fontSize: 9, fontWeight: 600 }}>还没首帧</span>
        </div>
      ) : isVideo && s.videoUrl ? (
        <button type="button" onClick={() => setLb({ src: s.videoUrl!, kind: "video" })} title="点开看视频" aria-label={`看第 ${s.no} 镜的视频`} style={{ position: "relative", width: 62, height: 96, borderRadius: 9, overflow: "hidden", border: "none", cursor: "zoom-in", padding: 0, background: "#000", flex: "none" }}>
          <video src={s.videoUrl} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,.9)", display: "grid", placeItems: "center" }}><Play size={11} style={{ color: "var(--ink)", marginLeft: 1 }} /></span>
          </span>
        </button>
      ) : hasDual ? (
        // 补过尾帧：首帧 ▷ 尾帧 双联。首帧格 hover 预演过渡 + 点开 AI 改图；尾帧格点开看大图。
        <div style={{ display: "flex", alignItems: "center", gap: 2, flex: "none" }}>
          <button
            type="button"
            tabIndex={0}
            onClick={onAiEdit}
            onMouseEnter={() => setScrub(true)}
            onMouseLeave={() => setScrub(false)}
            onFocus={() => setScrub(true)}
            onBlur={() => setScrub(false)}
            title="首帧到尾帧：鼠标移上去看过渡效果；点击用 AI 改首帧"
            aria-label="用 AI 改首帧"
            style={{ position: "relative", width: 44, height: 70, borderRadius: 7, overflow: "hidden", border: "none", padding: 0, cursor: "pointer", boxShadow: scrub ? "0 0 0 2px var(--accent)" : "none" }}
          >
            <img src={frameSrc} alt="首帧" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: scrub ? 0 : 1, transition: "opacity .5s" }} />
            <img src={s.endFrameUrl} alt="尾帧" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: scrub ? 1 : 0, transition: "opacity .5s" }} />
            <span style={{ position: "absolute", left: 2, top: 2, background: "rgba(0,0,0,.5)", color: "#fff", fontSize: 7.5, fontWeight: 700, padding: "0 3px", borderRadius: 3 }}>{scrub ? "尾" : "首"}</span>
          </button>
          <ArrowRight size={11} style={{ color: "var(--accent)", flex: "none" }} />
          <button
            type="button"
            onClick={() => s.endFrameUrl && setLb({ src: s.endFrameUrl, kind: "image" })}
            title="尾帧，点开看大图"
            aria-label="看尾帧大图"
            style={{ width: 30, height: 48, borderRadius: 6, overflow: "hidden", border: "none", padding: 0, cursor: "zoom-in", opacity: 0.9 }}
          >
            <img src={s.endFrameUrl} alt="尾帧" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </button>
        </div>
      ) : (
        // 首帧已出：点开 AI 改图
        <button type="button" onClick={onAiEdit} title="点击用 AI 改这张首帧，每改一次扣积分" aria-label="用 AI 改这张首帧" style={{ position: "relative", width: 62, height: 96, borderRadius: 9, overflow: "hidden", border: "none", cursor: "pointer", padding: 0, flex: "none" }}>
          {frameSrc
            ? <img src={frameSrc} alt={`第 ${s.no} 镜首帧`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <Thumb from="#fb923c" to="#f472b6" ratio="9/14" radius={0} style={{ width: "100%", height: "100%" }} />}
          <span className="row center gap-1" style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.45)", color: "#fff", fontSize: 8.5, fontWeight: 600, padding: "2px 0" }}>
            <Wand2 size={9} /> AI 改图
          </span>
        </button>
      )}

      {/* 出了 2 张首帧：挑一张（仅项目表传 onPick）。补过尾帧后不再换（尾帧是照着当前这张画的）。 */}
      {!busy && s.flow === "frame" && onPick && !s.endFrameUrl && (s.frameUrls?.length ?? 0) > 1 && (
        <div className="col" style={{ gap: 2, alignItems: "center" }}>
          <span className="faint" style={{ fontSize: 9 }}>挑一张</span>
          <div className="row" style={{ gap: 4, justifyContent: "center" }}>
            {s.frameUrls!.slice(0, 2).map((u, i) => {
              const on = (s.frameUrl ?? s.frameUrls![0]) === u;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPick(u)}
                  title={`用第 ${i + 1} 张`}
                  aria-label={`用第 ${i + 1} 张首帧`}
                  aria-pressed={on}
                  style={{ position: "relative", width: 26, height: 42, borderRadius: 6, overflow: "hidden", padding: 0, cursor: "pointer", border: on ? "2px solid var(--accent)" : "1px solid var(--line)" }}
                >
                  <img src={u} alt={`第 ${i + 1} 张`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {on && (
                    <span style={{ position: "absolute", right: 1, bottom: 1, width: 12, height: 12, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center" }}>
                      <Check size={8} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 补过尾帧：可视文案定宽不溢出；动作幅度 + 动作描述放 hover 提示。 */}
      {!busy && s.motionDesc && (
        <div
          className="row"
          style={{ gap: 3, alignItems: "center", fontSize: 9, color: "var(--ink-3)", maxWidth: 118, minWidth: 0 }}
          title={`动作幅度：${VARI[s.variationType ?? ""] ?? "适中"}。${s.motionDesc}`}
        >
          <Sparkles size={9} style={{ color: "var(--accent)", flex: "none" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.endFrameUrl ? "已补尾帧" : "已补动作描述"}</span>
        </div>
      )}

      {/* C-1：参考生效回报——有参考图没用上（模型读不到 / 不支持尾帧…）时如实提示，全部用上不显示。 */}
      {!busy && <AppliedRefsChip refs={s.appliedRefs} />}

      {/* 动作按钮（按状态） */}
      {!busy && s.flow === "draft" && (
        <>
          <CreditButton
            {...priced}
            cost={frameCost}
            onConfirm={() => onRender("frame")}
            confirmTitle="先出首帧"
            confirmBody={onPick ? "出 2 张首帧，挑一张满意的再生成视频。" : "出一张首帧，确认人物和构图后再生成视频。"}
            confirmLabel="出首帧"
            className="btn btn-grad btn-sm sfc-btn"
            style={btnWide}
            markSize={11}
          >
            先出首帧
          </CreditButton>
          <CreditButton
            {...priced}
            cost={clipCost}
            alwaysConfirm
            getWarnings={getClipWarnings}
            onConfirm={() => onRender("direct")}
            confirmTitle="跳过首帧，直接出视频？"
            confirmBody="不先出首帧，AI 只按文字生成这一镜的视频，人物长相和场景可能和别的镜对不上。想稳一点，先点「先出首帧」挑一张。"
            confirmLabel="直接出视频"
            className="btn btn-ghost btn-sm sfc-btn"
            style={{ height: 24, fontSize: 10, color: "var(--ink-3)", padding: "0 6px" }}
            markSize={10}
          >
            跳过首帧出视频
          </CreditButton>
        </>
      )}
      {!busy && s.flow === "frame" && (
        <>
          {/* 选好首帧后：可选「补尾帧」—— AI 画出这一镜结束时的画面，生成视频时从首帧过渡到尾帧。
              按有没有尾帧图判断补没补成：动作描述写好了、尾帧图没画出来时还能「重画尾帧」（只重试出图）。 */}
          {onDecompose && !s.endFrameUrl && (
            <CreditButton
              cost={efShownCost}
              alwaysConfirm
              disabled={!!priceBlock}
              onConfirm={onDecompose}
              confirmTitle={endFrameRetry ? "重画尾帧？" : "补尾帧？"}
              confirmBody={endFrameRetry
                ? "动作描述已经有了（上次尾帧没画出来，或者改过首帧），这次只照现在这张首帧画一张尾帧，只扣出一张图的积分。补完之后就用现在这张首帧，不能再换另一张。"
                : "可选。AI 再画一张这一镜结束时的画面（尾帧），生成视频时会从首帧过渡到尾帧，动作的起止更好控制。补完之后就用现在这张首帧，不能再换另一张。"}
              confirmLabel={endFrameRetry ? "重画尾帧" : "补尾帧"}
              className="btn btn-line btn-sm sfc-btn"
              title={priceBlock || (endFrameRetry ? "照现在这张首帧再画一张尾帧" : "可选：AI 画出这一镜结束时的画面，生成视频时从首帧过渡到尾帧")}
              style={{ display: "inline-flex", alignItems: "center", gap: 3, height: 24, fontSize: 10, fontWeight: 700, padding: "0 8px", whiteSpace: "nowrap", color: "var(--accent)" }}
              markSize={10}
            >
              <Sparkles size={10} /> {endFrameRetry ? "重画尾帧" : "补尾帧"} <span className="num">{efShownCost}</span>
            </CreditButton>
          )}
          <CreditButton
            {...priced}
            cost={clipCost}
            getWarnings={getClipWarnings}
            onConfirm={() => onRender("clip")}
            confirmTitle="生成视频"
            confirmBody={s.endFrameUrl ? "从这张首帧过渡到尾帧，生成这一镜的视频。" : "按这张首帧生成这一镜的视频。"}
            confirmLabel="生成视频"
            className="btn btn-grad btn-sm sfc-btn"
            style={btnWide}
            markSize={11}
          >
            <Clapperboard size={12} /> 生成视频
          </CreditButton>
        </>
      )}
      {!busy && s.flow === "clip" && (
        <>
          <button
            type="button"
            onClick={onApprove}
            className="btn btn-primary btn-sm sfc-btn"
            title="确定就用这一版视频"
            style={{ ...btnWide, fontSize: 10.5 }}
          >
            <Check size={11} /> 就用这版
          </button>
          {redoBtn}
        </>
      )}
      {!busy && s.flow === "done" && (
        <>
          <CreditButton
            {...priced}
            cost={frameCost}
            alwaysConfirm
            onConfirm={() => onRender("frame")}
            confirmTitle="从首帧开始重做这一镜？"
            confirmBody="会重新出首帧，这一镜已生成的视频和尾帧都会清掉，挑好首帧后要重新生成视频。已花的积分不退。"
            confirmLabel="从头重做"
            className="btn btn-line btn-sm sfc-btn"
            style={{ ...btnWide, fontSize: 10.5 }}
            markSize={10}
          >
            <RefreshCw size={10} /> 从头重做
          </CreditButton>
          {redoBtn}
        </>
      )}
      <MediaLightbox media={lb} onClose={() => setLb(null)} />
    </div>
  );
}
