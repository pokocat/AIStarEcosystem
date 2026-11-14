import { apiFetch } from "@ai-star-eco/api-client";
import type { VideoPortraitOverview, VideoPortraitItem, VideoPortraitPerson, VideoPortraitReview, VideoPortraitPreparation, VideoPortraitDeclaration, VideoPortraitVerified } from "@ai-star-eco/types/video-portrait-library";

export const portraitOverview = () => apiFetch<VideoPortraitOverview>("/v1/ip-studio/asset-library");
export const verifiedPortraits = () => apiFetch<VideoPortraitVerified[]>("/v1/ip-studio/asset-library/verified");
export const registerPortrait = (body: { libraryId: string; key: string; mediaType: string; label: string }) => apiFetch<VideoPortraitItem>("/v1/ip-studio/asset-library/items", { method: "POST", body });
export const declarePortrait = (id: string, body: VideoPortraitDeclaration) => apiFetch<VideoPortraitItem>(`/v1/ip-studio/asset-library/items/${encodeURIComponent(id)}/declaration`, { method: "POST", body });
export const declarePortraits = (ids: string[], declaration: VideoPortraitDeclaration) =>
  apiFetch<VideoPortraitItem[]>("/v1/ip-studio/asset-library/items/declarations", { method: "POST", body: { ids, ...declaration } });
export const refreshPortrait = (id: string) => apiFetch<VideoPortraitItem>(`/v1/ip-studio/asset-library/items/${encodeURIComponent(id)}/refresh`, { method: "POST" });
export const startPortraitPerson = (body: { libraryId: string; name: string; clientRequestId: string; accepted: boolean; agreementVersion: string }) => apiFetch<VideoPortraitPerson>("/v1/ip-studio/asset-library/persons", { method: "POST", body });
export const refreshPortraitPerson = (id: string) => apiFetch<VideoPortraitPerson>(`/v1/ip-studio/asset-library/persons/${encodeURIComponent(id)}/refresh`, { method: "POST" });
export const revokePortraitPerson = (id: string) => apiFetch<void>(`/v1/ip-studio/asset-library/persons/${encodeURIComponent(id)}`, { method: "DELETE" });
export const checkPortraitInputs = (model: string, keys: string[]) => apiFetch<VideoPortraitPreparation>("/v1/ip-studio/asset-library/check", { method: "POST", body: { model, keys } });
export const portraitReview = (id: string) => apiFetch<VideoPortraitReview>(`/v1/ip-studio/asset-library/reviews/${encodeURIComponent(id)}`);
export const resumePortraitReview = (id: string) => apiFetch<VideoPortraitReview>(`/v1/ip-studio/asset-library/reviews/${encodeURIComponent(id)}/resume`, { method: "POST" });
