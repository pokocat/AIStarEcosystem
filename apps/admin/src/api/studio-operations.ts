import { apiFetch } from "./_client";
import type { CreditEventPage, ReconciliationDetailPage, StudioOperationsDashboard } from "@/types/studio-operations";

export function dashboard(days: 1 | 7 | 30): Promise<StudioOperationsDashboard> {
  return apiFetch("/admin/studio-operations", { query: { days } });
}

export function reconciliationDetails(check: string, page = 0, size = 20): Promise<ReconciliationDetailPage> {
  return apiFetch("/admin/studio-operations/reconciliation-details", { query: { check, page, size } });
}

export function creditEvents(days: 1 | 7 | 30, page = 0, type?: string, query?: string): Promise<CreditEventPage> {
  return apiFetch("/admin/studio-operations/credit-events", { query: { days, page, size: 20, type, query } });
}
