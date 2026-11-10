// 账号区：任务历史、存储用量、画布回收站。服务端：StudioTaskHistoryController / StudioStorageService /
// IpStudioController（/api/v1/ip-studio/task-history、/storage、/projects/trash）。

export type StudioTaskType = "image" | "video" | "audio" | "text" | "dialogue" | "digital-human";
export type StudioTaskStatus = "running" | "done" | "failed";

/** 一条任务的积分：spent 为已扣（含模型赠款），scopedSpent 为其中的模型赠款；pending 为进行中尚未结算；released 为已退回。 */
export interface StudioTaskCredits {
  spent: number;
  scopedSpent: number;
  pending: number;
  released: number;
}

export interface StudioTaskPayer {
  type: "personal" | "enterprise";
  name: string | null;
}

export interface StudioTaskHistoryItem {
  id: string;
  source: "canvas" | "director" | "digital-human";
  sourceId: string | null;
  sourceTitle: string | null;
  type: StudioTaskType;
  kind: string | null;
  title: string;
  status: StudioTaskStatus;
  pct: number;
  /** 真实排队位次（从 1 开始）；不在排队时为 null。 */
  queuePosition: number | null;
  createdAt: string | null;
  finishedAt: string | null;
  credits: StudioTaskCredits;
  payer: StudioTaskPayer;
  errorCode: string | null;
  errorMessage: string | null;
  /** 站内跳转地址：画布、导演台作品或数字人详情。 */
  href: string;
  /** 这条任务保留了模型返回的原文，可在任务历史里「查看原文」（`/me/model-results?taskId=`）。 */
  hasModelResult: boolean;
}

/** 时间窗内的汇总（与状态筛选无关）。partial=true 表示只统计了最近的一部分。 */
export interface StudioTaskHistorySummary {
  spent: number;
  scopedSpent: number;
  released: number;
  count: number;
  running: number;
  partial: boolean;
}

export interface StudioTaskHistoryPage {
  items: StudioTaskHistoryItem[];
  page: number;
  hasMore: boolean;
  summary: StudioTaskHistorySummary;
}

export interface StudioStorageCategory {
  key: "image" | "video" | "digital-human" | "upload" | "audio" | "license" | "other";
  label: string;
  mb: number;
}

export interface StudioStorageUsage {
  usedMb: number;
  quotaMb: number;
  baseQuotaMb: number;
  grantedMb: number;
  categories: StudioStorageCategory[];
}

export interface StudioTrashedCanvas {
  id: string;
  name: string;
  deletedAt: string | null;
}
