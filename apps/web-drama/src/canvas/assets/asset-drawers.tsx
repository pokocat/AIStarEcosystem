"use client";

// 列表里点卡片打开的抽屉（手机上点角色 / 场景卡、任何宽度点素材卡）：
//   角色：改名、分级、选哪个造型 → 这个造型的出图面板（inline，面板里有「造型详情」）；加一个造型；删掉角色
//   场景：改名、出现在哪几集、出图面板；删掉场景
//   素材：改名、出图面板（文字素材就是正文编辑）；删掉素材
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CanvasCharacterRole } from "@ai-star-eco/types/drama-canvas";
import {
  addLook,
  findCharacter,
  findMaterial,
  findScene,
  mapMaterial,
  mapScene,
  removeCharacter,
  removeMaterial,
  removeScene,
  useCanvasDoc,
} from "@/canvas/core";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { AssetGenPanel } from "./asset-gen-panel";
import { READ_ONLY_REASON, Reason, ROLE_LABEL, ROLE_ORDER, useNarrow } from "./bits";
import { CvaDrawer, ModalHead } from "./inputs";
import { episodeOptions, toggleEpisode } from "./list-ops";

export type DrawerTarget = { kind: "character" | "scene" | "material"; id: string; lookId?: string };

export function AssetDrawer({ target, onClose }: { target: DrawerTarget | null; onClose: () => void }) {
  const title = target?.kind === "character" ? "角色" : target?.kind === "scene" ? "场景" : "素材";
  return (
    <CvaDrawer open={!!target} onClose={onClose} label={title}>
      {target?.kind === "character" && <CharacterBody id={target.id} initialLookId={target.lookId} onClose={onClose} />}
      {target?.kind === "scene" && <SceneBody id={target.id} onClose={onClose} />}
      {target?.kind === "material" && <MaterialBody id={target.id} onClose={onClose} />}
    </CvaDrawer>
  );
}

function useCloseWhenGone(gone: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);
}

function NameInput({ value, onChange, label, readOnly }: { value: string; onChange: (v: string) => void; label: string; readOnly: boolean }) {
  return (
    <label className="cva-form-row">
      <span className="cva-field-label">{label}</span>
      <input className="cv-input" value={value} maxLength={24} readOnly={readOnly} aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function CharacterBody({ id, initialLookId, onClose }: { id: string; initialLookId?: string; onClose: () => void }) {
  const { doc, update, readOnly } = useCanvasDoc();
  const c = findCharacter(doc, id);
  const [lookId, setLookId] = React.useState<string | undefined>(initialLookId);
  useCloseWhenGone(!c, onClose);
  if (!c) return null;
  const current = c.looks.find((l) => l.id === lookId) ?? c.looks[0];

  const del = async () => {
    const ok = await dramaConfirm({
      title: `删掉「${c.name}」？`,
      body: `${c.looks.length} 个造型和它们的定妆照会一起删掉，连到它们的线也会断开。片段里 @ 到它们的地方会标红。`,
      confirmLabel: "删掉",
      tone: "danger",
    });
    if (!ok) return;
    update((d) => removeCharacter(d, id));
    onClose();
  };

  return (
    <>
      <ModalHead title={c.name || "角色"} onClose={onClose} />
      <div className="cva-drawer-body">
        <div className="cva-drawer-row2">
          <NameInput
            label="角色名"
            value={c.name}
            readOnly={readOnly}
            onChange={(v) => update((d) => ({ ...d, characters: d.characters.map((x) => (x.id === id && x.name !== v ? { ...x, name: v } : x)) }))}
          />
          <label className="cva-form-row">
            <span className="cva-field-label">分级</span>
            <select
              className="cv-select"
              value={c.role}
              disabled={readOnly}
              aria-label="分级"
              onChange={(e) => {
                const role = e.target.value as CanvasCharacterRole;
                update((d) => ({ ...d, characters: d.characters.map((x) => (x.id === id ? { ...x, role } : x)) }));
              }}
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {c.bio && <p className="cva-bio">{c.bio}</p>}
        <div className="cva-form-row">
          <span className="cva-field-label">造型</span>
          <div className="cva-look-tabs" role="tablist" aria-label="造型">
            {c.looks.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={l.id === current?.id}
                className={`chip${l.id === current?.id ? " on" : ""}`}
                onClick={() => setLookId(l.id)}
                title={l.name}
              >
                <span className="cv-ellipsis">{l.name || "未命名造型"}</span>
              </button>
            ))}
            <button
              type="button"
              className="chip"
              disabled={readOnly}
              onClick={() => {
                let next = "";
                update((d) => {
                  const r = addLook(d, id);
                  next = r.lookId;
                  return r.doc;
                });
                if (next) setLookId(next);
              }}
            >
              <Plus size={12} /> 加一个造型
            </button>
          </div>
        </div>
        {current && <AssetGenPanel target={{ kind: "look", id: current.id }} variant="inline" />}
        <div className="cva-drawer-foot">
          <button type="button" className="btn btn-ghost btn-sm cva-danger" disabled={readOnly} onClick={() => void del()}>
            <Trash2 size={13} /> 删掉这个角色
          </button>
        </div>
        <Reason>{readOnly ? READ_ONLY_REASON : null}</Reason>
      </div>
    </>
  );
}

