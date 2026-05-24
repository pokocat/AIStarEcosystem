// ─────────────────────────────────────────────────────────────────────────────
// types/error-log.ts — 错误日志（v0.30 新增）。对应 server ErrorLogDto。
// 字段与后端 record ErrorLogDto 1:1 对齐（camelCase wire）。
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorLog {
  /** 内部主键（UUID）。对外引用一律用 logId。 */
  id: string;
  /** 短追查号（12 字符，A-Z 去易混淆 + 2-9），用户报错时复述。 */
  logId: string;
  /** ISO-8601 时间字符串。 */
  occurredAt: string;
  /** 发生异常的机器（容器/Pod hostname）。 */
  hostname?: string | null;
  userId?: string | null;
  username?: string | null;
  httpMethod?: string | null;
  endpoint?: string | null;
  httpStatus?: number | null;
  /** 异常类简名，如 "BusinessException" / "NullPointerException"。 */
  errorType?: string | null;
  /** 业务错误码（BusinessException 才有），如 "ORDER_NOT_FOUND"。 */
  errorCode?: string | null;
  message?: string | null;
  stacktrace?: string | null;
  /** 脱敏后的请求参数 JSON 文本。 */
  requestParams?: string | null;
  userAgent?: string | null;
  clientIp?: string | null;
}
