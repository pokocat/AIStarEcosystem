"use client";

// ─────────────────────────────────────────────────────────────────────────────
// auth-context.tsx — 轻量鉴权上下文（共享版）。
// 启动时读 token（cookie/localStorage）→ 调 /api/me 拉取当前用户 + studio。
// 401 时清 token 并重定向到 /login。
// 每个 web app 通过 publicPathPrefixes prop 注入自己的公开路径白名单。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import type { AepUser } from "@ai-star-eco/types/account";
import {
  getAuthToken,
  registerUnauthorizedHandler,
  setAuthToken,
} from "./_client";
import * as AuthApi from "./api/auth";
import * as AccountApi from "./api/account";

interface AuthState {
  user: AepUser | null;
  loading: boolean;
  loginAs: (username?: string) => Promise<AepUser>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  /** 公开路径前缀。当前路径以列表中任一项 startsWith 即视为公开（无须登录）。
   *  默认仅含 ["/login", "/activate", "/"]，调用方应按子产品扩展（如 ["/music"]）。 */
  publicPathPrefixes?: string[];
  /** 未登录或 401 后跳转的路径。默认 "/login"。 */
  loginPath?: string;
}

const DEFAULT_PUBLIC_PREFIXES = ["/login", "/activate", "/"];

export function AuthProvider({
  children,
  publicPathPrefixes = DEFAULT_PUBLIC_PREFIXES,
  loginPath = "/login",
}: AuthProviderProps) {
  const [user, setUser] = React.useState<AepUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = React.useCallback(
    (p: string | null): boolean => {
      if (!p) return true;
      if (p === "/") return true;
      return publicPathPrefixes.some((prefix) => prefix !== "/" && p.startsWith(prefix));
    },
    [publicPathPrefixes],
  );

  React.useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null);
      if (!isPublicPath(pathname)) {
        router.replace(loginPath);
      }
    });
    return () => registerUnauthorizedHandler(null);
  }, [router, pathname, loginPath, isPublicPath]);

  const loadMe = React.useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
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

  React.useEffect(() => {
    if (loading) return;
    if (!user && !isPublicPath(pathname)) {
      router.replace(loginPath);
    }
  }, [loading, user, pathname, router, loginPath, isPublicPath]);

  const loginAs = React.useCallback(async (username?: string) => {
    const { user: me } = await AuthApi.devLogin(username);
    setUser(me);
    return me;
  }, []);

  const logout = React.useCallback(() => {
    setAuthToken(null);
    setUser(null);
    router.replace(loginPath);
  }, [router, loginPath]);

  const value: AuthState = { user, loading, loginAs, logout, refresh: loadMe };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
