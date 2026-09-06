"use client";

// 登录页 — 手机号验证码 / 密码登录；dev 环境提供种子账号快速登录。
// v0.149+：统一账号中心接管后（isIdMode），本页收敛成「去账号中心登录」一个按钮。

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, MessageSquareText, UserRound } from "lucide-react";
import { AuthApi, ENABLE_DEV_LOGIN, isIdMode, useAuth } from "@ai-star-eco/api-client";
import { IdCenterLoginScreen } from "@ai-star-eco/landing";

type Mode = "code" | "password";

const fieldClass = "w-full h-11 px-3.5 rounded-xl text-sm outline-none transition";
const fieldStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--line-2)",
  color: "var(--ink)",
};

export default function LoginPage() {
  const router = useRouter();
  const { refresh, loginAs } = useAuth();
  const [mode, setMode] = React.useState<Mode>("code");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [sendNotice, setSendNotice] = React.useState<string | null>(null);
  const [devAccounts, setDevAccounts] = React.useState<string[]>([]);
  const [devLoading, setDevLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  React.useEffect(() => {
    if (!ENABLE_DEV_LOGIN) return;
    AuthApi.listDevAccounts()
      .then((accounts) => setDevAccounts(accounts.map((a) => a.username)))
      .catch(() => setDevAccounts([]));
  }, []);

  const sendCode = async () => {
    setError(null);
    setSendNotice(null);
    if (!/^1\d{10}$/.test(phone.trim())) {
      setError("请输入 11 位手机号");
      return;
    }
    try {
      const result = await AuthApi.smsRequestCode(phone.trim(), "login");
      setSendNotice(AuthApi.describeSmsRequestCodeResult(result).message);
      setCooldown(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "验证码发送失败");
    }
  };

  const submit = async () => {
    setError(null);
    if (!/^1\d{10}$/.test(phone.trim())) {
      setError("请输入 11 位手机号");
      return;
    }
    if (mode === "code" && !code.trim()) {
      setError("请输入短信验证码");
      return;
    }
    if (mode === "password" && !password) {
      setError("请输入密码");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "code") await AuthApi.smsLogin(phone.trim(), code.trim());
      else await AuthApi.passwordLogin(phone.trim(), password);
      await refresh();
      router.replace("/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  };

  const devLogin = async (username: string) => {
    setError(null);
    setDevLoading(username);
    try {
      await loginAs(username);
      router.replace("/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "dev 登录失败");
    } finally {
      setDevLoading(null);
    }
  };

  if (isIdMode()) {
    return (
      <IdCenterLoginScreen
        brandLabel="AI IP 工作台"
        tagline="账号中心统一处理登录，一个账号通行全部产品。"
        postLoginPath="/projects"
        theme={{
          bg: "var(--canvas)",
          surface: "var(--surface)",
          fg: "var(--ink)",
          fgMuted: "var(--ink-2)",
          accent: "var(--primary)",
          accentFg: "var(--on-primary)",
          border: "var(--line-2)",
          radius: "15px",
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12" style={{ background: "var(--canvas)" }}>
      <div className="w-full max-w-sm">
        <Link href="/" className="flex flex-col items-center gap-2 mb-8">
          <span className="asset-name text-[26px]" style={{ color: "var(--ink)" }}>AI IP 工作台</span>
          <span className="reg">IP STUDIO · ATELIER</span>
        </Link>

        <div className="ledger-card p-6">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-5" style={{ background: "var(--surface-2)" }}>
            {([
              { id: "code" as Mode, label: "验证码登录", icon: MessageSquareText },
              { id: "password" as Mode, label: "密码登录", icon: KeyRound },
            ]).map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id); setError(null); }}
                  className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition"
                  style={active
                    ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "var(--shadow-hair)" }
                    : { color: "var(--ink-2)" }}
                >
                  <Icon className="w-3.5 h-3.5" /> {m.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="手机号"
              inputMode="tel"
              autoComplete="tel"
              className={fieldClass}
              style={fieldStyle}
            />
            {mode === "code" ? (
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="短信验证码"
                  inputMode="numeric"
                  className={fieldClass}
                  style={fieldStyle}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
                <button
                  onClick={sendCode}
                  disabled={cooldown > 0}
                  className="shrink-0 h-11 px-3.5 rounded-xl text-[13px] font-semibold transition disabled:opacity-50"
                  style={{ border: "1px solid var(--line-2)", color: "var(--ink)", background: "var(--surface)" }}
                >
                  {cooldown > 0 ? `${cooldown}s` : "获取验证码"}
                </button>
              </div>
            ) : (
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                type="password"
                autoComplete="current-password"
                className={fieldClass}
                style={fieldStyle}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            )}

            {sendNotice && <div className="text-[11px] leading-relaxed px-1" style={{ color: "var(--info)" }}>{sendNotice}</div>}
            {error && (
              <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: "var(--err-soft)", color: "var(--err)" }}>{error}</div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full h-11 rounded-xl text-sm font-bold transition hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              进入工作台
            </button>
          </div>
        </div>

        {ENABLE_DEV_LOGIN && devAccounts.length > 0 && (
          <div className="mt-4 ledger-card p-4">
            <div className="field-label mb-2 flex items-center gap-1">
              <UserRound className="w-3 h-3" /> DEV 种子账号（仅开发联调）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {devAccounts.map((u) => (
                <button
                  key={u}
                  onClick={() => devLogin(u)}
                  disabled={devLoading !== null}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono transition disabled:opacity-50"
                  style={{ border: "1px solid var(--line-2)", color: "var(--ink-2)", background: "var(--surface-2)" }}
                >
                  {devLoading === u ? "登录中…" : u}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
