import { describe, expect, it, vi } from "vitest";

vi.mock("@/proto/api", () => ({ JobApi: { cancel: vi.fn(), retry: vi.fn() } }));

import type { StudioTaskHistoryItem } from "@ai-star-eco/types";
import { canCancelTask, canRetryTask } from "@/ip/api/account";

const item = (over: Partial<StudioTaskHistoryItem>): StudioTaskHistoryItem => ({
  id: "IPR-1", source: "canvas", sourceId: "P", sourceTitle: "画布", type: "image", kind: "studio-image", title: "生成图片",
  status: "running", pct: 10, queuePosition: null, createdAt: null, finishedAt: null,
  credits: { spent: 0, scopedSpent: 0, pending: 8, released: 0 }, payer: { type: "personal", name: null },
  errorCode: null, errorMessage: null, href: "/projects/P", ...over,
});

// 任务历史只在通用取消接口确实适用的地方给「取消」：导演台、对话、写作各有自己的停止流程。
describe("task history actions", () => {
  it("offers cancel only for running canvas media tasks and digital-human jobs", () => {
    expect(canCancelTask(item({}))).toBe(true);
    expect(canCancelTask(item({ kind: "studio-video", type: "video" }))).toBe(true);
    expect(canCancelTask(item({ source: "digital-human", kind: "video" }))).toBe(true);
    expect(canCancelTask(item({ source: "director", kind: "studio-image" }))).toBe(false);
    expect(canCancelTask(item({ kind: "studio-dialogue", type: "dialogue" }))).toBe(false);
    expect(canCancelTask(item({ status: "done" }))).toBe(false);
  });
  it("offers retry only for failed digital-human jobs", () => {
    expect(canRetryTask(item({ source: "digital-human", status: "failed" }))).toBe(true);
    expect(canRetryTask(item({ status: "failed" }))).toBe(false);
  });
});
