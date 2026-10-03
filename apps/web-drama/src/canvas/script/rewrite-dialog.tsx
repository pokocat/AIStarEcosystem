"use client";

// 「重写 ▾」弹出的小层：写一句要求（可以不写，最多 200 字），说清会换掉什么，按钮上写价格。
// 它本身就是这次重写的确认（写清了会覆盖什么、花多少），点「重写」直接提交，不再叠第二个确认框。
import * as React from "react";
import { RotateCcw, X } from "lucide-react";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { Cost } from "./bits";
import { INSTRUCTION_MAX_CHARS, charCount } from "./script-ops";

export interface RewriteRequest {
  /** 弹层标题：「重写故事大纲」「重写第 2 集」。 */
  title: string;
  /** 会换掉什么（说后果）。 */
  consequence: string;
  cost: number | null;
  onSubmit: (instruction: string | undefined) => void;
}

export function RewriteDialog({ request, onClose }: { request: RewriteRequest | null; onClose: () => void }) {
  const open = !!request;
  const ref = React.useRef<HTMLFormElement | null>(null);
  useModalA11y(ref, onClose, open);
  const [text, setText] = React.useState("");
  const titleId = React.useId();
  const inputId = React.useId();

  React.useEffect(() => {
    if (open) setText("");
  }, [open]);

  if (!request) return null;
  const count = charCount(text.trim());
  const over = count > INSTRUCTION_MAX_CHARS;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (over) return;
    const instruction = text.trim() || undefined;
    onClose();
    request.onSubmit(instruction);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <form
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="card pop-in cvs-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="cvs-dialog-head">
          <div id={titleId} className="cvs-dialog-title">
            {request.title}
          </div>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" aria-label="关闭" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <label htmlFor={inputId} className="cv-field-label">
          想怎么改（可以不写）
        </label>
        <textarea
          id={inputId}
          className="cv-textarea cvs-dialog-input"
          rows={3}
          value={text}
          placeholder="比如：节奏再快一点，结尾留个悬念"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="cvs-dialog-count">
          <span className={over ? "cv-count over" : "cv-count"}>
            {count}/{INSTRUCTION_MAX_CHARS}
          </span>
        </div>
        <div className="cvs-dialog-note">{request.consequence}</div>
        <div className="cvs-dialog-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-grad" disabled={over} data-action="rewrite-submit">
            <RotateCcw size={14} /> 重写 <Cost value={request.cost} />
          </button>
        </div>
        {over && <div className="cvs-reason">要求最多 {INSTRUCTION_MAX_CHARS} 字，删短一点再重写。</div>}
      </form>
    </div>
  );
}
