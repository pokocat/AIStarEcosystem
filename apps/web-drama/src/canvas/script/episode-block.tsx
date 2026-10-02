"use client";

// 分集剧本里的一集：「1. 标题」（可改）+ 锁 + 正文（剧本格式，可直接改）+ 写 / 重写这一集。
// React.memo：打字时整页会重画，别的集的 episode 对象没变（文档是不可变更新），就不跟着重画 —— 几十集、
// 每集几万字时靠它不卡。所以回调都要从页面传稳定的引用进来（按集号调用）。
import * as React from "react";
import { ChevronDown, Lock, LockOpen, PenLine, RotateCcw, Trash2 } from "lucide-react";
import type { CanvasScriptEpisode } from "@ai-star-eco/types/drama-canvas";
import { AutoTextarea } from "./auto-textarea";
import { Cost, Reason, RunLine, RunResult } from "./bits";
import type { RunView } from "./run-view";
import { LONG_EPISODE_CHARS, charCount, isBlank } from "./script-ops";

export interface EpisodeHandlers {
  onToggleOpen: (no: number) => void;
  onTitle: (no: number, title: string) => void;
  onText: (no: number, text: string) => void;
  onToggleLock: (no: number) => void;
  onWrite: (no: number) => void;
  onRewrite: (no: number) => void;
  onDelete: (no: number) => void;
  onCancel: (runId: string) => void;
}

export interface EpisodeBlockProps {
  episode: CanvasScriptEpisode;
  open: boolean;
  view: RunView;
  /** 正在提交（flush + 请求，还没拿到运行记录）。 */
  submitting: boolean;
  /** 在「写全部分集剧本」这一批里、还没轮到（一集写完再写下一集）。 */
  waiting?: boolean;
  readOnly: boolean;
  price: number | null;
  /** 粘贴来的剧本：能删这一集。 */
  deletable: boolean;
  handlers: EpisodeHandlers;
}

const sameView = (a: RunView, b: RunView) =>
  a.status === b.status && a.runId === b.runId && a.errorMessage === b.errorMessage;

/** view 每次渲染都是新对象，按字段比；其余按引用比。 */
function propsEqual(a: EpisodeBlockProps, b: EpisodeBlockProps): boolean {
  return (
    a.episode === b.episode &&
    a.open === b.open &&
    a.submitting === b.submitting &&
    a.waiting === b.waiting &&
    a.readOnly === b.readOnly &&
    a.price === b.price &&
    a.deletable === b.deletable &&
    a.handlers === b.handlers &&
    sameView(a.view, b.view)
  );
}

const PLACEHOLDER = ["### 场1-1", "日 内 地点", "出场人物：", "△ 动作描写", "角色（语气）：台词"].join("\n");

export const EpisodeBlock = React.memo(function EpisodeBlock({
  episode: ep,
  open,
  view,
  submitting,
  waiting,
  readOnly,
  price,
  deletable,
  handlers: h,
}: EpisodeBlockProps) {
  const blank = isBlank(ep.text);
  const count = React.useMemo(() => charCount(ep.text), [ep.text]);
  const long = count > LONG_EPISODE_CHARS;
  const locked = !!ep.locked;
  const busy = view.pending || submitting;
  const bodyId = `cvs-ep-${ep.no}`;

  const genDisabled = readOnly || locked || busy;
  const genReason = locked
    ? blank
      ? "这一集锁上了，解锁后才能写"
      : "这一集锁上了，解锁后才能重写"
    : undefined;

  return (
    <div className={`cvs-ep${open ? " is-open" : ""}${locked ? " is-locked" : ""}`} data-episode={ep.no}>
      <div className="cvs-ep-head">
        <button
          type="button"
          className="cvs-ep-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? `收起第 ${ep.no} 集` : `展开第 ${ep.no} 集`}
          onClick={() => h.onToggleOpen(ep.no)}
        >
          <ChevronDown size={16} className={open ? "cvs-chev" : "cvs-chev is-closed"} />
          <span className="cvs-ep-no num">{ep.no}.</span>
        </button>
        <input
          className="cvs-ep-title"
          value={ep.title}
          maxLength={60}
          placeholder={`第 ${ep.no} 集`}
          aria-label={`第 ${ep.no} 集的标题`}
          readOnly={readOnly}
          onChange={(e) => h.onTitle(ep.no, e.target.value)}
        />
        <span className="cvs-ep-meta" data-waiting={(waiting && !view.pending) || undefined}>
          {view.pending ? "正在写…" : waiting ? "等前一集写完" : blank ? "还没写" : `${count.toLocaleString("zh-CN")} 字`}
        </span>
        <button
          type="button"
          className={`cvs-lock tap-target${locked ? " on" : ""}`}
          aria-pressed={locked}
          aria-label={locked ? `解锁第 ${ep.no} 集` : `锁上第 ${ep.no} 集`}
          title={locked ? "锁上了：AI 不会重写这一集。点一下解锁" : "锁上之后 AI 不会重写这一集，自己改不受影响"}
          disabled={readOnly}
          data-action="toggle-lock"
          onClick={() => h.onToggleLock(ep.no)}
        >
          {locked ? <Lock size={14} /> : <LockOpen size={14} />}
          <span className="cvs-lock-text">{locked ? "已锁上" : "锁"}</span>
        </button>
      </div>

      {open && (
        <div className="cvs-ep-body" id={bodyId}>
          {long && (
            <div className="cvs-warn">
              这一集很长（{count.toLocaleString("zh-CN")} 字）。一集短剧通常用不了这么多，看看是不是几集连在了一起。
            </div>
          )}
          <RunLine view={view} label={blank ? "正在写这一集" : "正在重写这一集，写完会换掉现在的正文"} onCancel={h.onCancel} disabled={readOnly} />
          <AutoTextarea
            className="cv-textarea cvs-text cvs-script-text"
            value={ep.text}
            onValueChange={(v) => h.onText(ep.no, v)}
            placeholder={blank && !busy ? PLACEHOLDER : undefined}
            readOnly={readOnly || view.pending}
            spellCheck={false}
            aria-label={`第 ${ep.no} 集的剧本`}
          />
          <div className="cvs-actions">
            {blank ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={genDisabled}
                aria-busy={submitting || undefined}
                data-action="write-episode"
                onClick={() => h.onWrite(ep.no)}
              >
                <PenLine size={14} /> 写这一集 <Cost value={price} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-line btn-sm"
                disabled={genDisabled}
                aria-busy={submitting || undefined}
                aria-haspopup="dialog"
                data-action="rewrite-episode"
                onClick={() => h.onRewrite(ep.no)}
              >
                <RotateCcw size={14} /> 重写这一集 <Cost value={price} />
                <ChevronDown size={13} />
              </button>
            )}
            {deletable && (
              <button
                type="button"
                className="btn btn-ghost btn-sm cvs-ep-delete"
                disabled={readOnly || busy}
                data-action="delete-episode"
                onClick={() => h.onDelete(ep.no)}
              >
                <Trash2 size={14} /> 删这一集
              </button>
            )}
          </div>
          <Reason>{genReason}</Reason>
          <RunResult view={view} />
        </div>
      )}
    </div>
  );
}, propsEqual);
