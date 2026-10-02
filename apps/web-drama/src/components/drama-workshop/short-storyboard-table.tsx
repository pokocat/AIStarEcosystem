"use client";

// 短视频分镜表（v0.94）— 设计真源：短视频制作右侧「分镜表」平铺表格。
// 列：镜·时长（beat 语义标签 + 镜号 + 时间线 + 时长） / 首帧（4 态 + AI 改图 + 出片）/
//     口播文案·画面（说话人 + 台词 + 画面）/ 镜头（景别·运镜）/ 音效·BGM·特效。
// 与短剧分镜表 StoryboardTable 同一视觉语言，但短视频是「单条平铺」无场分组，且每镜带 beat 标签。
// v0.197：容器宽度 <860（桌面上对话栏展开时）或手机上，每一镜变成一张卡片，样式在
// styles/pages/shorts-make.css（.smk-board 容器查询）；这里只挂 class。
import * as React from "react";
import { Loader2, Mic, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Editable } from "@/components/drama-ui";
import { ShotFrameCell } from "./storyboard-table";
import { AiImageEditModal } from "./ai-image-edit-modal";
import type { FormShot, ShotFlow } from "./shot-form";

const TH: React.CSSProperties = {
  padding: "11px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--ink-3)",
  letterSpacing: ".04em",
  borderBottom: "2px solid var(--line)",
  whiteSpace: "nowrap",
};
const TD: React.CSSProperties = { padding: "12px 12px", verticalAlign: "top", borderBottom: "1px solid var(--line-soft)" };

