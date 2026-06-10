// ─────────────────────────────────────────────────────────────────────────────
// api/notifications.ts — 通知管理 API。对应 AdminNotificationController。
// ─────────────────────────────────────────────────────────────────────────────

import type { Notification } from "@/types/notification";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { INITIAL_NOTIFICATIONS } from "@/mocks/notifications";

export async function listNotifications(): Promise<Notification[]> {
  if (USE_MOCK) return mockDelay(INITIAL_NOTIFICATIONS);
  return apiFetch<Notification[]>("/admin/notifications");
}

export async function markNotificationRead(id: string): Promise<void> {
  if (USE_MOCK) return mockDelay(undefined as void);
  await apiFetch<void>(`/admin/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}

/** v0.58：全部标记已读（仅运营收件箱行）。返回本次落已读的条数。 */
export async function markAllNotificationsRead(): Promise<number> {
  if (USE_MOCK) return mockDelay(0);
  const res = await apiFetch<{ updated: number }>("/admin/notifications/read-all", {
    method: "POST",
  });
  return res.updated;
}
