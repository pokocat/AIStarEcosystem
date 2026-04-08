import { getServerEnv } from "@/lib/config/env";

export function shouldUseMockData() {
  return getServerEnv().appDataSource === "mock";
}
