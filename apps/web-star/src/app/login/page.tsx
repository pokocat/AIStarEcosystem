"use client";

// 登录页 — 手机号验证码 / 密码登录；dev 环境提供种子账号快速登录。
// 明星账号由平台商务开通（绑定 star 平台 + 明星档案），不开放自助注册。

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, MessageSquareText, Star, UserRound } from "lucide-react";
import { AuthApi, ENABLE_DEV_LOGIN, useAuth } from "@ai-star-eco/api-client";

type Mode = "code" | "password";

function fieldClass() {
  return "w-full h-11 px-3.5 rounded-xl text-sm outline-none transition placeholder:text-[var(--ink-2)]";
}

const fieldStyle: React.CSSProperties = {
  background: "var(--bg-1)",
  border: "1px solid var(--line-strong)",
  color: "var(--ink-0)",
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
      const described = AuthApi.describeSmsRequestCodeResult(result);
      setSendNotice(described.message);
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
      if (mode === "code") {
        await AuthApi.smsLogin(phone.trim(), code.trim());
      } else {
        await AuthApi.passwordLogin(phone.trim(), password);
      }
      await refresh();
      router.replace("/dashboard");
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
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "dev 登录失败");
    } finally {
      setDevLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "var(--bg-0)" }}>
      <div className="absolute inset-x-0 top-0 h-64 star-grid-pattern" aria-hidden />
      <div className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-sm">
          {/* 品牌 */}
          <Link href="/" className="flex flex-col items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "var(--gradient-star)" }}>
              <Star className="w-6 h-6 text-white" fill="currentColor" />
            </div>
            <div className="text-center">
              <div className="text-lg font-black" style={{ color: "var(--ink-0)", fontFamily: "var(--font-display)" }}>明星商务工作台</div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-2)" }}>明星本人 / 经纪团队登录</div>
            </div>
          </Link>

          <div className="star-card p-4 sm:p-6">
            {/* 模式切换 */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-5" style={{ background: "var(--bg-2)" }}>
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
                    style={active ? { background: "var(--bg-1)", color: "var(--ink-0)", boxShadow: "var(--shadow-soft)" } : { color: "var(--ink-1)" }}
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
                className={fieldClass()}
                style={fieldStyle}
              />
              {mode === "code" ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="短信验证码"
                    inputMode="numeric"
                    className={fieldClass()}
                    style={fieldStyle}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                  <button
                    onClick={sendCode}
                    disabled={cooldown > 0}
                    className="w-full sm:w-auto sm:shrink-0 h-11 px-3.5 rounded-xl text-[13px] font-semibold transition disabled:opacity-50"
                    style={{ border: "1px solid var(--line-strong)", color: "var(--ink-0)", background: "var(--bg-1)" }}
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
                  className={fieldClass()}
                  style={fieldStyle}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              )}

              {sendNotice && (
                <div className="text-[11px] leading-relaxed px-1" style={{ color: "var(--info)" }}>{sendNotice}</div>
              )}
              {error && (
                <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: "var(--brand-soft)", color: "var(--brand-deep)" }}>{error}</div>
              )}

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full h-11 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "var(--ink-0)" }}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                登录工作台
              </button>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-center" style={{ color: "var(--ink-2)" }}>
              明星账号由平台商务团队开通并绑定艺人档案，暂不开放自助注册。
            </p>
          </div>

          {/* dev 快速登录 */}
          {ENABLE_DEV_LOGIN && devAccounts.length > 0 && (
            <div className="mt-4 star-card p-4">
              <div className="text-[11px] font-bold mb-2 flex items-center gap-1" style={{ color: "var(--ink-2)" }}>
                <UserRound className="w-3 h-3" /> DEV 种子账号（仅开发联调）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {devAccounts.map((u) => (
                  <button
                    key={u}
                    onClick={() => devLogin(u)}
                    disabled={devLoading !== null}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono transition hover:bg-white disabled:opacity-50"
                    style={{ border: "1px solid var(--line)", color: "var(--ink-1)", background: "var(--bg-2)" }}
                  >
                    {devLoading === u ? "登录中…" : u}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
