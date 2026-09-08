// ─────────────────────────────────────────────────────────────────────────────
// 数字资产 / 名片 —— 工作台的**只读**入口。
//
// 全部复用 dap 与 card 域已有的读接口，本文件不新增任何服务端契约：
//   GET /v1/assets/summary            六类资产概览
//   GET /v1/avatars                   我的形象
//   GET /v1/avatars/{id}/looks        某形象的造型
//   GET /v1/avatars/{id}/derivatives  某形象的衍生物
//   GET /v1/card/mine                 我的名片
//   GET /v1/card/by-avatar/{id}       某形象被哪些名片用了
//
// 为什么工作台自己渲染而不是内嵌 aiavatar：那是移动端 H5，塞进桌面画布应用里
// 尺寸、导航、登录态都不对。接口是同一套，界面各自按场景做。
//
// ⚠️ 路径必须写字面量：scripts/check-api-contract.mjs 是静态扫描，
// 拼接出来的路径它读不懂，门会红。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AssetSummary, CardSummary, DapAvatar, DapDerivative, DapLook,
} from "@/lib/asset-types";
import {
  MOCK_ASSET_SUMMARY, MOCK_AVATARS, MOCK_CARDS, MOCK_DERIVATIVES, MOCK_LOOKS,
} from "@/mocks/assets";
import { apiFetch, mockDelay, USE_MOCK } from "./_client";

export async function summary(): Promise<AssetSummary> {
  if (USE_MOCK) return mockDelay(MOCK_ASSET_SUMMARY);
  return apiFetch<AssetSummary>("/v1/assets/summary");
}

export async function listAvatars(): Promise<DapAvatar[]> {
  if (USE_MOCK) return mockDelay(MOCK_AVATARS);
  return apiFetch<DapAvatar[]>("/v1/avatars");
}

export async function looks(avatarId: string): Promise<DapLook[]> {
  if (USE_MOCK) return mockDelay(MOCK_LOOKS[avatarId] ?? []);
  return apiFetch<DapLook[]>(`/v1/avatars/${encodeURIComponent(avatarId)}/looks`);
}

export async function derivatives(avatarId: string): Promise<DapDerivative[]> {
  if (USE_MOCK) return mockDelay(MOCK_DERIVATIVES[avatarId] ?? []);
  return apiFetch<DapDerivative[]>(`/v1/avatars/${encodeURIComponent(avatarId)}/derivatives`);
}

export async function myCards(): Promise<CardSummary[]> {
  if (USE_MOCK) return mockDelay(MOCK_CARDS);
  return apiFetch<CardSummary[]>("/v1/card/mine");
}

/**
 * 从形象一键建卡（草稿）。名字与整柜造型由服务端从形象带过来 ——
 * 用户在工作台已经起过名、跑过一套装扮和表情，不该再填一遍。
 *
 * 回来的是**草稿**：发布是显式动作，不能一键把人的联系方式挂上公网。
 */
export async function createCardFromAvatar(avatarId: string): Promise<CardSummary> {
  if (USE_MOCK) {
    return mockDelay({
      id: "CARD-mock", slug: avatarId.toLowerCase(), regNo: "BC-0000", status: "draft",
      avatarId, publicUrl: `/card/p/${avatarId.toLowerCase()}`,
      publishedAt: null, updatedAt: new Date().toISOString(),
    } satisfies CardSummary);
  }
  // body 给**对象**，不要自己 JSON.stringify —— 共享的 apiFetch 会替你序列化，
  // 先 stringify 就成了「把一个 JSON 字符串再序列化一遍」，服务端收到的是一个字符串，
  // Jackson 直接 "no String-argument constructor" 500（v0.178 踩过）。
  // web-aiavatar 的 proto/api.ts 里那个同名 apiFetch 收的是原生 RequestInit，
  // 在那边 JSON.stringify 才是对的 —— 两个同名函数语义不同，容易抄混。
  return apiFetch<CardSummary>("/v1/card/from-avatar", {
    method: "POST",
    body: { avatarId },
  });
}

export async function cardsByAvatar(avatarId: string): Promise<CardSummary[]> {
  if (USE_MOCK) return mockDelay(MOCK_CARDS.filter((c) => c.avatarId === avatarId));
  return apiFetch<CardSummary[]>(`/v1/card/by-avatar/${encodeURIComponent(avatarId)}`);
}
