"use client";

// ─────────────────────────────────────────────────────────────────────────────
// auth-context.tsx — 轻量鉴权上下文（共享版）。
// 启动时读 token（cookie/localStorage）→ 调 /api/me 拉取当前用户 + studio。
// 401 时清 token 并重定向到 /login。
// 每个 web app 通过 publicPathPrefixes prop 注入自己的公开路径白名单。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import type { AepUser, SubProduct } from "@ai-star-eco/types/account";
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
  /** v0.43+: 本子产品 key（由 AuthProvider.requiredPlatform 注入）；未配置时为 null。 */
  platform: SubProduct | null;
  /**
   * v0.43+: 当前账号是否可访问本子产品平台。
   * - 未配置 requiredPlatform → 恒 true（不做隔离）
   * - 未登录 / 加载中 → false（交由各页面的登录跳转处理）
   * - 已登录：账号 platforms 含本平台才为 true（platforms 缺失时宽松放行）
   */
  hasPlatformAccess: boolean;
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
  /** v0.43+: 本子产品 key（music / drama / celebrity）。配置后启用平台访问隔离。 */
  requiredPlatform?: SubProduct;
}

const DEFAULT_PUBLIC_PREFIXES = ["/login", "/activate", "/"];

export function AuthProvider({
  children,
  publicPathPrefixes = DEFAULT_PUBLIC_PREFIXES,
  loginPath = "/login",
  requiredPlatform,
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

  const hasPlatformAccess = React.useMemo(() => {
    if (!requiredPlatform) return true;
    if (!user) return false;
    // platforms 缺失（老后端 / 未回填）→ 宽松放行，避免误锁。
    if (!user.platforms || user.platforms.length === 0) return true;
    return user.platforms.includes(requiredPlatform);
  }, [requiredPlatform, user]);

  const value: AuthState = {
    user,
    loading,
    platform: requiredPlatform ?? null,
    hasPlatformAccess,
    loginAs,
    logout,
    refresh: loadMe,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
