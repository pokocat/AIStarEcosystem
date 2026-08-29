"use client";
// 中枢新界面（P1）· 登录守卫：live 模式未登录 → /login?next=当前页；401 到期同样回登录。
// mock 模式（NEXT_PUBLIC_USE_MOCK=1）不拦截。
// enabled=false 时守卫完全不动作（review #1：根路由检测到旧 hash 正在转发 /studio 时，
// 必须禁用守卫，否则 router.replace("/login") 与 location.replace 竞速会丢掉刷脸回调 hash）。
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { auth, onAuthExpired, USE_MOCK } from "@/proto/api";

export type AuthState = "checking" | "ok" | "redirecting";

export function useRequireAuth(enabled = true): AuthState {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>(USE_MOCK ? "ok" : "checking");

  useEffect(() => {
    if (USE_MOCK || !enabled) return;
    const toLogin = () => {
      setState("redirecting");
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
    };
    if (!auth.isAuthed()) {
      toLogin();
      return;
    }
    setState("ok");
    return onAuthExpired(toLogin);
  }, [router, pathname, enabled]);

  if (!enabled) return USE_MOCK ? "ok" : "checking";
  return state;
}

/**
 * /login 成功后的回跳目标。只接受站内相对路径：
 * 拒绝 `//`（协议相对外跳）、含 `\`（浏览器把反斜杠归一成斜杠，`/\evil.com` 可外跳）、
 * 以及 `/login` 自身（避免自循环）。
 */
export function useLoginNext(): string {
  const sp = useSearchParams();
  const raw = sp.get("next") || "/";
  const safe = raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") && !raw.startsWith("/login");
  return safe ? raw : "/";
}
