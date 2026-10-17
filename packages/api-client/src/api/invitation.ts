import { idIssuer } from "../config";
import type { InvitationOverview } from "@ai-star-eco/types/invitation";
import { idApiFetch } from "../_client";

/** 直接使用 ID 本人 API，Studio 后端不保存邀请数据。 */
export function getMyInvitations(page = 0, signal?: AbortSignal): Promise<InvitationOverview> {
  return idApiFetch<InvitationOverview>("/api/me/invitations", { query: { page, pageSize: 20 }, signal });
}

export function ensureInvitationCode(): Promise<{ inviteCode: string }> {
  return idApiFetch<{ inviteCode: string }>("/api/me/invitations/code", { method: "POST" });
}

export class InvitationPublicError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

async function publicIdentityRequest<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const issuer = idIssuer();
  if (!issuer) throw new InvitationPublicError("ID_DISABLED", "暂时无法连接账号服务。");
  const timeout = AbortSignal.timeout(12_000);
  const response = await fetch(`${issuer}${path}`, {
    method: body ? "POST" : "GET", credentials: "omit", cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok || result.success !== true) {
    throw new InvitationPublicError(result.error?.code ?? "UNAVAILABLE", result.error?.message ?? "账号服务暂时不可用，请稍后重试。");
  }
  return result.data as T;
}

export function getInvitationPreview(code: string, signal?: AbortSignal): Promise<{ displayName: string }> {
  return publicIdentityRequest(`/api/auth/invitations/${encodeURIComponent(code)}`, undefined, signal);
}

export function sendInvitationSms(phone: string): Promise<{ sent: boolean }> {
  return publicIdentityRequest("/api/auth/sms/send-code", { phone });
}
