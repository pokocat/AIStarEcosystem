// ─────────────────────────────────────────────────────────────────────────────
// api/social-account.ts — 用户的第三方社交账号绑定 API（network-only）。
// 对应后端 SocialAccountController：/api/me/social-accounts/*
//
// 绑定流程：
//   1. POST /bind-init      → 后端调 sau-service 启 Playwright 拿 QR，返回 ticket+QR
//   2. GET  /bind-poll?ticket=… → 前端轮询，sau 检测扫码 → storage_state 加密落库
//   3. status=success 后，账号即可用于 PublishJob
//
// storage_state（cookie）永远不流向前端；本模块所有 DTO 都不含该字段。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SocialAccount,
  SocialAccountBindInit,
  SocialAccountBindInput,
  SocialAccountBindPollResult,
  SubmitBindInteractionInput,
} from "@ai-star-eco/types/social-account";
import type { ID } from "@ai-star-eco/types/_shared";
import { apiFetch } from "../_client";

/** 列出当前用户已绑定的所有社交账号 */
export async function listSocialAccounts(): Promise<SocialAccount[]> {
  return apiFetch<SocialAccount[]>("/me/social-accounts");
}

/** 初始化绑定：要求后端调 sau-service 启动 Playwright，返回 QR + ticket */
export async function initBind(input: SocialAccountBindInput): Promise<SocialAccountBindInit> {
  return apiFetch<SocialAccountBindInit>("/me/social-accounts/bind-init", {
    method: "POST",
    body: input,
  });
}

/** 轮询扫码状态；成功时 result.account 是新绑定账号 */
export async function pollBind(ticket: string): Promise<SocialAccountBindPollResult> {
  return apiFetch<SocialAccountBindPollResult>("/me/social-accounts/bind-poll", {
    query: { ticket },
  });
}

/**
 * 取消正在进行的扫码绑定。
 *
 * 用户关掉弹窗 / 点取消时调用。后端会：
 *   1. 调 sau-service /login/cancel 关掉 playwright (chromium 进程立即退出)
 *   2. 把 PENDING 状态、还没拿到 cookie 的 SocialAccount 行删掉，避免脏数据
 *
 * 幂等：ticket 已过期/不存在时静默成功；前端只 fire-and-forget，不阻塞关弹窗。
 */
export async function cancelBind(ticket: string): Promise<void> {
  await apiFetch<void>("/me/social-accounts/bind-cancel", {
    method: "POST",
    query: { ticket },
  });
}

/** 提交绑定过程中的短信验证码；成功后继续 pollBind 等待最终绑定结果。 */
export async function submitBindInteraction(
  ticket: string,
  input: SubmitBindInteractionInput,
): Promise<void> {
  await apiFetch<void>("/me/social-accounts/bind-interaction", {
    method: "POST",
    query: { ticket },
    body: input,
  });
}

/** 让 sau-service 用现有 storage_state 跑一次 verify，刷新 lastVerifiedAt 或翻 expired */
export async function verifySocialAccount(id: ID): Promise<SocialAccount> {
  return apiFetch<SocialAccount>(`/me/social-accounts/${encodeURIComponent(id)}/verify`, {
    method: "POST",
  });
}

/** 解绑：DB 行连同密文 storage_state 一并删除 */
export async function unbindSocialAccount(id: ID): Promise<void> {
  await apiFetch<void>(`/me/social-accounts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
