import type { IpRun, IpSavedAsset } from './ip-studio';
export type LibraryObjectKind = 'character' | 'scene' | 'prop';
export interface LibraryFolder { id: string; name: string }
export interface LibrarySource { id: string; projectId: string; nodeId: string; title: string; evidence: string; description: string }
export interface LibraryVersion { id: string; storageKey: string; url: string; prompt: string; createdAt: string; runId?: string; mock?: boolean }
export interface LibraryObject {
  id: string; kind: LibraryObjectKind; name: string; description: string; prompt: string; folderId?: string;
  referenceKey?: string; referenceUrl?: string; mainVersionId?: string; versions: LibraryVersion[]; sources: LibrarySource[];
  pendingRun?: IpRun; createdAt: string; updatedAt: string;
}
export interface LibraryCandidate { key: string; kind: LibraryObjectKind; name: string; description: string; evidence: string; reuseId?: string }
export interface LibraryExtraction { sourceHash: string; title: string; items: LibraryCandidate[]; run?: IpRun;warnings?:string[] }
export interface LibraryPage<T> { items: T[]; page: number; total: number; hasMore: boolean }
export interface LibraryObjectEdit { name?: string; description?: string; prompt?: string; folderId?: string | null; referenceKey?: string | null; mainVersionId?: string; updatedAt?: string }
export interface LibraryGenerateRequest { clientRequestId: string; model?: string; aspectRatio: string; maxCost: number; billing?: import("./enterprise").EnterpriseBillingSelection }
export type LibraryMaterial = IpSavedAsset;
