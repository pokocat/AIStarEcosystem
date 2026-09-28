// 数字人演员页的状态文案（v0.197）。
// lib/cast-derive.ts 里那套 STATUS_LABEL（在线 / 训练中 / 出道期 / 休养 / 退役）是音乐线偶像孵化的叫法，
// 那个文件不归这里改；本目录的页面一律读这张表。导入的数字人实际只有「在用 / 已归档」两种。
// 第三轮：「可出演」改「在用」—— 给角色绑数字人时直接从 AiAvatar 里选、不读这份导入列表，
// 这里的状态管不了能不能出演，只表示它还在不在这一页的列表里。
import type { ArtistStatus } from "@ai-star-eco/types/artist";

export const CAST_STATUS_LABEL: Record<ArtistStatus, string> = {
  active: "在用",
  debut: "在用",
  trainee: "制作中",
  rest: "暂停使用",
  retired: "已归档",
};

export const CAST_STATUS_TONE: Record<ArtistStatus, "success" | "info" | "neutral"> = {
  active: "success",
  debut: "success",
  trainee: "info",
  rest: "neutral",
  retired: "neutral",
};

/** 归档确认框：说后果和怎么恢复（归档只影响这一页的列表，短剧里的绑定直接读 AiAvatar，不受影响）。 */
export const ARCHIVE_DESCRIPTION =
  "归档后会收进「已归档」，想用时点「恢复」。短剧里已经绑了这个数字人的角色不受影响。";
