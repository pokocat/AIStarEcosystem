import { apiFetch } from '@ai-star-eco/api-client';
import type { StudioVideoEffect, StudioVideoEffectPublishRequest } from '@ai-star-eco/types';

export const listVideoEffects = () => apiFetch<StudioVideoEffect[]>('/v1/ip-studio/video-effects');
export const publishVideoEffect = (body: StudioVideoEffectPublishRequest) => apiFetch<StudioVideoEffect>('/v1/ip-studio/video-effects',{method: "POST",body});
export const favoriteVideoEffect = (id:string,favorite:boolean) => apiFetch<StudioVideoEffect>(`/v1/ip-studio/video-effects/${encodeURIComponent(id)}/favorite`,{method: "PUT",body:{favorite}});
export const applyVideoEffect = (id:string,model:string) => apiFetch<StudioVideoEffect>(`/v1/ip-studio/video-effects/${encodeURIComponent(id)}/apply`,{method: "POST",body:{model}});
