"use client";

// ─────────────────────────────────────────────────────────────────────────────
// auth-context.tsx — 轻量鉴权上下文。
// 启动时读 localStorage 的 token（若有）→ 调 /api/me 拉取当前用户 + studio。
// 401 时清 token 并重定向到 /login。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import type { AepUser } from "@/types/account";
import {
  AccountApi,
  AuthApi,
  getAuthToken,
  registerUnauthorizedHandler,
  setAuthToken,
  USE_MOCK,
} from "@/api";

interface AuthState {
  user: AepUser | null;
  loading: boolean;
  loginAs: (username?: string) => Promise<AepUser>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

/** 不需要登录即可访问的路径前缀。其它路径在未登录时会被推到 /login。
 *  注：/music /drama /celebrity 当前只承载子产品对外公开 landing 页（无后续工作台子路由），
 *  匹配 startsWith 不会出错。一旦后续在 /<product>/console/* 下挂入工作台，
 *  需把这里的前缀收窄为精确匹配，或下移到 middleware。 */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/activate",
  "/portal",
  "/producer-intro",
  "/music",
  "/drama",
  "/celebrity",
  "/",
];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((p) => p !== "/" && pathname.startsWith(p));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AepUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // 注册 401 回调：清 token + 跳 /login
  React.useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null);
      if (!isPublicPath(pathname)) {
        router.replace("/login");
      }
    });
    return () => registerUnauthorizedHandler(null);
  }, [router, pathname]);

  const loadMe = React.useCallback(async () => {
    // USE_MOCK 下，token 不参与校验，直接假定已登录。
    if (!USE_MOCK) {
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
    }
    try {
      const me = await AccountApi.getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadMe();
  }, [loadMe]);

  // 未登录时，若当前路径需要鉴权，推到 /login
  React.useEffect(() => {
    if (loading) return;
    if (!user && !isPublicPath(pathname)) {
      router.replace("/login");
    }
  }, [loading, user, pathname, router]);

  const loginAs = React.useCallback(async (username?: string) => {
    const { user: me } = await AuthApi.devLogin(username);
    setUser(me);
    return me;
  }, []);

  const logout = React.useCallback(() => {
    setAuthToken(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value: AuthState = { user, loading, loginAs, logout, refresh: loadMe };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
