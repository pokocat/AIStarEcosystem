import type { StudioVoiceCatalog,StudioVoiceProfile,StudioAdoptVoiceRequest,StudioBindVoiceRequest } from "@ai-star-eco/types/ip-studio-workflow";
import { apiFetch } from "@ai-star-eco/api-client";
import type { IpProject, IpRun, StudioMediaImportResult } from "@ai-star-eco/types";
import type { StudioAssetCatalog, StudioAdoptRequest, StudioAdoptResult, StudioCapabilities, StudioIpAsset, StudioRunRequest } from "@ai-star-eco/types/ip-studio-workflow";
import type { StudioSpeechCatalog, StudioSpeechRequest } from "@ai-star-eco/types/ip-studio-workflow";
import type { StudioLipSyncCatalog, StudioLipSyncInput, StudioLipSyncQuote, StudioLipSyncRequest } from "@ai-star-eco/types/ip-studio-workflow";
import type { StudioStoryImportResult } from "@ai-star-eco/types/ip-studio-workflow";

export const importStudioStory = (projectId: string, file: File) => {
  const body = new FormData(); body.append('file', file);
  return apiFetch<StudioStoryImportResult>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/story-import`, { method: "POST", body });
};

export const importStudioMedia = (projectId: string, file: File, mediaType: StudioMediaImportResult['mediaType']) => {
  const body = new FormData(); body.append('file', file); body.append('mediaType', mediaType);
  return apiFetch<StudioMediaImportResult>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/media-import`, { method: "POST", body });
};

export const studioLipSyncCatalog = () => apiFetch<StudioLipSyncCatalog>("/v1/ip-studio/studio/lip-sync-catalog");
export const quoteStudioLipSync = (projectId:string,input:StudioLipSyncInput) => apiFetch<StudioLipSyncQuote>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/lip-sync-quote`,{method:"POST",body:input});
export const submitStudioLipSync = (projectId:string,request:StudioLipSyncRequest) => apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/lip-sync-runs`,{method:"POST",body:request});
export const extractStudioLipSync = (projectId:string,runId:string) => apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/lip-sync-runs/${encodeURIComponent(runId)}/extract`,{method:"POST"});

export const studioSpeechCatalog = () => apiFetch<StudioSpeechCatalog>("/v1/ip-studio/studio/speech-catalog");
export const submitStudioSpeech = (projectId: string, request: StudioSpeechRequest) =>
  apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/speech-runs`, { method: "POST", body: request });

export const studioCapabilities = () => apiFetch<StudioCapabilities>("/v1/ip-studio/studio/capabilities");
export const submitStudioRun = (projectId: string, request: StudioRunRequest) =>
  apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/studio-runs`, { method: "POST", body: request });
export const adoptStudioImage = (projectId: string, request: StudioAdoptRequest) =>
  apiFetch<StudioAdoptResult>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/adopt`, { method: "POST", body: request });
export const readStudioProject = (projectId: string) => apiFetch<IpProject>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}`);
export const listStudioIps = () => apiFetch<{ id: string; name: string }[]>("/v1/assets/ips");
export const listStudioIpAssets = () => apiFetch<StudioIpAsset[]>("/v1/ip-studio/studio/ip-assets");
export const classifyStudioIpAsset = (avatarId:string,lookId:string,assetRole:string) => apiFetch<StudioIpAsset>(`/v1/ip-studio/studio/performers/${encodeURIComponent(avatarId)}/looks/${encodeURIComponent(lookId)}/role`,{method:"PUT",body:{assetRole}});
export const studioAssetCatalog = () => apiFetch<StudioAssetCatalog>("/v1/ip-studio/studio/asset-catalog");

export const studioVoiceProfiles = () => apiFetch<StudioVoiceCatalog>("/v1/ip-studio/studio/voice-profiles");
export const adoptStudioVoice = (projectId:string,request:StudioAdoptVoiceRequest) => apiFetch<StudioVoiceProfile>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/adopt-voice`,{method:"POST",body:request});
export const bindStudioVoice = (avatarId:string,request:StudioBindVoiceRequest) => apiFetch<StudioVoiceProfile>(`/v1/ip-studio/studio/performers/${encodeURIComponent(avatarId)}/voice`,{method:"PUT",body:request});
