// ─────────────────────────────────────────────────────────────────────────────
// api/audit.ts — 审计日志 API。对应 AdminAuditLogController。
// ─────────────────────────────────────────────────────────────────────────────

import type { AuditLog } from "@/types/audit";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { AUDIT_LOGS } from "@/mocks/audit";

export async function listAuditLogs(
  userId?: string, action?: string, result?: string, page = 0, size = 20
): Promise<AuditLog[]> {
  if (USE_MOCK) return mockDelay(AUDIT_LOGS);
  return apiFetch<AuditLog[]>("/admin/audit-logs", {
    query: { userId, action, result, page, size },
  });
}
