// ─────────────────────────────────────────────────────────────────────────────
// api/payment-config.ts — Admin 支付渠道配置（v0.94 多渠道直连）。
// 对应 AdminPaymentConfigController（/api/admin/payment/channels）。FINANCE_ADMIN 专属。
// ─────────────────────────────────────────────────────────────────────────────

import type { PaymentChannelConfig, PaymentChannelUpsert } from "@/types/payment-config";
import { apiFetch } from "./_client";

const BASE = "/admin/payment/channels";

export async function list(): Promise<PaymentChannelConfig[]> {
  return apiFetch<PaymentChannelConfig[]>(BASE);
}

export async function update(code: string, body: PaymentChannelUpsert): Promise<PaymentChannelConfig> {
  return apiFetch<PaymentChannelConfig>(`${BASE}/${encodeURIComponent(code)}`, { method: "PUT", body });
}

export interface PaymentChannelTestResult {
  code: string;
  configured: boolean;
  ready: boolean;
  message: string;
}

export async function test(code: string): Promise<PaymentChannelTestResult> {
  return apiFetch<PaymentChannelTestResult>(`${BASE}/${encodeURIComponent(code)}/test`, { method: "POST" });
}
