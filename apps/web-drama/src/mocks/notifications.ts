// ─────────────────────────────────────────────────────────────────────────────
// mocks/notifications.ts — 短剧子产品通知样本。
// ─────────────────────────────────────────────────────────────────────────────

import type { Notification } from "@ai-star-eco/types/notification";

export const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "revenue",     title: "《暮色未央》分账到账", desc: "¥24,600 已到账，来自 EP01-03 的平台分账",                         time: "2 分钟",   viewedAt: null },
  { id: "n2", type: "achievement", title: "成就解锁：单日峰值",    desc: "《暮色未央》雨夜电话亭切片昨日新增播放 18.4 万",                  time: "15 分钟",  viewedAt: null },
  { id: "n3", type: "fan",         title: "新粉丝涌入",            desc: "过去 1 小时新增 314 名粉丝，主要来自抖音切片",                    time: "1 小时",   viewedAt: null },
  { id: "n4", type: "content",     title: "内容审核通过",          desc: "《摩天与月光》30 秒先导预告已通过审核，定档 5 月 17 日",           time: "2 小时",   viewedAt: "2026-05-01T00:00:00Z"  },
  { id: "n5", type: "system",      title: "系统维护通知",          desc: "5 月 20 日 02:00–04:00 系统升级，分发与生成功能暂停",            time: "5 小时",   viewedAt: "2026-05-01T00:00:00Z"  },
  { id: "n6", type: "revenue",     title: "素材授权入账",          desc: "《盛夏来信》先导素材授权收入 ¥12,000",                            time: "8 小时",   viewedAt: "2026-05-01T00:00:00Z"  },
  { id: "n7", type: "achievement", title: "里程碑：全网播放 300 万", desc: "《暮色未央》主线剧集累计播放突破 318 万次",                       time: "1 天",     viewedAt: "2026-05-01T00:00:00Z"  },
];
