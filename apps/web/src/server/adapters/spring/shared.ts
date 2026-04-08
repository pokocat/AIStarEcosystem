import { getServerEnv } from "@/lib/config/env";
import { ServerAppError } from "@/server/errors";

async function parseSpringPayload(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  return isJson ? response.json() : response.text();
}

export async function proxySpring<T>(path: string, init?: RequestInit): Promise<T> {
  const { springBootBaseUrl } = getServerEnv();
  const response = await fetch(`${springBootBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  const payload = await parseSpringPayload(response);

  if (!response.ok) {
    throw new ServerAppError(response.status, {
      code: "SPRING_REQUEST_FAILED",
      message: typeof payload === "string" ? payload : response.statusText,
      details: payload
    });
  }

  if (typeof payload === "object" && payload && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}
