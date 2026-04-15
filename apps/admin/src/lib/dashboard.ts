import type { DashboardStats } from "@/types";

const EMPTY_STATS: DashboardStats = {
  totalUsers: 0,
  activeTenants: 0,
  activeLicenses: 0,
  totalCreditsIssued: 0,
  products: 0,
  auditEvents: 0,
};

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function pickNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (key in source) return asNumber(source[key]);
  }
  return 0;
}

export function normalizeDashboardStats(input: unknown): DashboardStats {
  if (!input || typeof input !== "object") {
    return EMPTY_STATS;
  }

  const source = input as Record<string, unknown>;

  return {
    totalUsers: pickNumber(source, ["totalUsers", "userCount", "users", "totalUserCount"]),
    activeTenants: pickNumber(source, ["activeTenants", "tenantCount", "tenants"]),
    activeLicenses: pickNumber(source, ["activeLicenses", "licenseCount", "licenses"]),
    totalCreditsIssued: pickNumber(source, [
      "totalCreditsIssued",
      "creditsIssued",
      "totalCredits",
      "credits",
    ]),
    products: pickNumber(source, ["products", "productCount", "planCount"]),
    auditEvents: pickNumber(source, ["auditEvents", "auditLogCount", "totalAuditEvents"]),
  };
}

export const dashboardFallbackStats: DashboardStats = {
  totalUsers: 1284,
  activeTenants: 342,
  activeLicenses: 891,
  totalCreditsIssued: 2450000,
  products: 12,
  auditEvents: 58432,
};
