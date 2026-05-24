// ─────────────────────────────────────────────────────────────────────────────
// api/error-log.ts — 错误日志查询（v0.30）。对应 AdminErrorLogController。
// 仅 SUPER_ADMIN 可访问；OPERATOR 调用会返回 403。
// ─────────────────────────────────────────────────────────────────────────────

import type { ErrorLog } from "@/types/error-log";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { ERROR_LOGS } from "@/mocks/error-log";

export interface ErrorLogListParams {
  userId?: string;
  /** 端点子串过滤，如 "/mixcut" 命中 "/api/mixcut/jobs"。 */
  endpoint?: string;
  httpStatus?: number;
  hostname?: string;
  /**
   * 精确匹配 traceId：拿到一条 ErrorLog 后想看「同一请求触发的所有错误」时用。
   * 与 endpoint / userId 等模糊过滤不同，traceId 是精确等值。
   */
  traceId?: string;
  /** ISO-8601 起始时间（含）。 */
  since?: string;
  /** ISO-8601 结束时间（含）。 */
  until?: string;
  page?: number;
  size?: number;
}

export async function listErrorLogs(params: ErrorLogListParams = {}): Promise<ErrorLog[]> {
  if (USE_MOCK) return mockDelay(filterMock(ERROR_LOGS, params));
  // apiFetch.query 是 Record<string, unknown>；ErrorLogListParams 字段全可选，整体强制就行
  return apiFetch<ErrorLog[]>("/admin/error-logs", {
    query: params as Record<string, unknown>,
  });
}

/** 按追查号单条查（运营拿到用户报来的 logId 后直接搜）。 */
export async function getErrorLogByLogId(logId: string): Promise<ErrorLog> {
  if (USE_MOCK) {
    const hit = ERROR_LOGS.find((e) => e.logId === logId);
    if (!hit) throw new Error(`未找到追查号为 ${logId} 的错误日志`);
    return mockDelay(hit);
  }
  return apiFetch<ErrorLog>(`/admin/error-logs/by-log-id/${encodeURIComponent(logId)}`);
}

function filterMock(logs: ErrorLog[], p: ErrorLogListParams): ErrorLog[] {
  return logs.filter((log) => {
    if (p.userId && log.userId !== p.userId) return false;
    if (p.endpoint && !(log.endpoint ?? "").includes(p.endpoint)) return false;
    if (p.httpStatus != null && log.httpStatus !== p.httpStatus) return false;
    if (p.hostname && log.hostname !== p.hostname) return false;
    if (p.traceId && log.traceId !== p.traceId) return false;
    if (p.since && log.occurredAt < p.since) return false;
    if (p.until && log.occurredAt > p.until) return false;
    return true;
  });
}
