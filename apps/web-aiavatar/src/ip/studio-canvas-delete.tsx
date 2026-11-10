"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "antd";
import { Loader2 } from "lucide-react";
import { IpStudioApi } from "./api";
import { deleteEach } from "./assets-delete";
import { StudioErrorNotice, useStudioErrorState } from "./studio-errors";
import { studioOverlayContainer } from "./studio-overlay";

export type CanvasDeleteTarget = { id: string; name: string };
type Ask = {
  targets: CanvasDeleteTarget[];
  /** 「画布」或「草稿」（AI 视频 / AI 图片页的草稿也是一张画布）。 */
  noun?: string;
  /** 删掉会一起带走什么，界面上看不出来的（AI 视频页一份草稿里的几条视频）。 */
  detail?: string;
  /** 现在不能删的原因（还有视频在生成）：写在弹窗里，删除按钮不可点；服务端同样会拒绝。 */
  blocked?: string;
  onDeleted: (ids: string[]) => void;
};

/**
 * 删除画布 / 草稿（2026-11-10 用户：不想要的画布删不掉）。项目页、AI 视频 / AI 图片页的「最近」、画布页的「⋯」都走这里，
 * 一张或几张都行。删除只是移进回收站（「我的账号 → 回收站」可以恢复），服务端还有任务在生成时回 409 IP_PROJECT_BUSY，
 * 原话写在弹窗里；几张一起删时一张一张删，某张没删成就停在那里，已经删掉的照样算删掉。
 */
export function useCanvasDelete(container: () => HTMLElement = studioOverlayContainer) {
  const [asking, setAsking] = useState<Ask>();
  const [removed, setRemoved] = useState(0);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useStudioErrorState();
  const ask = (next: Ask) => { if (running.current || !next.targets.length) return; setRemoved(0); setError(""); setAsking(next); };
  const close = () => { if (!running.current) setAsking(undefined); };
  const confirm = async () => {
    if (!asking || asking.blocked || running.current) return;
    running.current = true; setBusy(true); setError("");
    const result = await deleteEach(asking.targets.map(t => t.id), id => IpStudioApi.deleteProject(id));
    running.current = false; setBusy(false);
    if (result.removed.length) asking.onDeleted(result.removed);
    if (!result.error) { setAsking(undefined); return; }
    setRemoved(n => n + result.removed.length);
    setAsking({ ...asking, targets: asking.targets.filter(t => !result.removed.includes(t.id)) });
    setError(result.error);
  };
  const noun = asking?.noun ?? "画布";
  const one = asking?.targets.length === 1 ? asking.targets[0] : undefined;
  const dialog = <Modal open={!!asking} title={one ? `删除「${one.name}」？` : `删除选中的 ${asking?.targets.length ?? 0} 张${noun}？`} footer={null}
    onCancel={close} closable={!busy} keyboard={!busy} mask={{ closable: !busy }} getContainer={container}
    className="ip-management-editor studio-gallery-delete" centered destroyOnHidden>
    {asking?.detail && <p>{asking.detail}</p>}
    {asking?.blocked ? <p className="studio-gallery-action-error" role="status">{asking.blocked}</p> : <p>删除后可在<Link href="/studio#/trash">回收站</Link>恢复。</p>}
    {error && <p className="studio-gallery-action-error">{removed > 0 && `已删除 ${removed} 张，其余没有删除。`}<StudioErrorNotice error={error}/></p>}
    <div className="studio-gallery-delete-actions">
      <button type="button" className="ip-brand-secondary" disabled={busy} onClick={close}>取消</button>
      <button type="button" className="ip-brand-button is-danger" disabled={busy || !!asking?.blocked} onClick={() => void confirm()}>{busy && <Loader2 size={16} className="studio-gallery-spinner"/>}{busy ? "正在删除…" : "删除"}</button>
    </div>
  </Modal>;
  return { ask, dialog, busy };
}
