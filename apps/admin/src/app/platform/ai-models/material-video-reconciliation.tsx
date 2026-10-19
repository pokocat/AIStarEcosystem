"use client";

import * as React from "react";
import { StudioImageReconciliation } from "./studio-image-reconciliation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as api from "@/api/material-video-reconciliation";
import type { MaterialVideoReconciliationCard, MaterialVideoReconciliationRequest } from "@/types/material-video-reconciliation";
const labels: Record<string, string> = { rendering: "生成中", ready: "已完成", done: "已完成", failed: "生成失败", cancelled: "已取消", submitting: "正在确认受理", queued: "排队中" };

/** Reconcile the original job, or release its hold only after evidenced supplier confirmation. */
export function MaterialVideoReconciliation() {
  const [jobId, setJobId] = React.useState("");
  const [card, setCard] = React.useState<MaterialVideoReconciliationCard>();
  const [externalId, setExternalId] = React.useState(""), [evidence, setEvidence] = React.useState("");
  const [review, setReview] = React.useState<MaterialVideoReconciliationRequest>();
  const [confirmedNoTask, setConfirmedNoTask] = React.useState(false);
  const [loading, setLoading] = React.useState(false), [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(""), [success, setSuccess] = React.useState("");
  const lock = React.useRef(false), version = React.useRef(0);
  const unknown = card?.error_code === "VIDEO_SUBMISSION_UNKNOWN" && !card.external_task_id;
  const read = async (id: string) => {
    if (!id.trim() || lock.current) return;
    const current = ++version.current; setLoading(true); setError(""); setSuccess("");
    try { const result = await api.read(id.trim()); if (current === version.current) { setCard(result); setExternalId(""); setEvidence(""); setReview(undefined); setConfirmedNoTask(false); } }
    catch (caught) { if (current === version.current) { setCard(undefined); setError(caught instanceof Error ? caught.message : "无法读取原视频任务，请核对任务编号。"); } }
    finally { if (current === version.current) setLoading(false); }
  };
  const prepare = (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (!unknown) return;
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(externalId.trim())) { setError("请填写原厂商任务号，以字母或数字开头，支持下划线、点、冒号及短横线，最多 256 个字符。"); return; }
    if (evidence.trim().length < 8) { setError("请填写至少 8 个字符的核对依据，例如厂商控制台记录、日志位置和核对时间。"); return; }
    setReview({ externalTaskId: externalId.trim(), evidence: evidence.trim() });
  };
  const reconcile = async (body?: MaterialVideoReconciliationRequest) => {
    if (!card || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      const result = await api.reconcile(card.id, body); setCard(result); setReview(undefined);
      setSuccess(body?.confirmedNotAccepted ? "已登记供应商未受理依据，原冻结积分已退回原付款账户。" : body ? "已登记原厂商任务号，正在查询原任务结果。请刷新查看核对进度。" : "原任务结果已核对并更新。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "核对未完成，请保留原任务信息后重试。"); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Card>
    <CardHeader><CardTitle className="text-base">视频任务核对</CardTitle><CardDescription>按原任务确认厂商受理情况与结果。补录任务号需要可核对的证据，原付款账户与冻结记录继续保留。</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void read(jobId); }}><Input className="max-w-md" aria-label="我方视频任务编号" placeholder="填写错误记录中的我方视频任务编号" value={jobId} maxLength={128} disabled={busy || loading} onChange={event => setJobId(event.target.value)} /><Button type="submit" disabled={!jobId.trim() || busy || loading}>{loading ? "正在查询…" : "查询原任务"}</Button></form>
      {success && <p role="status" className="text-sm text-success">{success}</p>}
      {error && !review && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {card && <div className="space-y-4">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm"><dt className="text-muted-foreground">当前状态</dt><dd>{card.stage || labels[card.status] || "等待核对"}</dd><dt className="text-muted-foreground">我方任务</dt><dd className="break-all">{card.id}</dd><dt className="text-muted-foreground">厂商任务</dt><dd className="break-all">{card.external_task_id || "尚未记录"}</dd></dl>
        {card.error_message && <p className="break-words text-sm text-muted-foreground">{card.error_message}</p>}
        {unknown ? <form onSubmit={prepare} className="space-y-4 border-t pt-4"><p className="text-sm text-muted-foreground">厂商是否受理尚未确认。请先在厂商控制台或原始响应中找到对应记录，再填写原任务号与依据。</p><div className="space-y-2"><label className="text-sm font-medium" htmlFor="video-original-supplier-id">原厂商任务号</label><Input id="video-original-supplier-id" value={externalId} disabled={busy} maxLength={256} onChange={event => setExternalId(event.target.value)} placeholder="填写已核实的原厂商任务号" autoComplete="off" /></div><div className="space-y-2"><label className="text-sm font-medium" htmlFor="video-reconcile-evidence">核对依据</label><Textarea id="video-reconcile-evidence" value={evidence} disabled={busy} minLength={8} maxLength={2000} rows={4} onChange={event => setEvidence(event.target.value)} placeholder="填写厂商记录或原始响应的位置、核对时间，以及确认是同一任务的依据；请勿填写密钥或令牌" /></div><Button type="submit" disabled={busy || !externalId.trim() || evidence.trim().length < 8}>核对补录信息</Button></form> : <div className="flex flex-wrap gap-2">{card.external_task_id && !["ready", "done", "cancelled"].includes(card.status) && <Button disabled={busy || loading} onClick={() => void reconcile()}>{busy ? "正在核对…" : "核对原厂商任务结果"}</Button>}<Button variant="outline" disabled={busy || loading} onClick={() => void read(card.id)}>刷新原任务状态</Button></div>}
        {unknown && <section className="space-y-3 border-t pt-4" aria-label="供应商确认未受理"><h3 className="text-sm font-medium">供应商确认未受理</h3><p className="text-sm text-muted-foreground">仅在供应商明确确认原请求未受理且不存在上游任务后使用。“未查到”或等待超时不能作为确认。请在上方填写核对依据。</p><label className="flex items-start gap-2 text-sm" htmlFor="video-confirm-no-upstream-task"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" id="video-confirm-no-upstream-task" checked={confirmedNoTask} disabled={busy || !!externalId.trim()} onChange={event => setConfirmedNoTask(event.target.checked)} />已向供应商核实原请求未受理且没有上游任务</label><Button variant="outline" disabled={busy || !!externalId.trim() || !confirmedNoTask || evidence.trim().length < 8} onClick={() => { setError(""); setReview({ confirmedNotAccepted: true, evidence: evidence.trim() }); }}>核对未受理依据与积分退回</Button></section>}
      </div>}
      <Dialog open={!!review} onOpenChange={open => { if (!open && !busy) setReview(undefined); }}><DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}><DialogHeader><DialogTitle>{review?.confirmedNotAccepted ? "确认供应商未受理与积分退回" : "确认原厂商任务与依据"}</DialogTitle><DialogDescription>{review?.confirmedNotAccepted ? "此操作登记供应商明确确认未受理的依据，并将原冻结积分退回原付款账户；不会重新生成。" : "确认后将任务号与核对依据保存到原记录，并开始查询原任务。请核对这确实是同一次生成。"}</DialogDescription></DialogHeader>{review && <><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 text-sm"><dt>我方视频任务</dt><dd className="break-all">{card?.id}</dd><dt>{review.confirmedNotAccepted ? "核实结果" : "原厂商任务号"}</dt><dd className="break-all">{review.confirmedNotAccepted ? "供应商确认原请求未受理且没有上游任务" : review.externalTaskId}</dd><dt>核对依据</dt><dd className="whitespace-pre-wrap break-words">{review.evidence}</dd></dl>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setReview(undefined)}>返回修改</Button><Button disabled={busy} onClick={() => void reconcile(review)}>{busy ? "正在登记…" : review.confirmedNotAccepted ? "确认未受理并退回冻结积分" : "确认并核对原任务"}</Button></DialogFooter></>}</DialogContent></Dialog>
    </CardContent>
  </Card>;
}


export function GenerationTaskReconciliation() {
  const [kind, setKind] = React.useState<"video" | "image">("video");
  return <section className="space-y-3" aria-label="原生成任务核对"><div className="flex gap-2" role="group" aria-label="核对任务类型"><Button size="sm" variant={kind === "video" ? "default" : "outline"} aria-pressed={kind === "video"} onClick={() => setKind("video")}>视频任务核对</Button><Button size="sm" variant={kind === "image" ? "default" : "outline"} aria-pressed={kind === "image"} onClick={() => setKind("image")}>图片任务核对</Button></div>{kind === "image" ? <StudioImageReconciliation/> : <MaterialVideoReconciliation/>}</section>;
}
