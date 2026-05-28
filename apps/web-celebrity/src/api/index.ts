// api/index.ts — 本 app 的 API 聚合出口。
//   - 共享：从 @ai-star-eco/api-client 重导出（Account/Auth/底座工具）
//   - 本地：CelebrityZoneApi + ProductsApi

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
  AccountApi,
  AuthApi,
} from "@ai-star-eco/api-client";

import * as CelebrityZoneApi from "./celebrity-zone";
import * as ProductsApi from "./products";
import * as MixcutApi from "./mixcut";
import * as MaterialOpsApi from "./material-ops";

export { CelebrityZoneApi, ProductsApi, MixcutApi, MaterialOpsApi };
