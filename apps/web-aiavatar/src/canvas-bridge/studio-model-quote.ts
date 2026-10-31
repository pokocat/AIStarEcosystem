import { apiFetch } from '@ai-star-eco/api-client';
import type { ModelBillingQuote } from '@ai-star-eco/types/model-billing';

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
