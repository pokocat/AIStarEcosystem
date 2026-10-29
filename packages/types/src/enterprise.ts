/** Enterprise membership, credit operations, generation payer and lifecycle contracts. */
export type EnterpriseRole = "owner" | "manager" | "member";
export type EnterpriseStatus = "active" | "closing" | "closed";
export type EnterpriseMemberStatus = "active" | "suspended" | "removed";
export type EnterprisePermission = "enterprise.read" | "member.invite" | "member.manage" | "member.role.manage" | "points.manage" | "billing.read" | "billing.request" | "usage.read" | "policy.manage" | "ownership.transfer";
export interface EnterpriseCapabilities { pointsManage: boolean; billingRead: boolean; rechargeRequest: boolean; }
export interface Enterprise {
  id: string; name: string; ownerUserId: string; status: EnterpriseStatus;
  version: number; createdAt: string; updatedAt: string;
}
export interface EnterpriseMember {
  id: string; enterpriseId: string; userId: string; displayName: string; role: EnterpriseRole;
  status: EnterpriseMemberStatus; capabilities: EnterpriseCapabilities;
  version: number; joinedAt: string;
}
export interface EnterpriseContext { enterprise: Enterprise; member: EnterpriseMember; permissions: EnterprisePermission[]; }
export interface EnterpriseCreateRequest { name: string; clientRequestId: string; }
/** Adds an existing, phone-verified product account as an ordinary member. */
export interface EnterpriseMemberAddRequest { phone: string; }
export interface EnterpriseMemberBatchAddRequest { phones: string[]; }
export interface EnterpriseMemberAddResult { phone: string; status: "success" | "failed"; member?: EnterpriseMember | null; errorCode?: string | null; message?: string | null; }
export interface EnterpriseMemberBatchAddResult { results: EnterpriseMemberAddResult[]; successCount: number; failureCount: number; }
export interface EnterpriseInvitationRequest { clientRequestId: string; validDays?: 90 | 365; }
export interface EnterpriseInvitation { id: string; enterpriseId: string; status: "pending" | "revoked" | "expired"; expiresAt: string; }
/** Token appears only on initial creation. Never persist it in localStorage or logs. */
export interface EnterpriseInvitationCreated { invitation: EnterpriseInvitation; token?: string; }
export interface EnterpriseInvitationAcceptRequest { token: string; }
/** Public bearer-invitation preview. Contains no member identity, balance or private assets. */
export interface EnterpriseInvitationPreview {
  enterpriseId: string; enterpriseName: string; expiresAt: string;
}
export interface EnterpriseMemberUpdateRequest { role: "manager" | "member"; capabilities: EnterpriseCapabilities; version: number; }
export interface EnterprisePolicy { enterpriseId: string; allowedEndpointIds: string[]; maxActiveJobs: number; version: number; }
export interface EnterprisePolicyUpdateRequest { allowedEndpointIds: string[]; maxActiveJobs: number; version: number; }
export interface EnterpriseOwnershipRequest { targetMemberId: string; clientRequestId: string; }
export interface EnterpriseOwnershipTransfer { id: string; enterpriseId: string; fromUserId: string; toUserId: string; status: "pending" | "accepted" | "expired"; expiresAt: string; }
export interface EnterpriseWallet {
  id: string; accountType: "enterprise" | "enterprise_member"; enterpriseId: string; memberUserId: string | null;
  totalBalance: number; licenseBalance: number; rechargeBalance: number; giftBalance: number; pendingBalance: number;
}
/** Allocated credits remain enterprise property. Null amount means reclaim all available. */
export type EnterprisePointsDirection = "allocate" | "reclaim";
export interface EnterprisePointsItem { memberId: string; amount: number | null; }
export interface EnterprisePointsPreviewRequest { items: EnterprisePointsItem[]; }
export interface EnterprisePointsRequest { clientRequestId: string; confirmationFingerprint: string; items: EnterprisePointsItem[]; }
export interface EnterprisePointsPreviewItem { memberId: string; amount: number; availableBefore: number; availableAfter: number; pendingBalance: number; }
export interface EnterprisePointsPreview { enterpriseId: string; direction: EnterprisePointsDirection; memberCount: number; totalAmount: number; rootAvailableBefore: number; rootAvailableAfter: number; confirmationFingerprint: string; items: EnterprisePointsPreviewItem[]; }
export interface EnterprisePointsTransfer { id: string; batchId: string; enterpriseId: string; memberId: string; memberName?: string; direction: EnterprisePointsDirection; amount: number; status: "done"; createdAt: string; fromWalletId: string; toWalletId: string; fromGift: number; fromLicense: number; fromRecharge: number; outLedgerId: string; inLedgerId: string; }
export interface EnterprisePointsBatch { id: string; enterpriseId: string; direction: "allocate" | "reclaim"; totalAmount: number; transfers: EnterprisePointsTransfer[]; createdAt: string; }
export interface EnterpriseWalletSummary { enterpriseId: string; enterpriseName: string; unallocated: number; allocated: number; pending: number; spent: number; totalBalance: number; }
export interface EnterpriseMemberBalance { memberId: string; userId: string; displayName: string; role: EnterpriseRole; status: EnterpriseMemberStatus; walletId: string; totalBalance: number; pendingBalance: number; rechargeBalance: number; giftBalance: number; licenseBalance: number; }
export interface EnterpriseRechargeRequest { clientRequestId: string; requestedPriceCents?: number; note: string; }
export interface EnterpriseRechargeConfirmRequest { clientRequestId: string; priceCents: number; credits: number; receiptReference: string; note: string; }
export interface EnterpriseRefundPreview { orderId: string; enterpriseId: string; originalCredits: number; originalPriceCents: number; reclaimableCredits: number; refundPriceCents: number; memberRecallCredits: number; pendingCredits: number; spentCredits: number; previewToken: string; }
export interface EnterpriseRefundRequest { clientRequestId: string; previewToken: string; reason: string; receiptReference: string; }
export interface EnterpriseRechargeRejectRequest { reason: string; }
export interface EnterpriseRechargeOrder { id: string; enterpriseId: string; enterpriseName: string; initiatorUserId: string; initiatorName: string; targetWalletId: string; priceCents: number; credits: number; status: "pending" | "paid" | "rejected" | "refunded"; createdAt: string; paidAt?: string; reviewedAt?: string; reviewerName?: string; receiptReference?: string; note?: string; refundedCredits: number; refundedPriceCents: number; refundReceiptReference?: string; }
export type EnterpriseBillingSelection = { mode: "personal" } | { mode: "enterprise"; enterpriseId: string };
export interface EnterpriseUsage { id: string; enterpriseId: string; actorUserId: string; actorName: string; billingWalletId: string; referenceType: string; referenceId: string; cost: number; pendingCredits: number; status: string; modelName: string; createdAt: string; }
export interface EnterpriseBillingReplaySelection { found: boolean; billing?: EnterpriseBillingSelection | null; modelBilling?: import('./model-billing').ModelBillingApproval | null; }
export type EnterpriseLifecycleAction = "suspend" | "resume" | "remove" | "leave" | "close";
export interface EnterpriseLifecyclePreviewRequest { action: EnterpriseLifecycleAction; memberId?: string; }
export interface EnterpriseLifecyclePreview { action: EnterpriseLifecycleAction; memberId?: string; availableCredits: number; pendingCredits: number; activeJobs: number; cancellableJobs: number; acceptedJobs: number; canProceed: boolean; blockers: string[]; confirmationFingerprint: string; }
export interface EnterpriseLifecycleRequest { action: EnterpriseLifecycleAction; memberId?: string; clientRequestId: string; confirmationFingerprint: string; }
export interface EnterpriseLifecycleResult { action: EnterpriseLifecycleAction; enterpriseId: string; memberId?: string; reclaimedCredits: number; cancelledJobs: number; status: string; }
export interface EnterpriseError { code: string; message: string; }

export interface EnterpriseAudit { id: string; enterpriseId: string; actorUserId: string; action: string; targetId: string; summary: string; createdAt: string; }
