"use client";

// ─────────────────────────────────────────────────────────────────────────────
// useAdminRole — 取当前已登录管理员角色（SUPER_ADMIN / OPERATOR / null）。
// 模块级单次拉取 + 缓存，避免每个组件都打一次 /admin/auth/me。
// USE_MOCK=1 时直接返回 SUPER_ADMIN，让 dev 看到全部菜单。
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { getMe } from "@/api/auth";
import { USE_MOCK } from "@/api/_client";

let cachedRole: string | null = null;
let cachePromise: Promise<string | null> | null = null;

function loadRole(): Promise<string | null> {
  if (cachedRole) return Promise.resolve(cachedRole);
  if (USE_MOCK) {
    cachedRole = "SUPER_ADMIN";
    return Promise.resolve(cachedRole);
  }
  if (!cachePromise) {
    cachePromise = getMe().then(
      (u) => {
        cachedRole = u.role;
        return cachedRole;
      },
      // 未登录 / 网络挂 → null，role-gated 菜单按"未知角色"处理（隐藏）。
      () => null,
    );
  }
  return cachePromise;
}

export function useAdminRole(): string | null {
  const [role, setRole] = useState<string | null>(cachedRole);
  useEffect(() => {
    if (cachedRole) return;
    let alive = true;
    loadRole().then((r) => {
      if (alive && r) setRole(r);
    });
    return () => { alive = false; };
  }, []);
  return role;
}
