import * as mockAdapter from "@/server/adapters/mock/analytics";
import * as springAdapter from "@/server/adapters/spring/analytics";
import { shouldUseMockData } from "@/server/services/shared";

export async function getAnalyticsDashboardData() {
  return shouldUseMockData() ? mockAdapter.getAnalyticsDashboard() : springAdapter.getAnalyticsDashboard();
}
