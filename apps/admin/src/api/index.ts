// ─────────────────────────────────────────────────────────────────────────────
// api/index.ts — Admin API 统一出口。
// 组件从 "@/api" 导入，不直接引用子文件。
// ─────────────────────────────────────────────────────────────────────────────

export * from "./_client";
export * as AepUsersApi from "./aep-users";
export * as AppearanceForgeApi from "./appearance-forge";
export * as AuditApi from "./audit";
export * as AuthApi from "./auth";
export * as CoachApi from "./coach";
export * as CommunityApi from "./community";
export * as DigitalIpsApi from "./digital-ips";
export * as DistributionApi from "./distribution";
export * as SocialAccountApi from "./social-account";
export * as PublishJobApi from "./publish-job";
export * as FanApi from "./fan";
export * as FilmApi from "./film";
export * as FinanceApi from "./finance";
export * as LicensesApi from "./licenses";
export * as StaffApi from "./staff";
export * as MusicApi from "./music";
export * as NotificationsApi from "./notifications";
export * as PoseApi from "./pose";
export * as SettingsApi from "./settings";
export * as StatsApi from "./stats";
export * as StudiosApi from "./studios";
export * as TenantsApi from "./tenants";
export * as UsersApi from "./users";
export * as WalletApi from "./wallet";
export * as WardrobeApi from "./wardrobe";
export * as StoreApi from "./store";
export * as PlatformConfigApi from "./platform-config";
export * as GenerationApi from "./generation";
export * as ProductsApi from "./products";
export * as CelebrityZoneApi from "./celebrity-zone";
export * as CelebrityAuthorizationsApi from "./celebrity-authorizations";
export * as RechargePackagesApi from "./recharge-packages";
export * as TemplateScriptsApi from "./template-scripts";
export * as AiModelsApi from "./ai-models";
export * as LlmKeysApi from "./llm-keys";
export * as MixcutOfficialClipsApi from "./mixcut-official-clips";
export * as ErrorLogApi from "./error-log";
export * as SellingChannelsApi from "./selling-channels";
