/** Existing material-video wire card fields used by the platform reconciliation tool. */
export interface MaterialVideoReconciliationCard {
  id: string;
  status: string;
  stage?: string;
  error_code?: string;
  error_message?: string;
  external_task_id?: string;
  video_url?: string;
  cost?: number;
}
export interface MaterialVideoReconciliationRequest { externalTaskId?: string; evidence: string; confirmedNotAccepted?: boolean; }

export interface StudioImageReconciliationCard {
  id: string; ownerUserId: string; projectId: string; status: string; stage: string;
  cost: number; holdTotal: number; endpointId: string; errorCode?: string; errorMessage?: string;
  images: { imageIndex: number; submitAttempted: boolean; externalTaskId: string; mirrored: boolean; requestFingerprint?: string }[];
}
export interface StudioImageReconciliationRequest { imageIndex?: number; externalTaskId: string; evidence: string; }

export interface StudioImageUnknownReleaseRequest { imageIndex?: number; evidence: string; confirmedNoUpstreamTask: true; }
