"use client";
// 中枢新界面（P1）· 登录守卫：live 模式未登录 → /login?next=当前页；401 到期同样回登录。
// mock 模式（NEXT_PUBLIC_USE_MOCK=1）不拦截。
// enabled=false 时守卫完全不动作（review #1：根路由检测到旧 hash 正在转发 /studio 时，
// 必须禁用守卫，否则 router.replace("/login") 与 location.replace 竞速会丢掉刷脸回调 hash）。
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EnrollmentGate } from "@ai-star-eco/landing/EnrollmentGate";
import { auth, AuthApi, ID_MODE, onAuthExpired, USE_MOCK } from "@/proto/api";

export type AuthState = "checking" | "ok" | "redirecting" | "no-platform";

export function useRequireAuth(enabled = true): AuthState {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>(USE_MOCK ? "ok" : "checking");

  useEffect(() => {
    if (USE_MOCK || !enabled) return;
    const toLogin = () => {
      setState("redirecting");
      if (ID_MODE) {
        // 统一账号中心：直接整页跳授权页，回来还落在同一个页面。
        void auth.startIdLogin(pathname || "/");
        return;
      }
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
  // v0.149：权益真值改为后端 enrollments（statue=active）；老后端不返回该字段时
  // 回落历史的 platforms 判定。拉取失败宽松放行（与老 SPA 一致）。
  useEffect(() => {
    if (USE_MOCK || !enabled || state !== "ok") return;
    let cancelled = false;
    AuthApi.me()
      .then((me: { platforms?: string[]; enrollments?: { product: string; status: string }[] } | null) => {
        if (cancelled) return;
        const enrollments = me?.enrollments;
        if (Array.isArray(enrollments)) {
          const ok = enrollments.some((e) => e.product === "aiavatar" && e.status === "active");
          if (!ok) setState("no-platform");
          return;
        }
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
 * 避免让人对着空货架猜发生了什么。v0.149 起复用共享的开通门（激活码就地开通）。
 */
export function PlatformGateScreen() {
  const router = useRouter();
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <EnrollmentGate
        product="aiavatar"
        productLabel="数字资产"
        // 本 app 没挂共享 AuthProvider，开通成功后整页重载最直接：
        // 重载会重跑 useRequireAuth 的 enrollments 检查并放行。
        onActivated={() => window.location.reload()}
        onLogout={() => {
          auth.logout();
          if (!ID_MODE) router.replace("/login");
        }}
        theme={{
          bg: "var(--canvas)",
          surface: "var(--surface)",
          fg: "var(--ink)",
          fgMuted: "var(--ink-2)",
          accent: "var(--primary)",
          accentFg: "#ffffff",
          border: "var(--line-2)",
          radius: "var(--r-md)",
        }}
      />
    </div>
  );
}
