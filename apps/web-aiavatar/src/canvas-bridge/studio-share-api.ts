import { apiFetch } from '@ai-star-eco/api-client';
import type { StudioConversationShare, StudioConversationSharePreview, StudioConversationSharePublic } from '@ai-star-eco/types/ip-studio-share';
export const previewConversationShare=(project:string,node:string)=>apiFetch<StudioConversationSharePreview>(`/v1/ip-studio/projects/${encodeURIComponent(project)}/conversations/${encodeURIComponent(node)}/share`);
export const createConversationShare=(project:string,node:string,snapshotHash:string)=>apiFetch<StudioConversationShare>(`/v1/ip-studio/projects/${encodeURIComponent(project)}/conversations/${encodeURIComponent(node)}/share`,{method: "POST",body:{snapshotHash}});
export const revokeConversationShare=(project:string,node:string,token:string)=>apiFetch<{revoked:boolean}>(`/v1/ip-studio/projects/${encodeURIComponent(project)}/conversations/${encodeURIComponent(node)}/share/${encodeURIComponent(token)}`,{method: "DELETE"});
export const readConversationShare=(token:string)=>apiFetch<StudioConversationSharePublic>(`/v1/ip-studio/shared/conversations/${encodeURIComponent(token)}`);
export const copyConversationShare=(token:string,clientRequestId:string)=>apiFetch<{projectId:string}>(`/v1/ip-studio/shared/conversations/${encodeURIComponent(token)}/copy`,{method: "POST",body:{clientRequestId}});
