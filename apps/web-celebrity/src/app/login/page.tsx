"use client";

// Creator-Friendly login — v0.31+: 主入口手机号 + 验证码；dev-login 入口仅开发/显式开启时显示。

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, KeyRound, Loader2, Lock, LogIn, Phone, Smartphone } from "lucide-react";
import { AuthApi, ENABLE_DEV_LOGIN, useAuth } from "@ai-star-eco/api-client";
import { STUDIO_KIND_LABEL_ZH, type StudioKind } from "@ai-star-eco/types/account";
import { Avatar, Button, Card, Chip } from "@/components/creator";

type Tab = "phone-login" | "phone-register" | "dev";
type LoginMode = "code" | "password";
type SmsCodePurpose = "login" | "register";

function CelebrityLoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") || "/dashboard";
  const { loginAs, refresh, user } = useAuth();
  const enableDev = ENABLE_DEV_LOGIN;

  const [tab, setTab] = React.useState<Tab>("phone-login");

  React.useEffect(() => {
    if (user) router.replace(from);
  }, [user, from, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-0)",
        color: "var(--fg-0)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <Brand />

        <Card style={{ padding: "22px 22px 18px" }}>
          {/* tab strip */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 18,
              background: "var(--bg-2)",
              borderRadius: "var(--radius-md)",
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
                <Smartphone size={12} /> dev
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
        </Card>

        <p
          className="mono"
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "var(--fg-3)",
            marginTop: 16,
            letterSpacing: 0.3,
          }}
        >
          {enableDev
            ? "验证码 / 密码登录支持任意环境；dev tab 仅在后端 dev profile 下生效。"
            : "验证码 / 密码登录支持当前环境；新用户请使用激活码完成注册。"}
        </p>
      </div>
    </div>
  );
}

// ── 顶部品牌区 ─────────────────────────────────────────────────────────────
function Brand() {
  return (
    <div style={{ textAlign: "center", marginBottom: 28 }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 20, textDecoration: "none" }}>
        <img src="/brand/logo.svg" alt="AI 明星带货" style={{ height: 42, width: "auto", display: "block" }} />
      </Link>
      <h1 style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "var(--tracking-tight)", margin: "0 0 8px", lineHeight: 1.25 }}>
        登录到
        <span className="serif-italic" style={{ color: "var(--accent)", margin: "0 6px" }}>经纪公司</span>
        工作台
      </h1>
      <p style={{ fontSize: 13, color: "var(--fg-2)", maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
        手机号支持验证码或密码登录；新用户需要激活码 + 手机号完成注册。
      </p>
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
        padding: "8px 10px",
        background: active ? "var(--bg-0)" : "transparent",
        color: active ? "var(--fg-0)" : "var(--fg-2)",
        border: "none",
        borderRadius: "calc(var(--radius-md) - 2px)",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        transition: "background 120ms",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
      }}
    >
      {children}
    </button>
  );
}

// ── 通用：发送验证码按钮（带 60s 倒计时） ────────────────────────────────
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
      onError("手机号格式不正确（11 位国内号）");
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
      const err = e as { error?: { message?: string }; message?: string };
      onError(err.error?.message ?? err.message ?? "发送失败");
    } finally {
      setSending(false);
    }
  };

  const disabled = sending || cooldown > 0;
  return (
    <Button
      variant="secondary"
      size="md"
      disabled={disabled}
      onClick={handleSend}
      style={{ minWidth: 116, whiteSpace: "nowrap" }}
    >
      {sending ? <Loader2 size={12} className="animate-spin" /> : null}
      {cooldown > 0 ? `${cooldown} 秒后可重发` : sending ? "发送中" : "发送验证码"}
    </Button>
  );
}

