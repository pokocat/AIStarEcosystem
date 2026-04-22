// ─────────────────────────────────────────────────────────────────────────────
// api/stats.ts — 平台统计概览。对应 AdminStatsController。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from "./_client";

export interface AdminStats {
  totalUsers: number;
  activeTenants: number;
  activeLicenses: number;
  totalCreditsIssued: number;
  auditEvents: number;
}

export async function getStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/admin/stats");
}
