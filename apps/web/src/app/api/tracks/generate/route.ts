import { type NextRequest, NextResponse } from "next/server";
import type { Lang } from "@/types/app";
import type { TrackGenerationRequest } from "@/types/contracts/tracks";
import { resolveGeneratedTrack } from "@/mocks/tracks/resolver";

export async function POST(request: NextRequest) {
  try {
    const lang = (request.nextUrl.searchParams.get("lang") === "en" ? "en" : "zh") as Lang;
    const body: TrackGenerationRequest = await request.json();
    const data = resolveGeneratedTrack(lang, body);
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
