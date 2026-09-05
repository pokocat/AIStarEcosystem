"use client";

// ─────────────────────────────────────────────────────────────────────────────
// auth-context.tsx — 轻量鉴权上下文（共享版）。
// 启动时读 token（localStorage）→ 调 /api/me 拉取当前用户 + studio + enrollments。
// 每个 web app 通过 publicPathPrefixes prop 注入自己的公开路径白名单。
//
// 两种登录模式（docs/unified-identity-plan.md §12.5，由 ./config.ts 的 authMode() 决定）：
//   - legacy：无令牌 → router.replace(loginPath)；401 同上（历史行为完全不变）
//   - id    ：无令牌 → beginLogin(pathname) 跳统一账号中心；登出走 RP-initiated logout
// `/auth/callback` 在两种模式下都算公开路径（否则回调页会被自己踢走）。
//
// 「能不能进本子产品」的真值是 enrollments（后端 §12.2）；老后端不返回该字段时
// 回落到历史的 platforms 判定，避免误锁。
//
// P1-8：`/api/me` 失败 ≠ 没登录。只有确定的 401（apiFetch 已刷新重试过）才清会话并
// 跳登录；网络 / 5xx / 超时保留令牌进 `error` 态，渲染「服务暂时不可用」重试屏 ——
// 否则「跳授权 → 回调 → /me 又挂 → 再跳」会变成登录死循环。判定逻辑在 ./auth-status.ts。
// 同理，`/api/me` 401 之后**换令牌那一步**自己失败（断网 / 账号中心 5xx / 等锁超时）时，
// apiFetch 抛 `AUTH_REFRESH_UNAVAILABLE`(503) 而不是 401：令牌保留、也进 `error` 态。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import type {
  AepUser,
  Enrollment,
  EnrollmentStatus,
  SubProduct,
} from "@ai-star-eco/types/account";
import {
  getAuthToken,
  registerEnrollmentRequiredHandler,
  registerUnauthorizedHandler,
  setAppCode,
} from "./_client";
import { isIdMode } from "./config";
import { clearAuthTokens } from "./token-store";
import { AUTH_CALLBACK_PATH, beginLogin, logout as oidcLogout } from "./oidc";
import {
  shouldRedirectToLogin,
  shouldRenderRetryScreen,
  statusForMeFailure,
  type AuthStatus,
} from "./auth-status";
import * as AuthApi from "./api/auth";
import * as AccountApi from "./api/account";

interface AuthState {
  user: AepUser | null;
  loading: boolean;
  /**
   * v0.149+: 会话状态。`loading` / `ready` / `unauthenticated` / `error`。
   * `error` = 拉取当前用户时后端不可用（网络 / 5xx）——**令牌仍然有效**，可重试；
   * 老字段 `loading` / `user` 保持原语义不变，存量调用方无需改。
   */
  status: AuthStatus;
  /** 重新拉取当前用户（`error` 态重试屏的按钮就打这个）。 */
  retry: () => void;
  /** v0.43+: 本子产品 key（由 AuthProvider.requiredPlatform 注入）；未配置时为 null。 */
  platform: SubProduct | null;
  /**
   * v0.149+: 各子产品开通状态（后端权益真值）。老后端不返回该字段时为 undefined —
   * 此时一律回落 `user.platforms` 判定。
   */
  enrollments: Enrollment[] | undefined;
  /** 查某个子产品的开通状态；无 enrollments 数据或该产品没有记录时返回 null。 */
  enrollmentStatus: (product: SubProduct) => EnrollmentStatus | null;
  /**
   * v0.43+: 当前账号是否可访问本子产品平台。
   * - 未配置 requiredPlatform → 恒 true（不做隔离）
   * - 未登录 / 加载中 → false（交由各页面的登录跳转处理）
   * - 有 enrollments → 本产品 status=active 才放行（v0.149+ 权益真值）
   * - 无 enrollments（老后端）→ 回落 platforms（缺失/为空时宽松放行）
   */
  hasPlatformAccess: boolean;
  loginAs: (username?: string) => Promise<AepUser>;
  logout: () => void;
  refresh: () => Promise<void>;
  /** `refresh` 的语义别名 —— 开通成功后重新拉 /api/me 让门自动放行。 */
  refreshMe: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  /** 公开路径前缀。当前路径以列表中任一项 startsWith 即视为公开（无须登录）。
   *  默认仅含 ["/login", "/activate", "/"]，调用方应按子产品扩展（如 ["/music"]）。
   *  `/auth/callback` 永远公开，无须显式声明。 */
  publicPathPrefixes?: string[];
  /** 未登录或 401 后跳转的路径。默认 "/login"。（id 模式下改为跳统一账号中心） */
  loginPath?: string;
  /** v0.43+: 本子产品 key（music / drama / celebrity）。配置后启用平台访问隔离。 */
  requiredPlatform?: SubProduct;
  /**
   * 审计来源短码：随每个请求作为 `X-App-Code` 头带上，让 server 登录日志能区分子应用。
   * 默认回退到 {@link requiredPlatform}（music/drama/celebrity/aiavatar 已天然提供），
   * 仅在 app 未配 requiredPlatform 或需覆盖时显式传。
   */
  appCode?: string;
}

