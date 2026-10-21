"use client";
// 创作助手头部的「新对话」和「历史对话」（docs/ip-studio-new-canvas-and-threads.md §3.3）。
//
// A canvas can hold several conversations. The list is read fresh each time it opens (titles and times change as
// people talk). While the current conversation is still replying, has an execution running / paused, or a confirmation
// card is on its way (from saving the canvas to the execution's answer), neither a new one nor a switch is possible: the
// canvas gets its nodes from the current conversation's event stream, and leaving would drop the ones that have not
// arrived yet. The caller passes that reason; this component only shows it. Picking a row opens that conversation
// (POST …/open, the one call that makes it the server's current one).
import { useEffect, useRef, useState } from "react";
import { Popover } from "antd";
import { History, SquarePen } from "lucide-react";
import type { StudioDialogueThreadSummary } from "@ai-star-eco/types/ip-studio-workflow";
import { formatDateTime } from "@/lib/datetime";
import { StudioErrorNotice, useStudioErrorState } from "./studio-errors";

/** Shown on 「新对话」 while the current conversation has nothing in it yet. */
export const DIALOGUE_ALREADY_NEW = "现在就是新对话";

type Props = {
  /** The conversation shown in the panel; its row is marked 「当前」. */
  currentThreadId?: string;
  /** Why neither a new conversation nor a switch is possible right now (still going, still loading, switching). */
  busyReason?: string;
  /** The current conversation has no message of its own yet. */
  empty: boolean;
  listThreads: () => Promise<StudioDialogueThreadSummary[]>;
  /** Resolve true once the panel shows the new conversation; the caller reports failures and resolves false. */
  onNew: () => Promise<boolean>;
  onOpen: (threadId: string) => Promise<boolean>;
};

const popupContainer = (trigger: HTMLElement) => trigger.closest<HTMLElement>(".ip-surface") || document.body;

export function StudioDialogueThreads({ currentThreadId, busyReason, empty, listThreads, onNew, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<StudioDialogueThreadSummary[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useStudioErrorState();
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), request = useRef(0);
  const newReason = busyReason || (empty ? DIALOGUE_ALREADY_NEW : "");

  const load = () => {
    const seq = ++request.current;
    setLoading(true); setError("");
    listThreads().then(list => { if (request.current === seq) setThreads(list); })
      .catch(e => { if (request.current === seq) setError(e); })
      .finally(() => { if (request.current === seq) setLoading(false); });
  };
  const change = (next: boolean) => { setOpen(next); if (next) load(); };
  const close = (focusTrigger: boolean) => { setOpen(false); if (focusTrigger) trigger.current?.focus(); };
  // Escape closes the list and nothing else. Taken in the capture phase, before the panel would read it as 「close the
  // assistant」 (antd 6's Popover does not close on Escape by itself).
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.preventDefault(); e.stopPropagation(); close(true); };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [open]);

  const startNew = async () => {
    if (newReason) return;
    if (await onNew()) close(false);
  };
  const pick = async (thread: StudioDialogueThreadSummary) => {
    if (thread.id === currentThreadId) { close(true); return; }
    if (busyReason) return;
    if (await onOpen(thread.id)) close(false);
  };

  const list = threads || [];
  const others = list.filter(t => t.id !== currentThreadId);
  const content = <div ref={panel} className="studio-dialogue-threads" role="region" aria-label="历史对话">
    <header>
      <strong>历史对话</strong>
      <button type="button" className="studio-dialogue-threads-new" disabled={!!newReason} title={newReason || "开始一段新的对话，这一段留在历史里"} onClick={() => void startNew()}>
        <SquarePen size={14} aria-hidden="true"/>新对话</button>
    </header>
    {busyReason && <p className="studio-dialogue-threads-note" role="status">{busyReason}</p>}
    {loading && !threads && <p className="studio-dialogue-threads-note" role="status">正在读取对话列表</p>}
    {error && <div className="studio-dialogue-threads-error" role="alert"><span>对话列表没有读取成功。</span><StudioErrorNotice error={error} autoReport={false} label="查看详情"/>
      <button type="button" className="studio-dialogue-link" onClick={load}>重试</button></div>}
    {!!list.length && <ul className="studio-dialogue-threads-list">
      {list.map(thread => {
        const current = thread.id === currentThreadId || (!currentThreadId && thread.current);
        const disabled = !current && !!busyReason;
        return <li key={thread.id}>
          <button type="button" className={`studio-dialogue-thread${current ? " is-current" : ""}`} aria-current={current ? "true" : undefined} disabled={disabled}
            title={disabled ? busyReason : current ? "正在看的这段对话" : "打开这段对话"} onClick={() => void pick(thread)}>
            <span className="studio-dialogue-thread-title" title={thread.title}>{thread.title}</span>
            <span className="studio-dialogue-thread-meta">{formatDateTime(thread.lastActivityAt)} · {thread.messageCount} 条消息</span>
            {(current || thread.active || thread.parentThreadId) && <span className="studio-dialogue-thread-tags">
              {current && <em className="is-current">当前</em>}
              {thread.active && <em className="is-active">进行中</em>}
              {thread.parentThreadId && <em className="is-branch" title="从某条消息重新开始的对话">重新开始</em>}
            </span>}
          </button>
        </li>;
      })}
    </ul>}
    {threads && !error && !others.length && <p className="studio-dialogue-threads-note">还没有别的对话</p>}
  </div>;

  return <>
    <button type="button" className="studio-dialogue-thread-action" aria-label="新对话" title={newReason || "新对话"} disabled={!!newReason} onClick={() => void startNew()}>
      <SquarePen size={17} aria-hidden="true"/></button>
    <Popover trigger="click" placement="bottomRight" arrow={false} open={open} onOpenChange={change} destroyOnHidden getPopupContainer={popupContainer}
      classNames={{ root: "studio-dialogue-threads-overlay" }} styles={{ container: { padding: 0 } }} content={content}
      afterOpenChange={visible => { if (visible) (panel.current?.querySelector<HTMLButtonElement>(".studio-dialogue-thread.is-current") || panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus(); }}>
      <button ref={trigger} type="button" className="studio-dialogue-thread-action" aria-label="历史对话" title={busyReason || "历史对话"} aria-expanded={open} aria-haspopup="dialog" disabled={!!busyReason && !open}>
        <History size={17} aria-hidden="true"/></button>
    </Popover>
  </>;
}
