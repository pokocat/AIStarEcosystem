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

let cachedRole: string | null = null;
let cachePromise: Promise<string | null> | null = null;

export function useAdminRole(): string | null {
  // 同步初始化：mock 或已缓存场景在 render 之前就有值，避免首帧菜单闪烁。
  const [role, setRole] = useState<string | null>(() => {
    if (cachedRole) return cachedRole;
    if (USE_MOCK) {
      cachedRole = "SUPER_ADMIN";
      return cachedRole;
    }
    return null;
  });

  useEffect(() => {
    // 已知 role（mock 或上次缓存）→ 不发请求
    if (cachedRole || USE_MOCK) return;
    let alive = true;
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
    cachePromise.then((r) => {
      if (alive && r) setRole(r);
    });
    return () => { alive = false; };
  }, []);

  return role;
}