const DEFAULT_PUBLIC_PREFIXES = ["/login", "/activate", "/"];

export function AuthProvider({
  children,
  publicPathPrefixes = DEFAULT_PUBLIC_PREFIXES,
  loginPath = "/login",
  requiredPlatform,
  appCode,
}: AuthProviderProps) {
  const [user, setUser] = React.useState<AepUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = React.useCallback(
    (p: string | null): boolean => {
      if (!p) return true;
      if (p === "/") return true;
      // 账号中心回调页必须公开：它本身就是「还没有令牌」的那一刻。
      if (p.startsWith(AUTH_CALLBACK_PATH)) return true;
      return publicPathPrefixes.some((prefix) => prefix !== "/" && p.startsWith(prefix));
    },
    [publicPathPrefixes],
  );

  const loadMe = React.useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setStatus("unauthenticated");
      setLoading(false);
      return;
    }
    try {
      const me = await AccountApi.getMe();
      setUser(me);
      setStatus("ready");
    } catch (e) {
      const next = statusForMeFailure(e);
      // 服务暂时不可用（含「刷新令牌时后端不可用」）：保留令牌与已有用户态，交给重试屏；
      // 只有确定的 401 才清会话。（apiFetch 的 401 分支已经单飞刷新过一次，并且自己清了令牌。）
      if (next === "unauthenticated") setUser(null);
      setStatus(next);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 重试屏按钮：回到 loading 再拉一次。 */
  const retry = React.useCallback(() => {
    setLoading(true);
    setStatus("loading");
    void loadMe();
  }, [loadMe]);

  React.useEffect(() => {
    registerUnauthorizedHandler(() => {
      // 走到这里说明 apiFetch 拿到的是确定的 401（id 模式下还刷新重试过一次）。
      setUser(null);
      setStatus("unauthenticated");
      if (isPublicPath(pathname)) {
        // 公开页（landing / 登录页）上令牌过期：清干净留在原地，不要把人弹走。
        return true;
      }
      if (isIdMode()) {
        // 返回 false → 由 apiFetch 兜底 beginLogin(当前路径)。
        return false;
      }
      router.replace(loginPath);
      return true;
    });
    return () => registerUnauthorizedHandler(null);
  }, [router, pathname, loginPath, isPublicPath]);

  // 403 PRODUCT_NOT_ENROLLED：任何业务请求撞上开通闸 → 重新拉 /api/me，
  // enrollments 更新后 hasPlatformAccess 转 false，布局自动切到开通页。
  React.useEffect(() => {
    registerEnrollmentRequiredHandler(() => {
      void loadMe();
    });
    return () => registerEnrollmentRequiredHandler(null);
  }, [loadMe]);

  // 在首个请求前注入 X-App-Code（v0.149 起后端共享路由按它判定产品，缺头 403 APP_CODE_REQUIRED）。
  // 必须在**渲染期**设置而不是 useEffect：React 先跑子组件的 effect 再跑父组件的，仪表盘各卡片的
  // 数据请求会抢在 Provider 的 effect 之前发出。useMemo 在 render 阶段同步执行，且幂等（只写模块变量）。
  React.useMemo(() => {
    setAppCode(appCode ?? requiredPlatform ?? null);
    return null;
  }, [appCode, requiredPlatform]);

  React.useEffect(() => {
    loadMe();
  }, [loadMe]);

  React.useEffect(() => {
    if (loading) return;
    // status=error（后端不可用）时**绝不**跳登录：那正是登录死循环的入口 ——
    // 回调页刚把人送回来，/api/me 就 502，再跳一次授权只会原地打转。
    if (
      !shouldRedirectToLogin({
        status,
        hasUser: !!user,
        isPublicPath: isPublicPath(pathname),
      })
    ) {
      return;
    }
    if (isIdMode()) {
      void beginLogin(pathname ?? "/");
      return;
    }
    router.replace(loginPath);
  }, [loading, status, user, pathname, router, loginPath, isPublicPath]);

  const loginAs = React.useCallback(async (username?: string) => {
    const { user: me } = await AuthApi.devLogin(username);
    setUser(me);
    setStatus("ready");
    return me;
  }, []);

  const logout = React.useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
    // id 模式：oidcLogout 清令牌后整页跳账号中心登出，返回 true 表示已接管跳转。
    if (oidcLogout()) return;
    clearAuthTokens();
    router.replace(loginPath);
  }, [router, loginPath]);

  const enrollments = user?.enrollments;

  const enrollmentStatus = React.useCallback(
    (product: SubProduct): EnrollmentStatus | null =>
      enrollments?.find((e) => e.product === product)?.status ?? null,
    [enrollments],
  );

  const hasPlatformAccess = React.useMemo(() => {
    if (!requiredPlatform) return true;
    if (!user) return false;
    // v0.149+：后端返回 enrollments 时它就是权益真值（空数组 = 一个都没开通）。
    if (enrollments) {
      return enrollments.some((e) => e.product === requiredPlatform && e.status === "active");
    }
    // 老后端：platforms 缺失（未回填）→ 宽松放行，避免误锁。
    if (!user.platforms || user.platforms.length === 0) return true;
    return user.platforms.includes(requiredPlatform);
  }, [requiredPlatform, user, enrollments]);

  const value: AuthState = {
    user,
    loading,
    status,
    retry,
    platform: requiredPlatform ?? null,
    enrollments,
    enrollmentStatus,
    hasPlatformAccess,
    loginAs,
    logout,
    refresh: loadMe,
    refreshMe: loadMe,
  };

  // 后端暂时不可用时，受保护页面渲染重试屏而不是继续往下渲染（下游组件会因为
  // user=null 各自炸开）。公开页（landing / 登录页）不拦，照常渲染。
  const content = shouldRenderRetryScreen({ status, isPublicPath: isPublicPath(pathname) }) ? (
    <ServiceUnavailableScreen onRetry={retry} />
  ) : (
    children
  );

  return <AuthContext.Provider value={value}>{content}</AuthContext.Provider>;
}

