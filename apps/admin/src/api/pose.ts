// ─────────────────────────────────────────────────────────────────────────────
// api/pose.ts — 姿态资源管理：姿势、表情、手势
// ─────────────────────────────────────────────────────────────────────────────

import type { Pose, Expression, Gesture } from "@/types/pose";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { POSE_DATABASE, EXPRESSION_DATABASE, GESTURE_DATABASE } from "@/mocks/pose";

export async function listPoses(): Promise<Pose[]> {
  if (USE_MOCK) return mockDelay(POSE_DATABASE);
  return apiFetch<Pose[]>("/admin/poses");
}

export async function listExpressions(): Promise<Expression[]> {
  if (USE_MOCK) return mockDelay(EXPRESSION_DATABASE);
  return apiFetch<Expression[]>("/admin/expressions");
}

export async function listGestures(): Promise<Gesture[]> {
  if (USE_MOCK) return mockDelay(GESTURE_DATABASE);
  return apiFetch<Gesture[]>("/admin/gestures");
}
