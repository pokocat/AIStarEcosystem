// ─────────────────────────────────────────────────────────────────────────────
// mocks/notifications.ts — 通知样本数据。
// audience 字段记录推送对象（全站 / 工作室 / 艺人 / 账户）。
// ─────────────────────────────────────────────────────────────────────────────

import type { Notification } from "@/types/notification";

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "revenue",
    title: "版税到账",
    desc: "¥8,200 已到账，来自《霓虹之夜》流媒体版税。",
    time: "2min",
    createdAt: "2026-05-01T09:58:12Z",
    viewedAt: null,
    audience: { scope: "studio", targetId: "s-skywave", targetName: "星浪工作室" },
  },
  {
    id: "n2",
    type: "achievement",
    title: "成就解锁：万人迷",
    desc: "Neon V 粉丝突破 128,000！",
    time: "15min",
    createdAt: "2026-05-01T09:45:04Z",
    viewedAt: null,
    audience: { scope: "artist", targetId: "1", targetName: "Neon V" },
  },
  {
    id: "n3",
    type: "fan",
    title: "新粉丝涌入",
    desc: "过去 1 小时新增 520 名粉丝。",
    time: "1h",
    createdAt: "2026-05-01T09:00:31Z",
    viewedAt: null,
    audience: { scope: "artist", targetId: "2", targetName: "Luna Soft" },
  },
  {
    id: "n4",
    type: "content",
    title: "内容自动通过",
    desc: "《赛博城市律动》MV 已自动通过审核并上架。",
    time: "2h",
    createdAt: "2026-05-01T08:00:19Z",
    viewedAt: "2026-05-01T00:00:00Z",
    audience: { scope: "studio", targetId: "s-nebula", targetName: "星云 MCN" },
  },
  {
    id: "n5",
    type: "system",
    title: "系统维护通知",
    desc: "4 月 20 日 02:00–04:00 系统升级，部分功能暂停。",
    time: "5h",
    createdAt: "2026-05-01T05:00:43Z",
    viewedAt: "2026-05-01T00:00:00Z",
    audience: { scope: "all", targetName: "全体用户" },
  },
  {
    id: "n6",
    type: "revenue",
    title: "数字藏品 #287 售出",
    desc: "¥4,800 收入，买家：加密粉丝 X。",
    time: "8h",
    createdAt: "2026-05-01T02:00:08Z",
    viewedAt: "2026-05-01T00:00:00Z",
    audience: { scope: "account", targetId: "u-001", targetName: "星浪工作室" },
  },
  {
    id: "n7",
    type: "achievement",
    title: "里程碑：百万播放",
    desc: "《数字日落》总播放量突破 100 万！",
    time: "1d",
    createdAt: "2026-04-30T10:00:55Z",
    viewedAt: "2026-05-01T00:00:00Z",
    audience: { scope: "artist", targetId: "7", targetName: "Phoenix All" },
  },
];
