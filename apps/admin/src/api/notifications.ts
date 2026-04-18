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
