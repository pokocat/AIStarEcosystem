"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EnrollmentGate.tsx — 「当前账号还没开通这个产品」的开通页（v0.149+）。
//
// 统一账号中心 P2（docs/unified-identity-plan.md §12.2 / §12.5）：身份只有一份，
// 「能不能用某个产品」由后端 enrollment 说了算。账号能登进来但没开通本产品时，
// 五个 web app 的工作台布局一律渲染本组件，而不是各写一版「无权限」空屏。
//
// 与旧的 PlatformAccessDenied 的区别：
//   - 打的是新端点 POST /api/me/enrollments/{product}/activate（开通即权益真值）
//   - 不依赖 AuthProvider —— 自带鉴权栈的 app（web-aiavatar）也能直接用（见 props）
//   - 不引 lucide-react（图标用内联 SVG），子路径导入不拖额外依赖
//
// 配色：默认用 CSS 变量回退链适配五个 app 各自的 token 命名，也可用 `theme` 覆盖。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { ApiError, AccountApi, AuthApi, USE_MOCK, useAuthOptional } from "@ai-star-eco/api-client";
import { SUB_PRODUCT_LABEL_ZH, type SubProduct } from "@ai-star-eco/types/account";

export interface EnrollmentGateTheme {
  bg: string;
  surface: string;
  fg: string;
  fgMuted: string;
  accent: string;
  accentFg: string;
  danger: string;
  border: string;
  radius: string;
}

/**
 * 默认配色用 CSS 变量回退链，依次尝试 celebrity / drama / music / star / aiavatar
 * 各自的 token 名，全都取不到才落到中性硬编码值。
 */
const DEFAULT_THEME: EnrollmentGateTheme = {
  bg: "var(--bg-0, var(--bg, var(--background, var(--canvas, #f7f8fa))))",
  surface: "var(--surface, var(--card, var(--bg-1, #ffffff)))",
  fg: "var(--fg-0, var(--ink-0, var(--ink, var(--foreground, #16181d))))",
  fgMuted: "var(--fg-2, var(--ink-2, var(--ink-1, var(--muted-foreground, #6b7280))))",
  accent: "var(--accent, var(--brand, var(--primary, #4f46e5)))",
  accentFg: "var(--accent-fg, var(--primary-foreground, #ffffff))",
  danger: "#e11d48",
  border: "var(--line, var(--border, var(--line-2, var(--line-strong, #e6e8ec))))",
  radius: "var(--radius-lg, var(--radius, var(--r-md, 14px)))",
};

export interface EnrollmentGateProps {
  /** 本子产品短码（= AuthProvider 的 requiredPlatform）。 */
  product: SubProduct;
  /** 展示用产品名；缺省用 SUB_PRODUCT_LABEL_ZH。 */
  productLabel?: string;
  /**
   * 开通成功后的回调。挂在 AuthProvider 下时无需传 —— 组件会自动重新拉 /api/me
   * （`refreshMe`），门随之放行；这里额外给自带鉴权栈的 app 一个钩子。
   */
  onActivated?: () => void | Promise<void>;
  /** 「切换账号」的动作；缺省用 AuthProvider 的 logout。两者都没有时不渲染该链接。 */
  onLogout?: () => void;
  /** 配色覆盖（只需给要改的键）。 */
  theme?: Partial<EnrollmentGateTheme>;
}

function KeyIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 8.3-8.3" />
      <path d="m17 6 2.5 2.5" />
      <path d="m14 9 2.5 2.5" />
    </svg>
  );
}

/** 把后端错误码翻成用户看得懂的中文（绝不把原始码露到界面上）。 */
function describeActivateError(e: unknown, productLabel: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "LICENSE_KEY_UNAVAILABLE":
        return "这个激活码不存在，或者已经被使用过了。请核对后重试。";
      case "LICENSE_KEY_PRODUCT_MISMATCH":
        return `这个激活码不能用于「${productLabel}」，请换用该产品的激活码。`;
      case "PRODUCT_INVALID":
        return "没能识别这个激活码对应的产品，请联系你的客户经理。";
      case "PRODUCT_NOT_ENROLLED":
        return "开通没有生效，请稍后重试或联系你的客户经理。";
      default:
        return e.message || "开通失败，请稍后重试。";
    }
  }
  return e instanceof Error && e.message ? e.message : "开通失败，请稍后重试。";
}