// ── 手机号登录 ────────────────────────────────────────────────────────────
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
  const [error, setError] = React.useState<string>("");
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
        setError("该手机号还没有注册，已为你切换到「注册」");
        onNeedRegister();
      } else if (err.error?.code === "PASSWORD_NOT_SET") {
        setError("该账号还没设置密码，请先用验证码登录后设置。");
        setMode("code");
      } else {
        setError(err.error?.message ?? err.message ?? (mode === "password" ? "请检查手机号和密码" : "请检查手机号和验证码"));
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
          background: "var(--bg-2)",
          borderRadius: "var(--radius-md)",
          padding: 4,
        }}
      >
        <ModeBtn
          active={mode === "code"}
          onClick={() => {
            setMode("code");
            setError("");
          }}
          disabled={submitting}
        >
          <Phone size={12} /> 验证码登录
        </ModeBtn>
        <ModeBtn
          active={mode === "password"}
          onClick={() => {
            setMode("password");
            setError("");
          }}
          disabled={submitting}
        >
          <Lock size={12} /> 密码登录
        </ModeBtn>
      </div>
      <Field label="手机号">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="请输入 11 位手机号"
          inputMode="numeric"
          maxLength={11}
          disabled={submitting}
          style={inputStyle}
        />
      </Field>
      {mode === "code" ? (
        <Field label="验证码">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6 位数字"
              inputMode="numeric"
              maxLength={6}
              disabled={submitting}
              style={{ ...inputStyle, flex: 1 }}
              autoComplete="one-time-code"
            />
            <SendCodeButton phone={phone} purpose="login" onError={setError} />
          </div>
        </Field>
      ) : (
        <Field label="密码">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            type="password"
            disabled={submitting}
            style={inputStyle}
            autoComplete="current-password"
          />
        </Field>
      )}
      <Button
        onClick={handleSubmit}
        disabled={submitting || !phone || (mode === "code" ? !code : !password)}
        variant="dark"
        size="lg"
        style={{ width: "100%", marginTop: 6 }}
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
        {submitting ? "正在登录" : "登录"}
        {!submitting && <ArrowRight size={14} />}
      </Button>
    </div>
  );
}

function ModeBtn({
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
        background: active ? "var(--bg-0)" : "transparent",
        color: active ? "var(--fg-0)" : "var(--fg-2)",
        border: "none",
        borderRadius: "calc(var(--radius-md) - 2px)",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ── 手机号 + 激活码 注册 ───────────────────────────────────────────────
function PhoneRegisterForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [licenseKey, setLicenseKey] = React.useState("");
  const [studioName, setStudioName] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [error, setError] = React.useState<string>("");
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
        platform: "celebrity",
      });
      await onSuccess();
    } catch (e) {
      const err = e as { error?: { message?: string }; message?: string };
      setError(err.error?.message ?? err.message ?? "注册失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && <ErrBox msg={error} />}
      <Field label="手机号">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="请输入 11 位手机号"
          inputMode="numeric"
          maxLength={11}
          disabled={submitting}
          style={inputStyle}
        />
      </Field>
      <Field label="验证码">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 位数字"
            inputMode="numeric"
            maxLength={6}
            disabled={submitting}
            style={{ ...inputStyle, flex: 1 }}
            autoComplete="one-time-code"
          />
          <SendCodeButton phone={phone} purpose="register" onError={setError} />
        </div>
      </Field>
      <Field label="激活码">
        <input
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder="LIC-XXXX-XXXX-XXXX"
          disabled={submitting}
          style={{ ...inputStyle, fontFamily: "var(--font-mono)", letterSpacing: 1 }}
        />
      </Field>
      <Field label="工作室名称">
        <input
          value={studioName}
          onChange={(e) => setStudioName(e.target.value)}
          placeholder="例如：星光工作室"
          disabled={submitting}
          style={inputStyle}
        />
      </Field>
      <Field label="显示名（选填）">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="个人称呼，留空时使用工作室名"
          disabled={submitting}
          style={inputStyle}
        />
      </Field>
      <Button
        onClick={handleSubmit}
        disabled={submitting || !phone || !code || !licenseKey || !studioName}
        variant="dark"
        size="lg"
        style={{ width: "100%", marginTop: 6 }}
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
        {submitting ? "正在注册" : "完成注册并登录"}
      </Button>
    </div>
  );
}

