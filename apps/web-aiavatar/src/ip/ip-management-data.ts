import type { Avatar } from "@/proto/data";
import type { StudioIpAsset } from "@ai-star-eco/types/ip-studio-workflow";
import { groupStudioIpAssets, ipAssetRole } from "@/canvas-bridge/studio-ip-library";

export const ipStatusLabels = { all: "全部", active: "进行中", finalized: "已定稿", draft: "草稿", archived: "已归档" } as const;
export type IpStatusFilter = keyof typeof ipStatusLabels;
export type ManagedIp = { avatar: Avatar; assets: StudioIpAsset[]; main?: StudioIpAsset };

export function managedIpStatus(status: Avatar["status"]): Exclude<IpStatusFilter, "all"> {
  return status === "finalized" ? "finalized" : status === "archived" ? "archived" : status === "draft" ? "draft" : "active";
}
export function mergeManagedIps(avatars: Avatar[], assets: StudioIpAsset[]): ManagedIp[] {
  const groups = new Map(groupStudioIpAssets(assets.filter(a => a.librarySource !== "official")).map(g => [g.id, g]));
  return avatars.map(avatar => ({ avatar, assets: groups.get(avatar.id)?.assets || [], main: groups.get(avatar.id)?.main }));
}
export function managedIpTags(ip: ManagedIp): string[] {
  return [...new Set([ip.avatar.def?.气质, ...(ip.avatar.def?.性格 || []), ip.avatar.def?.用途].filter((v): v is string => !!v?.trim()))];
}
export function filterManagedIps(items: ManagedIp[], query: string, status: IpStatusFilter, tag: string, order: string): ManagedIp[] {
  const search = query.trim().toLocaleLowerCase();
  const filtered = items.filter(ip => (status === "all" || managedIpStatus(ip.avatar.status) === status) &&
    (!tag || managedIpTags(ip).includes(tag)) && (!search || [ip.avatar.name, ip.avatar.tagline, ip.avatar.def?.设定语, ...managedIpTags(ip)].join(" ").toLocaleLowerCase().includes(search)));
  return filtered.sort((a, b) => order === "name" ? a.avatar.name.localeCompare(b.avatar.name, "zh-CN") :
    order === "images" ? managedIpImages(b) - managedIpImages(a) : b.avatar.updated.localeCompare(a.avatar.updated));
}
export function managedIpImages(ip: ManagedIp) {
  return ip.assets.filter(a => ipAssetRole(a) !== "history").length || (ip.avatar.imageUrl ? 1 : 0);
}
export function managedIpDescription(ip: ManagedIp) {
  return ip.avatar.def?.设定语 || ip.main?.description || ip.avatar.descPrompt || "";
}
