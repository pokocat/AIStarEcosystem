/** One account navigation for the modern overview and the existing task screens. */
export const ACCOUNT_PAGES = [
  { key: "me", href: "/me", label: "账号总览", icon: "user" },
  { key: "invitations", href: "/invitations", label: "邀请朋友", icon: "invitation" },
  { key: "tasks", href: "/studio#/tasks", label: "任务中心", icon: "tasks" },
  { key: "membership", href: "/studio#/membership", label: "会员与积分", icon: "credits" },
  { key: "storage", href: "/studio#/storage", label: "存储用量", icon: "storage" },
  { key: "realmaterials", href: "/studio#/realmaterials", label: "真人授权素材", icon: "materials" },
  { key: "trash", href: "/studio#/trash", label: "回收站", icon: "trash" },
  { key: "settings", href: "/studio#/settings", label: "设置与安全", icon: "settings" },
] as const;

export function accountPageKey(hash: string): string | undefined {
  const key = hash.replace(/^#\/?/, "").split("/")[0];
  if (key === "security") return "settings";
  return ACCOUNT_PAGES.find(page => page.key === key)?.key;
}

/** Preserve stateful creation and real-auth callbacks; only replace obsolete root screens. */
export function studioEntryDestination(hash: string, search = ""): string | undefined {
  const params = new URLSearchParams(search);
  if (["sheet", "real", "ai", "compose"].includes(params.get("start") || "") || params.get("create") === "1") return;
  const key = hash.replace(/^#\/?/, "");
  return ({ "": "/projects", studio: "/projects", home: "/dashboard", library: "/assets", me: "/me", licenses: "/licenses" } as Record<string, string>)[key];
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
