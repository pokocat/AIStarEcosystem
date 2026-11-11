import type { IpProjectDoc, IpRun } from './ip-studio';
import type { EnterpriseBillingSelection } from './enterprise';
import type { StudioTakeChange } from './ip-studio-scenes';
import type { StudioPlanExecution, StudioRunRequest, StudioSegmentedVideoRequest } from './ip-studio-workflow';

export type StudioVideoTaskKind = 'direct' | 'segmented' | 'recreation' | 'depth' | 'replacement';
/** 爆款复刻的三种方式：分镜复刻 / 深度复刻 / 元素替换（服务端 StudioCloneVideoPlan）。 */
export type StudioVideoCloneMode = 'recreation' | 'depth' | 'replacement';
/** 爆款复刻：这条参考视频适合哪种方式。只按真实切镜数和平均镜头时长判断，不调模型；元素替换看用户意图，不推荐。 */
export interface StudioCloneAdvice {
  durationSec: number;
  shots: number;
  averageShotSec: number;
  recommended: Exclude<StudioVideoCloneMode, 'replacement'>;
  reason: string;
}
/** Immutable submission input; media nodes carry keys, never signed URLs. */
export type StudioVideoTaskInput = Pick<IpProjectDoc, 'sceneInputs' | 'sceneVideoState' | 'sceneVideoModel' | 'nodes'> & { take?: StudioVideoTakeInfo };
/**
 * 「视频裂变」里这一条怎么来的（只用来在列表里分清每一条）：same = 原样，variables = 换变量（页面直接替换，不调 AI），rewrite = AI 改写。
 * of 是从哪条任务再来的。
 */
export interface StudioVideoTakeInfo { of: string; mode: 'same' | 'variables' | 'rewrite'; changes?: StudioTakeChange[] }
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
