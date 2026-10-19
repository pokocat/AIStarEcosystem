import { apiFetch } from "./_client";
import type { MaterialVideoReconciliationCard, MaterialVideoReconciliationRequest } from "@/types/material-video-reconciliation";
const BASE = "/admin/material-video-jobs";
export function read(id: string): Promise<MaterialVideoReconciliationCard> { return apiFetch(`${BASE}/${encodeURIComponent(id)}`); }
export function reconcile(id: string, body?: MaterialVideoReconciliationRequest): Promise<MaterialVideoReconciliationCard> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/reconcile`, { method: "POST", ...(body ? { body } : {}) }); }

import type { StudioImageReconciliationCard, StudioImageReconciliationRequest, StudioImageUnknownReleaseRequest } from "@/types/material-video-reconciliation";
const IMAGE_BASE = "/admin/ip-studio/runs";
export function readImage(id: string): Promise<StudioImageReconciliationCard> { return apiFetch(`${IMAGE_BASE}/${encodeURIComponent(id)}`); }
export function reconcileImage(id: string, body: StudioImageReconciliationRequest): Promise<StudioImageReconciliationCard> { return apiFetch(`${IMAGE_BASE}/${encodeURIComponent(id)}/reconcile`, { method: "POST", body }); }

export function releaseUnknownImage(id: string, body: StudioImageUnknownReleaseRequest): Promise<StudioImageReconciliationCard> { return apiFetch(`${IMAGE_BASE}/${encodeURIComponent(id)}/release-unknown`, { method: "POST", body }); }
