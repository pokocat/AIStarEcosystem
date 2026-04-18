// ─────────────────────────────────────────────────────────────────────────────
// api/index.ts — 统一出口。组件从 "@/api" 导入，不直接引用子文件。
// ─────────────────────────────────────────────────────────────────────────────

export * from "./_client";
export * as AccountApi from "./account";
export * as AuthApi from "./auth";
export * as ArtistsApi from "./artists";
export * as MusicApi from "./music";
export * as FilmApi from "./film";
export * as FanApi from "./fan";
export * as CoachApi from "./coach";
export * as WardrobeApi from "./wardrobe";
export * as PoseApi from "./pose";
export * as DistributionApi from "./distribution";
export * as CommunityApi from "./community";
export * as FinanceApi from "./finance";
export * as NotificationsApi from "./notifications";
export * as SettingsApi from "./settings";
export * as AppearanceForgeApi from "./appearance-forge";
