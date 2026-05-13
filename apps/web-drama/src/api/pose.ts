// ─────────────────────────────────────────────────────────────────────────────
// api/pose.ts — 姿态 / 表情 / 手势库 API 封装。
// ─────────────────────────────────────────────────────────────────────────────

import type { Pose, Expression, Gesture } from "@ai-star-eco/types/pose";
import { POSE_DATABASE, EXPRESSION_DATABASE, GESTURE_DATABASE } from "@/mocks/pose";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listPoses(): Promise<Pose[]> {
  if (USE_MOCK) return mockDelay(POSE_DATABASE);
  return apiFetch<Pose[]>("/poses");
}

export async function listExpressions(): Promise<Expression[]> {
  if (USE_MOCK) return mockDelay(EXPRESSION_DATABASE);
  return apiFetch<Expression[]>("/expressions");
}

export async function listGestures(): Promise<Gesture[]> {
  if (USE_MOCK) return mockDelay(GESTURE_DATABASE);
  return apiFetch<Gesture[]>("/gestures");
}
