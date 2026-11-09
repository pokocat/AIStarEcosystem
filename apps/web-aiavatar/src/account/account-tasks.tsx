"use client";

// 任务历史：画布、AI 图片 / 视频、导演台、对话和数字人的全部生成任务，每条写实际消耗的积分。
// 数据：/api/v1/ip-studio/task-history（StudioTaskHistoryService）。积分口径与画布任务弹层相同。

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StudioTaskHistoryItem, StudioTaskHistoryPage, StudioTaskStatus, StudioTaskType } from "@ai-star-eco/types";
import { AccountApi } from "@/ip/api";
import { reportStudioError } from "@/ip/studio-errors";
import { formatDateTime } from "@/lib/datetime";
import { SelectField } from "@ai-star-eco/ui/ui/select-field";
import { LoadState, number, payerLabel, TaskCredits, TaskIcon, TaskStatusTag, taskSource } from "./account-ui";

const STATUS_FILTERS: { key?: StudioTaskStatus; label: string }[] = [
  { label: "全部" }, { key: "running", label: "进行中" }, { key: "done", label: "已完成" }, { key: "failed", label: "失败" },
];
const TYPE_FILTERS: { key?: StudioTaskType; label: string }[] = [
  { label: "全部类型" }, { key: "image", label: "图片" }, { key: "video", label: "视频" }, { key: "audio", label: "配音" },
  { key: "text", label: "文字" }, { key: "dialogue", label: "对话" }, { key: "digital-human", label: "数字人" },
];
const RANGES = [{ days: 30, label: "近 30 天" }, { days: 7, label: "近 7 天" }, { days: 90, label: "近 90 天" }, { days: 0, label: "全部时间" }];

function statusLine(item: StudioTaskHistoryItem): string | null {
  if (item.status === "failed") return item.errorMessage || "生成失败";
  if (item.status === "running") return item.queuePosition != null ? `排队第 ${item.queuePosition} 位` : null;
  return item.finishedAt ? `${formatDateTime(item.finishedAt)} 完成` : null;
}

/** 每条的操作：进行中可取消的给「取消」，数字人失败的给「重试」，其余「查看」回原处。 */
function TaskAction({ item, busy, onAct }: { item: StudioTaskHistoryItem; busy: boolean; onAct: (kind: "cancel" | "retry") => void }) {
  if (AccountApi.canCancelTask(item)) return <button type="button" className="account-button" disabled={busy} onClick={() => onAct("cancel")}>{busy ? "取消中…" : "取消"}</button>;
  if (AccountApi.canRetryTask(item)) return <button type="button" className="account-button" disabled={busy} onClick={() => onAct("retry")}>{busy ? "提交中…" : "重试"}</button>;
  return <Link className="account-button" href={item.href}>查看</Link>;
}

function monthOf(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
}

