import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/server/response";
import { createSinger } from "@/server/services/singers-service";

export async function POST(request: NextRequest) {
  try {
    const lang = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "zh";
    const data = await createSinger(lang);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
