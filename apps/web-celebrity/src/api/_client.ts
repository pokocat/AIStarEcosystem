// _client.ts — 本 app 的 API 底座，从 packages/api-client 重导出公共部分。
// 业务 api/*.ts 文件需要 USE_MOCK 分支时仍可读 USE_MOCK；mockDelay 也保留。

export {
  apiFetch,
  ApiError,
  USE_MOCK,
  AUTH_TOKEN_KEY,
  API_BASE_URL,
  getAuthToken,
  setAuthToken,
  registerUnauthorizedHandler,
  buildQuery,
  mockDelay,
} from "@ai-star-eco/api-client";
