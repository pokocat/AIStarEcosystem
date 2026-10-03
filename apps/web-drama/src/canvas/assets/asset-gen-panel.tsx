"use client";

// ─────────────────────────────────────────────────────────────────────────────
// canvas/assets/asset-gen-panel.tsx —— 出图面板（v0.198，props 见 canvas/core/contract.ts AssetGenPanelProps）。
// 画布（board，variant="docked"）和列表 / 手机抽屉（variant="inline"）共用这一个。
//
//   描述正文（造型 / 场景 / 素材图的 prompt，高度跟内容走，可放大编辑）
//   连进来的参考（每张右上 × 断开）+ 上传参考（建素材图 + 连线，board 通过 onReferenceAdded 摆位置）
//   候选图一排（点一张 = 用这张）、生成状态（排队中可停 / 失败原因 / 参考图实际用上几张）
//   出图模型 ▾ · 画幅 ▾ · 角色设计（只对造型）· 出几张 1–4 · 生成 ✦N
//   底下一行提示（为什么不能生成 / 出错原因）：**一直占着一行的高度**。面板贴着底边停靠，这一行时有时无的话
//   面板高度跟着变，「生成」按钮会在鼠标底下挪位（v0.198.1 线上实测）。
//
// 出图模型是**整张画布一个选择**（useCanvasPricing().imageModelId，按画布记在 localStorage）：
// 这里改了，列表批量出图、片段「出首帧」也跟着用这个。
// docked：position:absolute 停在所在容器（画布的 .cv-fill，position:relative）的底部中间，最宽 820，小屏整宽；
//   整体最高 min(46vh, 360px)：描述最多约 5 行（超出在框里滚，「放大编辑」开大弹窗），上传参考 / 已连参考 /
//   候选图合成一行 56px 小图横向滚动，底部一行放 模型 / 画幅 / 角色设计 / 出几张 / 生成。inline 是普通块，排版不压。
// 只通过 useCanvasDoc().update() 改文档，生成只走 useCanvasRuns().submit()，价格只从 useCanvasPricing() 拿。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { Check, FileText, ImagePlus, Loader2, Maximize2, Palette, Settings2, Sparkles, Square, X } from "lucide-react";
import type { CanvasImageRatio, CanvasImageSet, CanvasRunRef, DramaCanvasDoc, DramaCanvasRunTarget } from "@ai-star-eco/types/drama-canvas";
import { CanvasApi } from "@/api/canvas";
import {
  RunTarget,
  defaultImageRatio,
  findLook,
  findMaterial,
  findScene,
  lookLabel,
  mapLook,
  mapMaterial,
  mapScene,
  pickedImage,
  setPicked,
  useCanvasDoc,
  useCanvasPricing,
  useCanvasRuns,
  type AssetGenPanelProps,
} from "@/canvas/core";
import { CanvasImage } from "@/canvas/shell";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { aiErrorMessage } from "@/lib/ai-error";
import { assetRunView, Cost, READ_ONLY_REASON, Reason, withSubmitting } from "./bits";
import { CvaModal, GrowTextarea, ModalHead, NOT_IMAGE_MESSAGE, isImageFile, useImagePicker } from "./inputs";
import { LookDetailDialog } from "./look-detail-dialog";
import { addUploadedReference, disconnectReference, materialNameFromFile, referencesOf } from "./references";
import { traitCount } from "./traits";
import { TraitsDialog } from "./traits-dialog";

export const IMAGE_RATIOS: CanvasImageRatio[] = ["9:16", "16:9", "1:1", "4:3", "3:4"];
export const IMAGE_COUNTS = [1, 2, 3, 4] as const;

const LOOK_PLACEHOLDER =
  "写这个造型长什么样，比如：\n基本信息：…\n面部特征：…\n服饰装备：…\n配饰：…\n姿态构图：…\n光影渲染：…";
const SCENE_PLACEHOLDER = "写这个地方：环境、时间、光线、色调。不写人物。";
const MATERIAL_PLACEHOLDER = "写这张图要画什么。只是上传的参考图的话，可以不写。";
const TEXT_PLACEHOLDER = "写一段话。连给哪张卡片，出图时就拼进它的描述里。";