export function AccountTasks() {
  const [status, setStatus] = useState<StudioTaskStatus>();
  const [type, setType] = useState<StudioTaskType>();
  const [days, setDays] = useState(30);
  const [pages, setPages] = useState<StudioTaskHistoryPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [acting, setActing] = useState("");
  const act = async (item: StudioTaskHistoryItem, kind: "cancel" | "retry") => {
    if (acting) return;
    setActing(item.id);
    try {
      if (kind === "cancel") await AccountApi.cancelTask(item); else await AccountApi.retryTask(item);
      setReload(v => v + 1);
    } catch (e) { reportStudioError(e, { action: kind === "cancel" ? "取消任务" : "重试任务" }); }
    finally { setActing(""); }
  };

  useEffect(() => {
    let live = true;
    setLoading(true); setError(""); setPages([]);
    AccountApi.taskHistory({ status, type, days, page: 0 }).then(p => { if (live) setPages([p]); })
      .catch(() => { if (live) setError("任务历史加载失败，请稍后刷新重试。"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [status, type, days, reload]);

  const last = pages[pages.length - 1];
  const items = pages.flatMap(p => p.items);
  const summary = pages[0]?.summary;
  const loadMore = () => {
    if (!last?.hasMore || more) return;
    setMore(true);
    AccountApi.taskHistory({ status, type, days, page: last.page + 1 }).then(p => setPages(prev => [...prev, p]))
      .catch(() => setError("更多任务加载失败，请重试。")).finally(() => setMore(false));
  };
  const range = RANGES.find(r => r.days === days)?.label ?? "近 30 天";

  return <>
    {summary && <div className="account-kpis">
      <div className="account-kpi"><small>{range}消耗</small><b>{number.format(summary.spent)}<span className="account-muted" style={{ fontSize: 12, fontWeight: 400, marginLeft: 4 }}>积分</span></b></div>
      <div className="account-kpi" style={{ background: "#f5f9f7" }}><small>其中模型赠款</small><b style={{ color: "#1f6e4b" }}>{number.format(summary.scopedSpent)}</b></div>
      <div className="account-kpi" style={{ background: "#fbf7ef" }}><small>退回积分</small><b style={{ color: "#8a5a10" }}>{number.format(summary.released)}</b></div>
      <div className="account-kpi"><small>任务数</small><b>{number.format(summary.count)}{summary.partial ? "+" : ""}</b></div>
    </div>}
    {summary?.partial && <p className="account-muted" style={{ margin: "-8px 0 14px" }}>任务较多，汇总只统计了最近 {number.format(summary.count)} 条。</p>}

    <div className="account-filters">
      <div>
        <div className="account-seg" role="group" aria-label="按状态筛选">
          {STATUS_FILTERS.map(f => <button key={f.label} type="button" aria-pressed={status === f.key} onClick={() => setStatus(f.key)}>{f.label}</button>)}
        </div>
        <div className="account-chips" role="group" aria-label="按类型筛选">
          {TYPE_FILTERS.map(f => <button key={f.label} type="button" aria-pressed={type === f.key} onClick={() => setType(f.key)}>{f.label}</button>)}
        </div>
      </div>
      <label className="account-muted" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>时间
        <SelectField value={String(days)} onChange={e => setDays(Number(e.target.value))} style={{ height: 32, padding: "0 10px", border: "1px solid var(--sn-field)", borderRadius: 10, background: "#fff", color: "var(--ip-ink)", font: "inherit", fontSize: 12.5 }}>
          {RANGES.map(r => <option key={r.days} value={r.days}>{r.label}</option>)}
        </SelectField>
      </label>
    </div>

    <LoadState loading={loading} error={error && !items.length ? error : undefined} onRetry={() => setReload(v => v + 1)}
      empty={!loading && !error && items.length === 0 ? <><strong>没有符合条件的任务</strong><span>换个筛选条件或时间范围试试。</span></> : undefined}>
      <div className="account-table account-tasks" role="table" aria-label="任务历史">
        <div className="account-tr is-head" role="row"><span role="columnheader">任务</span><span role="columnheader">开始时间</span><span role="columnheader">状态</span><span role="columnheader" className="account-right">消耗积分</span><span role="columnheader">付款账户</span><span role="columnheader" className="account-right">操作</span></div>
        {items.map((item, i) => {
          const month = monthOf(item.createdAt);
          const showMonth = month && (i === 0 || monthOf(items[i - 1].createdAt) !== month);
          const line = statusLine(item);
          return <div key={item.id} style={{ display: "contents" }}>
            {showMonth && <div className="account-tr is-head" role="row" style={{ padding: "8px 20px" }}><span role="cell">{month}</span></div>}
            <div className="account-tr" role="row">
              <div className="account-task" role="cell"><TaskIcon type={item.type} /><div><strong title={item.title}>{item.title}</strong><small title={taskSource(item)}>{taskSource(item)}</small></div></div>
              <span role="cell" style={{ fontSize: 12.5, color: "var(--sn-text-2)" }}>{formatDateTime(item.createdAt)}</span>
              <div className="account-task-status" role="cell">
                <div><TaskStatusTag item={item} />{item.status === "running" && item.queuePosition == null && <span className="account-task-bar"><i style={{ width: `${Math.max(4, item.pct)}%` }} /></span>}</div>
                {line && <small title={line} style={item.status === "failed" ? { color: "var(--ip-error)" } : undefined}>{line}</small>}
              </div>
              <div role="cell" className="account-right"><TaskCredits item={item} /></div>
              <span role="cell" className="account-ellipsis" style={{ fontSize: 12 }} title={payerLabel(item)}>{payerLabel(item)}</span>
              <div role="cell" className="account-right"><TaskAction item={item} busy={acting === item.id} onAct={kind => void act(item, kind)} /></div>
            </div>
          </div>;
        })}
      </div>
      <div className="account-task-cards">
        {items.map(item => {
          const line = statusLine(item);
          return <article key={item.id} className="account-task-card">
            <div><TaskIcon type={item.type} /><div style={{ flex: 1, minWidth: 0 }}><strong className="account-ellipsis" style={{ display: "block", fontWeight: 500 }}>{item.title}</strong><small className="account-muted">{formatDateTime(item.createdAt)}</small></div><div className="account-right"><TaskCredits item={item} /></div></div>
            <div><TaskStatusTag item={item} /><small className="account-ellipsis account-muted" style={{ flex: 1, minWidth: 0, ...(item.status === "failed" ? { color: "var(--ip-error)" } : {}) }}>{line ?? taskSource(item)}</small><TaskAction item={item} busy={acting === item.id} onAct={kind => void act(item, kind)} /></div>
          </article>;
        })}
      </div>
      {last?.hasMore && <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}><button type="button" className="account-button" disabled={more} onClick={loadMore}>{more ? "正在加载…" : "加载更多"}</button></div>}
      {error && items.length > 0 && <p className="account-alert" role="alert" style={{ textAlign: "center", marginTop: 8 }}>{error}</p>}
    </LoadState>
  </>;
}
