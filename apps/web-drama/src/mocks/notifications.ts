// ─────────────────────────────────────────────────────────────────────────────
// mocks/notifications.ts — 短剧子产品通知样本。
// ─────────────────────────────────────────────────────────────────────────────

import type { Notification } from "@ai-star-eco/types/notification";

export const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "revenue",     title: "《暮色未央》分账到账", desc: "¥8,200 已到账，来自爱奇艺 EP06–08 的平台分账",                    time: "2 分钟",   read: false },
  { id: "n2", type: "achievement", title: "成就解锁：百万播放",    desc: "《暮色未央》EP08 累计播放破千万，热搜挂榜 4 小时",                time: "15 分钟",  read: false },
  { id: "n3", type: "fan",         title: "新粉丝涌入",            desc: "过去 1 小时新增 520 名粉丝，主要来自抖音切片",                    time: "1 小时",   read: false },
  { id: "n4", type: "content",     title: "内容审核通过",          desc: "《摩天与月光》先导片已通过审核，可发布到 5 个平台",                time: "2 小时",   read: true  },
  { id: "n5", type: "system",      title: "系统维护通知",          desc: "5 月 20 日 02:00–04:00 系统升级，分发与生成功能暂停",            time: "5 小时",   read: true  },
  { id: "n6", type: "revenue",     title: "《盛夏来信》周边售出",   desc: "¥4,800 收入，定制礼盒 12 套，买家：陆 **",                       time: "8 小时",   read: true  },
  { id: "n7", type: "achievement", title: "里程碑：全网播放破亿",  desc: "《暮色未央》主线剧集累计播放突破 1 亿次",                          time: "1 天",     read: true  },
];
