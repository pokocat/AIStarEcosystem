// ─────────────────────────────────────────────────────────────────────────────
// api/audit.ts — 审计日志 API。对应 AdminAuditLogController。
// v0.47：扩展多维筛选 + 登录注册日志专用 listAuthLogs 工具方法。
// ─────────────────────────────────────────────────────────────────────────────

import type { AuditLog, AuditResult } from "@/types/audit";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { AUDIT_LOGS } from "@/mocks/audit";

export interface AuditLogListParams {
  userId?: string;
  username?: string;
  action?: string;
  actions?: string[];
  ipAddress?: string;
  errorCode?: string;
  result?: AuditResult;
  since?: string;
  until?: string;
  page?: number;
  size?: number;
}

export async function listAuditLogs(params: AuditLogListParams = {}): Promise<AuditLog[]> {
  if (USE_MOCK) {
    const filtered = AUDIT_LOGS.filter((log) => {
      if (params.userId && log.userId !== params.userId) return false;
      if (params.username && !(log.username ?? "").startsWith(params.username)) return false;
      if (params.action && log.action !== params.action) return false;
      if (params.actions?.length && !params.actions.includes(log.action)) return false;
      if (params.ipAddress && !(log.ipAddress ?? "").startsWith(params.ipAddress)) return false;
      if (params.errorCode && log.errorCode !== params.errorCode) return false;
      if (params.result && log.result !== params.result) return false;
      if (params.since && log.createdAt < params.since) return false;
      if (params.until && log.createdAt > params.until) return false;
      return true;
    });
    return mockDelay(filtered);
  }
  return apiFetch<AuditLog[]>("/admin/audit-logs", {
    query: {
      userId: params.userId,
      username: params.username,
      action: params.action,
      actions: params.actions && params.actions.length > 0 ? params.actions.join(",") : undefined,
      ipAddress: params.ipAddress,
      errorCode: params.errorCode,
      result: params.result,
      since: params.since,
      until: params.until,
      page: params.page ?? 0,
      size: params.size ?? 100,
    },
  });
}

/**
 * v0.47：登录注册日志多维筛选入口。
 * server 端 GET /admin/audit-logs 接 scope=auth-all + actions / username / ipAddress 等 query。
 */
export interface AuthLogListParams {
  /** 默认按「登录注册全集」过滤；显式传 actions 时覆盖该默认。 */
  scope?: "auth-all";
  /** action 列表，如 ["admin.login","auth.sms.login"]。 */
  actions?: string[];
  userId?: string;
  /** 用户名 / 手机号前缀（LIKE 'xxx%'）。 */
  username?: string;
  /** IP 前缀（LIKE 'xxx%'）。 */
  ipAddress?: string;
  errorCode?: string;
  result?: AuditResult;
  /** ISO-8601 起始时间（含）。 */
  since?: string;
  /** ISO-8601 结束时间（含）。 */
  until?: string;
  page?: number;
  size?: number;
}

const AUTH_ACTION_DEFAULTS = [
  "admin.login",
  "admin.operator_login",
  "admin.change_password",
  "auth.sms.request_code",
  "auth.sms.login",
  "auth.sms.register",
  "auth.password.login",
  "auth.dev_login",
  "auth.license.activate",
];

export async function listAuthLogs(params: AuthLogListParams = {}): Promise<AuditLog[]> {
  if (USE_MOCK) {
    const want = new Set(
      params.actions && params.actions.length > 0 ? params.actions : AUTH_ACTION_DEFAULTS,
    );
    const filtered = AUDIT_LOGS.filter((log) => {
      if (!want.has(log.action)) return false;
      if (params.userId && log.userId !== params.userId) return false;
      if (params.username && !(log.username ?? "").startsWith(params.username)) return false;
      if (params.ipAddress && !(log.ipAddress ?? "").startsWith(params.ipAddress)) return false;
      if (params.errorCode && log.errorCode !== params.errorCode) return false;
      if (params.result && log.result !== params.result) return false;
      if (params.since && log.createdAt < params.since) return false;
      if (params.until && log.createdAt > params.until) return false;
      return true;
    });
    return mockDelay(filtered);
  }
  return apiFetch<AuditLog[]>("/admin/audit-logs", {
    query: {
      // 显式传 actions 时覆盖 scope；否则用 scope=auth-all 简短一键收口
      scope: params.actions && params.actions.length > 0 ? undefined : (params.scope ?? "auth-all"),
      actions: params.actions && params.actions.length > 0 ? params.actions.join(",") : undefined,
      userId: params.userId,
      username: params.username,
      ipAddress: params.ipAddress,
      errorCode: params.errorCode,
      result: params.result,
      since: params.since,
      until: params.until,
      page: params.page ?? 0,
      size: params.size ?? 50,
    },
  });
}
