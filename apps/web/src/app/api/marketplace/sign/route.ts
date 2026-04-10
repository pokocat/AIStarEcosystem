import { type NextRequest, NextResponse } from "next/server";
import type { ArtistSigningRequest } from "@/types/contracts/marketplace";

export async function POST(request: NextRequest) {
  try {
    const body: ArtistSigningRequest = await request.json();
    return NextResponse.json({ data: { success: true, signedArtistId: body.artistId } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
