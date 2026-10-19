import type { EnterpriseRechargeOrder, EnterpriseRechargeConfirmRequest, EnterpriseRefundPreview, EnterpriseRefundRequest } from "@/types/enterprise";
import type { PaginatedResponse } from "@/types/_shared";
import { apiFetch, apiFetchPage } from "./_client";

const BASE = "/admin/finance/enterprise-recharges";
export function list(status = "pending", page = 0, limit = 20): Promise<PaginatedResponse<EnterpriseRechargeOrder>> {
  return apiFetchPage(BASE, { query: { status: status === "all" ? undefined : status, page, limit } });
}
export function confirm(id: string, body: EnterpriseRechargeConfirmRequest): Promise<EnterpriseRechargeOrder> {
  return apiFetch(`${BASE}/${encodeURIComponent(id)}/confirm`, { method: "POST", body });
}
export function refundPreview(id: string): Promise<EnterpriseRefundPreview> { return apiFetch(`${BASE}/${encodeURIComponent(id)}/refund-preview`); }
export function refund(id: string, body: EnterpriseRefundRequest): Promise<EnterpriseRechargeOrder> {
  return apiFetch(`${BASE}/${encodeURIComponent(id)}/refund`, { method: "POST", body });
}
export function reject(id: string, reason: string): Promise<EnterpriseRechargeOrder> {
  return apiFetch(`${BASE}/${encodeURIComponent(id)}/reject`, { method: "POST", body: { reason } });
}


import type { Enterprise, EnterpriseMemberBalance, EnterprisePointsTransfer, EnterpriseUsage, EnterpriseWalletSummary } from "@/types/enterprise";
const REPORTS = "/admin/finance/enterprises";
export function enterprises(search = "", page = 0, limit = 20): Promise<PaginatedResponse<Enterprise>> { return apiFetchPage(REPORTS, { query: { search: search || undefined, page, limit } }); }
export function enterpriseSummary(id: string): Promise<EnterpriseWalletSummary> { return apiFetch(`${REPORTS}/${encodeURIComponent(id)}/wallet`); }
export function enterpriseMembers(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterpriseMemberBalance>> { return apiFetchPage(`${REPORTS}/${encodeURIComponent(id)}/member-balances`, { query: { page, limit } }); }
export function enterpriseTransfers(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterprisePointsTransfer>> { return apiFetchPage(`${REPORTS}/${encodeURIComponent(id)}/points/transfers`, { query: { page, limit } }); }
export function enterpriseUsage(id: string, page = 0, limit = 20): Promise<PaginatedResponse<EnterpriseUsage>> { return apiFetchPage(`${REPORTS}/${encodeURIComponent(id)}/usage`, { query: { page, limit } }); }
