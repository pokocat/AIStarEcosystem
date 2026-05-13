// ─────────────────────────────────────────────────────────────────────────────
// api/notifications.ts — 通知中心 API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type { Notification } from "@ai-star-eco/types/notification";
import { INITIAL_NOTIFICATIONS } from "@/mocks/notifications";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listNotifications(): Promise<Notification[]> {
  if (USE_MOCK) return mockDelay(INITIAL_NOTIFICATIONS);
  return apiFetch<Notification[]>("/notifications");
}

export async function markNotificationRead(id: string): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(undefined);
    return;
  }
  await apiFetch<void>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(undefined);
    return;
  }
  await apiFetch<void>("/notifications/read-all", { method: "POST" });
}

export async function deleteNotification(id: string): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(undefined);
    return;
  }
  await apiFetch<void>(`/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