function fmtT(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

export interface ShortStoryboardTableProps {
  shots: FormShot[];
  /** 每镜 beat 语义标签（痛点开场 / 卖点演示 / 强 CTA 收尾…），按序号取；没有就不显示标签。 */
  beats: string[];
  speakerOptions: string[];
  /** 提示词直出线的全片角色名；给了才渲染逐镜「出场人物」chip。 */
  characters?: string[];
  locked?: boolean;
  /**
   * 报价（驱动确认弹窗的金额）：首帧按所选图片模型；视频按所选视频模型和**这一镜的时长**算
   * （按秒计费的模型 × 秒数），所以是按镜取的函数，不是一个数。AI 改图按默认图片模型。
   */
  frameCost: number;
  clipCostFor: (s: FormShot) => number;
  aiEditCost: number;
  /** 分镜表上选的图片模型：AI 改图用同一个，价格才对得上 aiEditCost。 */
  imageEndpointId?: string;
  /**
   * 模型和价格还没读到时的停用原因（priceBlockReason）。有值时出首帧 / 生成视频 / 重新生成 / AI 改图
   * 这些按模型计价的入口都停用：这时的报价是全局价，服务端却按默认模型的价扣。
   */
  priceBlock?: string | null;
  /**
   * 批量生成这一轮里的锁定原因：有值时秒数不能改（总价按开跑时的秒数报）、AI 改图不给开
   * （这一轮按当前首帧出视频）。
   */
  runLock?: string | null;
  /** 正在生成的镜：{id,to}；其余镜 busy=null。 */
  busy: { id: string; to: ShotFlow } | null;
  /**
   * 已提交、还没回填的镜（后台还在生成）。这些镜显示「生成中」、不给任何生成按钮 ——
   * 再点一次就是再提交一次、再扣一次积分。watching=false 表示页面没在等它（轮询超时了），给「查看进度」。
   */
  pending?: Record<string, { kind: "frame" | "clip"; watching: boolean }>;
  onCheckPending?: (id: string) => void;
  onPatch: (id: string, patch: Partial<FormShot>) => void;
  onDelete: (id: string) => void;
  /** 返回 Promise 时，镜头格里的 CreditButton 等它结束再刷新余额。 */
  onRender: (id: string, kind: "frame" | "direct" | "clip") => void | Promise<unknown>;
  onApprove: (id: string) => void;
  /** 只重新生成这一镜的视频，保留首帧（ShotFrameCell 传了才显示「重新生成视频」）。返回 Promise 同上。 */
  onRedoClip?: (id: string) => void | Promise<unknown>;
  onFrameEdited: (id: string, frameUrl: string) => void;
}

export function ShortStoryboardTable(props: ShortStoryboardTableProps) {
  const { shots, beats, speakerOptions, characters, locked, busy, frameCost, clipCostFor, aiEditCost, pending, priceBlock, runLock } = props;
  const [edit, setEdit] = React.useState<FormShot | null>(null);
  // AI 改图按模型计价，而且一起生成的这一轮会按「现在这张」首帧出视频：两种情况都先不开弹窗，说明原因。
  const openAiEdit = (s: FormShot) => {
    const block = priceBlock || runLock;
    if (block) {
      toast(block);
      return;
    }
    setEdit(s);
  };

  // 时间线累计起点。
  const starts = new Map<string, number>();
  let acc = 0;
  for (const s of shots) {
    starts.set(s.id, acc);
    acc += s.dur || 0;
  }

  return (
    <div className="card smk-board" style={{ padding: 0, overflow: "hidden" }}>
      <div className="smk-table-scroll" style={{ overflowX: "auto" }}>
        <table className="smk-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "var(--surface)" }}>
              <th style={{ ...TH, width: 116, textAlign: "center" }}>镜 · 时长</th>
              <th style={{ ...TH, width: 116, textAlign: "center" }} title="这一镜视频的第一张画面。先出它，确认人物和构图再生成视频">首帧</th>
              <th style={{ ...TH, width: 280 }}>台词 · 画面</th>
              <th style={{ ...TH, width: 96 }}>景别 · 运镜</th>
              <th style={{ ...TH, width: 140 }}>音效 · BGM · 特效</th>
            </tr>
          </thead>
          <tbody>
            {shots.map((s, i) => (
              <ShortShotRow
                key={s.id}
                s={s}
                beat={beats[i] || ""}
                start={starts.get(s.id) ?? 0}
                busy={busy && busy.id === s.id ? busy.to : pending?.[s.id]?.kind ?? null}
                pending={pending?.[s.id]}
                onCheckPending={props.onCheckPending ? () => props.onCheckPending?.(s.id) : undefined}
                locked={locked}
                durLocked={!!runLock}
                durLockReason={runLock ?? undefined}
                priceBlock={priceBlock}
                speakerOptions={speakerOptions}
                characters={characters}
                frameCost={frameCost}
                clipCost={clipCostFor(s)}
                onPatch={(patch) => props.onPatch(s.id, patch)}
                onDelete={() => props.onDelete(s.id)}
                onRender={(kind) => props.onRender(s.id, kind)}
                onApprove={() => props.onApprove(s.id)}
                onRedoClip={props.onRedoClip}
                onAiEdit={() => openAiEdit(s)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <AiImageEditModal
          kind="short"
          endpointId={props.imageEndpointId}
          tag={`镜 ${edit.no}`}
          openingText={`这是镜 ${edit.no} 的首帧。说想怎么改就行，例如「换成夜景」「让她回头」「换成更高级的色调」。`}
          baseDesc={edit.visual || "分镜画面"}
          initialUrl={edit.frameUrl ?? edit.frameUrls?.[0]}
          ratio="9:16"
          chips={["换成夜景", "让她回头", "换暖色调", "背景虚化", "再高级一点"]}
          cost={aiEditCost}
          onClose={() => setEdit(null)}
          onCommit={(f) => props.onFrameEdited(edit.id, f.url)}
        />
      )}
    </div>
  );
}

function ShortShotRow({
  s,
  beat,
  start,
  busy,
  pending,
  onCheckPending,
  locked,
  durLocked,
  durLockReason,
  priceBlock,
  speakerOptions,
  characters,
  frameCost,
  clipCost,
  onPatch,
  onDelete,
  onRender,
  onApprove,
  onRedoClip,
  onAiEdit,
}: {
  s: FormShot;
  beat: string;
  start: number;
  busy: ShotFlow | null;
  pending?: { kind: "frame" | "clip"; watching: boolean };
  onCheckPending?: () => void;
  locked?: boolean;
  /** 批量生成这一轮里秒数不能改（见 ShortStoryboardTableProps.runLock）。 */
  durLocked?: boolean;
  durLockReason?: string;
  priceBlock?: string | null;
  speakerOptions: string[];
  characters?: string[];
  frameCost: number;
  clipCost: number;
  onPatch: (patch: Partial<FormShot>) => void;
  onDelete: () => void;
  onRender: (kind: "frame" | "direct" | "clip") => void | Promise<unknown>;
  onApprove: () => void;
  onRedoClip?: (id: string) => void | Promise<unknown>;
  onAiEdit: () => void;
}) {
  const whoList = speakerOptions.includes(s.voWho) || !s.voWho ? speakerOptions : [s.voWho, ...speakerOptions];
  return (
    <tr className="smk-row">
      {/* 镜 · 时长（beat 标签 + 镜号 + 时间线 + 时长） */}
      <td className="smk-cell-no" style={{ ...TD, textAlign: "center" }}>
        {beat && (
          <span className="tag tag-accent smk-beat" style={{ marginBottom: 8, fontSize: 10.5, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={beat}>
            {beat}
          </span>
        )}
        <div className="num smk-no" style={{ fontSize: 26, fontWeight: 800, color: "var(--accent)", lineHeight: 1.05 }}>{s.no}</div>
        <div className="num faint smk-time" style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>
          {fmtT(start)}–{fmtT(start + (s.dur || 0))}
        </div>
        <label className="row smk-dur" style={{ gap: 3, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
          <input
            type="number"
            min={1}
            max={60}
            value={s.dur}
            disabled={locked || durLocked}
            title={durLocked ? durLockReason : undefined}
            onChange={(e) => onPatch({ dur: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
            className="smk-dur-input"
            style={{ width: 46, height: 22, border: "1px solid var(--line)", borderRadius: 6, fontSize: 11, textAlign: "center", outline: "none", background: "var(--surface)" }}
            aria-label="这一镜多少秒"
          />
          <span className="faint" style={{ fontSize: 10.5 }}>秒</span>
        </label>
        {!locked && (
          <button
            type="button"
            className="smk-del"
            title="删除这一镜"
            aria-label={`删除镜 ${s.no}`}
            onClick={onDelete}
            style={{ marginTop: 8, background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)" }}
          >
            <X size={12} />
          </button>
        )}
      </td>

      {/* 首帧（4 态 + AI 改图 + 出片，复用短剧分镜表的单元） */}
      <td className="smk-cell-frame" style={{ ...TD, textAlign: "center" }}>
        <ShotFrameCell
          s={s}
          busy={busy}
          onRender={onRender}
          onApprove={onApprove}
          onRedoClip={onRedoClip}
          onAiEdit={onAiEdit}
          frameCost={frameCost}
          clipCost={clipCost}
          priceBlock={priceBlock}
        />
        {pending && (
          <div className="col smk-pending" style={{ alignItems: "center", gap: 4, marginTop: 6 }} aria-live="polite">
            <span className="row gap-1 faint" style={{ fontSize: 10.5, alignItems: "center", maxWidth: 118, minWidth: 0 }}>
              {pending.watching && <Loader2 size={10} style={{ flex: "none", animation: "drama-spin .7s linear infinite" }} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pending.kind === "frame" ? "首帧在后台生成" : "视频在后台生成"}
              </span>
            </span>
            {!pending.watching && onCheckPending && (
              <button
                type="button"
                className="btn btn-line btn-sm sfc-btn"
                data-action="check-pending"
                onClick={onCheckPending}
                title="去查一下这一镜的进度，好了就填回来。不会重新生成，也不花积分"
                style={{ height: 24, fontSize: 10.5, padding: "0 8px" }}
              >
                <RefreshCw size={10} /> 查看进度
              </button>
            )}
          </div>
        )}
      </td>

      {/* 台词 · 画面 */}
      <td className="smk-cell-text" style={TD}>
        <div className="row gap-1" style={{ alignItems: "center", marginBottom: 5 }}>
          <Mic size={12} style={{ color: "var(--accent)", flex: "none" }} />
          <select
            value={s.voWho || speakerOptions[0]}
            disabled={locked}
            onChange={(e) => onPatch({ voWho: e.target.value })}
            className="smk-speaker"
            aria-label="谁来说这句"
            style={{ height: 22, border: "1px solid var(--line)", borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: "var(--surface-2)", color: "var(--accent)", outline: "none", maxWidth: 120 }}
          >
            {whoList.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <Editable
          block
          value={s.voText}
          placeholder="口播 / 台词（这一镜不说话就留空）"
          onCommit={(v) => onPatch({ voText: v })}
          className="edit-field"
          style={{ display: "block", fontSize: 13, lineHeight: 1.6, padding: "6px 9px", background: "var(--accent-soft)", borderRadius: 8 }}
        />
        <Editable
          block
          value={s.visual}
          placeholder="画面：镜头里发生什么…"
          onCommit={(v) => onPatch({ visual: v })}
          className="edit-field"
          style={{ display: "block", fontSize: 12.5, lineHeight: 1.7, padding: "5px 7px", marginTop: 7, color: "var(--ink-2)" }}
        />
        {/* 出场人物（提示词直出线）：决定这一镜出图时锚哪几个人的外貌。
            字段缺失 = 未标注，按全员锚定，chip 也按全员亮起，跟实际行为一致。 */}
        {!!characters?.length && (
          <div className="row gap-1" style={{ flexWrap: "wrap", alignItems: "center", marginTop: 7 }}>
            {!s.castNames && (
              <span
                className="faint"
                style={{ fontSize: 10, flex: "none" }}
                title="这一镜没选人物，出图会把所有角色都画进去；点名字可以去掉不在这一镜的人"
              >
                默认全员
              </span>
            )}
            {characters.map((name) => {
              const on = s.castNames ? s.castNames.includes(name) : true;
              return (
                <button
                  key={name}
                  type="button"
                  className="chip"
                  disabled={locked}
                  aria-pressed={on}
                  title={on ? `${name} 出现在这一镜（点一下移出）` : `${name} 不在这一镜（点一下加入）`}
                  onClick={() => {
                    const base = s.castNames ?? characters;
                    onPatch({ castNames: on ? base.filter((n) => n !== name) : [...base, name] });
                  }}
                  style={{
                    height: 20, fontSize: 10.5, padding: "0 7px", maxWidth: 92,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    background: on ? "var(--accent-soft)" : undefined,
                    color: on ? "var(--accent)" : "var(--ink-3)", opacity: on ? 1 : 0.7,
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </td>

      {/* 镜头（景别 · 运镜） */}
      <td className="smk-cell-shot" style={TD}>
        <div className="col gap-2 smk-fields" style={{ fontSize: 12 }}>
          <div className="col smk-field" style={{ gap: 1 }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>景别</span>
            <Editable className="edit-field" value={s.size} placeholder="中景" onCommit={(v) => onPatch({ size: v })} style={{ padding: "2px 5px" }} />
          </div>
          <div className="col smk-field" style={{ gap: 1 }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>运镜</span>
            <Editable className="edit-field" value={s.move} placeholder="固定" onCommit={(v) => onPatch({ move: v })} style={{ padding: "2px 5px" }} />
          </div>
        </div>
      </td>

      {/* 音效 · BGM · 特效 */}
      <td className="smk-cell-audio" style={TD}>
        <div className="col smk-fields" style={{ gap: 5, fontSize: 11.5, color: "var(--ink-2)" }}>
          <div className="col smk-field" style={{ gap: 1 }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>音效</span>
            <Editable className="edit-field" value={s.sfx} placeholder="环境音…" onCommit={(v) => onPatch({ sfx: v })} style={{ padding: "2px 5px" }} />
          </div>
          <div className="col smk-field" style={{ gap: 1 }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>BGM</span>
            <Editable className="edit-field" value={s.bgm} placeholder="无 / 渐入…" onCommit={(v) => onPatch({ bgm: v })} style={{ padding: "2px 5px" }} />
          </div>
          <div className="col smk-field" style={{ gap: 1 }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>特效</span>
            <Editable className="edit-field" value={s.fx} placeholder="光效 / 慢放…" onCommit={(v) => onPatch({ fx: v })} style={{ padding: "2px 5px" }} />
          </div>
        </div>
      </td>
    </tr>
  );
}
