"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as api from "@/api/material-video-reconciliation";
import type { StudioImageReconciliationCard, StudioImageReconciliationRequest, StudioImageUnknownReleaseRequest } from "@/types/material-video-reconciliation";
const stateLabel = (card: StudioImageReconciliationCard) => card.errorCode === "STUDIO_IMAGE_SUBMISSION_UNKNOWN" ? "等待核对厂商受理结果" : card.errorCode === "STUDIO_IMAGE_RECOVERING" ? "正在查询原图片任务" : card.status === "done" ? "图片生成已完成" : card.status === "failed" ? "图片生成失败" : "原图片任务进行中";

export function StudioImageReconciliation() {
  const [runId, setRunId] = React.useState("");
  const [card, setCard] = React.useState<StudioImageReconciliationCard>();
  const [imageIndex, setImageIndex] = React.useState(0);
  const [externalId, setExternalId] = React.useState(""), [evidence, setEvidence] = React.useState("");
  const [review, setReview] = React.useState<StudioImageReconciliationRequest>();
  const [confirmedNoTask, setConfirmedNoTask] = React.useState(false);
  const [releaseReview, setReleaseReview] = React.useState<StudioImageUnknownReleaseRequest>();
  const [loading, setLoading] = React.useState(false), [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(""), [success, setSuccess] = React.useState("");
  const lock = React.useRef(false), version = React.useRef(0);
  const selected = card?.images.find(image => image.imageIndex === imageIndex);
  const unsettled = card?.images.filter(image => image.submitAttempted && !image.mirrored) || [];
  const canCheck = card?.status === "running" && !!selected?.submitAttempted && !selected.mirrored && (!!selected.externalTaskId || card.errorCode === "STUDIO_IMAGE_SUBMISSION_UNKNOWN");
  const canRelease = canCheck && !selected?.externalTaskId && !externalId.trim() && card?.errorCode === "STUDIO_IMAGE_SUBMISSION_UNKNOWN";
  const read = async (id: string) => {
    if (!id.trim() || lock.current) return;
    const current = ++version.current; setLoading(true); setError(""); setSuccess("");
    try {
      const result = await api.readImage(id.trim()); if (current !== version.current) return;
      const image = result.images.find(row => row.submitAttempted && !row.mirrored) || result.images[0];
      setCard(result); setImageIndex(image?.imageIndex || 0); setExternalId(image?.externalTaskId || ""); setEvidence(""); setReview(undefined); setConfirmedNoTask(false); setReleaseReview(undefined);
    } catch (caught) { if (current === version.current) { setCard(undefined); setError(caught instanceof Error ? caught.message : "无法读取原图片任务，请核对记录编号。"); } }
    finally { if (current === version.current) setLoading(false); }
  };
  const prepare = (event: React.FormEvent) => {
    event.preventDefault(); setError(""); if (!canCheck) return;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(externalId.trim())) { setError("请填写原厂商图片任务号，支持字母、数字、下划线和短横线，最多 128 个字符。"); return; }
    if (evidence.trim().length < 8) { setError("请填写至少 8 个字符的核对依据。"); return; }
    setReview({ imageIndex, externalTaskId: externalId.trim(), evidence: evidence.trim() });
  };
  const reconcile = async () => {
    if (!card || !review || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    try { const result = await api.reconcileImage(card.id, review); setCard(result); setReview(undefined); setSuccess("原图片任务已进入核对，将沿用原模型、原请求与原付款账户。请刷新查看结果。"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "核对未完成，请保留原任务信息后重试。"); }
    finally { lock.current = false; setBusy(false); }
  };
  const releaseUnknown = async () => {
    if (!card || !releaseReview || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    try { const result = await api.releaseUnknownImage(card.id, releaseReview); setCard(result); setReleaseReview(undefined); setConfirmedNoTask(false); setSuccess("已登记供应商未受理依据，原任务剩余冻结积分已退回原付款账户。此前已完成的图片仍保留。"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "核实与退回未完成，请保留依据后重试。"); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Card><CardHeader><CardTitle className="text-base">图片任务核对</CardTitle><CardDescription>按图片候选逐张核实原厂商任务。已保存的模型、输入与价格保持原记录，结果返回后按原冻结结算。</CardDescription></CardHeader><CardContent className="space-y-4">
    <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void read(runId); }}><Input className="max-w-md" aria-label="我方图片运行记录编号" placeholder="填写错误记录中的图片运行记录编号" value={runId} maxLength={128} disabled={busy || loading} onChange={event => setRunId(event.target.value)} /><Button type="submit" disabled={!runId.trim() || busy || loading}>{loading ? "正在查询…" : "查询原图片任务"}</Button></form>
    {success && <p role="status" className="text-sm text-success">{success}</p>}{error && !review && !releaseReview && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {card && <div className="space-y-4"><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm"><dt className="text-muted-foreground">当前状态</dt><dd>{stateLabel(card)}</dd><dt className="text-muted-foreground">我方图片任务</dt><dd className="break-all">{card.id}</dd><dt className="text-muted-foreground">任务计价积分</dt><dd className="tabular-nums">{card.cost.toLocaleString("zh-CN")}</dd><dt className="text-muted-foreground">原任务冻结总额</dt><dd className="tabular-nums">{card.holdTotal.toLocaleString("zh-CN")}</dd></dl>{card.errorMessage && <p className="break-words text-sm text-muted-foreground">{card.errorMessage}</p>}
      {!!unsettled.length && <div className="space-y-2"><label className="text-sm font-medium">选择尚未结算的图片</label><Select value={String(imageIndex)} disabled={busy} onValueChange={value => { const image = card.images.find(row => row.imageIndex === Number(value)); setImageIndex(Number(value)); setExternalId(image?.externalTaskId || ""); setEvidence(""); setConfirmedNoTask(false); setError(""); }}><SelectTrigger aria-label="选择尚未结算的图片"><SelectValue /></SelectTrigger><SelectContent>{unsettled.map(image => <SelectItem key={image.imageIndex} value={String(image.imageIndex)}>第 {image.imageIndex + 1} 张 · {image.externalTaskId ? "已记录原任务号" : "受理结果待核对"}</SelectItem>)}</SelectContent></Select></div>}
      {canCheck ? <form className="space-y-4 border-t pt-4" onSubmit={prepare}><p className="text-sm text-muted-foreground">请从厂商控制台或原始响应确认对应图片的任务号，再填写核对依据。尚未受理的后续图片不在本次核对范围。</p><div className="space-y-2"><label className="text-sm font-medium" htmlFor="image-original-supplier-id">原厂商图片任务号</label><Input id="image-original-supplier-id" value={externalId} readOnly={!!selected?.externalTaskId} disabled={busy} maxLength={128} autoComplete="off" placeholder="填写已核实的原图片任务号" onChange={event => setExternalId(event.target.value)} /></div><div className="space-y-2"><label className="text-sm font-medium" htmlFor="image-reconcile-evidence">核对依据</label><Textarea id="image-reconcile-evidence" value={evidence} disabled={busy} minLength={8} maxLength={2000} rows={4} placeholder="填写厂商记录、原始响应的位置与核对时间；请勿填写密钥或令牌" onChange={event => setEvidence(event.target.value)} /></div><Button type="submit" disabled={busy || !externalId.trim() || evidence.trim().length < 8}>{selected?.externalTaskId ? "核对原图片任务" : "核对图片补录信息"}</Button></form> : <p className="text-sm text-muted-foreground">当前没有可以补录的未结算图片。请按原任务状态继续核对，已完成记录保留原结果。</p>}
      {canCheck && !selected?.externalTaskId && <section className="space-y-3 border-t pt-4" aria-label="供应商确认未受理"><h3 className="text-sm font-medium">供应商确认未受理</h3><p className="text-sm text-muted-foreground">仅在供应商明确确认原请求未受理且不存在上游任务后使用。“未查到”或等待超时不能作为确认。请在上方填写核对依据；服务端还会核对任务执行租约已结束。</p><label className="flex items-start gap-2 text-sm" htmlFor="image-confirm-no-upstream-task"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" id="image-confirm-no-upstream-task" checked={confirmedNoTask} disabled={busy || !canRelease} onChange={event => setConfirmedNoTask(event.target.checked)} />已向供应商核实原请求未受理且没有上游任务</label><Button variant="outline" disabled={busy || !canRelease || !confirmedNoTask || evidence.trim().length < 8} onClick={() => { setError(""); setReleaseReview({ imageIndex, evidence: evidence.trim(), confirmedNoUpstreamTask: true }); }}>核对未受理依据与积分退回</Button></section>}
      <Button variant="outline" disabled={busy || loading} onClick={() => void read(card.id)}>刷新图片任务状态</Button>
    </div>}
    <Dialog open={!!review} onOpenChange={open => { if (!open && !busy) setReview(undefined); }}><DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}><DialogHeader><DialogTitle>确认原图片任务与依据</DialogTitle><DialogDescription>保存核对依据后，只查询这张图片对应的原厂商任务。</DialogDescription></DialogHeader>{review && <><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 text-sm"><dt>图片候选</dt><dd>第 {(review.imageIndex ?? 0) + 1} 张</dd><dt>原厂商图片任务</dt><dd className="break-all">{review.externalTaskId}</dd><dt>核对依据</dt><dd className="whitespace-pre-wrap break-words">{review.evidence}</dd></dl>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setReview(undefined)}>返回修改</Button><Button disabled={busy} onClick={() => void reconcile()}>{busy ? "正在登记…" : "确认并核对原图片任务"}</Button></DialogFooter></>}</DialogContent></Dialog>
    <Dialog open={!!releaseReview} onOpenChange={open => { if (!open && !busy) setReleaseReview(undefined); }}><DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}><DialogHeader><DialogTitle>确认供应商未受理与积分退回</DialogTitle><DialogDescription>此操作结束原任务未完成部分，并按原付款账户退回剩余冻结积分；不会重新生成。</DialogDescription></DialogHeader>{releaseReview && <><p className="text-sm">已向供应商核实第 {(releaseReview.imageIndex ?? 0) + 1} 张图片的原请求未受理且没有上游任务。此前成功图片保留。</p><p className="whitespace-pre-wrap break-words text-sm">{releaseReview.evidence}</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setReleaseReview(undefined)}>返回核对</Button><Button disabled={busy} onClick={() => void releaseUnknown()}>{busy ? "正在登记…" : "确认未受理并退回冻结积分"}</Button></DialogFooter></>}</DialogContent></Dialog>
  </CardContent></Card>;
}
