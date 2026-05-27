"use client";

// ─────────────────────────────────────────────────────────────────────────────
// useAdminRole — 取当前已登录管理员角色（SUPER_ADMIN / OPERATOR / null）。
// 模块级单次拉取 + 缓存，避免每个组件都打一次 /admin/auth/me。
// USE_MOCK=1 时直接返回 SUPER_ADMIN，让 dev 看到全部菜单。
//
// 关键陷阱（StrictMode 双调用）：
//   早期实现把 mock 分支放在 effect 里，第一次 effect 设 cachedRole + queue
//   `.then(setRole)`，但 StrictMode 的 cleanup 会把 alive 翻 false，然后第二次
//   effect 看到 cachedRole 已被设而 early-return → setRole 永远不触发 → role 卡 null。
//   修：把 mock + 已缓存两条同步路径挪到 useState 的 initializer，effect 里只剩
//   "需要真发 /admin/auth/me" 这一种异步路径，自然 StrictMode-safe。
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { getMe } from "@/api/auth";
import { USE_MOCK } from "@/api/_client";

export type AccountSource = "admin" | "operator";
export interface AdminIdentity {
  role: string | null;
  accountSource: AccountSource | null;
}

let cachedRole: string | null = null;
let cachedSource: AccountSource | null = null;
let cachePromise: Promise<AdminIdentity> | null = null;

/**
 * v0.37+：返回登录管理员的 role + accountSource。
 * - role: SUPER_ADMIN / OPERATOR / null（小写归一为大写）
 * - accountSource: "admin"（admin_users 体系）/ "operator"（aep_users.operatorRole 体系）
 *
 * 前端按 accountSource="admin" 隐藏「秘钥批次 / 管理员账号」等仅 admin 可见菜单。
 */
export function useAdminIdentity(): AdminIdentity {
  const [identity, setIdentity] = useState<AdminIdentity>(() => {
    if (cachedRole) return { role: cachedRole, accountSource: cachedSource };
    if (USE_MOCK) {
      cachedRole = "SUPER_ADMIN";
      cachedSource = "admin";
      return { role: cachedRole, accountSource: cachedSource };
    }
    return { role: null, accountSource: null };
  });

  useEffect(() => {
    if (cachedRole || USE_MOCK) return;
    let alive = true;
    if (!cachePromise) {
      cachePromise = getMe().then(
        (u) => {
          cachedRole = u.role ? u.role.toUpperCase() : null;
          // server /me 返回 accountSource: "admin" | "operator"（v0.37+）
          const src = (u as { accountSource?: string }).accountSource;
          cachedSource = src === "admin" || src === "operator" ? src : null;
          return { role: cachedRole, accountSource: cachedSource };
        },
        () => {
          cachedRole = null;
          cachedSource = null;
          cachePromise = null;
          return { role: null, accountSource: null };
        },
      );
    }
    cachePromise.then((r) => {
      if (alive && (r.role || r.accountSource)) setIdentity(r);
    });
    return () => { alive = false; };
  }, []);

  return identity;
}

/** 仅取 role 的向后兼容包装（保留旧调用点的契约不变）。 */
export function useAdminRole(): string | null {
  return useAdminIdentity().role;
}
