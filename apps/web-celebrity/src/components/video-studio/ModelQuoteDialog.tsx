"use client";

import * as React from "react";
import type { ModelBillingApproval, ModelBillingQuote } from "@ai-star-eco/types/model-billing";
import type { VideoStudioJobRequest } from "@ai-star-eco/types/video-studio";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@ai-star-eco/ui/ui/dialog";
import { VideoStudioApi } from "@/api";
import { errorMessage } from "@/components/common/ai-error-notice";

export function ModelQuoteDialog({request, onConfirm, onCancel}: {
  request: VideoStudioJobRequest;
  onConfirm: (approval: ModelBillingApproval) => void;
  onCancel: () => void;
}) {
  const [freeOnly, setFreeOnly] = React.useState(false);
  const [revision, reload] = React.useReducer(n => n + 1, 0);
  const [quote, setQuote] = React.useState<ModelBillingQuote>();
  const [error, setError] = React.useState("");
  const confirmed = React.useRef(false);
  React.useEffect(() => {
    const controller = new AbortController();
    setQuote(undefined); setError("");
    VideoStudioApi.quoteJob(request, freeOnly, controller.signal)
      .then(value => { if (!controller.signal.aborted) setQuote(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause, "报价没有加载成功")); });
    return () => controller.abort();
  }, [request, freeOnly, revision]);
  const blocked = !quote?.canAfford || quote.freeOnly !== freeOnly || !!error;
  return <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
    <DialogContent className="max-w-md border-zinc-200 bg-white text-zinc-900">
      <DialogHeader><DialogTitle>确认视频费用</DialogTitle>
        <DialogDescription>本次生成 {request.seconds} 秒视频，先冻结，成功后扣费。</DialogDescription>
      </DialogHeader>
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : !quote ? <p role="status">正在报价…</p> :
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>标准价格</dt><dd className="text-right">{quote.standardCredits} 积分</dd>
          {quote.discountCredits > 0 && <><dt>{quote.discountName || "客户优惠"}</dt><dd className="text-right">−{quote.discountCredits} 积分</dd></>}
          <dt>折后费用</dt><dd className="text-right">{quote.payableCredits} 积分</dd>
          <dt>模型赠款抵扣</dt><dd className="text-right">−{quote.scopedCredits} 积分</dd>
          <dt className="font-semibold">需付普通积分</dt><dd className="text-right font-semibold">{quote.walletCredits} 积分</dd>
        </dl>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={freeOnly}
        onChange={event => {setQuote(undefined); setFreeOnly(event.target.checked);}} />仅使用免费额度</label>
      <p className="text-xs text-zinc-500">选中后，赠款不足就停止生成，不扣普通积分。到期赠款不能抵扣。</p>
      {quote && !quote.canAfford && <p role="alert" className="text-sm text-amber-700">{quote.unavailableReason || "当前额度不足"}</p>}
      {(error || (quote && !quote.canAfford)) && <button type="button" onClick={reload} className="text-sm text-violet-700">重新报价</button>}
      <DialogFooter>
        <button type="button" onClick={onCancel} className="rounded-full border px-4 py-2 text-sm">取消生成</button>
        <button type="button" disabled={blocked} className="rounded-full bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-40"
          onClick={() => {if (!blocked && quote && !confirmed.current) {confirmed.current = true; onConfirm(quote.approval);}}}>
          {quote?.walletCredits ? `确认并支付 ${quote.walletCredits} 积分` : "确认并生成"}
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
