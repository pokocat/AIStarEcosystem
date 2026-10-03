// mocks/publish-jobs.ts — 发布记录种子数据。
// projectId 指向 mocks/drama-workshop/meta.ts 里真实存在的短剧（p2 已完结、p1 制作中）；平台名与 PLATFORMS 对齐（服务端存的是连接时的中文平台名）；外链与服务端模拟推进一致是 v.example.com。

import type { PublishJob } from "@ai-star-eco/types/publish-job";

export const PUBLISH_JOBS: PublishJob[] = [
  {
    id: "pj-001",
    projectId: "p2",
    platformId: "p5",
    platformName: "抖音",
    status: "live",
    progress: 100,
    externalUrl: "https://v.example.com/p5/pj-001",
    createdAt: "2026-04-12T08:00:00Z",
    updatedAt: "2026-04-12T08:15:00Z",
  },
  {
    id: "pj-002",
    projectId: "p2",
    platformId: "p8",
    platformName: "B 站",
    status: "live",
    progress: 100,
    externalUrl: "https://v.example.com/p8/pj-002",
    createdAt: "2026-04-12T08:00:00Z",
    updatedAt: "2026-04-12T08:20:00Z",
  },
  {
    id: "pj-003",
    projectId: "p1",
    platformId: "p5",
    platformName: "抖音",
    status: "transcoding",
    progress: 64,
    createdAt: "2026-05-13T02:00:00Z",
    updatedAt: "2026-05-13T02:10:00Z",
    scheduledAt: "2026-05-16T00:00:00Z",
  },
  {
    id: "pj-004",
    projectId: "p1",
    platformId: "p8",
    platformName: "B 站",
    status: "queued",
    progress: 0,
    createdAt: "2026-05-13T02:01:00Z",
    updatedAt: "2026-05-13T02:01:00Z",
    scheduledAt: "2026-05-16T00:00:00Z",
  },
];
