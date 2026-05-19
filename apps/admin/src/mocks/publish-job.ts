// ─────────────────────────────────────────────────────────────────────────────
// mocks/publish-job.ts — Admin 跨用户发布任务 + 事件流样本。
// ─────────────────────────────────────────────────────────────────────────────

import type { PublishJob, PublishJobEvent } from "@/types/publish-job";

export const PUBLISH_JOBS: PublishJob[] = [
  {
    id: "pj-1001",
    userId: "user-celebrity-001",
    projectId: "proj-cel-a",
    socialAccountId: "sa-1",
    platformId: "douyin",
    platformName: "抖音",
    status: "live",
    progress: 100,
    title: "刘涛 × 美妆新品|7s 短片",
    creditsSpent: 20,
    externalUrl: "https://www.douyin.com/video/7400000000000000001",
    externalTaskId: "douyin-task-aaaa",
    createdAt: "2026-05-18T08:00:00Z",
    updatedAt: "2026-05-18T08:09:00Z",
  },
  {
    id: "pj-1002",
    userId: "user-celebrity-001",
    projectId: "proj-cel-a",
    socialAccountId: "sa-2",
    platformId: "kuaishou",
    platformName: "快手",
    status: "publishing",
    progress: 80,
    title: "刘涛 × 美妆新品|7s 短片",
    creditsSpent: 20,
    externalTaskId: "kuaishou-task-bbbb",
    createdAt: "2026-05-18T08:00:00Z",
    updatedAt: "2026-05-19T05:40:00Z",
  },
  {
    id: "pj-1003",
    userId: "user-celebrity-002",
    projectId: "proj-cel-b",
    socialAccountId: "sa-3",
    platformId: "xiaohongshu",
    platformName: "小红书",
    status: "failed",
    progress: 35,
    title: "新品试穿合集",
    errorMessage: "登录态过期，请重新绑定账号",
    creditsSpent: 20,
    createdAt: "2026-05-17T12:00:00Z",
    updatedAt: "2026-05-17T12:08:00Z",
  },
  {
    id: "pj-1004",
    userId: "user-drama-003",
    projectId: "proj-drama-c",
    socialAccountId: "sa-4",
    platformId: "douyin",
    platformName: "抖音",
    status: "queued",
    progress: 0,
    title: "短剧 EP01 预告",
    createdAt: "2026-05-19T06:10:00Z",
    updatedAt: "2026-05-19T06:10:00Z",
  },
];

export const PUBLISH_JOB_EVENTS: Record<string, PublishJobEvent[]> = {
  "pj-1001": [
    { id: "ev-1", jobId: "pj-1001", kind: "transition", toStatus: "queued",       at: "2026-05-18T08:00:00Z", note: "createBatch" },
    { id: "ev-2", jobId: "pj-1001", kind: "transition", fromStatus: "queued",     toStatus: "uploading",  at: "2026-05-18T08:00:30Z", note: "startJob" },
    { id: "ev-3", jobId: "pj-1001", kind: "progress",   progress: 40,             at: "2026-05-18T08:02:00Z" },
    { id: "ev-4", jobId: "pj-1001", kind: "transition", fromStatus: "uploading",  toStatus: "publishing", at: "2026-05-18T08:05:00Z" },
    { id: "ev-5", jobId: "pj-1001", kind: "transition", fromStatus: "publishing", toStatus: "live",       at: "2026-05-18T08:09:00Z" },
  ],
  "pj-1003": [
    { id: "ev-10", jobId: "pj-1003", kind: "transition", toStatus: "queued",     at: "2026-05-17T12:00:00Z" },
    { id: "ev-11", jobId: "pj-1003", kind: "transition", fromStatus: "queued",   toStatus: "uploading",  at: "2026-05-17T12:00:30Z" },
    { id: "ev-12", jobId: "pj-1003", kind: "error",      progress: 35,           at: "2026-05-17T12:08:00Z", note: "登录态过期" },
    { id: "ev-13", jobId: "pj-1003", kind: "transition", fromStatus: "uploading", toStatus: "failed",     at: "2026-05-17T12:08:00Z" },
  ],
};
