"use client";

import { useEffect, useState } from "react";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import type { ModelBillingQuote } from "@ai-star-eco/types/model-billing";
import type { StudioVideoSettings } from "@ai-star-eco/types/ip-studio-workflow";
import { quoteVideoPrice, type StudioVideoPriceQuery } from "./studio-model-quote";
import { knownStudioBilling, loadStudioBillingAccount } from "./studio-billing-preference";

/**
 * AI 视频页「生成视频」按钮旁的价（2026-11-03）：折扣、模型赠款和付款账户都由服务端按提交用的同一个报价算，
 * 页面不自己乘折扣。点生成时确认弹窗再按完整请求报一次价，那一份才是付款依据。
 */

/** 页面现在知道的付款账户：定了就是那一个；企业成员没设默认账户时两个都报，点生成时才选。 */
export type StudioPreviewPayer =
  | { kind: "decided"; billing: EnterpriseBillingSelection }
  | { kind: "undecided"; enterpriseId?: string };

export async function studioPreviewPayer(): Promise<StudioPreviewPayer> {
  if (process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED !== "1") return { kind: "decided", billing: { mode: "personal" } };
  const account = await loadStudioBillingAccount();
  const known = knownStudioBilling(account);
  return known ? { kind: "decided", billing: known } : { kind: "undecided", enterpriseId: account.context?.enterprise.id };
}

/** 价格只看这些：素材按类型数张数，不带文件 key，也不带提示词。 */
export function studioVideoPriceQuery(model: string | undefined, video: StudioVideoSettings, durationSec: number, aspectRatio: string): StudioVideoPriceQuery {
  const count = (type: string) => (video.references || []).filter(ref => ref.mediaType === type).length;
  return { model, mode: video.mode, tier: video.resolutionTier, aspectRatio, durationSec,
    imageRefs: count("image"), videoRefs: count("video"), audioRefs: count("audio") };
}

export type StudioVideoPrice =
  | { status: "idle" | "loading" | "failed" }
  | { status: "ready"; payer: "decided"; quote: ModelBillingQuote }
  | { status: "ready"; payer: "undecided"; personal: ModelBillingQuote; enterprise?: ModelBillingQuote };

async function loadPrice(query: StudioVideoPriceQuery, payer: StudioPreviewPayer, signal: AbortSignal): Promise<StudioVideoPrice> {
  if (payer.kind === "decided") return { status: "ready", payer: "decided", quote: await quoteVideoPrice(query, payer.billing, signal) };
  const [personal, enterprise] = await Promise.all([
    quoteVideoPrice(query, { mode: "personal" }, signal),
    // 企业账户报不出来（停用、在途满了、模型没授权）不挡个人价：点生成时选账户会说清楚。
    payer.enterpriseId ? quoteVideoPrice(query, { mode: "enterprise", enterpriseId: payer.enterpriseId }, signal).catch(() => undefined) : undefined,
  ]);
  return { status: "ready", payer: "undecided", personal, enterprise };
}

/**
 * query 为空 = 不用报价（演示模式、交给创作助手、算不出标准价）。参数一变就作废上一份：只返回与当前参数对得上的那份，
 * 慢回来的旧报价不会盖住新选择。不缓存：切回之前用过的参数也重新报，后台刚改的折扣不会被旧结果挡住。
 * revision 变了（生成完、可能刚设了默认账户、赠款也用掉了）或页面切回前台也重新报。
 */
