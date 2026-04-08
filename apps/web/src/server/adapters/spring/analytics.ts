import type { AnalyticsDashboardPayload } from "@/types/contracts/analytics";
import { proxySpring } from "@/server/adapters/spring/shared";

export async function getAnalyticsDashboard() {
  return proxySpring<AnalyticsDashboardPayload>("/api/analytics/dashboard");
}