/**
 * 开通一次：优先打统一账号中心 P2 的 enrollment 端点；
 * 遇到 404（server 还没升到 v0.149 的过渡期部署）回落到历史的「追加激活」端点，
 * 两条路的业务语义一致（核销激活码 → 开通该子产品 → 发积分）。
 */
async function activate(product: SubProduct, licenseKey: string): Promise<number> {
  try {
    // 新端点只回 enrollment 记录，不回发放积分数（余额由 /me/wallet 兜底）。
    await AccountApi.activateEnrollment(product, licenseKey);
    return 0;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      const legacy = await AuthApi.activateAdditionalLicense(licenseKey);
      return legacy.creditsGranted ?? 0;
    }
    throw e;
  }
}

export function EnrollmentGate({
  product,
  productLabel,
  onActivated,
  onLogout,
  theme,
}: EnrollmentGateProps) {
  const auth = useAuthOptional();
  const t = React.useMemo(() => ({ ...DEFAULT_THEME, ...(theme ?? {}) }), [theme]);
  const label = productLabel ?? SUB_PRODUCT_LABEL_ZH[product] ?? product;

  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

  const handleLogout = onLogout ?? auth?.logout;

  const finish = React.useCallback(async () => {
    // 先刷新 /api/me（enrollments 变了门才会放行），再通知调用方。
    await auth?.refreshMe();
    await onActivated?.();
  }, [auth, onActivated]);

  const submit = React.useCallback(async () => {
    const licenseKey = code.trim();
    if (!licenseKey) {
      setError("请先填写激活码");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      if (USE_MOCK) {
        // mock 模式没有后端可打，直接按开通成功走完流程。
        setOkMsg("开通成功，正在进入…");
        await finish();
        return;
      }
      const creditsGranted = await activate(product, licenseKey);
      setOkMsg(
        creditsGranted > 0
          ? `开通成功，已发放 ${creditsGranted} 积分，正在进入…`
          : "开通成功，正在进入…",
      );
      await finish();
    } catch (e) {
      setError(describeActivateError(e, label));
      setBusy(false);
    }
  }, [code, product, label, finish]);

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
          maxWidth: 420,
          minWidth: 0,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: t.radius,
          padding: "30px 26px 26px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: `color-mix(in srgb, ${t.accent} 12%, transparent)`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <KeyIcon color={t.accent} />
        </div>

        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.5,
            margin: "0 0 8px",
            overflowWrap: "anywhere",
          }}
        >
          当前账号还没有开通「{label}」
        </h1>
        <p style={{ fontSize: 13.5, color: t.fgMuted, lineHeight: 1.75, margin: "0 0 18px" }}>
          你的账号本身是正常的，只是还没开通这个产品。有激活码可以直接在下面开通；
          没有激活码请联系你的客户经理。
        </p>

        <label
          htmlFor="enrollment-license-key"
          style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: t.fgMuted, marginBottom: 7 }}
        >
          激活码
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            id="enrollment-license-key"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void submit();
            }}
            placeholder="输入激活码"
            disabled={busy}
            autoComplete="off"
            style={{
              flex: 1,
              minWidth: 0,
              padding: "11px 12px",
              borderRadius: t.radius,
              border: `1px solid ${t.border}`,
              background: t.bg,
              color: t.fg,
              fontSize: 13.5,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            style={{
              flex: "0 0 auto",
              padding: "11px 18px",
              borderRadius: t.radius,
              border: "none",
              background: t.accent,
              color: t.accentFg,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.68 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {busy ? "开通中…" : "开通"}
          </button>
        </div>

        {error ? (
          <div role="alert" style={{ marginTop: 9, fontSize: 12.5, color: t.danger, lineHeight: 1.6 }}>
            {error}
          </div>
        ) : null}
        {okMsg ? (
          <div role="status" style={{ marginTop: 9, fontSize: 12.5, color: t.accent, lineHeight: 1.6 }}>
            {okMsg}
          </div>
        ) : null}

        {handleLogout ? (
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${t.border}`, textAlign: "center" }}>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                border: "none",
                background: "transparent",
                color: t.fgMuted,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                padding: 4,
              }}
            >
              换个账号登录
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
