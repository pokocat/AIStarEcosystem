"use client";

// 角色设计：六个页签的标签点选（真源 docs/drama-canvas-plan.md §1.5，标签清单在 constants/canvas-traits.ts）。
// 点选只改弹窗里的草稿；「写进描述」时一次写 look.traits + 外貌描述里受管理的那一行「角色设计：……」
// （traits.ts applyTraits：有就替换、没有就追加在末尾、全清空就删掉，别的段落不动）。
import * as React from "react";
import { Check } from "lucide-react";
import { CANVAS_TRAIT_TABS, type TraitGroup } from "@/constants/canvas-traits";
import { findLook, lookLabel, mapLook, useCanvasDoc } from "@/canvas/core";
import { READ_ONLY_REASON, Reason } from "./bits";
import { CvaModal, ModalHead } from "./inputs";
import { applyTraits, normalizeTraits, toggleTrait, traitsLine, type Traits } from "./traits";

export interface TraitsDialogProps {
  lookId: string;
  open: boolean;
  onClose: () => void;
}

export function TraitsDialog({ lookId, open, onClose }: TraitsDialogProps) {
  const { doc } = useCanvasDoc();
  const hit = findLook(doc, lookId);
  // 只在打开时挂上：每次打开都从造型当前的勾选状态开始（首帧就是对的，不闪一下空的）
  if (!open || !hit) return null;
  return <TraitsBody key={lookId} lookId={lookId} onClose={onClose} />;
}

function initialCustom(t: Traits): Record<string, string> {
  const c: Record<string, string> = {};
  for (const g of CANVAS_TRAIT_TABS.flatMap((x) => x.groups)) {
    if (!g.custom) continue;
    const v = t[g.name]?.[0];
    if (v && !g.options.some((o) => o.label === v)) c[g.name] = v;
  }
  return c;
}

function TraitsBody({ lookId, onClose }: { lookId: string; onClose: () => void }) {
  const { doc, update, readOnly } = useCanvasDoc();
  const hit = findLook(doc, lookId);
  const [tab, setTab] = React.useState(CANVAS_TRAIT_TABS[0].name);
  const [draft, setDraft] = React.useState<Traits>(() => normalizeTraits(hit?.look.traits));
  const [custom, setCustom] = React.useState<Record<string, string>>(() => initialCustom(normalizeTraits(hit?.look.traits)));

  if (!hit) return null;
  const current = CANVAS_TRAIT_TABS.find((t) => t.name === tab) ?? CANVAS_TRAIT_TABS[0];
  const line = traitsLine(draft);
  const countIn = (groups: TraitGroup[]) => groups.reduce((n, g) => n + (draft[g.name]?.length ?? 0), 0);

  const save = () => {
    if (readOnly) return;
    update((d) =>
      mapLook(d, lookId, (l) => {
        const next = applyTraits(l, draft);
        return { ...l, traits: next.traits, prompt: next.prompt };
      }),
    );
    onClose();
  };

  const setCustomValue = (g: TraitGroup, value: string) => {
    setCustom((c) => ({ ...c, [g.name]: value }));
    setDraft((d) => {
      const out = { ...d };
      const v = value.trim();
      if (v) out[g.name] = [v];
      else if (out[g.name]?.every((x) => !g.options.some((o) => o.label === x))) delete out[g.name];
      return out;
    });
  };

  return (
    <CvaModal open onClose={onClose} label="角色设计" className="cva-traits-dialog">
      <ModalHead title={`角色设计 · ${lookLabel(hit.character, hit.look)}`} onClose={onClose} />
      <div className="cva-traits-tabs" role="tablist" aria-label="角色设计分类">
        {CANVAS_TRAIT_TABS.map((t) => {
          const n = countIn(t.groups);
          return (
            <button
              key={t.name}
              type="button"
              role="tab"
              aria-selected={t.name === current.name}
              className={`cva-traits-tab${t.name === current.name ? " on" : ""}`}
              onClick={() => setTab(t.name)}
            >
              {t.name}
              {n > 0 && <span className="cva-traits-n num">{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="cva-traits-body" role="tabpanel" aria-label={current.name}>
        {current.groups.map((g) => {
          const sel = draft[g.name] ?? [];
          return (
            <div key={g.name} className="cva-traits-group">
              <div className="cva-traits-gname">
                {g.name}
                <span className="cva-traits-mode">{g.multi ? "可多选" : "选一个"}</span>
              </div>
              <div className="cva-traits-opts">
                {g.options.map((o) => {
                  const on = sel.includes(o.label);
                  return (
                    <button
                      key={o.label}
                      type="button"
                      className={`chip cva-trait${on ? " on" : ""}${o.swatch ? " cva-trait-swatch" : ""}`}
                      aria-pressed={on}
                      disabled={readOnly}
                      onClick={() => {
                        setDraft((d) => toggleTrait(d, g.name, o.label));
                        if (g.custom) setCustom((c) => ({ ...c, [g.name]: "" }));
                      }}
                    >
                      {o.swatch && <span className="cva-swatch" style={{ background: o.swatch }} aria-hidden />}
                      {on && !o.swatch && <Check size={12} />}
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {g.custom && (
                <input
                  className="cv-input cva-trait-custom"
                  value={custom[g.name] ?? ""}
                  maxLength={40}
                  placeholder={g.custom.placeholder}
                  aria-label={`自己写${g.name}`}
                  disabled={readOnly}
                  onChange={(e) => setCustomValue(g, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="cva-traits-preview">
        <div className="cva-field-label">会写进外貌描述的一行</div>
        <div className="cva-traits-line">{line ?? "还没选。都不选的话，外貌描述里原来那行「角色设计：」会被删掉。"}</div>
      </div>
      <div className="cva-modal-foot">
        <button type="button" className="btn btn-ghost btn-sm" disabled={readOnly || !line} onClick={() => { setDraft({}); setCustom({}); }}>
          全部清掉
        </button>
        <span className="cva-spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          取消
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={readOnly} onClick={save}>
          写进描述
        </button>
      </div>
      <Reason>{readOnly ? READ_ONLY_REASON : null}</Reason>
    </CvaModal>
  );
}
