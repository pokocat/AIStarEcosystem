// ─────────────────────────────────────────────────────────────────────────────
// api/index.ts — 本 app 的 API 聚合出口。
//   - 共享底座 + Account/Auth：从 @ai-star-eco/api-client 重导出（自带 USE_MOCK 分支）
//   - 本地业务 API：导出本地 modules（music / artists / appearance-forge 等）
// ─────────────────────────────────────────────────────────────────────────────

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
export * as DapAvatarsApi from "./dap-avatars";
export * as MusicApi from "./music";
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
// ── v0.39 · 素材中心 / 制作工坊（figma MCN 运营端 2 页迁入）──────────────────
export * as AssetApi from "./asset";
export * as CopyApi from "./copy";
export * as ClipStudioApi from "./clip-studio";
export * as DigitalPersonApi from "./digital-person";
export * as BatchMixApi from "./batch-mix";