// ── 「服务暂时不可用」重试屏 ─────────────────────────────────────────────────
// 样式对齐 packages/landing 的 EnrollmentGate（同一套 CSS 变量回退链），但**不**从
// landing 引入 —— landing 依赖 api-client，反向 import 会成环。
const RETRY_THEME = {
  bg: "var(--bg-0, var(--bg, var(--background, var(--canvas, #f7f8fa))))",
  surface: "var(--surface, var(--card, var(--bg-1, #ffffff)))",
  fg: "var(--fg-0, var(--ink-0, var(--ink, var(--foreground, #16181d))))",
  fgMuted: "var(--fg-2, var(--ink-2, var(--ink-1, var(--muted-foreground, #6b7280))))",
  accent: "var(--accent, var(--brand, var(--primary, #4f46e5)))",
  accentFg: "var(--accent-fg, var(--primary-foreground, #ffffff))",
  border: "var(--line, var(--border, var(--line-2, var(--line-strong, #e6e8ec))))",
  radius: "var(--radius-lg, var(--radius, var(--r-md, 14px)))",
};

function ServiceUnavailableScreen({ onRetry }: { onRetry: () => void }) {
  const t = RETRY_THEME;
  return (
    <div
      role="alert"
      style={{
        minHeight: "100dvh",
        background: t.bg,
        color: t.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-sans, var(--font, system-ui, sans-serif))",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          minWidth: 0,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: t.radius,
          padding: "28px 26px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            margin: "0 auto 14px",
            background: `color-mix(in srgb, ${t.accent} 12%, transparent)`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke={t.accent}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 8v5" />
            <path d="M12 16.5h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", overflowWrap: "anywhere" }}>
          服务暂时不可用，请稍后重试
        </h1>
        <p style={{ fontSize: 13, color: t.fgMuted, lineHeight: 1.75, margin: "0 0 20px" }}>
          你的登录状态还在，只是这会儿没能连上服务。网络恢复后点下面的按钮就能继续。
        </p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: "11px 24px",
            borderRadius: t.radius,
            border: "none",
            background: t.accent,
            color: t.accentFg,
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          重试
        </button>
      </div>
    </div>
  );
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/**
 * 与 {@link useAuth} 相同，但不在 Provider 外抛错 —— 供既可挂在 AuthProvider 下、
 * 也可被自带鉴权栈的 app（web-aiavatar）复用的共享组件使用。
 */
export function useAuthOptional(): AuthState | null {
  return React.useContext(AuthContext);
}

export type { AuthState };
