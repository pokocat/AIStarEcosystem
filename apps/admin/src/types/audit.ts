// ─────────────────────────────────────────────────────────────────────────────
// audit.ts — 审计日志。
// 对应后端 AuditLogDto / aep_audit_logs 表。v0.47 扩展 username / errorCode。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type AuditResult = "success" | "failure";

export interface AuditLog {
  id: ID;
  /** 登录用户 id（失败登录时可能为 null）。 */
  userId?: string | null;
  /** v0.47：用户在登录时输入的辨识串（admin username / 手机号 / aep username）。失败时也落，便于排查。 */
  username?: string | null;
  tenantId?: string | null;
  /**
   * 动作命名：见 server AuditService.Actions。
   * 登录注册相关：admin.login / admin.operator_login / admin.change_password /
   * auth.sms.request_code / auth.sms.login / auth.sms.register /
   * auth.password.login / auth.dev_login / auth.license.activate
   */
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  /** v0.47：失败时的业务码（如 ADMIN_CREDENTIALS_INVALID）。成功时 null。 */
  errorCode?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  result: AuditResult;
  detail?: string | null;
  createdAt: ISODateTime;
}

/**
 * v0.47：登录注册类动作 → 中文展示字典。
 * 与 server AuditService.Actions 严格对齐。
 */
export const AUTH_ACTION_LABEL: Record<string, string> = {
  "admin.login": "管理员登录",
  "admin.operator_login": "运营登录",
  "admin.change_password": "管理员改密",
  "auth.sms.request_code": "发送短信验证码",
  "auth.sms.login": "短信验证码登录",
  "auth.sms.register": "短信 + 激活码注册",
  "auth.password.login": "手机号 + 密码登录",
  "auth.dev_login": "开发联调登录",
  "auth.license.activate": "激活码注册",
};

export const AUTH_ACTION_KEYS = Object.keys(AUTH_ACTION_LABEL);
