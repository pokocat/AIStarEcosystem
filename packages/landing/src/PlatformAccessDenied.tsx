"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PlatformAccessDenied.tsx — 已登录但当前账号未开通本子产品时的拦截屏（v0.43+）。
// 由各子产品 workspace 布局在 `!hasPlatformAccess` 时渲染。主题通过 props 注入。
// v0.53+：内置「输入激活码开通」表单 —— 秘钥批次按子应用拆分后，老账号可用
// 新秘钥追加激活本子产品（POST /api/me/license/activate），无需换号。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { ShieldAlert, LogOut, KeyRound } from "lucide-react";
import { useAuth, AuthApi } from "@ai-star-eco/api-client";
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
  const { user, logout, refresh } = useAuth();
  const granted = (user?.platforms ?? []) as SubProduct[];

  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

  const handleActivate = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("请输入激活码");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await AuthApi.activateAdditionalLicense(trimmed);
      setOkMsg(`开通成功，已发放 ${result.creditsGranted} 积分，正在进入…`);
      await refresh(); // 刷新 /api/me → platforms 更新 → 拦截屏自动消失
    } catch (e) {
      setError(e instanceof Error ? e.message : "激活失败，请检查激活码");
      setBusy(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px",
    borderRadius: theme.radius,
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.fg,
    fontSize: 13.5,
    outline: "none",
  };

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
        </p>

        {/* v0.53：激活码追加开通 */}
        <div
          style={{
            textAlign: "left",
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius,
            padding: "14px 14px 16px",
            marginBottom: 16,
            background: `color-mix(in srgb, ${theme.accent} 5%, transparent)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
            <KeyRound size={15} color={theme.accent} />
            有{appName}的激活码？
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) void handleActivate(); }}
              placeholder="输入激活码直接开通"
              disabled={busy}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => void handleActivate()}
              disabled={busy}
              style={{
                padding: "10px 16px",
                borderRadius: theme.radius,
                border: "none",
                background: theme.accent,
                color: theme.accentFg,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.7 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              {busy ? "开通中…" : "开通"}
            </button>
          </div>
          {error ? (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#e11d48" }}>{error}</div>
          ) : null}
          {okMsg ? (
            <div style={{ marginTop: 8, fontSize: 12.5, color: theme.accent }}>{okMsg}</div>
          ) : null}
          <p style={{ margin: "8px 0 0", fontSize: 12, color: theme.fgMuted, lineHeight: 1.6 }}>
            激活后将开通该激活码对应的子应用并发放积分；没有激活码请联系你的客户经理。
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          style={{
            width: "100%",
            padding: "11px 16px",
            borderRadius: theme.radius,
            border: `1px solid ${theme.border}`,
            background: "transparent",
            color: theme.fg,
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
