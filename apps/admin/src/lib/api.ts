import type { PageResponse } from "@/types";
import { getStoredToken } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...Object.fromEntries(
      Object.entries(init?.headers ?? {}).filter(([, v]) => v != null)
    ),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function coerceNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeListResponse<T>(
  input: unknown,
  candidateKeys: string[] = ["content", "items", "records", "list", "rows", "results", "data"]
): T[] {
  if (Array.isArray(input)) return input as T[];

  if (!isRecord(input)) return [];

  for (const key of candidateKeys) {
    const value = input[key];
    if (Array.isArray(value)) return value as T[];
  }

  return [];
}

export function normalizePageResponse<T>(
  input: unknown,
  candidateKeys?: string[]
): PageResponse<T> {
  const content = normalizeListResponse<T>(input, candidateKeys);

  if (!isRecord(input)) {
    return {
      content,
      totalElements: content.length,
      totalPages: content.length > 0 ? 1 : 0,
      number: 0,
      size: content.length,
    };
  }

  const size = coerceNumber(input.size ?? input.pageSize, content.length);
  const totalElements = coerceNumber(
    input.totalElements ?? input.total ?? input.count,
    content.length
  );
  const totalPages = coerceNumber(
    input.totalPages,
    size > 0 ? Math.ceil(totalElements / size) : content.length > 0 ? 1 : 0
  );
  const number = coerceNumber(input.number ?? input.page ?? input.pageIndex, 0);

  return {
    content,
    totalElements,
    totalPages,
    number,
    size,
  };
}
