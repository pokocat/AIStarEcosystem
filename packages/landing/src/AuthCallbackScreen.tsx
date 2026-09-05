"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AuthCallbackScreen.tsx — 统一账号中心登录回调页（v0.149+，docs/unified-identity-plan.md §12.5）。
//
// 五个 web app 的 `src/app/auth/callback/page.tsx` 都只是本组件的薄壳：
//   校验 state → 拿授权码换令牌 → 回到登录前那一页。
//
// 该路径必须是公开路径（AuthProvider 内置放行）—— 它本身就是「还没有令牌」的那一刻。
// 不引 lucide-react，便于自带鉴权栈的 app（web-aiavatar）走子路径导入。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import { beginLogin, completeAuthCallback, isIdMode, OidcError } from "@ai-star-eco/api-client";

export interface AuthCallbackScreenProps {
  /** 兜底落点：拿不到登录前路径时去哪。默认 "/"。 */
  fallbackPath?: string;
  /** 配色覆盖（键名同 EnrollmentGate）。 */
  theme?: Partial<{ bg: string; fg: string; fgMuted: string; accent: string; accentFg: string; radius: string }>;
}

const DEFAULT = {
  bg: "var(--bg-0, var(--bg, var(--background, var(--canvas, #f7f8fa))))",
  fg: "var(--fg-0, var(--ink-0, var(--ink, var(--foreground, #16181d))))",
  fgMuted: "var(--fg-2, var(--ink-2, var(--ink-1, var(--muted-foreground, #6b7280))))",
  accent: "var(--accent, var(--brand, var(--primary, #4f46e5)))",
  accentFg: "var(--accent-fg, var(--primary-foreground, #ffffff))",
  radius: "var(--radius-lg, var(--radius, var(--r-md, 14px)))",
};

export function AuthCallbackScreen({ fallbackPath = "/", theme }: AuthCallbackScreenProps) {
  const router = useRouter();
  const t = { ...DEFAULT, ...(theme ?? {}) };
  const [error, setError] = React.useState<string | null>(null);
  // 连不上账号中心（网络 / 502）和「这次登录不作数」（state 不符、码过期）是两回事：
  // 前者是「稍后重试」，后者才该重新走一遍登录。文案与按钮据此分开。
  const [offline, setOffline] = React.useState(false);
  const ran = React.useRef(false);

  React.useEffect(() => {
    // React 18/19 StrictMode 下 effect 会跑两次；授权码只能换一次，用 ref 上闸。
    if (ran.current) return;
    ran.current = true;

    if (!isIdMode()) {
      router.replace(fallbackPath);
      return;
    }
    completeAuthCallback()
      .then((returnPath) => router.replace(returnPath || fallbackPath))
      .catch((e: unknown) => {
        setOffline(e instanceof OidcError && (e.code === "NETWORK" || e.code.startsWith("HTTP_5")));
        setError(e instanceof Error && e.message ? e.message : "登录没有完成，请重新登录。");
      });
  }, [router, fallbackPath]);

  return (
    <div
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
      <div style={{ width: "100%", maxWidth: 360, minWidth: 0, textAlign: "center" }}>
        {error ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, overflowWrap: "anywhere" }}>
              {offline ? "服务暂时不可用，请稍后重试" : "登录没有完成"}
            </div>
            <p style={{ fontSize: 13.5, color: t.fgMuted, lineHeight: 1.75, margin: "0 0 20px", overflowWrap: "anywhere" }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => void beginLogin(fallbackPath)}
              style={{
                padding: "11px 22px",
                borderRadius: t.radius,
                border: "none",
                background: t.accent,
                color: t.accentFg,
                fontSize: 13.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {offline ? "重试" : "重新登录"}
            </button>
          </>
        ) : (
          <div style={{ fontSize: 14, color: t.fgMuted }} role="status">
            正在登录…
          </div>
        )}
      </div>
    </div>
  );
}
