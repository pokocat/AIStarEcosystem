// @ai-star-eco/api-client 入口聚合。
//
// 设计原则：
//   - 网络专用（无 mock 分支）；新 web app 若需 mock，自行在 src/api 包一层。
//   - 跨子域名 SSO 由统一账号中心（id.aibuzz.cn）承担，见 docs/unified-identity-plan.md D9；
//     登录模式开关见 ./config.ts（authMode / idIssuer / idClientId）。
//
// 用法：
//   import { apiFetch, ApiError, AuthProvider, useAuth, AccountApi, AuthApi } from "@ai-star-eco/api-client";

export {
  apiFetch,
  apiFetchPaginated,
  ApiError,
  USE_MOCK,
  ENABLE_DEV_LOGIN,
  AUTH_TOKEN_KEY,
  API_BASE_URL,
  getAuthToken,
  setAuthToken,
  setAppCode,
  registerUnauthorizedHandler,
  registerEnrollmentRequiredHandler,
  isProductNotEnrolledError,
  PRODUCT_NOT_ENROLLED,
  // 刷新令牌时后端不可用（P1-8）：可重试，不等于没登录
  isAuthRefreshUnavailableError,
  AUTH_REFRESH_UNAVAILABLE,
  buildQuery,
  mockDelay,
  // 统一账号中心令牌仓库（id 模式）
  AUTH_REFRESH_TOKEN_KEY,
  AUTH_EXPIRES_AT_KEY,
  AUTH_ID_TOKEN_KEY,
  getRefreshToken,
  setRefreshToken,
  getIdToken,
  setIdToken,
  getTokenExpiresAt,
  setTokenExpiresAt,
  clearAuthTokens,
} from "./_client";

// 登录模式开关（docs/unified-identity-plan.md §12.5）
export { authMode, idIssuer, idClientId, isIdMode, type AuthMode } from "./config";

// 统一账号中心 OIDC + PKCE 流程
export {
  beginLogin,
  completeAuthCallback,
  refreshAccessToken,
  logout as idLogout,
  sanitizeReturnPath,
  buildAuthorizeUrl,
  computeCodeChallenge,
  generateCodeVerifier,
  generateState,
  base64UrlEncode,
  OidcError,
  isTransientOidcError,
  AUTH_CALLBACK_PATH,
  OIDC_PENDING_KEY,
} from "./oidc";

export {
  AuthProvider,
  useAuth,
  useAuthOptional,
  type AuthProviderProps,
  type AuthState,
} from "./auth-context";

// 会话状态判定（P1-8：/api/me 失败 ≠ 没登录）
export {
  isDefinitiveUnauthorized,
  isTransientAuthFailure,
  statusForMeFailure,
  shouldRedirectToLogin,
  shouldRenderRetryScreen,
  type AuthStatus,
} from "./auth-status";

export {
  registerMock,
  registerMocks,
  clearMocks,
  listMocks,
  findMockHandler,
  type MockMethod,
  type MockHandler,
  type MockHandlerCtx,
} from "./_mock-registry";

// auth + account 的兜底 mock：USE_MOCK=1 时让 dev-login / /me / /me/wallet 可用。
// 业务 mock 在各 web app 自行注册并可覆盖这些 handler。
import "./_bootstrap-mocks";

// 充值套餐的 dev/mock 真值（= admin 后端配置 / seed）。子应用 mock 兜底应复用它，避免漂移。
export { DEFAULT_RECHARGE_PACKAGES } from "./_mocks";

export * from "./format";

import * as AccountApi from "./api/account";
import * as AuthApi from "./api/auth";
import * as PublishJobApi from "./api/publish-job";
import * as SocialAccountApi from "./api/social-account";

export { AccountApi, AuthApi, PublishJobApi, SocialAccountApi };
export type { SmsCodePurpose, SmsDeliveryStatus, SmsRequestCodeResult } from "./api/auth";
export type { CheckoutPayload, CheckoutResponse, PaymentChannel } from "./api/account";

// 子路径 alt 入口（按域细粒度引入）：
//   import { getMe } from "@ai-star-eco/api-client/api/account";
//   import { devLogin } from "@ai-star-eco/api-client/api/auth";
//   import { listPublishJobs } from "@ai-star-eco/api-client/api/publish-job";
//   import { initBind } from "@ai-star-eco/api-client/api/social-account";
