// api/index.ts — 本 app 的 API 聚合出口。
// Account/Auth 走 packages（自带 USE_MOCK 分支），业务 api 走本地。
// drama 专属业务：FilmApi（短剧）。
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

export * as ArtistsApi from "./artists";
export * as FilmApi from "./film";
export * as WardrobeApi from "./wardrobe";
export * as PoseApi from "./pose";
export * as DistributionApi from "./distribution";
export * as CommunityApi from "./community";
export * as FinanceApi from "./finance";
export * as NotificationsApi from "./notifications";
export * as SettingsApi from "./settings";
export * as AppearanceForgeApi from "./appearance-forge";
export * as ConfigApi from "./config";
export * as StoreApi from "./store";
export * as GenerationApi from "./generation";
export * as ScriptsApi from "./scripts";
export * as ShortDramaApi from "./short-drama";
