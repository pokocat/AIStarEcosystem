"use client";

import type { ReactNode } from "react";
import { AudioLines, FileText, Image as ImageIcon, MessageSquare, UserRound, Video } from "lucide-react";
import type { StudioTaskHistoryItem, StudioTaskType } from "@ai-star-eco/types";

export const number = new Intl.NumberFormat("zh-CN");

const TYPE_ICON: Record<StudioTaskType, { icon: typeof ImageIcon; tone: string }> = {
  image: { icon: ImageIcon, tone: "is-image" },
  video: { icon: Video, tone: "is-video" },
  audio: { icon: AudioLines, tone: "is-audio" },
  text: { icon: FileText, tone: "is-text" },
  dialogue: { icon: MessageSquare, tone: "is-text" },
  "digital-human": { icon: UserRound, tone: "is-person" },
};

export function TaskIcon({ type }: { type: StudioTaskType }) {
  const { icon: Icon, tone } = TYPE_ICON[type] ?? TYPE_ICON.text;
  return <span className={`account-icon ${tone}`} aria-hidden="true"><Icon /></span>;
}

export function IconBox({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`account-icon ${tone}`} aria-hidden="true">{children}</span>;
}

export const TASK_STATUS: Record<StudioTaskHistoryItem["status"], { label: string; tone: string }> = {
  running: { label: "生成中", tone: "is-ai" },
  done: { label: "已完成", tone: "is-ok" },
  failed: { label: "失败", tone: "is-error" },
};

export function TaskStatusTag({ item }: { item: StudioTaskHistoryItem }) {
  const queued = item.status === "running" && item.queuePosition != null;
  const s = queued ? { label: "排队中", tone: "" } : TASK_STATUS[item.status] ?? TASK_STATUS.done;
  return <span className={`account-tag ${s.tone}`}><i />{s.label}</span>;
}

/** 来源一行：画布「X」/ 作品「X」/ 人物「X」。名字拿不到就不写。 */
export function taskSource(item: StudioTaskHistoryItem): string {
  if (!item.sourceTitle) return item.source === "director" ? "导演台" : item.source === "digital-human" ? "数字人" : "画布";
  const prefix = item.source === "director" ? "作品" : item.source === "digital-human" ? "人物" : "画布";
  return `${prefix}「${item.sourceTitle}」`;
}

/**
 * 消耗积分一栏：进行中写「待结算」，用了模型赠款另起一行。
 * 不写「已退回」（2026-11-10 用户要求）：冻结后多出的部分本来就没扣，写退回会让人以为先扣了又退。失败且没扣的写「未扣积分」。
 */
export function TaskCredits({ item }: { item: StudioTaskHistoryItem }) {
  const c = item.credits;
  if (item.status === "running") return <div className="account-money"><b className="account-muted" style={{ fontWeight: 500 }}>待结算</b></div>;
  const ordinary = Math.max(0, c.spent - c.scopedSpent);
  return <div className="account-money">
    <b className={ordinary === 0 && c.spent === 0 ? "account-muted" : undefined} style={ordinary === 0 && c.spent === 0 ? { fontWeight: 500 } : undefined}>
      {ordinary > 0 ? `−${number.format(ordinary)}` : "0"}
    </b>
    {c.scopedSpent > 0 && <small className="is-grant">另扣模型赠款 {number.format(c.scopedSpent)}</small>}
    {item.status === "failed" && c.spent === 0 && <small>未扣积分</small>}
  </div>;
}

export function payerLabel(item: StudioTaskHistoryItem): string {
  return item.payer.type === "enterprise" ? `企业 · ${item.payer.name || "企业积分"}` : "个人积分";
}

export function LoadState({ loading, error, empty, onRetry, children }: {
  loading: boolean; error?: string; empty?: ReactNode; onRetry?: () => void; children?: ReactNode;
}) {
  if (loading) return <div className="account-state" role="status">正在加载…</div>;
  if (error) return <div className="account-state" role="alert"><span className="account-alert">{error}</span>{onRetry && <button type="button" className="account-button" onClick={onRetry}>重试</button>}</div>;
  if (empty) return <div className="account-state">{empty}</div>;
  return <>{children}</>;
}
