// ─────────────────────────────────────────────────────────────────────────────
// api/notifications.ts — 通知中心 API（network-only）。
// USE_MOCK 模式由 src/mocks/_handlers/notifications.ts 拦截。
// ─────────────────────────────────────────────────────────────────────────────

import type { Notification } from "@ai-star-eco/types/notification";
import { apiFetch } from "./_client";

export async function listNotifications(): Promise<Notification[]> {
  return apiFetch<Notification[]>("/notifications");
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch<void>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch<void>("/notifications/read-all", { method: "POST" });
}

export async function deleteNotification(id: string): Promise<void> {
  await apiFetch<void>(`/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
