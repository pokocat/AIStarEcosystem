import { apiFetch, ApiError } from "@ai-star-eco/api-client";
import type { IpModels } from "./api";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";

export type StudioBillingRequest = { clientRequestId?: string; billing?: EnterpriseBillingSelection | null; model?: string; maxCost?: number; operation?: string; modelBilling?: import('@ai-star-eco/types/model-billing').ModelBillingApproval };
export type StudioBillingDetails = { operation?: string; expectedCost?: number; textUsage?: boolean; model?: string; libraryObjectId?: string; nodeId?: string; modelQuote?: boolean } & StudioShortageOptions;
/** 积分不足提示框要用的：页面能换成哪些模型、能不能接着生成。不给就只说明情况，不提供直接换模型。 */
export type StudioShortageOptions = { modelChoices?: import('@/ip/studio-credit-shortage').StudioModelChoice[]; canRetry?: boolean };
/** 出图、出视频的入口不能直接换模型时的说明。 */
export const STUDIO_GRANT_HINT='选用这些模型生成时，可用赠款抵扣。';
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
/**
 * 积分不够：打开提示框，用户选完后按「取消生成」收尾。各入口已经会撤销取消的那一次（不留失败的节点和记录），
 * 用户选了换模型或接着生成，页面从错误上读（studioCreditShortageChoice）。
 */
export async function studioCreditShortageCancel(input: import('@/ip/studio-credit-shortage').StudioCreditShortageInput) {
  const {askStudioCreditShortage}=await import('@/ip/studio-credit-shortage');
  const choice=await askStudioCreditShortage(input);
  return Object.assign(new ApiError({code:'STUDIO_BILLING_CANCELLED',message:'本次生成已取消，未提交任务。'},400),{creditShortage:choice});
}

/**
 * 花钱之前问一次付不付得起。付不起就弹积分不足提示框，并按「取消生成」抛出（见 studioCreditShortageCancel）。
 * 本月赠送的积分提交时才发，报价看不到：个人账户先把它领了再判断一次，别把刚好没领的人拦下。报价失败不在这里拦，交给调用方。
 */
export async function studioCreditCheck<T extends import('@ai-star-eco/types/model-billing').ModelBillingQuote>(load:()=>Promise<T>,billing:EnterpriseBillingSelection|undefined,input:Omit<import('@/ip/studio-credit-shortage').StudioCreditShortageInput,'quote'|'billing'|'reason'>):Promise<T|undefined> {
  let first=await load().catch(()=>undefined);
  if(first?.unavailableCode==='MODEL_CREDITS_INSUFFICIENT'&&billing?.mode!=='enterprise'){
    await apiFetch('/v1/account').catch(()=>undefined);
    first=await load().catch(()=>first);
  }
  if(first?.unavailableCode==='MODEL_CREDITS_INSUFFICIENT')throw await studioCreditShortageCancel({quote:first,billing,...input});
  return first;
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
      const quoteOf=(request:object,freeOnly:boolean,signal:AbortSignal)=>kind==='video'
        ?payerRequest.operation==='video'?quote.quoteWorkflowVideo(projectId,request,freeOnly,signal):quote.quoteVideoRequest(projectId,request,freeOnly,signal)
        :details.nodeId?quote.quoteImageNode(projectId,details.nodeId,request,freeOnly,signal)
        :payerRequest.operation==='image'?quote.quoteWorkflowImage(projectId,request,freeOnly,signal):quote.quoteImageRequest(projectId,request,freeOnly,signal);
      const load=(freeOnly:boolean,signal:AbortSignal)=>quoteOf(body,freeOnly,signal);
      // 付不起就不进费用确认：先报一次价，积分不够直接给提示框。报价失败交给费用弹窗（它显示原因和「重新报价」）。
      const freeOnly=original?.freeOnly??false;
      const signal=new AbortController().signal;
      const first=await studioCreditCheck(()=>load(freeOnly,signal),billing,{modelChoices:details.modelChoices,canRetry:details.canRetry,grantHint:STUDIO_GRANT_HINT,
        // 节点出图的模型在节点文档里，换不了。上限是原模型的价，别的模型报价不能带着它。
        verifyChoice:details.nodeId?undefined:(model,patch)=>quoteOf({...body,...patch,model,maxCost:undefined},false,signal)});
      const {confirmStudioModelQuote}=await import('@/ip/studio-model-quote-dialog');
      const chosenId=first?.target.endpointId;
      const modelName=details.modelChoices?.find(m=>chosenId&&(m.endpointId===chosenId||m.legacyEndpointIds?.includes(chosenId)))?.name;
      const modelBilling=await confirmStudioModelQuote(load,billing,freeOnly,first,modelName);
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
