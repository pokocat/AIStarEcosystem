// mocks/_handlers/pose.ts — 姿态 / 表情 / 手势库 mock handlers。

import { mockDelay, registerMocks } from "@ai-star-eco/api-client";
import { POSE_DATABASE, EXPRESSION_DATABASE, GESTURE_DATABASE } from "@/mocks/pose";

registerMocks([
  { method: "GET", pattern: "/poses", handler: () => mockDelay(POSE_DATABASE) },
  { method: "GET", pattern: "/expressions", handler: () => mockDelay(EXPRESSION_DATABASE) },
  { method: "GET", pattern: "/gestures", handler: () => mockDelay(GESTURE_DATABASE) },
]);
