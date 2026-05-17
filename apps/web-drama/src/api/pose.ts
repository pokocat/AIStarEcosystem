// ─────────────────────────────────────────────────────────────────────────────
// api/pose.ts — 姿态 / 表情 / 手势库 API（network-only）。
// USE_MOCK 模式由 src/mocks/_handlers/pose.ts 拦截。
// ─────────────────────────────────────────────────────────────────────────────

import type { Pose, Expression, Gesture } from "@ai-star-eco/types/pose";
import { apiFetch } from "./_client";

export async function listPoses(): Promise<Pose[]> {
  return apiFetch<Pose[]>("/poses");
}

export async function listExpressions(): Promise<Expression[]> {
  return apiFetch<Expression[]>("/expressions");
}

export async function listGestures(): Promise<Gesture[]> {
  return apiFetch<Gesture[]>("/gestures");
}
