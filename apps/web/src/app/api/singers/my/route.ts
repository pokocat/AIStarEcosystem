import { type NextRequest, NextResponse } from "next/server";
import type { Lang } from "@/types/app";
import { resolveSingerWorkspace } from "@/mocks/singers/resolver";

export async function GET(request: NextRequest) {
  try {
    const lang = (request.nextUrl.searchParams.get("lang") === "en" ? "en" : "zh") as Lang;
    const data = resolveSingerWorkspace(lang);
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
