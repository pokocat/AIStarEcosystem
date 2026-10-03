"use client";

// 全剧风格浮层（v0.198，docs/drama-canvas-plan.md §2.2）：左边分类、右边格子（色带 + 名字）。
// 新建页与画布顶栏的风格 chip 共用。选「自定义」时要写一句风格描述。
import * as React from "react";
import { Check, X } from "lucide-react";
import type { CanvasStyle } from "@ai-star-eco/types/drama-canvas";
import { useModalA11y } from "@/lib/use-modal-a11y";
import {
  CANVAS_STYLES,
  CANVAS_STYLE_CATEGORIES,
  CUSTOM_STYLE_ID,
  CUSTOM_STYLE_MAX,
  findCanvasStyle,
  toCanvasStyle,
  type CanvasStyleCategory,
} from "@/constants/canvas-styles";

export interface StylePickerDialogProps {
  open: boolean;
  value: CanvasStyle;
  onClose: () => void;
  onChange: (style: CanvasStyle) => void;
  /** 顶栏里改风格时的提醒（已经出过的图不会跟着变）。 */
  note?: React.ReactNode;
}

export function StylePickerDialog({ open, value, onClose, onChange, note }: StylePickerDialogProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  useModalA11y(panelRef, onClose, open);
  const [cat, setCat] = React.useState<"all" | CanvasStyleCategory>("all");
  const [selected, setSelected] = React.useState(value.id);
  const [custom, setCustom] = React.useState(value.id === CUSTOM_STYLE_ID ? value.prompt : "");

  // 只在打开的那一下按当前风格回显；开着的时候文档别处有变化（如生成结果合进来）不要把用户正在挑的冲掉
  const valueRef = React.useRef(value);
  valueRef.current = value;
  React.useEffect(() => {
    if (!open) return;
    const v = valueRef.current;
    setSelected(findCanvasStyle(v.id) ? v.id : CANVAS_STYLES[0].id);
    setCustom(v.id === CUSTOM_STYLE_ID ? v.prompt : "");
  }, [open]);

  if (!open) return null;
  const list = CANVAS_STYLES.filter((s) => cat === "all" || s.category === cat);
  const isCustom = selected === CUSTOM_STYLE_ID;
  const customLen = Array.from(custom.trim()).length;
  const blocked = isCustom && customLen === 0;

  const apply = () => {
    const opt = findCanvasStyle(selected);
    if (!opt || blocked) return;
    onChange(toCanvasStyle(opt, custom));
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="选全剧风格"
        tabIndex={-1}
        className="card pop-in cv-style-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cv-style-head">
          <div className="cv-style-title">全剧风格</div>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="关闭">
            <X size={15} />
          </button>
        </div>
        <div className="cv-style-body">
          <div className="cv-style-cats" role="tablist" aria-label="风格分类">
            {CANVAS_STYLE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={cat === c.key}
                className={`cv-style-cat${cat === c.key ? " on" : ""}`}
                onClick={() => setCat(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="cv-style-grid">
            {list.map((s) => {
              const on = s.id === selected;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`cv-style-tile${on ? " on" : ""}`}
                  aria-pressed={on}
                  onClick={() => setSelected(s.id)}
                  title={s.prompt || undefined}
                >
                  <span className="cv-style-band" style={{ background: `linear-gradient(120deg, ${s.band[0]}, ${s.band[1]})` }}>
                    {on && (
                      <span className="cv-style-check">
                        <Check size={12} />
                      </span>
                    )}
                  </span>
                  <span className="cv-style-name">{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        {isCustom && (
          <div className="cv-style-custom">
            <label htmlFor="cv-style-custom" className="cv-field-label">
              用一句话写你要的风格
            </label>
            <textarea
              id="cv-style-custom"
              className="cv-textarea"
              rows={2}
              maxLength={CUSTOM_STYLE_MAX}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="比如：冷色调的港风夜景，胶片颗粒，人物边缘有一点逆光"
            />
            <div className="cv-hint">{customLen} / {CUSTOM_STYLE_MAX} 字</div>
          </div>
        )}
        {note && <div className="cv-hint cv-style-note">{note}</div>}
        <div className="cv-style-foot">
          {blocked && <span className="cv-hint">先写一句风格描述</span>}
          <span className="grow" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={apply} disabled={blocked}>
            用这个风格
          </button>
        </div>
      </div>
    </div>
  );
}

/** 风格按钮（显示当前风格，点开浮层）。 */
export function StylePickerButton({
  value,
  onChange,
  disabled,
  className = "chip",
  note,
}: {
  value: CanvasStyle;
  onChange: (s: CanvasStyle) => void;
  disabled?: boolean;
  className?: string;
  note?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const opt = findCanvasStyle(value.id);
  return (
    <>
      <button
        type="button"
        className={`${className} cv-style-trigger`}
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={value.prompt ? `全剧风格：${value.prompt}` : "全剧风格"}
      >
        {opt && <span className="cv-style-dot" style={{ background: `linear-gradient(120deg, ${opt.band[0]}, ${opt.band[1]})` }} />}
        <span className="cv-ellipsis">风格：{value.name || "无风格"}</span>
      </button>
      <StylePickerDialog open={open} value={value} onClose={() => setOpen(false)} onChange={onChange} note={note} />
    </>
  );
}
