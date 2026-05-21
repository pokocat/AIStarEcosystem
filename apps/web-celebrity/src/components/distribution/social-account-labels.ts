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

const PLATFORM_ICON_URL: Record<string, string> = {
  douyin: "https://www.douyin.com/favicon.ico",
  kuaishou: "https://www.kuaishou.com/favicon.ico",
  xiaohongshu: "https://www.xiaohongshu.com/favicon.ico",
  shipinhao: "https://channels.weixin.qq.com/favicon.ico",
  bilibili: "https://www.bilibili.com/favicon.ico",
  tiktok: "https://www.tiktok.com/favicon.ico",
  youtube: "https://www.youtube.com/favicon.ico",
  baijiahao: "https://baijiahao.baidu.com/favicon.ico",
};

const PLATFORM_FALLBACK_CLASS: Record<string, string> = {
  douyin: "bg-zinc-950 text-white",
  kuaishou: "bg-orange-500 text-white",
  xiaohongshu: "bg-red-500 text-white",
  shipinhao: "bg-emerald-500 text-white",
  bilibili: "bg-sky-500 text-white",
  tiktok: "bg-zinc-950 text-white",
  youtube: "bg-red-600 text-white",
  baijiahao: "bg-blue-600 text-white",
};

export function platformAccountLabel(platform: string): string {
  return PLATFORM_ACCOUNT_LABEL[platform] ?? "平台账号";
}

export function platformDisplayName(platform: string): string {
  return PLATFORM_DISPLAY_NAME[platform] ?? platform;
}

export function platformIconUrl(platform: string): string | undefined {
  return PLATFORM_ICON_URL[platform];
}

export function platformFallbackClass(platform: string): string {
  return PLATFORM_FALLBACK_CLASS[platform] ?? "bg-zinc-500 text-white";
}

export function socialAccountOptionLabel(account: SocialAccount): string {
  const primary = account.displayName || account.accountName;
  if (!account.platformAccountId) return primary;
  return `${primary} (${platformAccountLabel(account.platform)} ${account.platformAccountId})`;
}
