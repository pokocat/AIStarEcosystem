import type { IpRun, IpSavedAsset } from './ip-studio';
export type LibraryObjectKind = 'character' | 'scene' | 'prop' | 'product';
export interface LibraryFolder { id: string; name: string }
/** origin：空 = 剧本提取；director = 导演台那一项自动建的卡；director-link = 导演台关联来用的；canvas = 从画布存的。 */
export interface LibrarySource { id: string; projectId: string; nodeId: string; title: string; evidence: string; description: string; origin?: 'director' | 'director-link' | 'canvas' | null }
/** label：这一张是什么（导演台的角色形态名、场景视角），主图没有。 */
export interface LibraryVersion { id: string; storageKey: string; url: string; prompt: string; createdAt: string; runId?: string; mock?: boolean; label?: string | null }
export interface LibraryObject {
  id: string; kind: LibraryObjectKind; name: string; description: string; prompt: string; folderId?: string;
  referenceKey?: string; referenceUrl?: string; mainVersionId?: string; versions: LibraryVersion[]; sources: LibrarySource[];
  pendingRun?: IpRun; createdAt: string; updatedAt: string;
}
export interface LibraryCandidate { key: string; kind: LibraryObjectKind; name: string; description: string; evidence: string; reuseId?: string }
export interface LibraryExtraction { sourceHash: string; title: string; items: LibraryCandidate[]; run?: IpRun;warnings?:string[] }
export interface LibraryPage<T> { items: T[]; page: number; total: number; hasMore: boolean }
export interface LibraryObjectEdit { name?: string; description?: string; prompt?: string; folderId?: string | null; referenceKey?: string | null; mainVersionId?: string; updatedAt?: string; /** 删掉一张图（商品库用，至少保留一张）。 */ removeVersionId?: string }
export interface LibraryGenerateRequest { clientRequestId: string; model?: string; aspectRatio: string; maxCost: number; billing?: import("./enterprise").EnterpriseBillingSelection }
export type LibraryMaterial = IpSavedAsset;
/** 资产库里东西的来源：导演台作品或画布。deleted 表示作品或画布已删除，资产还在。 */
export interface LibrarySourceOption { id: string; type: 'director' | 'canvas'; title: string; deleted: boolean; count: number }
/** 一张已有的图存成角色、场景、道具：给 objectId 就加到那一项，否则按 kind + name 新建。 */
export interface LibrarySaveMediaRequest { clientRequestId: string; storageKey: string; objectId?: string; kind?: LibraryObjectKind; name?: string; description?: string; folderId?: string; projectId?: string; nodeId?: string }
