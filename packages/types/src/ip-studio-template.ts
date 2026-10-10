import type { IpProject, IpProjectDoc, IpRun } from './ip-studio';
import type { StudioReference } from './ip-studio-workflow';

/** Published recipes contain authored instructions, never private media or execution credentials. */
export interface StudioTemplateInput {
  id: string;
  nodeId: string;
  label: string;
  type: 'character' | 'image' | 'text' | 'option';
  required: boolean;
  options?: string[];
  defaultValue?: string;
}
export interface StudioTemplateVideo {
  mode: 't2v' | 'i2v' | 'first_last_frame_video' | 'universal_reference_video';
  resolutionTier: '768p' | '544p';
  seed?: number;
}
export interface StudioTemplateStep {
  id: string;
  nodeId: string;
  title: string;
  operation: 'image' | 'video';
  prompt: string;
  /** IDs of inputs or earlier steps. All references are declared explicitly. */
  references: string[];
  size?: '768x1024' | '1024x1024' | '768x1365' | '1365x768';
  outputRole: 'main' | 'sheet' | 'front' | 'side' | 'back' | 'expression' | 'detail' | 'custom' | 'video';
  requiresAdoption: boolean;
  durationSec?: number;
  aspectRatio?: string;
  /** Ordered recipe references fill first/last slots; contains no private media keys. */
  video?: StudioTemplateVideo;
}
export interface StudioTemplateRecipe {
  inputs: StudioTemplateInput[];
  steps: StudioTemplateStep[];
}
export interface StudioTemplateVersion {
  id: string;
  templateId: string;
  version: number;
  name: string;
  summary: string;
  visibility: 'personal' | 'official';
  recipe: StudioTemplateRecipe;
  doc: IpProjectDoc;
  createdAt: string;
}
export interface StudioTemplatePublishRequest {
  templateId?: string;
  name: string;
  summary?: string;
  visibility: 'personal' | 'official';
  recipe: StudioTemplateRecipe;
}
export interface StudioTemplateValue {
  text?: string;
  reference?: StudioReference;
}
export interface StudioTemplateUseRequest {
  name?: string;
  versionId: string;
  inputs: Record<string, StudioTemplateValue>;
  /** Explicit platform model choice. No provider keys in a recipe. */
  model?: string;
  videoModel?: string;
}
export interface StudioTemplatePlanStep {
  id: string;
  title: string;
  nodeId: string;
  outputRole: StudioTemplateStep['outputRole'];
  cost: number;
  status: 'ready' | 'waiting_dependency' | 'waiting_adoption';
  dependsOn: string[];
  requiresAdoption: boolean;
  operation?: 'image' | 'video';
}
export interface StudioTemplatePlan {
  versionId: string;
  version: number;
  model?: string;
  totalCost: number;
  imageCount: number;
  videoModel?: string;
  videoCount?: number;
  steps: StudioTemplatePlanStep[];
}
export interface StudioTemplateInstance {
  project: IpProject;
  source: StudioTemplateVersion;
  plan: StudioTemplatePlan;
}

export interface StudioTemplateExecutionStep {
  id: string;
  title: string;
  nodeId: string;
  outputRole: StudioTemplateStep['outputRole'];
  status: 'ready' | 'waiting_dependency' | 'waiting_adoption' | 'running' | 'failed' | 'done' | 'stale';
  requiresAdoption: boolean;
  cost?: number;
  run?: IpRun;
  storageKey?: string;
  url?: string;
  accepted: boolean;
  adoption?: import('./ip-studio-workflow').StudioAdoptResult;
  operation?: 'image' | 'video';
}
export interface StudioTemplateExecution {
  versionId: string;
  version: number;
  steps: StudioTemplateExecutionStep[];
  complete: boolean;
}
export interface StudioTemplateExecuteRequest {
  clientRequestId: string;
  maxCost: number;
  /** Explicit compare-and-set replacement; accepted/running jobs are never resubmitted. */
  replaceRunId?: string;
  /** Per-instance direction; published recipe stays immutable and references remain server-controlled. */
  prompt?: string;
}
export interface StudioTemplateAcceptRequest {
  runId: string;
  storageKey: string;
  accepted: boolean;
}
export interface StudioTemplatePackageRequest {
  title: string;
  description?: string;
  stepIds: string[];
}
export interface StudioTemplatePackage {
  id: string;
  title: string;
  versionId: string;
  boardKey: string;
  boardUrl: string;
  bundleKey: string;
  bundleUrl: string;
  width: number;
  height: number;
  imageCount: number;
  requiredCount: number;
  complete: boolean;
  createdAt: string;
}
export interface StudioTemplateMetrics {
  versionId: string;
  version: number;
  scope: 'owner';
  instances: number;
  completedInstances: number;
  generatedSteps: number;
  acceptedSteps: number;
  firstPassAcceptedSteps: number;
  failedRuns: number;
  runningRuns: number;
  spentCredits: number;
  pendingCredits: number;
  packages: number;
  archivedAssets: number;
}
