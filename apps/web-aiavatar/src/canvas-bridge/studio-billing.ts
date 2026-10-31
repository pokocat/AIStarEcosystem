import { apiFetch } from "@ai-star-eco/api-client";
import type { IpModels } from "./api";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";

export type StudioBillingRequest = { clientRequestId?: string; billing?: EnterpriseBillingSelection | null; model?: string; maxCost?: number; operation?: string; modelBilling?: import('@ai-star-eco/types/model-billing').ModelBillingApproval };
export type StudioBillingDetails = { operation?: string; expectedCost?: number; textUsage?: boolean; model?: string; libraryObjectId?: string; nodeId?: string; modelQuote?: boolean };
export type BillingLookup = import('@ai-star-eco/types/enterprise').EnterpriseBillingReplaySelection;
type Decision={billing?:EnterpriseBillingSelection;modelBilling?:import('@ai-star-eco/types/model-billing').ModelBillingApproval};
const pending = new Map<string, Promise<Decision>>();
const prefix = "ipstudio:payer:",quotePrefix='ipstudio:model-approval:';

export function readSavedStudioBilling(key: string): EnterpriseBillingSelection | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(prefix + key) || "null");
    if (value?.mode === "personal") return { mode: "personal" };
    if (value?.mode === "enterprise" && typeof value.enterpriseId === "string") return { mode: "enterprise", enterpriseId: value.enterpriseId };
  } catch { /* The server remains authoritative when browser storage is unavailable. */ }
}
function savedApproval(key:string) {
  try {const value=JSON.parse(sessionStorage.getItem(quotePrefix+key)||'null');if(value?.target&&value?.usage&&typeof value.priceVersion==='string'&&typeof value.freeOnly==='boolean'&&Number.isSafeInteger(value.maxWalletCredits))return value as NonNullable<StudioBillingRequest['modelBilling']>;}catch{ /* No local draft can authorize a server charge. */ }
}
/** Resolve accepted requests first. Unknown receipts retain the original payer and approval on retry. */
export async function withStudioBilling<T extends object>(projectId: string, request: T, details: StudioBillingDetails = {}): Promise<T> {
  const payerRequest=request as T&StudioBillingRequest;
  const enterpriseEnabled=process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED==='1';
  const kind=details.operation||payerRequest.operation;
  const modelQuote=(kind==='image'||kind==='video')&&!details.libraryObjectId;
  if(!enterpriseEnabled&&!modelQuote)return request;
  payerRequest.clientRequestId ||= crypto.randomUUID();
  const key=`${projectId}:${payerRequest.clientRequestId}`;
  let operation=pending.get(key);
  if(!operation){
    operation=(async()=>{
      const lookup=details.libraryObjectId
        ?await apiFetch<BillingLookup>(`/v1/ip-studio/library/objects/${encodeURIComponent(details.libraryObjectId)}/billing-selection`,{query:{clientRequestId:payerRequest.clientRequestId}})
        :await apiFetch<BillingLookup>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/billing-selection`,{query:{clientRequestId:payerRequest.clientRequestId}});
      if(lookup.found)return {billing:lookup.billing||undefined,modelBilling:lookup.modelBilling||undefined};
      const capabilities=modelQuote?await apiFetch<{mock:boolean}>('/v1/ip-studio/studio/capabilities'):undefined;
      const requireQuote=modelQuote&&!capabilities?.mock;
      let billing=enterpriseEnabled?(readSavedStudioBilling(key)||(payerRequest.modelBilling?payerRequest.billing||undefined:undefined)):undefined;
      if(enterpriseEnabled&&!billing){
        const {chooseStudioBilling}=await import('@/ip/studio-billing-dialog');
        billing=await chooseStudioBilling({...details,operation:details.operation||payerRequest.operation,expectedCost:details.expectedCost??payerRequest.maxCost,model:details.model||payerRequest.model,...(requireQuote?{modelQuote:true}:{})});
        try{sessionStorage.setItem(prefix+key,JSON.stringify(billing));}catch{ /* Preserve the request's payer even without storage. */ }
      }
      if(!requireQuote)return {billing};
      const original=payerRequest.modelBilling||savedApproval(key);
      if(original&&!original.priceVersion.startsWith('stale:'))return {billing,modelBilling:original};
      const body={...request,billing,modelBilling:undefined};
      const quote=await import('./studio-model-quote');
      const load=(freeOnly:boolean,signal:AbortSignal)=>kind==='video'
        ?payerRequest.operation==='video'?quote.quoteWorkflowVideo(projectId,body,freeOnly,signal):quote.quoteVideoRequest(projectId,body,freeOnly,signal)
        :details.nodeId?quote.quoteImageNode(projectId,details.nodeId,body,freeOnly,signal)
        :payerRequest.operation==='image'?quote.quoteWorkflowImage(projectId,body,freeOnly,signal):quote.quoteImageRequest(projectId,body,freeOnly,signal);
      const {confirmStudioModelQuote}=await import('@/ip/studio-model-quote-dialog');
      const modelBilling=await confirmStudioModelQuote(load,billing,original?.freeOnly??false);
      try{sessionStorage.setItem(quotePrefix+key,JSON.stringify(modelBilling));}catch{ /* The original request still retains approval for retry. */ }
      return {billing,modelBilling};
    })();pending.set(key,operation);
  }
  try{
    const decision=await operation;
    if(decision.billing)payerRequest.billing=decision.billing;else delete payerRequest.billing;
    if(decision.modelBilling)payerRequest.modelBilling=decision.modelBilling;else delete payerRequest.modelBilling;
    return request;
  }finally{pending.delete(key);}
}

/** These pre-admission errors roll back the task; retry requires a new quote, retaining free-only intent. */
export function invalidateStudioModelQuote(projectId:string,request:StudioBillingRequest,error:unknown) {
  if(!error||typeof error!=='object'||!('code' in error)||!['MODEL_QUOTE_CHANGED','SCOPED_CREDITS_INSUFFICIENT','MODEL_CREDITS_INSUFFICIENT','SCOPED_RESOURCE_LIMIT','SCOPED_CONCURRENT_LIMIT'].includes(String(error.code))||!request.modelBilling)return;
  const approval={...request.modelBilling,priceVersion:'stale:'+request.modelBilling.priceVersion.replace(/^stale:/,'')};request.modelBilling=approval;
  if(request.clientRequestId)try{sessionStorage.setItem(quotePrefix+`${projectId}:${request.clientRequestId}`,JSON.stringify(approval));}catch{ /* Request snapshot remains marked stale. */ }
}

export async function legacyImageBillingDetails(doc: unknown, nodeId: string) {
  if (process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED !== "1") return {};
  const node = (doc as { nodes?: { id: string; metadata?: { model?: string; count?: number } }[] } | undefined)?.nodes?.find(item => item.id === nodeId);
  const choices = (await apiFetch<IpModels>("/v1/ip-studio/models")).image;
  const chosen = choices.find(model => model.endpointId === node?.metadata?.model) || choices.find(model => model.isDefault) || choices[0];
  return { model: chosen?.endpointId, expectedCost: chosen ? chosen.creditCost * (node?.metadata?.count || 1) : undefined };
}
