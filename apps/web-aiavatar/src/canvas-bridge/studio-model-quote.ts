import { apiFetch } from '@ai-star-eco/api-client';
import type { ModelBillingQuote } from '@ai-star-eco/types/model-billing';
import type { EnterpriseBillingSelection } from '@ai-star-eco/types/enterprise';

/** Each route compiles exactly the same image request as its corresponding submission. */
export const quoteImageRequest = (projectId:string,request:object,freeOnly:boolean,signal?:AbortSignal) =>
  apiFetch<ModelBillingQuote>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/image-quote`,{method: "POST",body:request,query:{freeOnly},signal});
export const quoteWorkflowImage = (projectId:string,request:object,freeOnly:boolean,signal?:AbortSignal) =>
  apiFetch<ModelBillingQuote>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/studio-image-quote`,{method: "POST",body:request,query:{freeOnly},signal});
export const quoteImageNode = (projectId:string,nodeId:string,request:object,freeOnly:boolean,signal?:AbortSignal) =>
  apiFetch<ModelBillingQuote>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/nodes/${encodeURIComponent(nodeId)}/image-quote`,{method: "POST",body:request,query:{freeOnly},signal});

export const quoteVideoRequest = (projectId:string,request:object,freeOnly:boolean,signal?:AbortSignal) =>
  apiFetch<ModelBillingQuote>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/video-quote`,{method: "POST",body:request,query:{freeOnly},signal});
export const quoteWorkflowVideo = (projectId:string,request:object,freeOnly:boolean,signal?:AbortSignal) =>
  apiFetch<ModelBillingQuote>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/studio-video-quote`,{method: "POST",body:request,query:{freeOnly},signal});

/** What the AI video page's price depends on: no asset keys, no prompt (MaterialVideoBilling prices by counts). */
export type StudioVideoPriceQuery = { model?: string; mode: string; tier: string; aspectRatio: string; durationSec: number; imageRefs: number; videoRefs: number; audioRefs: number };
/** Read-only and GET, so it needs no draft and passes the phone-binding guard; the confirm dialog still quotes the full request. */
export const quoteVideoPrice = (query:StudioVideoPriceQuery,billing:EnterpriseBillingSelection,signal?:AbortSignal) =>
  apiFetch<ModelBillingQuote>('/v1/ip-studio/studio/video-price',{query:{...query,payer:billing.mode,enterpriseId:billing.mode==='enterprise'?billing.enterpriseId:undefined},signal});
/**
 * 「智能优化」那一笔的价：改写提示词用的是另一个文字模型，只能用普通积分，视频的模型赠款付不了它（2026-11-11 线上：视频全由赠款付，
 * 优化差 1 积分，任务一建就停在「需处理」）。点生成前和视频价分开核对。
 */
export const quoteVideoOptimizePrice = (billing:EnterpriseBillingSelection,signal?:AbortSignal) =>
  apiFetch<ModelBillingQuote>('/v1/ip-studio/studio/video-optimize-price',{query:{payer:billing.mode,enterpriseId:billing.mode==='enterprise'?billing.enterpriseId:undefined},signal});
