/**
 * Thin HTTP client that talks to apps/server via the Next.js rewrite at
 * /api/server/**. See next.config.mjs and .env.example.
 *
 * Backend response envelope (per specs/openapi.yaml):
 *   success: { data: T }
 *   error:   { error: { code: string, message: string } }
 */

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiEnvelope<T> = { data?: T; error?: { code: string; message: string } };

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("/") ? `/api/server${path}` : `/api/server/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // non-JSON
  }

  if (!res.ok || body?.error) {
    const code = body?.error?.code ?? `HTTP_${res.status}`;
    const message = body?.error?.message ?? res.statusText;
    throw new ApiError(code, message, res.status);
  }

  return (body?.data ?? (undefined as unknown)) as T;
}
