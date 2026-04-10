import { NextResponse } from "next/server";
import { resolveNftCollections } from "@/mocks/nft/resolver";

export async function GET() {
  try {
    const data = resolveNftCollections();
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
