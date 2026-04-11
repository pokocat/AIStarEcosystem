import { NextResponse } from "next/server";

export async function POST() {
  try {
    return NextResponse.json({ data: { success: true, publishJobId: `publish-${Date.now()}` } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
