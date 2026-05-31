// api/index.ts — AiAvatar 中心 API 聚合出口。
//   - 共享：从 @ai-star-eco/api-client 重导出底座工具
//   - 本地：AiAvatarApi（avatars / jobs / templates / assets / health）

export {
  apiFetch,
  ApiError,
  USE_MOCK,
  ENABLE_DEV_LOGIN,
  AUTH_TOKEN_KEY,
  API_BASE_URL,
  getAuthToken,
  setAuthToken,
  registerUnauthorizedHandler,
  buildQuery,
  mockDelay,
  AccountApi,
  AuthApi,
} from "@ai-star-eco/api-client";

import * as AiAvatarApi from "./ai-avatar";

export { AiAvatarApi };
