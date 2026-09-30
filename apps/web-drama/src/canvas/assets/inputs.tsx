"use client";

// 角色和场景页的输入小件：高度跟着内容走的文本框、选图片文件的按钮、输名字的弹窗、右侧 / 底部抽屉的外壳。
import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModalA11y } from "@/lib/use-modal-a11y";

// ── 高度跟着内容走的文本框（上限由 CSS max-height 管，超出在框里滚）─────────────

export type GrowTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

function fit(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = `${el.scrollHeight + Math.max(0, border)}px`;
}

export function GrowTextarea({ value, onValueChange, ...rest }: GrowTextareaProps) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  React.useLayoutEffect(() => {
    if (ref.current) fit(ref.current);
  }, [value]);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit(el);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <textarea ref={ref} rows={2} {...rest} value={value} onChange={(e) => onValueChange(e.target.value)} />;
}

// ── 选一张图片 ───────────────────────────────────────────────────────────────

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
export const NOT_IMAGE_MESSAGE = "只能传图片（jpg、png、webp）。";

/** 一个隐藏的 <input type=file>：open() 打开选择框，选好后回调 onPick(file)。 */
export function useImagePicker(onPick: (file: File) => void, label: string) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  const cb = React.useRef(onPick);
  cb.current = onPick;
  const open = React.useCallback(() => ref.current?.click(), []);
  const input = (
    <input
      ref={ref}
      type="file"
      accept={IMAGE_ACCEPT}
      hidden
      aria-label={label}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // 同一个文件再选一次也要触发
        if (file) cb.current(file);
      }}
    />
  );
  return { open, input };
}

export const isImageFile = (file: File) => /^image\/(png|jpe?g|webp)$/i.test(file.type);

// ── 弹窗外壳（遮罩 + 焦点圈定 + Esc）──────────────────────────────────────────

/**
 * 弹窗 / 抽屉一律挂到 body 上：出图面板可能停在画布里（React Flow 的容器带 transform，
 * 里面的 position:fixed 会被它困住）。层级：抽屉 70 < 弹窗 75 < 全站确认框（.overlay 80），
 * 弹窗里再弹 dramaConfirm 时确认框在最上面。
 */
function toBody(node: React.ReactNode) {
  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}

/**
 * 居中弹窗。遮罩用 .cva-overlay（单列 minmax(0,1fr) 网格，§8.0.1 ⑫：不写轨道的话弹窗的定宽会把轨道撑开，
 * 手机上照样冲出屏幕）。面板宽度由 className 给。
 */
export function CvaModal({
  open,
  onClose,
  label,
  className,
  children,
  zIndex,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
  zIndex?: number;
}) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  useModalA11y(panelRef, onClose, open);
  if (!open) return null;
  return toBody(
    <div
      className="cva-overlay"
      onClick={(e) => {
        // 挂在 body 上但 React 事件仍沿组件树往上冒（如冒到画布节点上），这里截住
        e.stopPropagation();
        onClose();
      }}
      style={zIndex != null ? { zIndex } : undefined}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={["card pop-in cva-modal", className].filter(Boolean).join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
  );
}

/** 弹窗标题行（标题 + 关闭）。 */
export function ModalHead({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="cva-modal-head">
      <div className="cva-modal-title">{title}</div>
      {children}
      <button type="button" className="btn btn-icon btn-ghost btn-sm tap-target" aria-label="关闭" title="关闭" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  );
}

/** 抽屉：桌面从右边滑出（520 宽），≤720 是从底部升起的整宽面板。 */
export function CvaDrawer({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  useModalA11y(panelRef, onClose, open);
  if (!open) return null;
  return toBody(
    <div
      className="cva-drawer-mask"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="cva-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
  );
}

// ── 输名字 ───────────────────────────────────────────────────────────────────

export function NameDialog({
  open,
  title,
  placeholder,
  confirmLabel,
  initial = "",
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  placeholder: string;
  confirmLabel: string;
  initial?: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = React.useState(initial);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    setName(initial);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, initial]);
  const value = name.trim();
  const submit = () => {
    if (!value) return;
    onConfirm(value);
  };
  return (
    <CvaModal open={open} onClose={onClose} label={title} className="cva-name-dialog">
      <ModalHead title={title} onClose={onClose} />
      <form
        className="cva-name-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          className="cv-input"
          value={name}
          maxLength={40}
          placeholder={placeholder}
          aria-label={title}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="cva-modal-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!value}>
            {confirmLabel}
          </button>
        </div>
        {!value && <div className="cva-reason">先写个名字。</div>}
      </form>
    </CvaModal>
  );
}
