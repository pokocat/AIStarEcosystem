// ─────────────────────────────────────────────────────────────────────────────
// api.ts — 通用响应格式，与 specs/openapi.yaml 6.x 节对齐
// ─────────────────────────────────────────────────────────────────────────────

// ── 6.3 错误响应 ─────────────────────────────────────────────────────────────

export interface ApiErrorShape {
  code: string;       // 业务错误码，英文大写下划线，如 SINGER_NOT_FOUND
  message: string;    // 用户友好信息（中文）
  messageEn?: string; // 英文版本
  details?: unknown;
}

// ── 6.1 / 6.2 成功响应 ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ── 6.5 异步任务启动响应 ──────────────────────────────────────────────────────

export interface AsyncJobStarted {
  jobId: string;
  status: "queued";
  pollUrl: string;
  pollIntervalMs: number;
  estimatedSeconds?: number;
}
