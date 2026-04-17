// ─────────────────────────────────────────────────────────────────────────────
// _shared.ts — 跨域共享类型 / 枚举 / API 通用壳。
// 以前端设计为唯一事实源；后端需按本文件定义对齐。
// ─────────────────────────────────────────────────────────────────────────────

// ── 稀有度（Artist / Wardrobe / NFT / Pose 共用） ─────────────────────────────
export type Rarity = "common" | "rare" | "epic" | "legendary";

// ── ID / 时间戳别名（便于后续收敛到分支类型） ────────────────────────────────
export type ID = string;
export type ISODateTime = string; // ISO-8601，例："2026-04-17T08:30:00Z"
export type ISODate = string;     // "YYYY-MM-DD"

// ── 金额：前端目前多以预格式化字符串展示（如 "¥1.2M"），同时保留数值 ─────
export interface Money {
  /** 原始数值（人民币分或元，按 currency 决定） */
  amount: number;
  currency: "CNY" | "USD";
  /** 前端预格式化后的展示文本，可选 */
  display?: string;
}

// ── API 壳（与 apps/server / specs/openapi.yaml 对齐） ───────────────────────
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

export interface AsyncJobStarted {
  jobId: ID;
  status: "queued";
  pollUrl: string;
  pollIntervalMs: number;
  estimatedSeconds?: number;
}

// ── 列表查询通用入参 ──────────────────────────────────────────────────────────
export interface ListQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: "asc" | "desc";
}
