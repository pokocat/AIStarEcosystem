import { prepareStudioImageUpload } from './studio-image-file';
import { withStudioBilling, invalidateStudioModelQuote } from "./studio-billing";
import type { StudioVoiceCatalog,StudioVoiceProfile,StudioAdoptVoiceRequest,StudioBindVoiceRequest } from "@ai-star-eco/types/ip-studio-workflow";
import { apiFetch } from "@ai-star-eco/api-client";
import { USE_MOCK } from "@/ip/api/_client";
import { getProject } from "@/ip/api/ip-studio";
import type { IpProject, IpRun, StudioMediaImportResult } from "@ai-star-eco/types";
import type { StudioAssetCatalog, StudioAdoptRequest, StudioAdoptResult, StudioCapabilities, StudioIpAsset, StudioRunRequest } from "@ai-star-eco/types/ip-studio-workflow";
import type { StudioSpeechCatalog, StudioSpeechRequest } from "@ai-star-eco/types/ip-studio-workflow";
import type { StudioLipSyncCatalog, StudioLipSyncInput, StudioLipSyncQuote, StudioLipSyncRequest } from "@ai-star-eco/types/ip-studio-workflow";
import type { StudioStoryImportResult } from "@ai-star-eco/types/ip-studio-workflow";

export const importStudioStory = (projectId: string, file: File) => {
  const body = new FormData(); body.append('file', file);
  return apiFetch<StudioStoryImportResult>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/story-import`, { method: "POST", body });
};

export const importStudioMedia = async (projectId: string, file: File, mediaType: StudioMediaImportResult['mediaType']) => {
  const prepared = mediaType === 'image' ? await prepareStudioImageUpload(file) : file;
  const body = new FormData(); body.append('file', prepared); body.append('mediaType', mediaType);
  return apiFetch<StudioMediaImportResult>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/media-import`, { method: "POST", body });
};

export const studioLipSyncCatalog = () => apiFetch<StudioLipSyncCatalog>("/v1/ip-studio/studio/lip-sync-catalog");
export const quoteStudioLipSync = (projectId:string,input:StudioLipSyncInput) => apiFetch<StudioLipSyncQuote>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/lip-sync-quote`,{method:"POST",body:input});
export const submitStudioLipSync = async (projectId:string,request:StudioLipSyncRequest) => apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/lip-sync-runs`,{method:"POST",body:await withStudioBilling(projectId,request,{operation:"lip-sync"})});
export const extractStudioLipSync = (projectId:string,runId:string) => apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/lip-sync-runs/${encodeURIComponent(runId)}/extract`,{method:"POST"});

export const studioSpeechCatalog = () => apiFetch<StudioSpeechCatalog>("/v1/ip-studio/studio/speech-catalog");
export const submitStudioSpeech = async (projectId: string, request: StudioSpeechRequest) =>
  apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/speech-runs`, { method: "POST", body: await withStudioBilling(projectId, request, { operation: "speech" }) });

export const studioCapabilities = () => apiFetch<StudioCapabilities>("/v1/ip-studio/studio/capabilities");
export const submitStudioRun = async (projectId: string, request: StudioRunRequest) => {
  const body=await withStudioBilling(projectId,request);
  try{return await apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/studio-runs`,{method:"POST",body});}
  catch(error){invalidateStudioModelQuote(projectId,request,error);throw error;}
};
export const adoptStudioImage = (projectId: string, request: StudioAdoptRequest) =>
  apiFetch<StudioAdoptResult>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/adopt`, { method: "POST", body: request });
// Mock-aware: the workspace reads the run list through this helper to decide whether finished execution outputs must be
// restored; USE_MOCK=1 must see the same runs the mock-aware IpStudioApi.getProject returns (Codex R3-02).
export const readStudioProject = (projectId: string) => USE_MOCK ? getProject(projectId) : apiFetch<IpProject>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}`);
export const listStudioIps = () => apiFetch<{ id: string; name: string }[]>("/v1/assets/ips");
export const listStudioIpAssets = () => apiFetch<StudioIpAsset[]>("/v1/ip-studio/studio/ip-assets");
export const classifyStudioIpAsset = (avatarId:string,lookId:string,assetRole:string) => apiFetch<StudioIpAsset>(`/v1/ip-studio/studio/performers/${encodeURIComponent(avatarId)}/looks/${encodeURIComponent(lookId)}/role`,{method:"PUT",body:{assetRole}});
export const studioAssetCatalog = () => apiFetch<StudioAssetCatalog>("/v1/ip-studio/studio/asset-catalog");

export const studioVoiceProfiles = () => apiFetch<StudioVoiceCatalog>("/v1/ip-studio/studio/voice-profiles");
export const adoptStudioVoice = (projectId:string,request:StudioAdoptVoiceRequest) => apiFetch<StudioVoiceProfile>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/adopt-voice`,{method:"POST",body:request});
export const bindStudioVoice = (avatarId:string,request:StudioBindVoiceRequest) => apiFetch<StudioVoiceProfile>(`/v1/ip-studio/studio/performers/${encodeURIComponent(avatarId)}/voice`,{method:"PUT",body:request});
