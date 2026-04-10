import type { AnalyticsDashboardPayload } from "@/types/contracts/analytics";
import { fetcher } from "@/lib/http/fetcher";
import { resolveAnalyticsDashboard } from "@/mocks/analytics/resolver";

const isMock = process.env.NEXT_PUBLIC_MOCK === "true";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function getAnalyticsDashboard(): Promise<AnalyticsDashboardPayload> {
  if (isMock) return resolveAnalyticsDashboard();
  return fetcher<AnalyticsDashboardPayload>(`${apiBase}/api/analytics/dashboard`);
}
