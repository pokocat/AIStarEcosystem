/**
 * 账号区的 7 个标签（2026-11-10 第三版，设计稿「账号区（三）：合并页面与统一路由」）。地址统一在 /me 下面。
 * 「企业」只在开通企业功能时显示（构建期 NEXT_PUBLIC_ENTERPRISE_ENABLED）。
 */
export const ACCOUNT_PAGES = [
  { key: "me", href: "/me", label: "总览" },
  { key: "tasks", href: "/me/tasks", label: "任务历史" },
  { key: "credits", href: "/me/credits", label: "积分" },
  { key: "storage", href: "/me/storage", label: "存储" },
  { key: "authorization", href: "/me/authorization", label: "授权" },
  { key: "enterprise", href: "/me/enterprise", label: "企业" },
  { key: "settings", href: "/me/settings", label: "设置" },
] as const;

export type AccountPageKey = (typeof ACCOUNT_PAGES)[number]["key"];

export function visibleAccountPages() {
  return ACCOUNT_PAGES.filter(page => page.key !== "enterprise" || process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === "1");
}

/** 「存储」「授权」的子标签。 */
export const STORAGE_TABS = [{ href: "/me/storage", label: "用量" }, { href: "/me/storage/trash", label: "回收站" }] as const;
export const AUTHORIZATION_TABS = [
  { href: "/me/authorization", label: "真人授权" },
  { href: "/me/authorization/ip", label: "IP 授权登记" },
  { href: "/me/authorization/stars", label: "明星形象授权" },
] as const;

/** 旧工作室里账号页的哈希 → 新地址。旧链接、书签、旧 SPA 内部跳转都经 /studio 转到这里。 */
const LEGACY_ACCOUNT_HASH: Record<string, string> = {
  membership: "/me/credits",
  tasks: "/me/tasks",
  storage: "/me/storage",
  trash: "/me/storage/trash",
  realmaterials: "/me/authorization",
  licenses: "/me/authorization/ip",
  settings: "/me/settings",
  security: "/me/settings",
};

/** 这个哈希是不是旧的账号页（是的话旧 SPA 不接管，由 /studio 转到新地址）。 */
export function accountPageKey(hash: string): string | undefined {
  const key = hash.replace(/^#\/?/, "").split("/")[0];
  return key in LEGACY_ACCOUNT_HASH ? key : undefined;
}

/** Preserve stateful creation and real-auth callbacks; only replace obsolete root screens. */
export function studioEntryDestination(hash: string, search = ""): string | undefined {
  const params = new URLSearchParams(search);
  if (["sheet", "real", "ai", "compose"].includes(params.get("start") || "") || params.get("create") === "1") return;
  const key = hash.replace(/^#\/?/, "");
  return ({ "": "/projects", studio: "/projects", home: "/dashboard", library: "/assets", me: "/me" } as Record<string, string>)[key] ?? LEGACY_ACCOUNT_HASH[key];
}

/**
 * 从站内别的页面点进旧工作室时带上来源（`/studio?from=…#/voice`），工作室根页的「返回」回到那里，而不是旧工作室自己的首页
 * （2026-10-30 线上复核：资产 → 声音 → 声音工作室 → 返回，跳到了首页）。只认站内路径。
 */
export function studioWithReturn(href: string, from: string): string {
  return href.replace(/^\/studio(?=#|$)/, `/studio?from=${encodeURIComponent(from)}`);
}
export function studioReturnPath(from: string | null): string | undefined {
  return from && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/\\") ? from : undefined;
}

export const STUDIO_NAVIGATION_EVENT = "studio:navigation";
