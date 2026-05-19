// ─────────────────────────────────────────────────────────────────────────────
// mocks/social-account.ts — Admin 跨用户社交账号样本。
// ─────────────────────────────────────────────────────────────────────────────

import type { SocialAccount } from "@/types/social-account";

export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  {
    id: "sa-1",
    userId: "user-celebrity-001",
    platform: "douyin",
    accountName: "公司主号-抖音",
    status: "active",
    displayName: "AI 明星运营官方号",
    avatarUrl: "https://avatars.example.com/sa-1.png",
    boundAt: "2026-05-10T08:30:00Z",
    lastVerifiedAt: "2026-05-18T22:15:00Z",
  },
  {
    id: "sa-2",
    userId: "user-celebrity-001",
    platform: "kuaishou",
    accountName: "公司主号-快手",
    status: "active",
    displayName: "AI 明星运营官方号",
    boundAt: "2026-05-10T09:02:00Z",
    lastVerifiedAt: "2026-05-18T22:10:00Z",
  },
  {
    id: "sa-3",
    userId: "user-celebrity-002",
    platform: "xiaohongshu",
    accountName: "工作室小红书",
    status: "expired",
    displayName: "小红书工作室",
    boundAt: "2026-04-22T14:11:00Z",
    lastVerifiedAt: "2026-05-15T07:00:00Z",
  },
  {
    id: "sa-4",
    userId: "user-drama-003",
    platform: "douyin",
    accountName: "短剧分发号",
    status: "pending",
    boundAt: "2026-05-19T05:50:00Z",
  },
  {
    id: "sa-5",
    userId: "user-music-004",
    platform: "shipinhao",
    accountName: "音乐人视频号",
    status: "banned",
    displayName: "MusicProducer",
    boundAt: "2026-03-04T11:00:00Z",
    lastVerifiedAt: "2026-04-09T03:25:00Z",
  },
];
