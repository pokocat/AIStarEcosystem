"use client";

// 修改记录：每次「通过」或 AI 重写前自动存的版本（最多 10 版，最新的在最上面）。
// 「恢复到这一版」先确认；恢复前 core 会把现在的样子也存一版（restoreScriptVersion）。
import * as React from "react";
import { History, X } from "lucide-react";
import { formatDateTime } from "@ai-star-eco/api-client";
import type { CanvasScriptVersion } from "@ai-star-eco/types/drama-canvas";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { versionSummary } from "./script-ops";

export function HistoryDialog({
  open,
  versions,
  readOnly,
  onRestore,
  onClose,
}: {
  open: boolean;
  versions: CanvasScriptVersion[];
  readOnly: boolean;
  onRestore: (v: CanvasScriptVersion) => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  useModalA11y(ref, onClose, open);
  const titleId = React.useId();
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="card pop-in cvs-dialog cvs-history"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cvs-dialog-head">
          <div id={titleId} className="cvs-dialog-title">
            <History size={16} /> 修改记录
          </div>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" aria-label="关闭" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="cv-hint">每次「通过」或 AI 重写之前会自动存一版，最多留 10 版。</div>
        {versions.length === 0 ? (
          <div className="cvs-history-empty">还没有修改记录。</div>
        ) : (
          <ul className="cvs-history-list">
            {versions.map((v) => (
              <li key={v.id} className="cvs-history-item" data-version={v.id}>
                <div className="cvs-history-copy">
                  <span className="cvs-history-label" title={v.label}>
                    {v.label}
                  </span>
                  <span className="cvs-history-meta">
                    <span className="num">{formatDateTime(v.at)}</span>
                    <span className="cvs-history-sum">{versionSummary(v)}</span>
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-line btn-sm"
                  disabled={readOnly}
                  data-action="restore-version"
                  onClick={() => onRestore(v)}
                >
                  恢复到这一版
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
