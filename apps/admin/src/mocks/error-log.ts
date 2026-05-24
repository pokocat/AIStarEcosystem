// ─────────────────────────────────────────────────────────────────────────────
// mocks/error-log.ts — 错误日志样本数据（v0.30）。
// 覆盖三类典型来源：业务异常 / 500 系统异常 / 422 校验异常。
// ─────────────────────────────────────────────────────────────────────────────

import type { ErrorLog } from "@/types/error-log";

export const ERROR_LOGS: ErrorLog[] = [
  {
    id: "el-001",
    logId: "K7QN3T9XB4F2",
    traceId: "kP3xR9aBcD4eF7hJ",
    occurredAt: "2026-05-23T09:42:11Z",
    hostname: "aep-prod-pod-7c4d8b9",
    userId: "u_42",
    username: "alice",
    httpMethod: "POST",
    endpoint: "/api/me/mixcut/jobs",
    httpStatus: 500,
    errorType: "NullPointerException",
    errorCode: "INTERNAL_ERROR",
    message: "Cannot invoke \"java.util.List.size()\" because \"slots\" is null",
    stacktrace:
      "java.lang.NullPointerException: Cannot invoke \"java.util.List.size()\" because \"slots\" is null\n" +
      "\tat com.aistareco.aep.service.MixcutJobService.create(MixcutJobService.java:128)\n" +
      "\tat com.aistareco.aep.controller.MixcutController.createJob(MixcutController.java:74)\n" +
      "\tat sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n" +
      "\t…[truncated 6342 chars]",
    requestParams: "template_id=tpl_food_v1&variants=8",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    clientIp: "223.104.63.12",
  },
  {
    id: "el-002",
    logId: "M9PD2QF7HJK5",
    traceId: "mN5yT8bDfE2gH6jK",
    occurredAt: "2026-05-23T08:15:34Z",
    hostname: "aep-prod-pod-7c4d8b9",
    userId: "u_19",
    username: "bob",
    httpMethod: "POST",
    endpoint: "/api/me/wallet/recharge",
    httpStatus: 400,
    errorType: "BusinessException",
    errorCode: "PACKAGE_NOT_FOUND",
    message: "充值套餐不存在或已下架",
    stacktrace:
      "com.aistareco.common.BusinessException: 充值套餐不存在或已下架\n" +
      "\tat com.aistareco.aep.service.CreditService.recharge(CreditService.java:88)\n" +
      "\tat com.aistareco.aep.controller.FinanceController.recharge(FinanceController.java:42)",
    requestParams: "package_id=pkg_premium_v2&amount=99",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    clientIp: "116.228.89.44",
  },
  {
    id: "el-003",
    logId: "T4XR8MJN2QC6",
    traceId: "qS7uV2cEgH4mN8pR",
    occurredAt: "2026-05-22T22:01:09Z",
    hostname: "aep-prod-pod-9f2a1c0",
    userId: null,
    username: null,
    httpMethod: "POST",
    endpoint: "/api/auth/register",
    httpStatus: 422,
    errorType: "ResponseStatusException",
    errorCode: "UNPROCESSABLE_ENTITY",
    message: "邮箱格式不合法",
    stacktrace:
      "org.springframework.web.server.ResponseStatusException: 422 UNPROCESSABLE_ENTITY \"邮箱格式不合法\"\n" +
      "\tat com.aistareco.aep.service.AuthService.validateEmail(AuthService.java:65)\n" +
      "\tat com.aistareco.aep.controller.AuthController.register(AuthController.java:38)",
    requestParams: "email=not-an-email&password=***",
    userAgent: "okhttp/4.10.0",
    clientIp: "47.102.11.4",
  },
];
