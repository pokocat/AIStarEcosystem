import { apiFetch, apiFetchPaginated, ApiError, API_BASE_URL } from "../_client";
import type { EnterpriseInvitationPreview } from "@ai-star-eco/types/enterprise";
import type { EnterpriseContext, EnterpriseCreateRequest, EnterpriseInvitationCreated, EnterpriseInvitationRequest, EnterpriseInvitationAcceptRequest, EnterpriseMember, EnterpriseMemberUpdateRequest, EnterprisePolicy, EnterprisePolicyUpdateRequest, EnterpriseOwnershipRequest, EnterpriseOwnershipTransfer, EnterpriseAudit, EnterpriseInvitation } from "@ai-star-eco/types/enterprise";
import type { PaginatedResponse } from "@ai-star-eco/types/_shared";
import type { EnterpriseWalletSummary, EnterpriseMemberBalance, EnterprisePointsDirection, EnterprisePointsPreviewRequest, EnterprisePointsRequest, EnterprisePointsPreview, EnterprisePointsBatch, EnterprisePointsTransfer, EnterpriseRechargeOrder, EnterpriseRechargeRequest } from "@ai-star-eco/types/enterprise";
import type { EnterpriseUsage, EnterpriseLifecyclePreviewRequest, EnterpriseLifecyclePreview, EnterpriseLifecycleRequest, EnterpriseLifecycleResult } from "@ai-star-eco/types/enterprise";
const BASE = "/v1/ip-studio/enterprises";
export function mine(): Promise<EnterpriseContext[]> { return apiFetch(`${BASE}`); }
export function create(body: EnterpriseCreateRequest): Promise<EnterpriseContext> { return apiFetch(`${BASE}`, { method: "POST", body }); }
export function context(id: string): Promise<EnterpriseContext> { return apiFetch(`${BASE}/${encodeURIComponent(id)}`); }
export function invite(id: string, body: EnterpriseInvitationRequest): Promise<EnterpriseInvitationCreated> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/invitations`, { method: "POST", body }); }
export function accept(body: EnterpriseInvitationAcceptRequest): Promise<EnterpriseContext> { return apiFetch("/v1/ip-studio/enterprise-invitations/accept", { method: "POST", body }); }
/** Anonymous and read-only: do not refresh/login or forward a stored token to preview an invitation. */
export async function previewInvitation(token: string, signal?: AbortSignal): Promise<EnterpriseInvitationPreview> {
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/v1/ip-studio/enterprise-invitations/preview`, {
    method: "POST", credentials: "omit", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000),
  });
  const result = await response.json();
  if (!response.ok || result.success !== true) throw new ApiError(result.error || { code: "UNAVAILABLE", message: "暂时无法读取企业邀请，请稍后重试。" }, response.status);
  return result.data;
}
export function updateMember(id: string, memberId: string, body: EnterpriseMemberUpdateRequest): Promise<EnterpriseMember> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`, { method: "PATCH", body }); }
export function policy(id: string): Promise<EnterprisePolicy> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/policy`); }
export function updatePolicy(id: string, body: EnterprisePolicyUpdateRequest): Promise<EnterprisePolicy> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/policy`, { method: "PUT", body }); }
export function requestOwnership(id: string, body: EnterpriseOwnershipRequest): Promise<EnterpriseOwnershipTransfer> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/ownership-transfers`, { method: "POST", body }); }
export function acceptOwnership(id: string, transferId: string): Promise<EnterpriseContext> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/ownership-transfers/${encodeURIComponent(transferId)}/accept`, { method: "POST" }); }

export function members(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterpriseMember>> { return apiFetchPaginated(`${BASE}/${encodeURIComponent(id)}/members?page=${page}&limit=${limit}`); }
export function audit(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterpriseAudit>> { return apiFetchPaginated(`${BASE}/${encodeURIComponent(id)}/audit?page=${page}&limit=${limit}`); }
export function revoke(id: string, invitationId: string): Promise<EnterpriseInvitation> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/invitations/${encodeURIComponent(invitationId)}`, { method: "DELETE" }); }

export function wallet(id: string): Promise<EnterpriseWalletSummary> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/wallet`); }
export function memberBalances(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterpriseMemberBalance>> { return apiFetchPaginated(`${BASE}/${encodeURIComponent(id)}/member-balances?page=${page}&limit=${limit}`); }
export function previewPoints(id: string, direction: EnterprisePointsDirection, body: EnterprisePointsPreviewRequest): Promise<EnterprisePointsPreview> {
  if (direction === "allocate") return apiFetch(`${BASE}/${encodeURIComponent(id)}/points/allocate/preview`, { method: "POST", body });
  return apiFetch(`${BASE}/${encodeURIComponent(id)}/points/reclaim/preview`, { method: "POST", body });
}
export function transferPoints(id: string, direction: EnterprisePointsDirection, body: EnterprisePointsRequest): Promise<EnterprisePointsBatch> {
  if (direction === "allocate") return apiFetch(`${BASE}/${encodeURIComponent(id)}/points/allocate`, { method: "POST", body });
  return apiFetch(`${BASE}/${encodeURIComponent(id)}/points/reclaim`, { method: "POST", body });
}
export function pointsBatch(id: string, batchId: string): Promise<EnterprisePointsBatch> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/points/batches/${encodeURIComponent(batchId)}`); }
export function transfers(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterprisePointsTransfer>> { return apiFetchPaginated(`${BASE}/${encodeURIComponent(id)}/points/transfers?page=${page}&limit=${limit}`); }
export function recharges(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterpriseRechargeOrder>> { return apiFetchPaginated(`${BASE}/${encodeURIComponent(id)}/recharges?page=${page}&limit=${limit}`); }
export function requestRecharge(id: string, body: EnterpriseRechargeRequest): Promise<EnterpriseRechargeOrder> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/recharges`, { method: "POST", body }); }
export function myBalance(id: string): Promise<EnterpriseMemberBalance> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/my-balance`); }
export function invitations(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterpriseInvitation>> { return apiFetchPaginated(`${BASE}/${encodeURIComponent(id)}/invitations?page=${page}&limit=${limit}`); }
export function ownershipTransfers(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterpriseOwnershipTransfer>> { return apiFetchPaginated(`${BASE}/${encodeURIComponent(id)}/ownership-transfers?page=${page}&limit=${limit}`); }
export function usage(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterpriseUsage>> { return apiFetchPaginated(`${BASE}/${encodeURIComponent(id)}/usage?page=${page}&limit=${limit}`); }
export function previewLifecycle(id: string, body: EnterpriseLifecyclePreviewRequest): Promise<EnterpriseLifecyclePreview> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/lifecycle/preview`, { method: "POST", body }); }
export function lifecycle(id: string, body: EnterpriseLifecycleRequest): Promise<EnterpriseLifecycleResult> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/lifecycle`, { method: "POST", body }); }