type Target = AssetGenPanelProps["target"];

interface Subject {
  kind: Target["kind"];
  id: string;
  /** 「林微·学生时期」「23 路末班车车厢」 */
  title: string;
  typeLabel: string;
  prompt: string;
  images?: CanvasImageSet;
  run?: CanvasRunRef;
  /** 文字素材：没有出图，只有正文。 */
  isText: boolean;
  traits?: Record<string, string[]>;
}

function resolveSubject(doc: DramaCanvasDoc, target: Target): Subject | null {
  if (target.kind === "look") {
    const hit = findLook(doc, target.id);
    if (!hit) return null;
    return {
      kind: "look",
      id: target.id,
      title: lookLabel(hit.character, hit.look),
      typeLabel: "造型",
      prompt: hit.look.prompt,
      images: hit.look.images,
      run: hit.look.run,
      isText: false,
      traits: hit.look.traits,
    };
  }
  if (target.kind === "scene") {
    const s = findScene(doc, target.id);
    if (!s) return null;
    return { kind: "scene", id: s.id, title: s.name, typeLabel: "场景", prompt: s.prompt, images: s.images, run: s.run, isText: false };
  }
  const m = findMaterial(doc, target.id);
  if (!m) return null;
  if (m.kind === "text") return { kind: "material", id: m.id, title: m.name, typeLabel: "文字", prompt: m.text ?? "", isText: true };
  return { kind: "material", id: m.id, title: m.name, typeLabel: "素材图", prompt: m.prompt ?? "", images: m.images, run: m.run, isText: false };
}

function writePrompt(doc: DramaCanvasDoc, s: Subject, value: string): DramaCanvasDoc {
  if (s.kind === "look") return mapLook(doc, s.id, (l) => (l.prompt === value ? l : { ...l, prompt: value }));
  if (s.kind === "scene") return mapScene(doc, s.id, (x) => (x.prompt === value ? x : { ...x, prompt: value }));
  return mapMaterial(doc, s.id, (m) =>
    m.kind === "text" ? (m.text === value ? m : { ...m, text: value }) : m.prompt === value ? m : { ...m, prompt: value },
  );
}

function runTargetOf(s: Pick<Subject, "kind" | "id">): DramaCanvasRunTarget {
  return s.kind === "look" ? RunTarget.look(s.id) : s.kind === "scene" ? RunTarget.scene(s.id) : RunTarget.material(s.id);
}

const UPLOAD_CAT: Record<Target["kind"], string> = { look: "人物", scene: "场景", material: "其他" };

export function AssetGenPanel(props: AssetGenPanelProps) {
  // 换了目标就从头来（画幅缺省值跟着类型变、出几张回到 1、报错清掉）
  return <PanelInner key={`${props.target.kind}:${props.target.id}`} {...props} />;
}

