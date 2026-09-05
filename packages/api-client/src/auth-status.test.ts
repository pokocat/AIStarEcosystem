import { describe, expect, it } from "vitest";
import { ApiError, AUTH_REFRESH_UNAVAILABLE } from "./_client";
import {
  isDefinitiveUnauthorized,
  isTransientAuthFailure,
  shouldRedirectToLogin,
  shouldRenderRetryScreen,
  statusForMeFailure,
} from "./auth-status";

/** apiFetch 在「401 → 刷新令牌，但刷新这一步自己挂了」时抛的东西（P1-8）。 */
const refreshUnavailable = new ApiError(
  { code: AUTH_REFRESH_UNAVAILABLE, message: "暂时无法确认登录状态，请稍后重试。" },
  503,
);

describe("isDefinitiveUnauthorized", () => {
  it("只有 401 才算「确定没登录」", () => {
    expect(isDefinitiveUnauthorized(new ApiError({ code: "UNAUTHORIZED", message: "x" }, 401))).toBe(true);
  });

  it("5xx / 网关错误 / 坏响应都不算没登录", () => {
    expect(isDefinitiveUnauthorized(new ApiError({ code: "HTTP_ERROR", message: "x" }, 502))).toBe(false);
    expect(isDefinitiveUnauthorized(new ApiError({ code: "HTTP_ERROR", message: "x" }, 504))).toBe(false);
    expect(isDefinitiveUnauthorized(new ApiError({ code: "PARSE_ERROR", message: "x" }, 200))).toBe(false);
    // 反代/Next 代理挂了：fetch 直接抛 TypeError，连状态码都没有
    expect(isDefinitiveUnauthorized(new TypeError("Failed to fetch"))).toBe(false);
    expect(isDefinitiveUnauthorized(undefined)).toBe(false);
  });

  it("业务错误码叫 UNAUTHORIZED 但状态码不是 401 时不算", () => {
    expect(isDefinitiveUnauthorized(new ApiError({ code: "UNAUTHORIZED", message: "x" }, 403))).toBe(false);
  });

  it("刷新令牌时后端不可用不算没登录（令牌还在，点重试就能恢复）", () => {
    expect(isDefinitiveUnauthorized(refreshUnavailable)).toBe(false);
  });
});

describe("isTransientAuthFailure", () => {
  it("只认 apiFetch 的 AUTH_REFRESH_UNAVAILABLE", () => {
    expect(isTransientAuthFailure(refreshUnavailable)).toBe(true);
    expect(isTransientAuthFailure(new ApiError({ code: "UNAUTHORIZED", message: "x" }, 401))).toBe(false);
    expect(isTransientAuthFailure(new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("statusForMeFailure", () => {
  it("401 → unauthenticated；其余 → error（保留令牌）", () => {
    expect(statusForMeFailure(new ApiError({ code: "UNAUTHORIZED", message: "x" }, 401))).toBe("unauthenticated");
    expect(statusForMeFailure(new ApiError({ code: "HTTP_ERROR", message: "x" }, 500))).toBe("error");
    expect(statusForMeFailure(new TypeError("Failed to fetch"))).toBe("error");
  });

  it("刷新令牌时后端不可用 → error（重试屏），不是 unauthenticated", () => {
    expect(statusForMeFailure(refreshUnavailable)).toBe("error");
    // 顺带钉死这条链路的终点：error 态绝不跳登录，只渲染重试屏。
    expect(shouldRedirectToLogin({ status: "error", hasUser: false, isPublicPath: false })).toBe(false);
    expect(shouldRenderRetryScreen({ status: "error", isPublicPath: false })).toBe(true);
  });
});

describe("shouldRedirectToLogin", () => {
  it("确认未登录且在受保护页面才跳", () => {
    expect(shouldRedirectToLogin({ status: "unauthenticated", hasUser: false, isPublicPath: false })).toBe(true);
  });

  it("后端不可用时绝不跳（登录死循环的入口）", () => {
    expect(shouldRedirectToLogin({ status: "error", hasUser: false, isPublicPath: false })).toBe(false);
  });

  it("加载中 / 已登录 / 公开页都不跳", () => {
    expect(shouldRedirectToLogin({ status: "loading", hasUser: false, isPublicPath: false })).toBe(false);
    expect(shouldRedirectToLogin({ status: "ready", hasUser: true, isPublicPath: false })).toBe(false);
    expect(shouldRedirectToLogin({ status: "unauthenticated", hasUser: false, isPublicPath: true })).toBe(false);
  });
});

describe("shouldRenderRetryScreen", () => {
  it("只在受保护页面的 error 态替换页面内容", () => {
    expect(shouldRenderRetryScreen({ status: "error", isPublicPath: false })).toBe(true);
    expect(shouldRenderRetryScreen({ status: "error", isPublicPath: true })).toBe(false);
    expect(shouldRenderRetryScreen({ status: "unauthenticated", isPublicPath: false })).toBe(false);
    expect(shouldRenderRetryScreen({ status: "loading", isPublicPath: false })).toBe(false);
  });
});
