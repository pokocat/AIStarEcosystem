// ─────────────────────────────────────────────────────────────────────────────
// api/dap-avatars.ts — AiAvatar 数字人引用层（v0.60 收敛，network-only）。
// 子应用不再自建演员形象：这里只读取「我的数字人」及其造型 / 场景图，
// 供「引入数字人」picker 选择；创建 / 渲染数字人请去 AiAvatar 应用。
// 端点为 dap 域（/api/v1/*，与 web-aiavatar 同 server 同 JWT）。
// USE_MOCK 模式由 src/mocks/_handlers/dap-avatars.ts 在网络层拦截。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from "./_client";

/** AiAvatar 应用入口（生产 aistar.aibuzz.cn；本地联调可在 .env.local 覆盖为 http://localhost:3013） */
export const AIAVATAR_URL = process.env.NEXT_PUBLIC_AIAVATAR_URL || "https://aistar.aibuzz.cn";

/** 数字人永久链接（web-aiavatar hash 路由）；screen 可选 looks / scene / atlas 等 */
export function dapAvatarDeepLink(avatarId: string, screen?: string): string {
  return `${AIAVATAR_URL}/#/avatar/${encodeURIComponent(avatarId)}${screen ? `/${screen}` : ""}`;
}

/** 数字人（dap AvatarDto 子集 —— picker 只消费这些字段） */
export interface DapAvatarLite {
  id: string;
  name: string;
  status: string;
  /** 定妆照签名 URL（无定妆照的草稿为 null，不可引入） */
  imageUrl: string | null;
  /** 形象变体图（生成时的多张变体，签名 URL） */
  variantImages?: string[];
  /** 机位照（front-half 正面半身 / right 右侧脸 / left 左侧脸 → 签名 URL） */
  shotImages?: Record<string, string> | null;
}

/** 造型（dap LookDto 子集） */
export interface DapLookLite {
  id: string;
  label: string | null;
  status: string;
  imageUrl: string | null;
}

/** 衍生资产（dap DerivativeDto 子集） */
export interface DapDerivativeLite {
  id: string;
  /** atlas | expr | scene | ward | d3 | video */
  kind: string;
  label: string | null;
  fileUrl: string | null;
  thumbUrl: string | null;
}

/** 可作演员展示图的衍生物 kind（与 server DapAvatarRefResolver 白名单对齐） */
export const IMAGE_DERIV_KINDS = ["atlas", "expr", "scene", "ward"];

/** 我的数字人列表 */
export async function listMyDapAvatars(): Promise<DapAvatarLite[]> {
  return apiFetch<DapAvatarLite[]>("/v1/avatars", { query: { scope: "mine" } });
}

/** 某数字人的全部造型 */
export async function listDapLooks(avatarId: string): Promise<DapLookLite[]> {
  return apiFetch<DapLookLite[]>(`/v1/avatars/${encodeURIComponent(avatarId)}/looks`);
}

/** 某数字人的全部衍生资产（展示图候选请按 IMAGE_DERIV_KINDS 过滤） */
export async function listDapDerivatives(avatarId: string): Promise<DapDerivativeLite[]> {
  return apiFetch<DapDerivativeLite[]>(`/v1/avatars/${encodeURIComponent(avatarId)}/derivatives`);
}
