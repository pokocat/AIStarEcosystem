import type { InvitationOverview } from "@ai-star-eco/types/invitation";
import { idApiFetch } from "../_client";

/** 直接使用 ID 本人 API，Studio 后端不保存邀请数据。 */
export function getMyInvitations(page = 0, signal?: AbortSignal): Promise<InvitationOverview> {
  return idApiFetch<InvitationOverview>("/api/me/invitations", { query: { page, pageSize: 20 }, signal });
}

export function ensureInvitationCode(): Promise<{ inviteCode: string }> {
  return idApiFetch<{ inviteCode: string }>("/api/me/invitations/code", { method: "POST" });
}
