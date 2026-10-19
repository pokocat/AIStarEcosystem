import type { EnterpriseContext } from "@ai-star-eco/types/enterprise";
/** Read-only design fixture; never intercepts real membership, credit or payment mutations. */
export const ENTERPRISE_DESIGN_SAMPLE: EnterpriseContext = {
  enterprise: { id: "sample-enterprise", name: "示例企业", ownerUserId: "sample-owner", status: "active", version: 0, createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z" },
  member: { id: "sample-membership", enterpriseId: "sample-enterprise", userId: "sample-owner", displayName: "示例成员", role: "owner", status: "active", capabilities: { pointsManage: false, billingRead: false, rechargeRequest: false }, version: 0, joinedAt: "2026-10-15T00:00:00Z" },
  permissions: ["enterprise.read", "member.invite", "member.manage", "member.role.manage", "points.manage", "billing.read", "billing.request", "usage.read", "policy.manage", "ownership.transfer"],
};
