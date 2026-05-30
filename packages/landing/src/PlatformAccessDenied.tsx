"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PlatformAccessDenied.tsx — 已登录但当前账号未开通本子产品时的拦截屏（v0.43+）。
// 由各子产品 workspace 布局在 `!hasPlatformAccess` 时渲染。主题通过 props 注入。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { ShieldAlert, LogOut } from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { SUB_PRODUCT_LABEL_ZH, type SubProduct } from "@ai-star-eco/types/account";

export interface PlatformAccessDeniedProps {
  /** 当前子产品名（例 "AI 音乐人"）。 */
  appName: string;
  /** 配色（最小子集）。 */
  theme: {
    bg: string;
    surface: string;
    fg: string;
    fgMuted: string;
    accent: string;
    accentFg: string;
    border: string;
    radius: string;
  };
}

export function PlatformAccessDenied({ appName, theme }: PlatformAccessDeniedProps) {
  const { user, logout } = useAuth();
  const granted = (user?.platforms ?? []) as SubProduct[];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius,
          padding: "32px 28px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: `color-mix(in srgb, ${theme.accent} 14%, transparent)`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <ShieldAlert size={26} color={theme.accent} />
        </div>
        <h1 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 10px" }}>
          当前账号未开通{appName}
        </h1>
        <p style={{ fontSize: 13.5, color: theme.fgMuted, lineHeight: 1.7, margin: "0 0 20px" }}>
          你登录的账号还没有{appName}的使用权限。
          {granted.length > 0 ? (
            <>
              <br />
              该账号已开通：
              <strong style={{ color: theme.fg }}>
                {granted.map((p) => SUB_PRODUCT_LABEL_ZH[p] ?? p).join("、")}
              </strong>
              。
            </>
          ) : null}
          <br />
          如需开通，请联系你的客户经理，或更换已开通的账号登录。
        </p>
        <button
          type="button"
          onClick={logout}
          style={{
            width: "100%",
            padding: "11px 16px",
            borderRadius: theme.radius,
            border: "none",
            background: theme.accent,
            color: theme.accentFg,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <LogOut size={15} />
          退出并切换账号
        </button>
      </div>
    </div>
  );
}
