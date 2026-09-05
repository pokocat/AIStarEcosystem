"use client";

// ─────────────────────────────────────────────────────────────────────────────
// IdCenterLoginScreen.tsx — id 模式下的登录页（v0.149+，docs/unified-identity-plan.md §12.5）。
//
// 统一账号中心接管登录后，各产品自己不再发验证码 / 不再收激活码注册，
// 登录页收敛成一个「去账号中心登录」按钮（授权码 + PKCE 整页跳转）。
// legacy 模式下这个组件不会被渲染 —— 各 app 的登录页照旧。
//
// 不引 lucide-react，便于自带鉴权栈的 app（web-aiavatar）走子路径导入。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { beginLogin } from "@ai-star-eco/api-client";

export interface IdCenterLoginScreenProps {
  /** 品牌主标题，例 "AI 短剧"。 */
  brandLabel: string;
  /** 副标题 / 一句话说明。 */
  tagline?: string;
  /** 登录成功后回到哪一页。 */
  postLoginPath?: string;
  /** 配色覆盖。 */
  theme?: Partial<{
    bg: string;
    surface: string;
    fg: string;
    fgMuted: string;
    accent: string;
    accentFg: string;
    border: string;
    radius: string;
  }>;
}

const DEFAULT = {
  bg: "var(--bg-0, var(--bg, var(--background, var(--canvas, #f7f8fa))))",
  surface: "var(--surface, var(--card, var(--bg-1, #ffffff)))",
  fg: "var(--fg-0, var(--ink-0, var(--ink, var(--foreground, #16181d))))",
  fgMuted: "var(--fg-2, var(--ink-2, var(--ink-1, var(--muted-foreground, #6b7280))))",
  accent: "var(--accent, var(--brand, var(--primary, #4f46e5)))",
  accentFg: "var(--accent-fg, var(--primary-foreground, #ffffff))",
  border: "var(--line, var(--border, var(--line-2, var(--line-strong, #e6e8ec))))",
  radius: "var(--radius-lg, var(--radius, var(--r-md, 14px)))",
};

export function IdCenterLoginScreen({
  brandLabel,
  tagline,
  postLoginPath = "/",
  theme,
}: IdCenterLoginScreenProps) {
  const t = { ...DEFAULT, ...(theme ?? {}) };
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const go = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const started = await beginLogin(postLoginPath);
      if (!started) {
        setError("登录服务暂时不可用，请稍后重试。");
        setBusy(false);
      }
      // started=true 时正在整页跳转，保持 busy 直到浏览器离开本页。
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "登录服务暂时不可用，请稍后重试。");
      setBusy(false);
    }
  }, [postLoginPath]);

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
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          minWidth: 0,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: t.radius,
          padding: "32px 28px 26px",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 8px", overflowWrap: "anywhere" }}>
          {brandLabel}
        </h1>
        <p style={{ fontSize: 13.5, color: t.fgMuted, lineHeight: 1.75, margin: "0 0 22px" }}>
          {tagline ?? "登录由账号中心统一处理，一个账号通行全部产品。"}
        </p>
        <button
          type="button"
          onClick={() => void go()}
          disabled={busy}
          style={{
            width: "100%",
            padding: "12px 18px",
            borderRadius: t.radius,
            border: "none",
            background: t.accent,
            color: t.accentFg,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "正在前往账号中心…" : "去账号中心登录"}
        </button>
        {error ? (
          <div role="alert" style={{ marginTop: 12, fontSize: 12.5, color: "#e11d48", lineHeight: 1.6 }}>
            {error}
          </div>
        ) : null}
        <p style={{ margin: "18px 0 0", fontSize: 12, color: t.fgMuted, lineHeight: 1.7 }}>
          登录成功后会自动回到这里。首次使用需要一个激活码来开通本产品。
        </p>
      </div>
    </div>
  );
}
