import { apiFetch } from '@ai-star-eco/api-client';
import type { StudioTemplateVersion, StudioTemplatePublishRequest, StudioTemplateUseRequest, StudioTemplatePlan, StudioTemplateInstance, StudioTemplateExecution, StudioTemplateExecuteRequest, StudioTemplateAcceptRequest, StudioAdoptRequest, IpRun, StudioTemplatePackage, StudioTemplatePackageRequest, StudioTemplateMetrics } from '@ai-star-eco/types';

export const readTemplateVersion=(versionId:string)=>apiFetch<StudioTemplateVersion>(`/v1/ip-studio/template-versions/${encodeURIComponent(versionId)}`);
export const publishTemplateVersion=(projectId:string,request:StudioTemplatePublishRequest)=>apiFetch<StudioTemplateVersion>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/template-versions`,{method: "POST",body:request});
export const previewTemplate=(request:StudioTemplateUseRequest)=>apiFetch<StudioTemplatePlan>('/v1/ip-studio/template-plan',{method: "POST",body:request});
export const instantiateTemplate=(request:StudioTemplateUseRequest)=>apiFetch<StudioTemplateInstance>('/v1/ip-studio/template-instances',{method: "POST",body:request});
export const readTemplateInstance=(projectId:string)=>apiFetch<StudioTemplateInstance>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/template-instance`);
export const templateAvailability=(templateId:string,enabled:boolean)=>apiFetch<void>(`/v1/ip-studio/templates/${encodeURIComponent(templateId)}/availability`,{method: "PUT",body:{enabled}});
export const readTemplateExecution=(projectId:string)=>apiFetch<StudioTemplateExecution>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/template-execution`);
export const executeTemplateStep=(projectId:string,stepId:string,request:StudioTemplateExecuteRequest)=>apiFetch<IpRun>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/template-steps/${encodeURIComponent(stepId)}/runs`,{method: "POST",body:request});
export const acceptTemplateStep=(projectId:string,stepId:string,request:StudioTemplateAcceptRequest)=>apiFetch<StudioTemplateExecution>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/template-steps/${encodeURIComponent(stepId)}/accept`,{method: "POST",body:request});
export const archiveTemplateStep=(projectId:string,stepId:string,request:StudioAdoptRequest)=>apiFetch<StudioTemplateExecution>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/template-steps/${encodeURIComponent(stepId)}/archive`,{method: "POST",body:request});
export const listTemplatePackages=(projectId:string)=>apiFetch<StudioTemplatePackage[]>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/template-packages`);
export const createTemplatePackage=(projectId:string,request:StudioTemplatePackageRequest)=>apiFetch<StudioTemplatePackage>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/template-packages`,{method: "POST",body:request});
export const readTemplateMetrics=(versionId:string)=>apiFetch<StudioTemplateMetrics>(`/v1/ip-studio/template-versions/${encodeURIComponent(versionId)}/metrics`);
