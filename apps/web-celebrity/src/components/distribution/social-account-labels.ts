import type { SocialAccount } from "@ai-star-eco/types/social-account";

const PLATFORM_ACCOUNT_LABEL: Record<string, string> = {
  douyin: "抖音号",
  kuaishou: "快手号",
  xiaohongshu: "小红书号",
  shipinhao: "视频号",
  bilibili: "B站号",
  tiktok: "TikTok ID",
  youtube: "YouTube",
  baijiahao: "百家号",
};

/** 仅平台简称：抖音 / 快手 / 小红书 / 视频号。展示用，不带"号"字。 */
const PLATFORM_DISPLAY_NAME: Record<string, string> = {
  douyin: "抖音",
  kuaishou: "快手",
  xiaohongshu: "小红书",
  shipinhao: "视频号",
  bilibili: "B站",
  tiktok: "TikTok",
  youtube: "YouTube",
  baijiahao: "百家号",
};

export function platformAccountLabel(platform: string): string {
  return PLATFORM_ACCOUNT_LABEL[platform] ?? "平台账号";
}

export function platformDisplayName(platform: string): string {
  return PLATFORM_DISPLAY_NAME[platform] ?? platform;
}

export function socialAccountOptionLabel(account: SocialAccount): string {
  const primary = account.displayName || account.accountName;
  if (!account.platformAccountId) return primary;
  return `${primary} (${platformAccountLabel(account.platform)} ${account.platformAccountId})`;
}

