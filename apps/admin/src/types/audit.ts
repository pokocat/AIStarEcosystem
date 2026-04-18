// ─────────────────────────────────────────────────────────────────────────────
// audit.ts — 审计日志。
// 对应后端 AuditLogDto / aep_audit_logs 表。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type AuditResult = "success" | "failure";

export interface AuditLog {
  id: ID;
  userId: string;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  result: AuditResult;
  detail?: string;
  createdAt: ISODateTime;
}
