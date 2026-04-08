export type AppDataSource = "mock" | "spring";

export interface AppEnv {
  appDataSource: AppDataSource;
  springBootBaseUrl: string;
}

function normalizeSource(value: string | undefined): AppDataSource {
  return value === "spring" ? "spring" : "mock";
}

export function getServerEnv(): AppEnv {
  return {
    appDataSource: normalizeSource(process.env.APP_DATA_SOURCE),
    springBootBaseUrl: process.env.SPRING_BOOT_BASE_URL?.trim() || "http://localhost:8080"
  };
}
