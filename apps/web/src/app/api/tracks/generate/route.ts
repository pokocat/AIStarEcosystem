import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/server/response";
import { createGeneratedTrack } from "@/server/services/tracks-service";
import type { TrackGenerationRequest } from "@/types/contracts/tracks";

export async function POST(request: NextRequest) {
  try {
    const lang = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "zh";
    const body = (await request.json()) as TrackGenerationRequest;
    const data = await createGeneratedTrack(lang, body);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
