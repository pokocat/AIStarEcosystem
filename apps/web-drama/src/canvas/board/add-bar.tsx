"use client";

// 画布底部中间：「加一个」（角色 / 场景 / 素材图 / 文字）+ 指针 / 抓手切换；以及加角色时输名字的弹窗。
import * as React from "react";
import { Hand, ImageUp, Loader2, Mountain, MousePointer2, Plus, Type, UserRound, X } from "lucide-react";
import type { CanvasCharacterRole } from "@ai-star-eco/types/drama-canvas";
import { RolePicker } from "@/canvas/assets";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { usePopover } from "./use-popover";

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

export type BoardMode = "pointer" | "hand";

export interface AddBarProps {
  mode: BoardMode;
  onMode: (m: BoardMode) => void;
  /** 只读时不给「加一个」（只留指针 / 抓手）。 */
  canEdit: boolean;
  uploading: boolean;
  onAddCharacter: () => void;
  onAddScene: () => void;
  onPickImage: (file: File) => void;
  onAddText: () => void;
}

export function AddBar(p: AddBarProps) {
  const pop = usePopover<HTMLDivElement>();
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const pick = (fn: () => void) => {
    pop.setOpen(false);
    fn();
  };
  return (
    <div className="cvb-addbar" role="toolbar" aria-label="加节点">
      {p.canEdit && (
        <div className="cvb-add" ref={pop.ref}>
          <button
            type="button"
            className="cvb-add-btn"
            aria-haspopup="menu"
            aria-expanded={pop.open}
            aria-busy={p.uploading || undefined}
            onClick={() => pop.setOpen(!pop.open)}
          >
            {p.uploading ? <Loader2 size={15} className="cv-spin" /> : <Plus size={15} />}
            {p.uploading ? "正在上传" : "加一个"}
          </button>
          {pop.open && (
            <div className="cvb-menu cvb-menu-up cvb-add-menu" role="menu">
              <button type="button" role="menuitem" className="cvb-menu-item" onClick={() => pick(p.onAddCharacter)}>
                <UserRound size={15} />
                角色
              </button>
              <button type="button" role="menuitem" className="cvb-menu-item" onClick={() => pick(p.onAddScene)}>
                <Mountain size={15} />
                场景
              </button>
              <button
                type="button"
                role="menuitem"
                className="cvb-menu-item"
                disabled={p.uploading}
                onClick={() => pick(() => fileRef.current?.click())}
              >
                <ImageUp size={15} />
                素材图（上传一张）
              </button>
              <button type="button" role="menuitem" className="cvb-menu-item" onClick={() => pick(p.onAddText)}>
                <Type size={15} />
                文字
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) p.onPickImage(f);
            }}
          />
        </div>
      )}
      <div className="cvb-modes" role="radiogroup" aria-label="鼠标模式">
        <button
          type="button"
          role="radio"
          aria-checked={p.mode === "pointer"}
          className={cx("cvb-tool", p.mode === "pointer" && "is-on")}
          aria-label="指针"
          title="指针：拖动卡片、连线"
          onClick={() => p.onMode("pointer")}
        >
          <MousePointer2 size={16} />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={p.mode === "hand"}
          className={cx("cvb-tool", p.mode === "hand" && "is-on")}
          aria-label="抓手"
          title="抓手：按住拖动画布"
          onClick={() => p.onMode("hand")}
        >
          <Hand size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * 加一个角色：输名字、选分级（同名的角色已经有了就不让加 —— 拆角色时按名字合并，重名会乱）。
 * 分级每次打开时重置成 defaultRole（调用方按 defaultNewRole 算：还没有主要角色就是主要角色，否则配角）。
 */
export function AddCharacterDialog({
  open,
  existingNames,
  defaultRole,
  onClose,
  onSubmit,
}: {
  open: boolean;
  existingNames: readonly string[];
  defaultRole: CanvasCharacterRole;
  onClose: () => void;
  onSubmit: (name: string, role: CanvasCharacterRole) => void;
}) {
  const ref = React.useRef<HTMLFormElement | null>(null);
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<CanvasCharacterRole>(defaultRole);
  useModalA11y(ref, onClose, open);
  const defaultRoleRef = React.useRef(defaultRole);
  defaultRoleRef.current = defaultRole;
  React.useEffect(() => {
    if (!open) return;
    setName("");
    setRole(defaultRoleRef.current);
  }, [open]);
  if (!open) return null;
  const trimmed = name.trim();
  const dup = !!trimmed && existingNames.includes(trimmed);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || dup) return;
    onSubmit(trimmed, role);
  };
  return (
    <div className="overlay" onClick={onClose}>
      <form
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="加一个角色"
        tabIndex={-1}
        className="card pop-in cv-rename-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="cv-style-head">
          <div className="cv-style-title">加一个角色</div>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="关闭">
            <X size={15} />
          </button>
        </div>
        <input
          autoFocus
          className="cv-input"
          value={name}
          maxLength={20}
          placeholder="角色名"
          aria-label="角色名"
          onChange={(e) => setName(e.target.value)}
        />
        <RolePicker value={role} onChange={setRole} />
        {dup ? (
          <div className="cv-error">已经有叫「{trimmed}」的角色了，换个名字，或者给它加一个造型。</div>
        ) : (
          <div className="cv-hint">加好后带一个基础造型，选中它就能写外貌描述、出定妆照。</div>
        )}
        <div className="cv-style-foot">
          <span className="grow" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!trimmed || dup}>
            加上
          </button>
        </div>
      </form>
    </div>
  );
}
