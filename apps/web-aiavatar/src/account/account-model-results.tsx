"use client";

// 模型原文抽屉（2026-11-10，替代原来的 /model-results 单独页面）。
// 两种打开方式：任务历史里某条文字任务的「查看原文」（只看这个任务的原文，按调用先后），
// 以及任务历史顶部的「全部原文」（按时间看全部，较早的原文没有关联到任务，只能在这里看）。
// 原文一律按纯文本显示，不当成 HTML 或可执行的操作。

import { useEffect, useState } from "react";
import { Drawer } from "antd";
import { ChevronLeft, Copy, Download } from "lucide-react";
import { AccountApi } from "@/ip/api";
import type { ModelResultDetail, ModelResultSummary } from "@/ip/api/account";
import { formatDateTime } from "@/lib/datetime";
import { LoadState } from "./account-ui";

/** 用量记录里的用途是内部编码，这里换成用户看得懂的说法。认不出的一律叫「文字生成」。 */
const PURPOSE_LABEL: Record<string, string> = {
  DAP_PERSONA: "创作文字",
  DAP_VIDEO_PROMPT: "视频提示词优化",
  DRAMA_SCRIPT_DRAFT: "剧本",
  SCRIPT_DRAFT: "脚本",
  VIDEO_REF_ANALYSIS: "视频分析",
  DAP_VIDEO_UNDERSTAND: "拉片分析",
  SELLING_POINTS: "卖点提取",
};
export const purposeLabel = (purpose: string) => PURPOSE_LABEL[purpose] ?? "文字生成";

export type ModelResultTarget = { mode: "task"; taskId: string; title: string } | { mode: "all" };

export function ModelResultsDrawer({ target, onClose }: { target: ModelResultTarget | null; onClose: () => void }) {
  const [rows, setRows] = useState<ModelResultSummary[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<ModelResultSummary | null>(null);
  const taskId = target?.mode === "task" ? target.taskId : undefined;

  useEffect(() => { setPage(0); setSelected(null); }, [target]);
  useEffect(() => {
    if (!target) return;
    let live = true;
    setLoading(true); setError("");
    AccountApi.modelResults({ taskId, page }).then(list => {
      if (!live) return;
      setRows(list);
      // 一个任务只调用过一次模型时，直接打开那一份。
      if (taskId && page === 0 && list.length === 1) setSelected(list[0]);
    }).catch(() => { if (live) setError("原文加载失败，请稍后重试。"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [target, taskId, page, reload]);

  const title = target?.mode === "task" ? target.title : "全部原文";
  const many = target?.mode === "all" || rows.length > 1;
  return <Drawer open={!!target} onClose={onClose} size={560} title={selected && many
      ? <button type="button" className="account-drawer-back" onClick={() => setSelected(null)}><ChevronLeft size={16} strokeWidth={1.6} aria-hidden="true" />{title}</button>
      : title}
    rootClassName="account-drawer" destroyOnHidden>
    {selected ? <ModelResultView summary={selected} index={target?.mode === "task" && rows.length > 1 ? rows.indexOf(selected) + 1 : undefined} />
      : <LoadState loading={loading} error={error || undefined} onRetry={() => setReload(v => v + 1)}
          empty={!loading && !error && rows.length === 0 ? <><strong>没有原文</strong><span>{taskId ? "这条任务没有保留模型返回的文字。" : "生成文字内容后，模型返回的原文会保留在这里。"}</span></> : undefined}>
        {target?.mode === "all" && <p className="account-muted" style={{ margin: "0 0 12px", fontSize: 12.5 }}>较早的原文没有关联到具体任务，可以在这里按时间查看。</p>}
        <div className="account-card account-list" style={{ overflow: "hidden" }}>
          {rows.map((row, i) => <button key={row.id} type="button" className="account-row" onClick={() => setSelected(row)}>
            <span><strong>{taskId ? `第 ${page * 20 + i + 1} 次调用` : purposeLabel(row.purpose)}</strong><small>{row.model} · {formatDateTime(row.createdAt)}</small></span>
          </button>)}
        </div>
        {(page > 0 || rows.length === 20) && <div className="account-pager">
          <button type="button" className="account-button" disabled={page === 0 || loading} onClick={() => setPage(v => v - 1)}>上一页</button>
          <span>第 {page + 1} 页</span>
          <button type="button" className="account-button" disabled={rows.length < 20 || loading} onClick={() => setPage(v => v + 1)}>下一页</button>
        </div>}
      </LoadState>}
  </Drawer>;
}

function ModelResultView({ summary, index }: { summary: ModelResultSummary; index?: number }) {
  const [detail, setDetail] = useState<ModelResultDetail | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    setDetail(null); setError(""); setCopied(false);
    AccountApi.modelResult(summary.id).then(d => { if (live) setDetail(d); })
      .catch(() => { if (live) setError("原文加载失败，请稍后重试。"); });
    return () => { live = false; };
  }, [summary.id, reload]);
  const copy = async () => {
    if (!detail) return;
    try { await navigator.clipboard.writeText(detail.content); setCopied(true); }
    catch { setError("复制失败，请选中下方文字后手动复制。"); }
  };
  const download = () => {
    if (!detail) return;
    const url = URL.createObjectURL(new Blob([detail.content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `生成原文-${detail.id}.txt`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="account-raw">
    <div className="account-raw-head">
      <span className="account-muted">{[index ? `第 ${index} 次调用` : purposeLabel(summary.purpose), summary.model, formatDateTime(summary.createdAt)].join(" · ")}</span>
      <span style={{ display: "flex", gap: 8 }}>
        <button type="button" className="account-button" disabled={!detail} onClick={download}><Download size={14} strokeWidth={1.6} aria-hidden="true" />下载原文</button>
        <button type="button" className="account-go" disabled={!detail} onClick={() => void copy()}><Copy size={14} strokeWidth={1.6} aria-hidden="true" />{copied ? "已复制" : "复制全文"}</button>
      </span>
    </div>
    {detail?.finishReason === "length" && <p className="account-raw-note">模型达到输出上限，内容可能不完整。</p>}
    {error ? <div className="account-state" role="alert"><span className="account-alert">{error}</span><button type="button" className="account-button" onClick={() => setReload(v => v + 1)}>重试</button></div>
      : detail ? <pre className="account-raw-text">{detail.content}</pre>
      : <div className="account-state" role="status">正在加载原文…</div>}
  </div>;
}
