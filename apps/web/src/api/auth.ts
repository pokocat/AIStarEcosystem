// ─────────────────────────────────────────────────────────────────────────────
// api/auth.ts — 鉴权 API 封装。
// 对应后端 LicenseActivationController: POST /api/auth/activate
// ─────────────────────────────────────────────────────────────────────────────

import type { LicenseRedeemRequest, LicenseRedeemResult } from "@/types/license";
import { apiFetch } from "./_client";

/** License 激活码注册（公开接口） */
export async function activate(req: LicenseRedeemRequest): Promise<LicenseRedeemResult> {
  return apiFetch<LicenseRedeemResult>("/auth/activate", {
    method: "POST",
    body: req,
  });
}