function SceneBody({ id, onClose }: { id: string; onClose: () => void }) {
  const { doc, update, readOnly } = useCanvasDoc();
  const s = findScene(doc, id);
  useCloseWhenGone(!s, onClose);
  if (!s) return null;
  const eps = episodeOptions(doc);
  const del = async () => {
    const ok = await dramaConfirm({
      title: `删掉「${s.name}」？`,
      body: "场景图和连到它的线会一起删掉。片段里 @ 到它的地方会标红。",
      confirmLabel: "删掉",
      tone: "danger",
    });
    if (!ok) return;
    update((d) => removeScene(d, id));
    onClose();
  };
  return (
    <>
      <ModalHead title={s.name || "场景"} onClose={onClose} />
      <div className="cva-drawer-body">
        <NameInput label="场景名" value={s.name} readOnly={readOnly} onChange={(v) => update((d) => mapScene(d, id, (x) => (x.name === v ? x : { ...x, name: v })))} />
        <div className="cva-form-row">
          <span className="cva-field-label">出现在哪几集</span>
          {eps.length ? (
            <div className="cva-eps" role="group" aria-label="出现在哪几集">
              {eps.map((n) => {
                const on = s.episodes.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    className={`chip${on ? " on" : ""}`}
                    aria-pressed={on}
                    disabled={readOnly}
                    onClick={() => update((d) => mapScene(d, id, (x) => ({ ...x, episodes: toggleEpisode(x.episodes, n) })))}
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
        <AssetGenPanel target={{ kind: "scene", id }} variant="inline" />
        <div className="cva-drawer-foot">
          <button type="button" className="btn btn-ghost btn-sm cva-danger" disabled={readOnly} onClick={() => void del()}>
            <Trash2 size={13} /> 删掉这个场景
          </button>
        </div>
        <Reason>{readOnly ? READ_ONLY_REASON : null}</Reason>
      </div>
    </>
  );
}

function MaterialBody({ id, onClose }: { id: string; onClose: () => void }) {
  const { doc, update, readOnly } = useCanvasDoc();
  const m = findMaterial(doc, id);
  const narrow = useNarrow();
  useCloseWhenGone(!m, onClose);
  if (!m) return null;
  const uses = doc.board.edges.filter((e) => e.source === id).length;
  const del = async () => {
    const ok = await dramaConfirm({
      title: `删掉「${m.name}」？`,
      body: uses ? `它正给 ${uses} 张卡片当参考，删掉后这些连线也会断开。` : "删掉之后找不回来。",
      confirmLabel: "删掉",
      tone: "danger",
    });
    if (!ok) return;
    update((d) => removeMaterial(d, id));
    onClose();
  };
  return (
    <>
      <ModalHead title={m.name || "素材"} onClose={onClose} />
      <div className="cva-drawer-body">
        <NameInput label="名字" value={m.name} readOnly={readOnly} onChange={(v) => update((d) => mapMaterial(d, id, (x) => (x.name === v ? x : { ...x, name: v })))} />
        <p className="cva-hint">
          {m.kind === "text" ? "文字连给哪张卡片，那张卡片出图时就把这段话拼进描述里。" : uses ? `正给 ${uses} 张卡片当参考。` : "还没连给谁。"}
          {narrow ? "连线要在电脑上打开画布拖。" : "连线在「画布」里拖一条过去。"}
        </p>
        <AssetGenPanel target={{ kind: "material", id }} variant="inline" />
        <div className="cva-drawer-foot">
          <button type="button" className="btn btn-ghost btn-sm cva-danger" disabled={readOnly} onClick={() => void del()}>
            <Trash2 size={13} /> 删掉这个素材
          </button>
        </div>
        <Reason>{readOnly ? READ_ONLY_REASON : null}</Reason>
      </div>
    </>
  );
}
