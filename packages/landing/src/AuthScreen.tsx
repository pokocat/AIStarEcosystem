"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AuthScreen.tsx — 共享登录/注册屏（v0.43+）。
// 三个 tab：手机号登录 / 注册（手机号 + 激活码 + 工作室）/ dev 免密。
// 主题由 `theme` prop 注入（颜色 / 圆角 / 字体），与各子产品自己的 token 命名解耦，
// 因此 music（克制紫）与 drama（影院金）可共用同一套结构、各自换肤。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Phone,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { AuthApi, ENABLE_DEV_LOGIN, useAuth } from "@ai-star-eco/api-client";
import {
  STUDIO_KIND_LABEL_ZH,
  type SubProduct,
  type StudioKind,
} from "@ai-star-eco/types/account";

export interface AuthScreenTheme {
  /** 页面底色 */
  bg: string;
  /** 卡片 / 输入框底色 */
  surface: string;
  /** 次级底色（tab strip / 输入框） */
  surfaceAlt: string;
  /** 主文字 */
  fg: string;
  /** 次级文字 */
  fgMuted: string;
  /** 更弱文字 */
  fgFaint: string;
  /** 强调色（品牌 / 主按钮 / 选中态） */
  accent: string;
  /** 主按钮上的文字色 */
  accentFg: string;
  /** 错误色 */
  danger: string;
  /** 边框色 */
  border: string;
  /** 圆角 */
  radius: string;
  fontSans?: string;
}

export interface AuthScreenProps {
  /** 本子产品 key —— 决定注册时透传给后端的 platform（dev 全授予）。 */
  platform: SubProduct;
  /** 顶栏品牌主标题，例 "AI 音乐人"。 */
  brandLabel: string;
  /** 顶栏品牌英文副标题，例 "AI Star Eco · Music"。 */
  brandSub: string;
  /** 品牌 mark 图标。 */
  icon: LucideIcon;
  /** 主标题下的一句话说明。 */
  tagline?: string;
  theme: AuthScreenTheme;
  /** 登录成功后的 fallback 路径（URL `?from=` 优先）。 */
  defaultPostLoginPath?: string;
  /** 是否显示 dev 免密 tab（默认开发构建显示、生产构建隐藏）。 */
  enableDev?: boolean;
}

type Tab = "phone-login" | "phone-register" | "dev";
type LoginMode = "code" | "password";
type SmsCodePurpose = "login" | "register";

