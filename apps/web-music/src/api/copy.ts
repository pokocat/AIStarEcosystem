// ─────────────────────────────────────────────────────────────────────────────
// api/copy.ts — 文案库 API。
// 真后端：/api/me/copies CRUD + /api/me/copies/{id}/approve 推进审批阶段。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CopyItem,
  CreateCopyInput,
  CopyApproveInput,
  CopyApprovalStage,
} from "@ai-star-eco/types/copy";
import type { ID } from "@ai-star-eco/types/_shared";
import { COPIES } from "@/mocks/copy";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

const STAGE_TRANSITIONS: Record<CopyApprovalStage, CopyApprovalStage> = {
  draft:          "ops_review",
  ops_review:     "partner_review",
  partner_review: "legal_review",
  legal_review:   "approved",
  approved:       "approved",
  rejected:       "rejected",
};

export async function listCopies(): Promise<CopyItem[]> {
  if (USE_MOCK) return mockDelay(COPIES);
  return apiFetch<CopyItem[]>("/me/copies");
}

export async function createCopy(input: CreateCopyInput): Promise<CopyItem> {
  if (USE_MOCK) {
    const c: CopyItem = {
      id: `cp-${Date.now()}`,
      ...input,
      stage: "ops_review",
      version: 1,
      author: "运营小新",
      createdAt: new Date().toISOString().slice(0, 10),
      comments: [],
      riskFlags: [],
    };
    COPIES.unshift(c);
    return mockDelay(c, 300);
  }
  return apiFetch<CopyItem>("/me/copies", { method: "POST", body: input });
}

/** 推进审批：通过 → 进入下一阶段；驳回 → rejected 终态。 */
export async function approveCopy(id: ID, input: CopyApproveInput): Promise<CopyItem> {
  if (USE_MOCK) {
    const c = COPIES.find(x => x.id === id);
    if (!c) throw new Error(`copy not found: ${id}`);
    c.comments.push({
      stage:
        input.stage === "ops_review" ? "运营初审"
        : input.stage === "partner_review" ? "合作方复审"
        : "法务终审",
      author: "运营小新",
      text: input.text,
      time: new Date().toISOString(),
      passed: input.passed,
    });
    c.stage = input.passed ? STAGE_TRANSITIONS[c.stage] : "rejected";
    return mockDelay(c, 300);
  }
  return apiFetch<CopyItem>(`/me/copies/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: input,
  });
}
