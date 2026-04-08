import { jsonError, jsonOk } from "@/server/response";
import { getAnalyticsDashboardData } from "@/server/services/analytics-service";

export async function GET() {
  try {
    const data = await getAnalyticsDashboardData();
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
