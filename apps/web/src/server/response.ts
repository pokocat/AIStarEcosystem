import { NextResponse } from "next/server";
import { toApiError } from "@/server/errors";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function jsonError(error: unknown) {
  const payload = toApiError(error);
  return NextResponse.json({ error: payload.error }, { status: payload.status });
}
