import { NextResponse } from "next/server";

export async function POST() {
  try {
    return NextResponse.json({
      data: { success: true, contractAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", tokenId: `token-${Date.now()}` }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
