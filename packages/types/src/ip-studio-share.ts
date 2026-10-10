import type { StudioAssistantMode, StudioPlan, StudioTurn } from './ip-studio-workflow';
/** Explicit text snapshot only. No source node/asset IDs, media URLs or run requests. */
export interface StudioConversationSnapshot {
  title: string;
  mode: StudioAssistantMode;
  turns: StudioTurn[];
  plan?: StudioPlan;
}
export interface StudioConversationShare { token: string; path: string; createdAt: string }
export interface StudioConversationSharePreview { snapshot: StudioConversationSnapshot; snapshotHash: string; share?: StudioConversationShare }
export interface StudioConversationSharePublic { snapshot: StudioConversationSnapshot; createdAt: string }
