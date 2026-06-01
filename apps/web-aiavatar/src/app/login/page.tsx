"use client";

// 登录：dev-login（开发/联调主入口，下拉选种子账号）+ 手机号验证码（生产入口）。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Boxes, Loader2, Phone, ShieldCheck } from "lucide-react";
import { AuthApi, ENABLE_DEV_LOGIN, useAuth } from "@ai-star-eco/api-client";

interface DevAccount { username: string; displayName?: string; role?: string }

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") || "/library";
  const { loginAs, refresh, user } = useAuth();

  const [tab, setTab] = React.useState<"dev" | "phone">(ENABLE_DEV_LOGIN ? "dev" : "phone");
  const [devAccounts, setDevAccounts] = React.useState<DevAccount[]>([]);
  const [username, setUsername] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => { if (user) router.replace(from); }, [user, from, router]);

  React.useEffect(() => {
    if (!ENABLE_DEV_LOGIN) return;
    AuthApi.listDevAccounts().then((list) => {
      setDevAccounts(list as DevAccount[]);
      if (list[0]) setUsername(list[0].username);
    }).catch(() => setDevAccounts([]));
  }, []);

  React.useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const doDevLogin = async () => {
    setBusy(true); setErr(null);
    try { await loginAs(username || undefined); await refresh(); router.replace(from); }
    catch (e) { setErr(e instanceof Error ? e.message : "登录失败"); }
    finally { setBusy(false); }
  };

  const sendCode = async () => {
    if (!phone) { setErr("请输入手机号"); return; }
    setBusy(true); setErr(null);
    try { await AuthApi.smsRequestCode(phone, "login"); setSent(true); setCountdown(60); }
    catch (e) { setErr(e instanceof Error ? e.message : "发送失败"); }
    finally { setBusy(false); }
  };

  const doPhoneLogin = async () => {
    setBusy(true); setErr(null);
    try { await AuthApi.smsLogin(phone, code); await refresh(); router.replace(from); }
    catch (e) { setErr(e instanceof Error ? e.message : "登录失败，请确认验证码"); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-0)] p-6 text-[var(--fg-0)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--bg-1)] p-7 shadow-[var(--shadow-lg)]">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-ink)]">
            <Boxes className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">AiAvatar 资产中心</div>
            <div className="meta">登录以管理你的形象资产</div>
          </div>
        </div>

        <div className="seg mb-5 w-full">
          {ENABLE_DEV_LOGIN && (
            <button onClick={() => setTab("dev")} data-on={tab === "dev"} className="seg-item flex-1">开发登录</button>
          )}
          <button onClick={() => setTab("phone")} data-on={tab === "phone"} className="seg-item flex-1">手机号登录</button>
        </div>

        {tab === "dev" && ENABLE_DEV_LOGIN ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--fg-2)]">选择种子账号</span>
              <select value={username} onChange={(e) => setUsername(e.target.value)} className="aa-select">
                {devAccounts.length === 0 && <option value="">（默认首个 STUDIO）</option>}
                {devAccounts.map((a) => (
                  <option key={a.username} value={a.username}>{a.displayName ?? a.username}（{a.username}）</option>
                ))}
              </select>
            </label>
            <button onClick={doDevLogin} disabled={busy} className="btn btn-primary btn-lg w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} 进入工作台
            </button>
            <p className="flex items-center gap-1 text-[11px] text-[var(--fg-3)]">
              <ShieldCheck className="h-3 w-3" /> 开发免密入口（生产构建自动隐藏）
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--fg-2)]">手机号</span>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-3 focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--brand-soft)]">
                <Phone className="h-4 w-4 text-[var(--fg-3)]" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 位手机号"
                  className="w-full bg-transparent py-2 text-sm text-[var(--fg-0)] outline-none placeholder:text-[var(--fg-3)]" />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--fg-2)]">验证码</span>
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 位验证码" className="aa-input" />
                <button onClick={sendCode} disabled={busy || countdown > 0} className="btn btn-ghost shrink-0">
                  {countdown > 0 ? <span className="num">{countdown}s</span> : sent ? "重发" : "发送"}
                </button>
              </div>
            </label>
            <button onClick={doPhoneLogin} disabled={busy || !code} className="btn btn-primary btn-lg w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} 登录
            </button>
          </div>
        )}

        {err && <p className="mt-3 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">{err}</p>}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[var(--bg-0)]" />}>
      <LoginInner />
    </React.Suspense>
  );
}