export function useStudioVideoPrice(query: StudioVideoPriceQuery | undefined, revision = 0): StudioVideoPrice {
  const [payer, setPayer] = useState<StudioPreviewPayer>();
  const [shown, setShown] = useState(0);
  const [result, setResult] = useState<{ key: string; price: StudioVideoPrice }>();
  useEffect(() => {
    const back = () => { if (document.visibilityState === "visible") setShown(n => n + 1); };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, []);
  const wanted = !!query;
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    // 账户读不出来就当没定：只报个人价，也不说要付多少。
    studioPreviewPayer().then(next => { if (live) setPayer(next); }, () => { if (live) setPayer({ kind: "undecided" }); });
    return () => { live = false; };
  }, [wanted, revision, shown]);
  const key = query && payer ? JSON.stringify([query, payer, revision, shown]) : "";
  useEffect(() => {
    if (!key || !query || !payer) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      loadPrice(query, payer, abort.signal).then(price => {
        if (abort.signal.aborted) return;
        setResult({ key, price });
      }, () => { if (!abort.signal.aborted) setResult({ key, price: { status: "failed" } }); });
    }, 250);
    return () => { clearTimeout(timer); abort.abort(); };
    // key 已经包含 query 与 payer 的全部内容
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!query) return { status: "idle" };
  return result?.key === key ? result.price : { status: "loading" };
}

export type StudioVideoPriceView = {
  /** 原价（标准价）。 */
  standard: number;
  /** 按钮上的视频费：有折扣时是折后价；付款账户没定、两个账户价不同时是较低的那个（from=true，写「起」）。 */
  shown: number;
  from?: boolean;
  /** 还在报价：先显示本地算的标准价。 */
  pending?: boolean;
  /** 折扣名和省了多少，放在价格的悬停提示里；划掉的原价已经说明有折扣，不再单写一行。 */
  discount?: string;
  /** 价格的其余细节（赠款抵扣、两个账户各多少、优化提示词另计），也只放悬停提示（2026-11-07 用户：按钮下的说明多余）。 */
  detail?: string;
  /** 按钮下那一行：只有生成不了的原因（积分不足、暂时无法生成）。 */
  note?: string;
};

const n = (value: number) => value.toLocaleString("zh-CN");

/**
 * 按钮上的价、悬停提示和下面那一行字。下面那一行只写生成不了的原因；赠款抵扣、两个账户价不同、优化提示词另计都放悬停提示。
 * fallback 是本地按价表算的标准价，报价没回来或报不出来时用；为空就不显示价格（不编）。
 */
export function describeStudioVideoPrice(price: StudioVideoPrice, fallback: number | null, opts: { optimizing?: boolean } = {}): StudioVideoPriceView | undefined {
  if (price.status !== "ready") return fallback == null ? undefined : { standard: fallback, shown: fallback, pending: price.status === "loading" };
  const optimizing = opts.optimizing ? "优化提示词按实际用量另计。" : "";
  const detailOf = (text = "") => (text + optimizing) || undefined;
  const discountOf = (q: ModelBillingQuote) => q.discountCredits > 0 ? `${q.discountName || "优惠"}，省 ${n(q.discountCredits)} 积分` : undefined;
  if (price.payer === "decided") {
    const q = price.quote;
    const grant = q.scopedCredits > 0 ? `模型赠款抵扣 ${n(q.scopedCredits)} 积分，${q.walletCredits > 0 ? `另需支付 ${n(q.walletCredits)} 积分` : "无需另付积分"}。` : "";
    const note = q.canAfford ? undefined : q.unavailableCode === "MODEL_CREDITS_INSUFFICIENT" ? `可用积分不足，需支付 ${n(q.walletCredits)} 积分。` : q.unavailableReason || "暂时无法生成。";
    return { standard: q.standardCredits, shown: q.payableCredits, discount: discountOf(q), detail: detailOf(grant), note };
  }
  const { personal, enterprise } = price;
  if (enterprise && enterprise.payableCredits !== personal.payableCredits)
    return { standard: personal.standardCredits, shown: Math.min(personal.payableCredits, enterprise.payableCredits), from: true,
      detail: detailOf(`个人账户 ${n(personal.payableCredits)} 积分，企业账户 ${n(enterprise.payableCredits)} 积分。`) };
  return { standard: personal.standardCredits, shown: personal.payableCredits, discount: discountOf(personal), detail: detailOf() };
}
