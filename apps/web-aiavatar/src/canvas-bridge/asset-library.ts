import { withStudioBilling } from "./studio-billing";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import { apiFetch, apiFetchPaginated } from '@ai-star-eco/api-client';
import type { LibraryFolder, LibraryObject, LibraryObjectEdit, LibraryPage, LibraryMaterial, LibraryCandidate, LibraryExtraction, LibraryGenerateRequest, IpRun, StudioMediaImportResult } from '@ai-star-eco/types';
const LIBRARY_BASE='/v1/ip-studio/library';
export const libraryFolders=()=>apiFetch<LibraryFolder[]>(`${LIBRARY_BASE}/folders`);
export const createLibraryFolder=(name:string)=>apiFetch<LibraryFolder>(`${LIBRARY_BASE}/folders`,{method: "POST",body:{name}});
export const renameLibraryFolder=(id:string,name:string)=>apiFetch<LibraryFolder>(`${LIBRARY_BASE}/folders/${id}`,{method: "PUT",body:{name}});
export const deleteLibraryFolder=(id:string)=>apiFetch<void>(`${LIBRARY_BASE}/folders/${id}`,{method: "DELETE"});
export const libraryObjects=(query:Record<string,string|number|undefined>={})=>apiFetchPaginated<LibraryObject>(`${LIBRARY_BASE}/objects`,{query}).then(r=>({items:r.data,page:r.pagination.page,total:r.pagination.total,hasMore:r.pagination.hasNext}));
export const libraryMaterials=(query:Record<string,string|number|undefined>={})=>apiFetchPaginated<LibraryMaterial>(`${LIBRARY_BASE}/materials`,{query}).then(r=>({items:r.data,page:r.pagination.page,total:r.pagination.total,hasMore:r.pagination.hasNext}));
export const readLibraryObject=(id:string)=>apiFetch<LibraryObject>(`${LIBRARY_BASE}/objects/${id}`);
export const editLibraryObject=(id:string,body:LibraryObjectEdit)=>apiFetch<LibraryObject>(`${LIBRARY_BASE}/objects/${id}`,{method: "PATCH",body});
export const createLibraryObject=(body:{name:string;kind:string;description:string;folderId?:string})=>apiFetch<LibraryObject>(`${LIBRARY_BASE}/objects`,{method: "POST",body});
export const deleteLibraryObject=(id:string)=>apiFetch<void>(`${LIBRARY_BASE}/objects/${id}`,{method: "DELETE"});
export const editLibraryMaterial=(id:string,body:{title?:string;folderId?:string|null})=>apiFetch<LibraryMaterial>(`${LIBRARY_BASE}/materials/${id}`,{method: "PATCH",body});
export const generateLibraryObject=async(id:string,body:LibraryGenerateRequest)=>apiFetch<IpRun>(`${LIBRARY_BASE}/objects/${id}/generate`,{method: "POST",body:await withStudioBilling(`library:${id}`,body,{operation:"image",libraryObjectId:id})});
export const addLibraryVersion=(id:string,storageKey:string,main=true)=>apiFetch<LibraryObject>(`${LIBRARY_BASE}/objects/${id}/versions`,{method: "POST",body:{storageKey,main}});
export const extractLibraryAssets=async(projectId:string,body:{billing?:EnterpriseBillingSelection;nodeId:string;analyze?:boolean;episodeNo?:number;clientRequestId?:string;model?:string;maxCost?:number})=>apiFetch<LibraryExtraction>(`/v1/ip-studio/projects/${projectId}/library/extract`,{method: "POST",body:body.analyze?await withStudioBilling(projectId,body,{operation:"asset-extract",textUsage:true}):body});
export const saveLibraryExtraction=(projectId:string,body:{nodeId:string;sourceHash:string;folderId?:string;items:LibraryCandidate[]})=>apiFetch<LibraryObject[]>(`/v1/ip-studio/projects/${projectId}/library/save-extraction`,{method: "POST",body});
export const uploadLibraryMedia=(file:File,mediaType:'image'|'video'|'audio'='image',folderId?:string)=>{const body=new FormData();body.append('file',file);body.append('mediaType',mediaType);if(folderId)body.append('folderId',folderId);return apiFetch<StudioMediaImportResult>(`${LIBRARY_BASE}/uploads`,{method: "POST",body});};
export const mainLibraryVersion=(asset:LibraryObject)=>asset.versions.find(v=>v.id===asset.mainVersionId);

export const canvasLibraryFolder=(projectId:string)=>apiFetch<{folderId:string}>(`/v1/ip-studio/projects/${projectId}/library/folder`);

export const setCanvasLibraryFolder=(projectId:string,folderId?:string)=>apiFetch<void>(`/v1/ip-studio/projects/${projectId}/library/folder`,{method: "PUT",body:{folderId:folderId||null}});
