import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/server/response";
import { listMySingerWorkspace } from "@/server/services/singers-service";

export async function GET(request: NextRequest) {
  try {
    const lang = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "zh";
    const data = await listMySingerWorkspace(lang);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
