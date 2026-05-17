// mocks/_handlers/notifications.ts — 通知中心 mock handlers。

import { mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { INITIAL_NOTIFICATIONS } from "@/mocks/notifications";

registerMocks([
  { method: "GET", pattern: "/notifications", handler: () => mockDelay(INITIAL_NOTIFICATIONS) },
  {
    method: "POST",
    pattern: "/notifications/:id/read",
    handler: () => mockDelay(undefined),
  },
  { method: "POST", pattern: "/notifications/read-all", handler: () => mockDelay(undefined) },
  {
    method: "DELETE",
    pattern: "/notifications/:id",
    handler: () => mockDelay(undefined),
  },
]);
