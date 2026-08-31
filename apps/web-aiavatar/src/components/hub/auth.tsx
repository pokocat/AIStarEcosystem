"use client";
// 中枢新界面（P1）· 登录守卫：live 模式未登录 → /login?next=当前页；401 到期同样回登录。
// mock 模式（NEXT_PUBLIC_USE_MOCK=1）不拦截。
// enabled=false 时守卫完全不动作（review #1：根路由检测到旧 hash 正在转发 /studio 时，
// 必须禁用守卫，否则 router.replace("/login") 与 location.replace 竞速会丢掉刷脸回调 hash）。
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { auth, AuthApi, onAuthExpired, USE_MOCK } from "@/proto/api";

export type AuthState = "checking" | "ok" | "redirecting" | "no-platform";

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

  // v0.53 平台门禁：账号未开通 aiavatar 子产品时给出引导，而不是让人看空货架。
  // 拉取失败宽松放行（与老 SPA 一致），platforms 缺失/为空 = 全平台。
  useEffect(() => {
    if (USE_MOCK || !enabled || state !== "ok") return;
    let cancelled = false;
    AuthApi.me()
      .then((me: { platforms?: string[] } | null) => {
        if (cancelled) return;
        const ps = me?.platforms;
        const ok = !Array.isArray(ps) || ps.length === 0 || ps.includes("aiavatar");
        if (!ok) setState("no-platform");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, state]);

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

/**
 * 平台门禁引导屏：账号已登录但没开通「数字资产」子产品时展示，
 * 避免让人对着空货架猜发生了什么。激活码开通仍走老 SPA 的成熟流程。
 */
export function PlatformGateScreen() {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        background: "var(--canvas)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "0 30px",
        textAlign: "center",
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: 999, background: "var(--primary-soft)", display: "grid", placeItems: "center", color: "var(--primary-700)" }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <span style={{ fontSize: 18, fontWeight: 800 }}>这个账号还没开通数字资产</span>
      <span style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.8 }}>
        有激活码可以直接开通；没有的话，联系客户经理或换个账号登录。
      </span>
      <a
        href="/studio"
        style={{
          height: 46,
          padding: "0 26px",
          display: "inline-flex",
          alignItems: "center",
          borderRadius: 999,
          background: "var(--grad)",
          color: "#fff",
          fontSize: 14.5,
          fontWeight: 800,
          textDecoration: "none",
          boxShadow: "0 8px 20px rgba(18,179,222,.3)",
        }}
      >
        用激活码开通
      </a>
    </div>
  );
}
