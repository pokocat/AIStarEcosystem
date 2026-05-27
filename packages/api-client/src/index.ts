// @ai-star-eco/api-client 入口聚合。
//
// 设计原则：
//   - 网络专用（无 mock 分支）；新 web app 若需 mock，自行在 src/api 包一层。
//   - 跨子域名（music/drama/celebrity.aibuzz.cn）SSO 见 _client.ts TODO。
//
// 用法：
//   import { apiFetch, ApiError, AuthProvider, useAuth, AccountApi, AuthApi } from "@ai-star-eco/api-client";

export {
  apiFetch,
  apiFetchPaginated,
  ApiError,
  USE_MOCK,
  AUTH_TOKEN_KEY,
  API_BASE_URL,
  getAuthToken,
  setAuthToken,
  registerUnauthorizedHandler,
  buildQuery,
  mockDelay,
} from "./_client";

export { AuthProvider, useAuth, type AuthProviderProps } from "./auth-context";

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

export * from "./format";

import * as AccountApi from "./api/account";
import * as AuthApi from "./api/auth";
import * as PublishJobApi from "./api/publish-job";
import * as SocialAccountApi from "./api/social-account";

export { AccountApi, AuthApi, PublishJobApi, SocialAccountApi };

// 子路径 alt 入口（按域细粒度引入）：
//   import { getMe } from "@ai-star-eco/api-client/api/account";
//   import { devLogin } from "@ai-star-eco/api-client/api/auth";
//   import { listPublishJobs } from "@ai-star-eco/api-client/api/publish-job";
//   import { initBind } from "@ai-star-eco/api-client/api/social-account";