function PanelInner({ target, variant, onClose, onReferenceAdded }: AssetGenPanelProps) {
  const { doc, meta, update, readOnly } = useCanvasDoc();
  const { submit, runFor, cancel, isSubmitting } = useCanvasRuns();
  const pricing = useCanvasPricing();
  const subject = resolveSubject(doc, target);

  const [count, setCount] = React.useState(1);
  const [ratio, setRatio] = React.useState<CanvasImageRatio>(() => defaultImageRatio(target.kind, meta.ratio));
  const [busy, setBusy] = React.useState(false);
  /** 同一帧里连点两下：state 还没更新，靠 ref 同步上锁（从确认框到请求返回整段都算在途）。 */
  const lock = React.useRef(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [traitsOpen, setTraitsOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const models = pricing.imageModels;
  const endpointId = pricing.imageModelId;

  const onPick = React.useCallback(
    async (file: File) => {
      if (!isImageFile(file)) {
        setUploadError(NOT_IMAGE_MESSAGE);
        return;
      }
      setUploadError(null);
      setUploading(true);
      try {
        const asset = await CanvasApi.uploadImage(file, UPLOAD_CAT[target.kind]);
        let materialId = "";
        update((d) => {
          const r = addUploadedReference(d, target.id, asset, materialNameFromFile(file.name));
          materialId = r.materialId;
          return r.doc;
        });
        if (materialId) onReferenceAdded?.(materialId);
      } catch (e) {
        setUploadError(aiErrorMessage(e, "图没传上去，请重试。"));
      } finally {
        setUploading(false);
      }
    },
    [target.id, target.kind, update, onReferenceAdded],
  );
  const picker = useImagePicker((f) => void onPick(f), "上传参考图");

  if (!subject) {
    return (
      <section className={`cva-panel cva-panel-${variant}`} aria-label="出图">
        <div className="cva-panel-head">
          <div className="cva-panel-title">
            <span className="cv-ellipsis">这张卡片已经删掉了</span>
          </div>
          {onClose && (
            <button type="button" className="btn btn-icon btn-ghost btn-sm tap-target" aria-label="关闭" title="关闭" onClick={onClose}>
              <X size={15} />
            </button>
          )}
        </div>
      </section>
    );
  }

  const rt = runTargetOf(subject);
  // 提交中（请求还没回来）和 queued / running 一起算生成中
  const view = withSubmitting(assetRunView(runFor(rt), subject.run), isSubmitting(rt));
  const refs = referencesOf(doc, subject.id);
  const versions = subject.images?.versions ?? [];
  const picked = pickedImage(subject.images);
  const price = pricing.imagePrice(count, endpointId);
  const hasPrompt = subject.prompt.trim().length > 0;
  const setPrompt = (v: string) => update((d) => writePrompt(d, subject, v));

  const disabledReason = readOnly
    ? READ_ONLY_REASON
    : view.pending
      ? "正在生成，等这次出完再生成。"
      : !hasPrompt
        ? subject.kind === "material"
          ? "先写要画什么，再生成。"
          : "先写描述，再生成。"
        : null;

  const generate = async () => {
    if (disabledReason || lock.current) return;
    lock.current = true;
    try {
      await generateOnce();
    } finally {
      lock.current = false;
    }
  };

  const generateOnce = async () => {
    setError(null);
    const needConfirm = !pricing.ready || price >= pricing.confirmThreshold;
    if (needConfirm) {
      const ok = await dramaConfirm({
        title: `给「${subject.title}」生成 ${count} 张？`,
        body: pricing.ready ? "生成失败的那几张会退回积分。" : "价格还没读到，下面是按默认单价估的，以实际扣费为准。生成失败的会退回积分。",
        cost: price,
        confirmLabel: "确认生成",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await submit({
        kind: "image",
        body: { target: { kind: subject.kind, id: subject.id }, count, ratio, ...(endpointId ? { endpointId } : {}) },
      });
      if (!res.ok) setError(res.message);
    } finally {
      setBusy(false);
    }
  };

  const promptLabel = subject.isText ? "文字" : subject.kind === "look" ? "外貌描述" : subject.kind === "scene" ? "场景描述" : "画面描述";
  const placeholder = subject.isText
    ? TEXT_PLACEHOLDER
    : subject.kind === "look"
      ? LOOK_PLACEHOLDER
      : subject.kind === "scene"
        ? SCENE_PLACEHOLDER
        : MATERIAL_PLACEHOLDER;
  const nTraits = subject.kind === "look" ? traitCount(subject.traits ?? {}) : 0;

  const docked = variant === "docked";
  const refItems = refs.map((r) => (
    <div key={r.edgeId} className={`cva-ref${r.kind === "text" ? " cva-ref-text" : ""}`} title={r.kind === "text" ? `${r.label}：${r.text ?? ""}` : r.label}>
      {r.kind === "text" ? (
        <span className="cva-ref-textbody">
          <FileText size={12} />
          <span className="cv-ellipsis">{r.label}</span>
        </span>
      ) : (
        <CanvasImage asset={r.asset} alt={r.label} className="cva-ref-img" placeholder={<span className="cva-ref-empty">还没有图</span>} />
      )}
      {!readOnly && (
        <button
          type="button"
          className="cva-ref-x"
          aria-label={`断开「${r.label}」`}
          title="不再拿它当参考"
          onClick={() => update((d) => disconnectReference(d, r.edgeId))}
        >
          <X size={11} />
        </button>
      )}
    </div>
  ));
  const addRefButton = (
    <button
      type="button"
      className="cva-ref-add"
      onClick={picker.open}
      disabled={readOnly || uploading}
      aria-busy={uploading || undefined}
      title={refs.length ? "再传一张图给它当参考" : "传一张图给它当参考；没有参考图时只按描述画"}
    >
      {uploading ? <Loader2 size={14} className="cv-spin" /> : <ImagePlus size={14} />}
      <span>{uploading ? "上传中…" : "上传参考"}</span>
    </button>
  );
  const candList =
    versions.length > 0 ? (
      <div className={docked ? "cva-strip-group" : "cva-cands"} role="list" aria-label="候选图">
        {versions.map((v, i) => {
          const on = v.key === picked?.key;
          return (
            <button
              key={v.key}
              type="button"
              role="listitem"
              className={`cva-cand cva-cand-${subject.kind}${on ? " on" : ""}`}
              aria-pressed={on}
              disabled={readOnly && !on}
              title={on ? "正在用这张" : "用这张"}
              onClick={() => !on && update((d) => setPicked(d, rt, v.key))}
            >
              <CanvasImage asset={v} alt={`${subject.title} 候选 ${i + 1}`} className="cva-cand-img" />
              <span className={`cva-cand-badge${on ? " on" : ""}`}>
                {on ? (
                  <>
                    <Check size={11} /> 正在用
                  </>
                ) : (
                  "用这张"
                )}
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <section className={`cva-panel cva-panel-${variant}`} aria-label={`出图：${subject.title}`}>
      <div className="cva-panel-head">
        <div className="cva-panel-title">
          <span className="tag tag-gray">{subject.typeLabel}</span>
          <b className="cv-ellipsis" title={subject.title}>
            {subject.title}
          </b>
        </div>
        <div className="cva-panel-tools">
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm tap-target"
            aria-label={`放大编辑${promptLabel}`}
            title={`放大编辑${promptLabel}`}
            onClick={() => setExpanded(true)}
          >
            <Maximize2 size={14} />
          </button>
          {subject.kind === "look" && (
            <button
              type="button"
              className="btn btn-icon btn-ghost btn-sm tap-target"
              aria-label="造型详情"
              title="造型详情：挑定妆照、改名字、出现在哪几集"
              onClick={() => setDetailOpen(true)}
            >
              <Settings2 size={14} />
            </button>
          )}
          {onClose && (
            <button type="button" className="btn btn-icon btn-ghost btn-sm tap-target" aria-label="关闭" title="关闭" onClick={onClose}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <GrowTextarea
        className="cv-textarea cva-prompt"
        value={subject.prompt}
        onValueChange={setPrompt}
        placeholder={placeholder}
        aria-label={promptLabel}
        readOnly={readOnly}
        maxLength={4000}
      />

      {!subject.isText && (
        <>
          {docked ? (
            // docked：上传参考 / 已连的参考 / 候选图挤成一行横排（56px 小图，横向滚动），面板整体压在 ~300px 高
            <div className="cva-strip">
              <div className="cva-strip-group" aria-label="连进来的参考">
                {addRefButton}
                {refItems}
              </div>
              {versions.length > 0 && <span className="cva-strip-sep" aria-hidden />}
              {candList}
              {picker.input}
            </div>
          ) : (
            <>
              <div className="cva-refs" aria-label="连进来的参考">
                {refItems}
                {addRefButton}
                {picker.input}
              </div>
              {refs.length === 0 && <div className="cva-hint">没有参考图时只按描述画。</div>}
            </>
          )}
          {uploadError && (
            <div className="cv-error" role="alert">
              {uploadError}
            </div>
          )}

          <RunLine view={view} disabled={readOnly} onCancel={(id) => void cancel(id)} />

          {!docked && candList}

          <div className="cva-panel-foot">
            <label className="cva-field cva-field-model">
              <span className="cva-field-label">出图模型</span>
              <select
                className="cv-select"
                value={endpointId ?? ""}
                disabled={readOnly || models.length <= 1}
                onChange={(e) => pricing.setImageModelId(e.target.value)}
                aria-label="出图模型"
              >
                {models.length === 0 && <option value="">默认模型</option>}
                {models.map((m) => (
                  <option key={m.endpointId} value={m.endpointId}>
                    {m.name}（每张 {m.creditCost} 积分）
                  </option>
                ))}
              </select>
            </label>
            <label className="cva-field cva-field-ratio">
              <span className="cva-field-label">画幅</span>
              <select className="cv-select" value={ratio} disabled={readOnly} onChange={(e) => setRatio(e.target.value as CanvasImageRatio)} aria-label="画幅">
                {IMAGE_RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            {subject.kind === "look" && (
              <button type="button" className="btn btn-line btn-sm cva-traits-btn" disabled={readOnly} onClick={() => setTraitsOpen(true)}>
                <Palette size={14} />
                角色设计{nTraits ? ` · ${nTraits}` : ""}
              </button>
            )}
            <div className="cva-field cva-field-count">
              <span className="cva-field-label">出几张</span>
              <div className="cv-seg" role="group" aria-label="出几张">
                {IMAGE_COUNTS.map((n) => (
                  <button key={n} type="button" className={count === n ? "on" : ""} aria-pressed={count === n} disabled={readOnly} onClick={() => setCount(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-grad btn-sm cva-gen"
              disabled={!!disabledReason}
              aria-busy={busy || undefined}
              onClick={() => void generate()}
            >
              <Sparkles size={14} />
              生成
              <Cost value={pricing.ready ? price : null} />
            </button>
          </div>
          {/* 有没有字都占着一行（见头注释）：提示时有时无，面板就不会跟着变高变矮 */}
          <div className="cva-foot-note" data-testid="cva-foot-note">
            <Reason>{disabledReason}</Reason>
            {error && (
              <div className="cv-error" role="alert">
                {error}
              </div>
            )}
          </div>
        </>
      )}

      <CvaModal open={expanded} onClose={() => setExpanded(false)} label={promptLabel} className="cva-expand-dialog">
        <ModalHead title={`${subject.title} · ${promptLabel}`} onClose={() => setExpanded(false)} />
        <textarea
          className="cv-textarea cva-expand-text"
          value={subject.prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          aria-label={promptLabel}
          readOnly={readOnly}
          maxLength={4000}
        />
        <div className="cva-modal-foot">
          <span className="cv-count">{Array.from(subject.prompt).length} / 4000</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setExpanded(false)}>
            写好了
          </button>
        </div>
      </CvaModal>
      {subject.kind === "look" && <TraitsDialog lookId={subject.id} open={traitsOpen} onClose={() => setTraitsOpen(false)} />}
      {subject.kind === "look" && <LookDetailDialog lookId={subject.id} open={detailOpen} onClose={() => setDetailOpen(false)} />}
    </section>
  );
}

/** 生成状态一行：排队中（可停）/ 生成中 / 失败原因 / 已停下 / 参考图实际用上几张。 */
function RunLine({
  view,
  disabled,
  onCancel,
}: {
  view: ReturnType<typeof assetRunView>;
  disabled: boolean;
  onCancel: (runId: string) => void;
}) {
  if (view.pending) {
    return (
      <div className="cva-run" role="status" aria-live="polite">
        <Loader2 size={14} className="cv-spin" />
        <span className="cva-run-text">{view.queued ? "排队中" : "正在生成…"}</span>
        {view.queued && view.runId && (
          <button type="button" className="btn btn-line btn-sm" disabled={disabled} onClick={() => onCancel(view.runId!)} title="还在排队，停下来不扣积分">
            <Square size={11} /> 停止
          </button>
        )}
      </div>
    );
  }
  if (view.failed) {
    return (
      <div className="cva-run cva-run-failed" role="alert">
        没生成出来：{view.errorMessage}
      </div>
    );
  }
  if (view.canceled) return <div className="cva-hint">已经停下来了，没扣积分。</div>;
  const refs = view.status === "succeeded" ? view.refs : undefined;
  if (!refs) return null;
  const lines: string[] = [];
  if (refs.requested > 0 && refs.applied < refs.requested) lines.push(`连进来 ${refs.requested} 张参考图，上次用上了 ${refs.applied} 张。`);
  lines.push(...refs.notes.filter((n) => n.trim()));
  if (!lines.length) return null;
  return (
    <ul className="cva-notes" aria-label="上次生成的说明">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}
