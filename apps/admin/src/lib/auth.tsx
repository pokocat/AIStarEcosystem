"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { User } from "@/types";

const TOKEN_KEY = "aep_admin_token";
const USER_KEY = "aep_admin_user";
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function setTokenCookie(token: string) {
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=86400; samesite=lax`;
}

function clearTokenCookie() {
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
}

function readTokenCookie(): string | null {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${TOKEN_KEY}=`));

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
}

function persistUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function readStoredUser(): User | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;

  try {
    return JSON.parse(userJson) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function clearStoredAuth() {
  clearTokenCookie();
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>({ token: null, user: null, loading: true });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = readTokenCookie();
      if (!token) {
        if (!cancelled) {
          setState({ token: null, user: null, loading: false });
        }
        return;
      }

      const cachedUser = readStoredUser();
      if (cachedUser && !cancelled) {
        setState({ token, user: cachedUser, loading: false });
      }

      try {
        const res = await fetch(`${BASE_URL}/api/admin/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(`AUTH_${res.status}`);
        }

        const json = await res.json();
        const user = (json.data ?? json) as User;
        persistUser(user);

        if (!cancelled) {
          setState({ token, user, loading: false });
        }
      } catch {
        clearStoredAuth();
        if (!cancelled) {
          setState({ token: null, user: null, loading: false });
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.loading) return;
    if (!state.token && pathname !== "/login") {
      router.replace("/login");
    }
  }, [state.loading, state.token, pathname, router]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetch(`${BASE_URL}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMessage =
          json?.error?.message ?? json?.message ?? json?.detail ?? `登录失败 (${res.status})`;
        throw new Error(errorMessage);
      }

      const data = json.data ?? json;
      const token = data.token as string;
      const user = data.user as User;

      setTokenCookie(token);
      persistUser(user);
      setState({ token, user, loading: false });
      router.replace("/dashboard");
    },
    [router]
  );

  const logout = useCallback(() => {
    clearStoredAuth();
    setState({ token: null, user: null, loading: false });
    router.replace("/login");
  }, [router]);

  const isAdmin = [
    "platform_owner",
    "platform_operator",
    "finance_admin",
    "channel_manager",
    "PLATFORM_OWNER",
    "PLATFORM_OPERATOR",
    "FINANCE_ADMIN",
    "CHANNEL_MANAGER",
  ].includes(state.user?.role ?? "");

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return readTokenCookie();
}

export function clearAdminAuth() {
  if (typeof window === "undefined") return;
  clearStoredAuth();
}
