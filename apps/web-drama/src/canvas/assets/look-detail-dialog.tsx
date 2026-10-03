"use client";

// ─────────────────────────────────────────────────────────────────────────────
// canvas/assets/look-detail-dialog.tsx —— 造型详情（v0.198，props 见 canvas/core/contract.ts LookDetailDialogProps）。
// 画布（造型卡的 ···）和列表 / 手机抽屉共用。
//
//   定妆照：候选里挑「用这张」、上传一张（直接放进这个造型的候选并选中，不建素材图、不连线）
//   角色：下拉改挂到别的角色（= 造型挪过去；原角色一个造型都不剩时整个角色删掉，先确认）
//   造型名 · 出现集数（多选，集号来自剧本）· 外貌描述（可打开角色设计）· 删除这个造型（确认）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { Check, ImagePlus, Loader2, Palette, Trash2 } from "lucide-react";
import { CanvasApi } from "@/api/canvas";
import {
  RunTarget,
  findLook,
  lookLabel,
  mapLook,
  pickedImage,
  removeLook,
  setPicked,
  useCanvasDoc,
  type LookDetailDialogProps,
} from "@/canvas/core";
import { CanvasImage } from "@/canvas/shell";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { aiErrorMessage } from "@/lib/ai-error";
import { READ_ONLY_REASON, Reason, ROLE_LABEL } from "./bits";
import { CvaModal, GrowTextarea, ModalHead, NOT_IMAGE_MESSAGE, isImageFile, useImagePicker } from "./inputs";
import { episodeOptions, moveEmptiesCharacter, moveLook, toggleEpisode } from "./list-ops";
import { traitCount } from "./traits";
import { TraitsDialog } from "./traits-dialog";

