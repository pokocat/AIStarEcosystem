import type { IpProjectDoc, IpRun } from './ip-studio';
import type { EnterpriseBillingSelection } from './enterprise';
import type { StudioPlanExecution, StudioRunRequest, StudioSegmentedVideoRequest } from './ip-studio-workflow';

export type StudioVideoTaskKind = 'direct' | 'segmented' | 'recreation';
/** Immutable submission input; media nodes carry keys, never signed URLs. */
export type StudioVideoTaskInput = Pick<IpProjectDoc, 'sceneInputs' | 'sceneVideoState' | 'sceneVideoModel' | 'nodes'>;
export interface StudioVideoTaskCreate {
  clientRequestId: string; kind: StudioVideoTaskKind; sceneId: string; title: string;
  configuration?: StudioSegmentedVideoRequest; video?: StudioRunRequest; budgetCap: number;
  sourceNodeId?: string; input: StudioVideoTaskInput; billing?: EnterpriseBillingSelection;
}
export interface StudioVideoTaskQuote { estimated: number; cap: number; segments: number[]; boards: number }
export interface StudioVideoTask {
  id: string; projectId: string; sceneId: string; title: string; kind: StudioVideoTaskKind; createdAt: string;
  execution?: StudioPlanExecution; run?: IpRun; input?: StudioVideoTaskInput; request?: StudioVideoTaskCreate;
  retryAt?: string; retryStepId?: string;
}
export interface StudioVideoTaskPage { items: StudioVideoTask[]; page: number; hasMore: boolean }