// ── dev 切换账号（保留旧路径） ────────────────────────────────────────────
function DevLoginForm({ onSuccess }: { onSuccess: (username: string) => Promise<void> }) {
  const [accounts, setAccounts] = React.useState<AuthApi.DevAccount[] | null>(null);
  const [selected, setSelected] = React.useState<string>("");
  const [manualUsername, setManualUsername] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string>("");

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
              ? "dev 账号暂不可用：请确认 apps/server 已启动并启用了 dev profile。"
              : err.message || "账号列表加载失败（仅开发模式可用）",
          );
        }
      });
    return () => { cancelled = true; };
  }, []);

  const handle = async (username?: string) => {
    setSubmitting(true);
    setError("");
    try {
      await onSuccess(username || "");
    } catch (err) {
      setError((err as Error).message ?? "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {error && <ErrBox msg={error} />}
      {!accounts ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 88, color: "var(--fg-2)", fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" style={{ marginRight: 8 }} />
          加载账号中
        </div>
      ) : accounts.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--fg-2)", fontSize: 13, padding: "24px 0" }}>
          开发模式下没有可用账号。请改用「手机号登录」。
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
                    borderRadius: "var(--radius-md)",
                    background: active ? "var(--accent-soft)" : "var(--bg-1)",
                    border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
                    boxShadow: active ? "0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent)" : "none",
                    cursor: submitting ? "not-allowed" : "pointer",
                    transition: "background 120ms, border-color 120ms, box-shadow 120ms",
                    opacity: submitting ? 0.7 : 1,
                    fontFamily: "var(--font-sans)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Avatar seed={a.username} size={32} shape="square" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.studioName || a.displayName}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-2)", letterSpacing: 0.3, marginTop: 2 }}>@{a.username}</div>
                  </div>
                  {a.studioKind && (
                    <Chip tone={active ? "accent" : "neutral"} size="sm">
                      {STUDIO_KIND_LABEL_ZH[a.studioKind as StudioKind] ?? a.studioKind}
                    </Chip>
                  )}
                  {active && (
                    <span aria-hidden style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "#fff", flexShrink: 0 }}>
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Button onClick={() => handle(selected)} disabled={submitting || !selected} variant="dark" size="lg" style={{ width: "100%" }}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            {submitting ? "正在登录" : "登录进入"}
            {!submitting && <ArrowRight size={14} />}
          </Button>
        </>
      )}

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>手动输入用户名（仅调试）</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={manualUsername}
            onChange={(e) => setManualUsername(e.target.value)}
            placeholder="studio_starlight"
            disabled={submitting}
            style={{ ...inputStyle, flex: 1, fontFamily: "var(--font-mono)" }}
          />
          <Button variant="secondary" size="md" onClick={() => handle(manualUsername.trim() || undefined)} disabled={submitting}>
            登录
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── 共用样式 / 小组件 ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-2)",
  border: "1px solid var(--line-2)",
  borderRadius: "var(--radius-md)",
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--fg-0)",
  outline: "none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 6, fontSize: 11, color: "var(--fg-2)" }}>{label}</div>
      {children}
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div
      style={{
        fontSize: 12.5,
        color: "var(--danger)",
        background: "color-mix(in srgb, var(--danger) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
        borderRadius: "var(--radius-md)",
        padding: "8px 12px",
      }}
    >
      {msg}
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--bg-0)", color: "var(--fg-2)", fontSize: 13, fontFamily: "var(--font-sans)" }}>
          正在加载登录页...
        </div>
      }
    >
      <CelebrityLoginInner />
    </React.Suspense>
  );
}