export function LookDetailDialog({ lookId, open, onClose }: LookDetailDialogProps) {
  const { doc, update, readOnly, getDoc } = useCanvasDoc();
  const hit = findLook(doc, lookId);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [traitsOpen, setTraitsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  const onPick = async (file: File) => {
    if (!isImageFile(file)) {
      setError(NOT_IMAGE_MESSAGE);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const asset = await CanvasApi.uploadImage(file, "人物");
      update((d) =>
        mapLook(d, lookId, (l) => ({
          ...l,
          images: { versions: [asset, ...l.images.versions.filter((v) => v.key !== asset.key)], pickedKey: asset.key },
        })),
      );
    } catch (e) {
      setError(aiErrorMessage(e, "图没传上去，请重试。"));
    } finally {
      setUploading(false);
    }
  };
  const picker = useImagePicker((f) => void onPick(f), "上传定妆照");

  // 造型被删掉（或挪走后原弹窗还开着）时：id 还在就继续显示（挪到别的角色下 id 不变），不在了就关掉
  React.useEffect(() => {
    if (open && !hit) onClose();
  }, [open, hit, onClose]);
  if (!hit) return null;

  const { character, look } = hit;
  const label = lookLabel(character, look);
  const picked = pickedImage(look.images);
  const eps = episodeOptions(doc);
  const nTraits = traitCount(look.traits ?? {});
  const rt = RunTarget.look(lookId);

  const moveTo = async (toId: string) => {
    if (toId === character.id) return;
    const to = getDoc().characters.find((c) => c.id === toId);
    if (!to) return;
    if (moveEmptiesCharacter(getDoc(), lookId)) {
      const ok = await dramaConfirm({
        title: `挪到「${to.name}」下面？`,
        body: `「${character.name}」只有这一个造型，挪走之后「${character.name}」这个角色会被删掉。片段里 @ 到这个造型的地方不受影响。`,
        confirmLabel: "挪过去",
        tone: "danger",
      });
      if (!ok) return;
    }
    update((d) => moveLook(d, lookId, toId));
  };

  const remove = async () => {
    const last = character.looks.length <= 1;
    const ok = await dramaConfirm({
      title: last ? `删掉「${character.name}」？` : `删掉造型「${look.name}」？`,
      body: last
        ? `这是「${character.name}」唯一的造型，删掉后这个角色也会一起删掉，连到它的线也会断开。片段里 @ 到它的地方会标红。`
        : `它的定妆照和连线会一起删掉。片段里 @ 到它的地方会标红。`,
      confirmLabel: "删掉",
      tone: "danger",
    });
    if (!ok) return;
    update((d) => removeLook(d, lookId));
    onClose();
  };

  return (
    <CvaModal open={open} onClose={onClose} label="造型详情" className="cva-detail-dialog">
      <ModalHead title={`造型详情 · ${label}`} onClose={onClose} />
      <div className="cva-detail">
        <div className="cva-detail-media">
          <div className="cva-detail-main">
            <CanvasImage
              asset={picked}
              alt={`${label} 定妆照`}
              fit="contain"
              className="cva-detail-img"
              placeholder={<div className="cva-detail-img cva-detail-empty">还没有定妆照</div>}
            />
          </div>
          {look.images.versions.length > 1 && (
            <div className="cva-detail-cands" role="list" aria-label="候选定妆照">
              {look.images.versions.map((v, i) => {
                const on = v.key === picked?.key;
                return (
                  <button
                    key={v.key}
                    type="button"
                    role="listitem"
                    className={`cva-cand cva-cand-look${on ? " on" : ""}`}
                    aria-pressed={on}
                    disabled={readOnly && !on}
                    title={on ? "正在用这张" : "用这张"}
                    onClick={() => !on && update((d) => setPicked(d, rt, v.key))}
                  >
                    <CanvasImage asset={v} alt={`${label} 候选 ${i + 1}`} className="cva-cand-img" />
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
          )}
          <button type="button" className="btn btn-line btn-sm" onClick={picker.open} disabled={readOnly || uploading} aria-busy={uploading || undefined}>
            {uploading ? <Loader2 size={14} className="cv-spin" /> : <ImagePlus size={14} />}
            {uploading ? "上传中…" : "上传一张定妆照"}
          </button>
          {picker.input}
          {error && (
            <div className="cv-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="cva-detail-form">
          <label className="cva-form-row">
            <span className="cva-field-label">角色</span>
            <select
              className="cv-select"
              value={character.id}
              disabled={readOnly || doc.characters.length < 2}
              onChange={(e) => void moveTo(e.target.value)}
              aria-label="属于哪个角色"
            >
              {doc.characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{ROLE_LABEL[c.role]}）
                </option>
              ))}
            </select>
            {doc.characters.length < 2 && <span className="cva-hint">只有一个角色，没有别的可挂。</span>}
            {doc.characters.length >= 2 && <span className="cva-hint">换一个角色 = 把这个造型挪到那个角色下面。</span>}
          </label>

          <label className="cva-form-row">
            <span className="cva-field-label">造型名</span>
            <input
              className="cv-input"
              value={look.name}
              maxLength={24}
              readOnly={readOnly}
              placeholder="如「基础造型」「学生时期」"
              onChange={(e) => {
                const v = e.target.value;
                update((d) => mapLook(d, lookId, (l) => (l.name === v ? l : { ...l, name: v })));
              }}
              aria-label="造型名"
            />
          </label>

          <div className="cva-form-row">
            <span className="cva-field-label">出现在哪几集</span>
            {eps.length ? (
              <div className="cva-eps" role="group" aria-label="出现在哪几集">
                {eps.map((n) => {
                  const on = look.episodes.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`chip${on ? " on" : ""}`}
                      aria-pressed={on}
                      disabled={readOnly}
                      onClick={() => update((d) => mapLook(d, lookId, (l) => ({ ...l, episodes: toggleEpisode(l.episodes, n) })))}
                    >
                      第 {n} 集
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="cva-hint">剧本里还没有分集。</span>
            )}
          </div>

          <div className="cva-form-row">
            <div className="cva-form-label-row">
              <span className="cva-field-label">外貌描述</span>
              <button type="button" className="btn btn-line btn-sm" disabled={readOnly} onClick={() => setTraitsOpen(true)}>
                <Palette size={13} />
                角色设计{nTraits ? ` · ${nTraits}` : ""}
              </button>
            </div>
            <GrowTextarea
              className="cv-textarea cva-prompt cva-detail-prompt"
              value={look.prompt}
              readOnly={readOnly}
              maxLength={4000}
              placeholder="基本信息 / 面部特征 / 服饰装备 / 配饰 / 姿态构图 / 光影渲染，一行写一项。"
              aria-label="外貌描述"
              onValueChange={(v) => update((d) => mapLook(d, lookId, (l) => (l.prompt === v ? l : { ...l, prompt: v })))}
            />
          </div>

          <div className="cva-detail-foot">
            <button type="button" className="btn btn-ghost btn-sm cva-danger" disabled={readOnly} onClick={() => void remove()}>
              <Trash2 size={13} />
              删除这个造型
            </button>
            <span className="cva-spacer" />
            <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
              好了
            </button>
          </div>
          <Reason>{readOnly ? READ_ONLY_REASON : null}</Reason>
        </div>
      </div>
      <TraitsDialog lookId={lookId} open={traitsOpen} onClose={() => setTraitsOpen(false)} />
    </CvaModal>
  );
}