function AuthScreenInner(props: AuthScreenProps) {
  const {
    platform,
    brandLabel,
    brandSub,
    icon: Icon,
    tagline,
    theme,
    defaultPostLoginPath = "/dashboard",
    enableDev = ENABLE_DEV_LOGIN,
  } = props;

  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") || defaultPostLoginPath;
  const { loginAs, refresh, user } = useAuth();

  const [tab, setTab] = React.useState<Tab>("phone-login");

  React.useEffect(() => {
    if (user) router.replace(from);
  }, [user, from, router]);

  const rootVars = {
    "--as-bg": theme.bg,
    "--as-surface": theme.surface,
    "--as-surface-alt": theme.surfaceAlt,
    "--as-fg": theme.fg,
    "--as-fg-muted": theme.fgMuted,
    "--as-fg-faint": theme.fgFaint,
    "--as-accent": theme.accent,
    "--as-accent-fg": theme.accentFg,
    "--as-danger": theme.danger,
    "--as-border": theme.border,
    "--as-radius": theme.radius,
  } as React.CSSProperties;

  return (
    <div
      style={{
        ...rootVars,
        minHeight: "100vh",
        background: "var(--as-bg)",
        color: "var(--as-fg)",
        fontFamily: theme.fontSans ?? "var(--font-sans, system-ui, sans-serif)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link
            href="/"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18, textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "var(--as-radius)",
                background: "var(--as-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--as-accent-fg)",
              }}
            >
              <Icon size={20} strokeWidth={2.2} />
            </div>
            <div style={{ textAlign: "left", lineHeight: 1.15 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{brandLabel}</div>
              <div style={{ fontSize: 10, color: "var(--as-fg-muted)", letterSpacing: 0.4 }}>{brandSub}</div>
            </div>
          </Link>
          <h1 style={{ fontSize: 25, fontWeight: 600, margin: "0 0 8px", lineHeight: 1.25 }}>
            登录工作台
          </h1>
          <p style={{ fontSize: 13, color: "var(--as-fg-muted)", maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
            {tagline ?? "手机号支持验证码或密码登录；新用户用激活码 + 手机号完成注册。"}
          </p>
        </div>

        <div style={{ background: "var(--as-surface)", border: "1px solid var(--as-border)", borderRadius: "var(--as-radius)", padding: "22px 22px 18px" }}>
          {/* tab strip */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 18,
              background: "var(--as-surface-alt)",
              borderRadius: "var(--as-radius)",
              padding: 4,
            }}
          >
            <TabBtn active={tab === "phone-login"} onClick={() => setTab("phone-login")}>
              <Phone size={12} /> 登录
            </TabBtn>
            <TabBtn active={tab === "phone-register"} onClick={() => setTab("phone-register")}>
              <KeyRound size={12} /> 注册
            </TabBtn>
            {enableDev && (
              <TabBtn active={tab === "dev"} onClick={() => setTab("dev")}>
                <Smartphone size={12} /> 体验账号
              </TabBtn>
            )}
          </div>

          {tab === "phone-login" && (
            <PhoneLoginForm
              onSuccess={async () => {
                await refresh();
                router.replace(from);
              }}
              onNeedRegister={() => setTab("phone-register")}
            />
          )}
          {tab === "phone-register" && (
            <PhoneRegisterForm
              platform={platform}
              onSuccess={async () => {
                await refresh();
                router.replace(from);
              }}
            />
          )}
          {tab === "dev" && enableDev && (
            <DevLoginForm
              onSuccess={async (username) => {
                await loginAs(username);
                router.replace(from);
              }}
            />
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "var(--as-fg-faint)",
            marginTop: 16,
            letterSpacing: 0.3,
          }}
        >
          {enableDev
            ? "验证码 / 密码登录适用于任意环境；体验账号仅在开发环境下可用。"
            : "验证码 / 密码登录适用于当前环境；新用户请使用激活码完成注册。"}
        </p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "8px 8px",
        background: active ? "var(--as-bg)" : "transparent",
        color: active ? "var(--as-fg)" : "var(--as-fg-muted)",
        border: "none",
        borderRadius: "calc(var(--as-radius) - 2px)",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        transition: "background 120ms",
      }}
    >
      {children}
    </button>
  );
}

function SendCodeButton({
  phone,
  purpose = "login",
  onError,
}: {
  phone: string;
  purpose?: SmsCodePurpose;
  onError: (msg: string) => void;
}) {
  const [sending, setSending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSend = async () => {
    const trimmed = phone.trim();
    if (!/^1\d{10}$/.test(trimmed)) {
      onError("请输入正确的 11 位手机号");
      return;
    }
    setSending(true);
    onError("");
    try {
      const result = await AuthApi.smsRequestCode(trimmed, purpose);
      const notice = AuthApi.describeSmsRequestCodeResult(result);
      if (notice.tone === "warn") {
        onError(notice.message);
      }
      setCooldown(60);
    } catch (e) {
      onError(extractErr(e, "验证码发送失败，请稍后重试"));
    } finally {
      setSending(false);
    }
  };

  const disabled = sending || cooldown > 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleSend}
      style={{
        minWidth: 116,
        whiteSpace: "nowrap",
        padding: "10px 12px",
        borderRadius: "var(--as-radius)",
        border: "1px solid var(--as-border)",
        background: "var(--as-surface-alt)",
        color: disabled ? "var(--as-fg-muted)" : "var(--as-fg)",
        fontSize: 12.5,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {sending ? <Loader2 size={12} className="animate-spin" /> : null}
      {cooldown > 0 ? `${cooldown} 秒后重发` : sending ? "发送中" : "获取验证码"}
    </button>
  );
}

function PhoneLoginForm({
  onSuccess,
  onNeedRegister,
}: {
  onSuccess: () => Promise<void>;
  onNeedRegister: () => void;
}) {
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<LoginMode>("code");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      if (mode === "password") {
        await AuthApi.passwordLogin(phone.trim(), password);
      } else {
        await AuthApi.smsLogin(phone.trim(), code.trim());
      }
      await onSuccess();
    } catch (e) {
      const err = e as { status?: number; error?: { code?: string; message?: string }; message?: string };
      if (err.error?.code === "USER_NOT_FOUND" || err.status === 404) {
        setError("这个手机号还没注册，已为你切到「注册」。");
        onNeedRegister();
      } else if (err.error?.code === "PASSWORD_NOT_SET") {
        setError("该账号还没设置密码，请先用验证码登录后设置。");
        setMode("code");
      } else {
        setError(extractErr(e, mode === "password" ? "登录没成功，请检查手机号和密码后重试" : "登录没成功，请检查手机号和验证码后重试"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && <ErrBox msg={error} />}
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "var(--as-surface-alt)",
          borderRadius: "var(--as-radius)",
          padding: 4,
        }}
      >
        <SegmentButton
          active={mode === "code"}
          onClick={() => {
            setMode("code");
            setError("");
          }}
          disabled={submitting}
        >
          <Phone size={12} /> 验证码登录
        </SegmentButton>
        <SegmentButton
          active={mode === "password"}
          onClick={() => {
            setMode("password");
            setError("");
          }}
          disabled={submitting}
        >
          <Lock size={12} /> 密码登录
        </SegmentButton>
      </div>
      <Field label="手机号">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入 11 位手机号" inputMode="numeric" maxLength={11} disabled={submitting} style={inputStyle} />
      </Field>
      {mode === "code" ? (
        <Field label="验证码">
          <div style={{ display: "flex", gap: 8 }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位数字" inputMode="numeric" maxLength={6} disabled={submitting} style={{ ...inputStyle, flex: 1 }} autoComplete="one-time-code" />
            <SendCodeButton phone={phone} purpose="login" onError={setError} />
          </div>
        </Field>
      ) : (
        <Field label="密码">
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" type="password" disabled={submitting} style={inputStyle} autoComplete="current-password" />
        </Field>
      )}
      <PrimaryButton onClick={handleSubmit} disabled={submitting || !phone || (mode === "code" ? !code : !password)}>
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
        {submitting ? "正在登录" : "登录"}
        {!submitting && <ArrowRight size={14} />}
      </PrimaryButton>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        minHeight: 32,
        border: "none",
        borderRadius: "calc(var(--as-radius) - 2px)",
        background: active ? "var(--as-bg)" : "transparent",
        color: active ? "var(--as-fg)" : "var(--as-fg-muted)",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function PhoneRegisterForm({ platform, onSuccess }: { platform: SubProduct; onSuccess: () => Promise<void> }) {
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [licenseKey, setLicenseKey] = React.useState("");
  const [studioName, setStudioName] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await AuthApi.smsRegister({
        phone: phone.trim(),
        code: code.trim(),
        licenseKey: licenseKey.trim(),
        studioName: studioName.trim(),
        displayName: displayName.trim() || undefined,
        platform,
      });
      await onSuccess();
    } catch (e) {
      setError(extractErr(e, "注册没成功，请检查信息后重试"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && <ErrBox msg={error} />}
      <Field label="手机号">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入 11 位手机号" inputMode="numeric" maxLength={11} disabled={submitting} style={inputStyle} />
      </Field>
      <Field label="验证码">
        <div style={{ display: "flex", gap: 8 }}>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位数字" inputMode="numeric" maxLength={6} disabled={submitting} style={{ ...inputStyle, flex: 1 }} autoComplete="one-time-code" />
          <SendCodeButton phone={phone} purpose="register" onError={setError} />
        </div>
      </Field>
      <Field label="激活码">
        <input value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} placeholder="LIC-XXXX-XXXX-XXXX" disabled={submitting} style={{ ...inputStyle, letterSpacing: 1 }} />
      </Field>
      <Field label="工作室名称">
        <input value={studioName} onChange={(e) => setStudioName(e.target.value)} placeholder="例如：星光工作室" disabled={submitting} style={inputStyle} />
      </Field>
      <Field label="显示名（选填）">
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="留空时用工作室名" disabled={submitting} style={inputStyle} />
      </Field>
      <PrimaryButton onClick={handleSubmit} disabled={submitting || !phone || !code || !licenseKey || !studioName}>
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
        {submitting ? "正在注册" : "完成注册并登录"}
      </PrimaryButton>
    </div>
  );
}

function DevLoginForm({ onSuccess }: { onSuccess: (username: string) => Promise<void> }) {
  const [accounts, setAccounts] = React.useState<AuthApi.DevAccount[] | null>(null);
  const [selected, setSelected] = React.useState("");
  const [manualUsername, setManualUsername] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    AuthApi.listDevAccounts()
      .then((list) => {
        if (cancelled) return;
        setAccounts(list);
        if (list.length > 0) setSelected(list[0].username);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setAccounts([]);
          setError(
            err.message.includes("Invalid JSON")
              ? "体验账号暂不可用：请确认 apps/server 已启动并启用了 dev profile。"
              : err.message || "体验账号加载失败（仅开发环境可用）",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handle = async (username?: string) => {
    setSubmitting(true);
    setError("");
    try {
      await onSuccess(username || "");
    } catch (err) {
      setError(extractErr(err, "登录没成功，请重试"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {error && <ErrBox msg={error} />}
      {!accounts ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 88, color: "var(--as-fg-muted)", fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" style={{ marginRight: 8 }} />
          加载体验账号中
        </div>
      ) : accounts.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--as-fg-muted)", fontSize: 13, padding: "24px 0" }}>
          当前没有可用的体验账号，请改用「手机号登录」。
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {accounts.map((a) => {
              const active = selected === a.username;
              return (
                <button
                  key={a.username}
                  onClick={() => setSelected(a.username)}
                  disabled={submitting}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: "var(--as-radius)",
                    background: active ? "color-mix(in srgb, var(--as-accent) 12%, transparent)" : "var(--as-surface-alt)",
                    border: active ? "1px solid var(--as-accent)" : "1px solid var(--as-border)",
                    cursor: submitting ? "not-allowed" : "pointer",
                    transition: "background 120ms, border-color 120ms",
                    opacity: submitting ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.studioName || a.displayName}</div>
                    <div style={{ fontSize: 10.5, color: "var(--as-fg-muted)", letterSpacing: 0.3, marginTop: 2 }}>
                      @{a.username}
                      {a.studioKind && <span style={{ marginLeft: 8, color: "var(--as-accent)" }}>· {STUDIO_KIND_LABEL_ZH[a.studioKind as StudioKind] ?? a.studioKind}</span>}
                    </div>
                  </div>
                  {active && (
                    <span aria-hidden style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "var(--as-accent)", color: "var(--as-accent-fg)", flexShrink: 0 }}>
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <PrimaryButton onClick={() => handle(selected)} disabled={submitting || !selected}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            {submitting ? "正在登录" : "登录进入"}
            {!submitting && <ArrowRight size={14} />}
          </PrimaryButton>
        </>
      )}

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--as-border)" }}>
        <div style={{ marginBottom: 8, fontSize: 11, color: "var(--as-fg-muted)" }}>手动输入账号（仅调试）</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={manualUsername} onChange={(e) => setManualUsername(e.target.value)} placeholder="studio_starlight" disabled={submitting} style={{ ...inputStyle, flex: 1 }} />
          <button
            type="button"
            onClick={() => handle(manualUsername.trim() || undefined)}
            disabled={submitting}
            style={{ padding: "10px 14px", borderRadius: "var(--as-radius)", border: "1px solid var(--as-border)", background: "var(--as-surface-alt)", color: "var(--as-fg)", fontSize: 12.5, cursor: submitting ? "not-allowed" : "pointer" }}
          >
            登录
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 共用样式 / 小组件 ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--as-surface-alt)",
  border: "1px solid var(--as-border)",
  borderRadius: "var(--as-radius)",
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--as-fg)",
  outline: "none",
};

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        marginTop: 6,
        padding: "12px 16px",
        borderRadius: "var(--as-radius)",
        border: "none",
        background: "var(--as-accent)",
        color: "var(--as-accent-fg)",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "opacity 120ms",
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 6, fontSize: 11, color: "var(--as-fg-muted)" }}>{label}</div>
      {children}
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div
      style={{
        fontSize: 12.5,
        color: "var(--as-danger)",
        background: "color-mix(in srgb, var(--as-danger) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--as-danger) 25%, transparent)",
        borderRadius: "var(--as-radius)",
        padding: "8px 12px",
      }}
    >
      {msg}
    </div>
  );
}

function extractErr(e: unknown, fallback: string): string {
  const err = e as { error?: { message?: string }; message?: string };
  return err?.error?.message ?? err?.message ?? fallback;
}

export function AuthScreen(props: AuthScreenProps) {
  return (
    <React.Suspense
      fallback={
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: props.theme.bg, color: props.theme.fgMuted, fontSize: 13 }}>
          正在加载登录页...
        </div>
      }
    >
      <AuthScreenInner {...props} />
    </React.Suspense>
  );
}
