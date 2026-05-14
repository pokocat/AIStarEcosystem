// mocks/publish-jobs.ts — 分发任务种子数据。

import type { PublishJob } from "@/types/publish-job";

export const PUBLISH_JOBS: PublishJob[] = [
  {
    id: "pj-001",
    projectId: "d-001",
    platformId: "p6",
    platformName: "Douyin",
    status: "live",
    progress: 100,
    externalUrl: "https://douyin.com/video/mock-d-001",
    createdAt: "2026-04-12T08:00:00Z",
    updatedAt: "2026-04-12T08:15:00Z",
  },
  {
    id: "pj-002",
    projectId: "d-001",
    platformId: "p7",
    platformName: "Bilibili",
    status: "live",
    progress: 100,
    externalUrl: "https://bilibili.com/video/mock-d-001",
    createdAt: "2026-04-12T08:00:00Z",
    updatedAt: "2026-04-12T08:20:00Z",
  },
  {
    id: "pj-003",
    projectId: "d-003",
    platformId: "p6",
    platformName: "Douyin",
    status: "transcoding",
    progress: 64,
    createdAt: "2026-05-13T02:00:00Z",
    updatedAt: "2026-05-13T02:10:00Z",
    scheduledAt: "2026-05-16T00:00:00Z",
  },
  {
    id: "pj-004",
    projectId: "d-003",
    platformId: "p7",
    platformName: "Bilibili",
    status: "queued",
    progress: 0,
    createdAt: "2026-05-13T02:01:00Z",
    updatedAt: "2026-05-13T02:01:00Z",
    scheduledAt: "2026-05-16T00:00:00Z",
  },
];
