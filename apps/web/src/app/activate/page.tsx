"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /activate — 秘钥激活注册（新用户入口）。
// 对应后端 POST /api/auth/activate（一次事务创建 AepUser + Studio + Wallet +
// Membership），契约见 types/license.ts#LicenseRedeemRequest。
// 未登录访问 /producer 时，producer-intro 会把新用户引到此页。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthApi } from "@/api";
import { useAuth } from "@/lib/auth-context";
import type { LicenseRedeemRequest } from "@/types/license";
import type { StudioKind } from "@/types/account";
import { STUDIO_KIND_LABEL_ZH } from "@/types/account";

const STUDIO_KIND_OPTIONS: StudioKind[] = [
  "personal_creator",
  "music_studio",
  "drama_studio",
  "variety_studio",
  "agency",
  "mcn",
];

export default function ActivatePage() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get("redirect") || "/producer";
  const { user, refresh } = useAuth();

  const [form, setForm] = React.useState<LicenseRedeemRequest>({
    code: "",
    username: "",
    studioName: "",
    studioKind: "personal_creator",
    displayName: "",
    email: "",
    phone: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, redirect, router]);

  const set = <K extends keyof LicenseRedeemRequest>(key: K, val: LicenseRedeemRequest[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.code.trim() || !form.username.trim() || !form.studioName.trim()) {
      setError("请填写秘钥、用户名、工作室名。");
      return;
    }
    setSubmitting(true);
    try {
      const body: LicenseRedeemRequest = {
        code: form.code.trim(),
        username: form.username.trim(),
        studioName: form.studioName.trim(),
        studioKind: form.studioKind,
        displayName: form.displayName?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
      };
      await AuthApi.activate(body);
      await refresh();
      router.replace(redirect);
    } catch (err) {
      setError((err as Error).message ?? "激活失败，请检查秘钥或信息。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              AI Star Eco
            </span>
          </div>
          <h1 className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
            秘钥激活注册
          </h1>
          <p className="text-sm text-gray-500 font-light">
            输入邀请秘钥即可开通经纪公司账号；激活后一次性入账初始点数。
          </p>
        </div>

        <Card className="bg-gray-900/60 border-white/5">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <Field label="License 秘钥" required>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={form.code}
                    onChange={(e) => set("code", e.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    disabled={submitting}
                    autoFocus
                    className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm font-mono tracking-wider text-white focus:border-cyan-500/40 outline-none"
                  />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="用户名" required>
                  <input
                    value={form.username}
                    onChange={(e) => set("username", e.target.value)}
                    placeholder="skywave_studio"
                    disabled={submitting}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/40 outline-none"
                  />
                </Field>
                <Field label="显示名">
                  <input
                    value={form.displayName ?? ""}
                    onChange={(e) => set("displayName", e.target.value)}
                    placeholder="星浪工作室"
                    disabled={submitting}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/40 outline-none"
                  />
                </Field>
              </div>

              <Field label="工作室 / 经纪公司名" required>
                <input
                  value={form.studioName}
                  onChange={(e) => set("studioName", e.target.value)}
                  placeholder="星浪工作室"
                  disabled={submitting}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/40 outline-none"
                />
              </Field>

              <Field label="机构类型">
                <select
                  value={form.studioKind ?? "personal_creator"}
                  onChange={(e) => set("studioKind", e.target.value as StudioKind)}
                  disabled={submitting}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/40 outline-none"
                >
                  {STUDIO_KIND_OPTIONS.map(k => (
                    <option key={k} value={k} className="bg-gray-900">
                      {STUDIO_KIND_LABEL_ZH[k]}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="邮箱">
                  <input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="ops@studio.io"
                    disabled={submitting}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/40 outline-none"
                  />
                </Field>
                <Field label="手机">
                  <input
                    value={form.phone ?? ""}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+86 138 0000 0000"
                    disabled={submitting}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/40 outline-none"
                  />
                </Field>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {submitting ? "激活中..." : "激活并进入控制台"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-500 font-light">
          已有账号？
          <Link href={{ pathname: "/login", query: { redirect } }} className="ml-1 text-cyan-400 hover:text-cyan-300">
            直接登录 →
          </Link>
        </div>

        <p className="text-[11px] text-gray-600 text-center font-light">
          激活将在一次事务内创建账号、工作室与钱包，并按批次发放初始点数。
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="text-[11px] text-gray-400">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </div>
      {children}
    </label>
  );
}
