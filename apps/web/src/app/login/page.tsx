"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, LogIn, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthApi } from "@/api";
import type { DevAccount } from "@/api/auth";
import { useAuth } from "@/lib/auth-context";
import { STUDIO_KIND_LABEL_ZH, type StudioKind } from "@/types/account";

/**
 * Dev 登录页 —— 免密，从后端拉取可用账号列表。
 * 每个账号对应一家经纪公司（Studio），登录后 /api/me 会返回嵌套的 studio 档案。
 */
export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get("redirect") || "/producer";
  const { loginAs, user } = useAuth();

  const [accounts, setAccounts] = React.useState<DevAccount[] | null>(null);
  const [selected, setSelected] = React.useState<string>("");
  const [manualUsername, setManualUsername] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 已登录直接跳目标页
  React.useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, redirect, router]);

  React.useEffect(() => {
    let cancelled = false;
    AuthApi.listDevAccounts()
      .then((list) => {
        if (cancelled) return;
        setAccounts(list);
        if (list.length > 0) setSelected(list[0].username);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "获取账号列表失败");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin(username?: string) {
    setSubmitting(true);
    setError(null);
    try {
      await loginAs(username);
      router.replace(redirect);
    } catch (err) {
      setError((err as Error).message ?? "登录失败");
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
            选择经纪公司登录
          </h1>
          <p className="text-sm text-gray-500 font-light">
            开发模式 · 免密切换账户。每个账号对应一家经纪公司，登录后可看到其签约艺人。
          </p>
        </div>

        <Card className="bg-gray-900/60 border-white/5">
          <CardContent className="p-5 space-y-4">
            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            {!accounts ? (
              <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> 载入账号中...
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-6">
                后端未种子任何 STUDIO 账户。请先启动 server（dev profile）。
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {accounts.map((a) => (
                    <button
                      key={a.username}
                      onClick={() => setSelected(a.username)}
                      disabled={submitting}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                        selected === a.username
                          ? "bg-cyan-500/10 border-cyan-500/40"
                          : "bg-white/[0.02] border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {a.studioName || a.displayName}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            @{a.username}
                            {a.studioKind && (
                              <span className="ml-2 text-cyan-300/70">
                                · {STUDIO_KIND_LABEL_ZH[a.studioKind as StudioKind] ?? a.studioKind}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <Button
                  onClick={() => handleLogin(selected)}
                  disabled={submitting || !selected}
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  {submitting ? "登录中..." : "登录进入"}
                </Button>
              </>
            )}

            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="text-[11px] text-gray-500">手动输入用户名（调试用）</div>
              <div className="flex items-center gap-2">
                <input
                  value={manualUsername}
                  onChange={(e) => setManualUsername(e.target.value)}
                  placeholder="studio_starlight"
                  disabled={submitting}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500/40 outline-none"
                />
                <Button
                  variant="outline"
                  onClick={() => handleLogin(manualUsername.trim() || undefined)}
                  disabled={submitting}
                  className="border-white/10 text-gray-400 hover:text-white text-xs"
                >
                  登录
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link
          href={{ pathname: "/activate", query: { redirect } }}
          className="block"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-500/30 transition">
            <div className="flex items-center gap-2 min-w-0">
              <KeyRound className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">新用户？秘钥激活注册</div>
                <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                  输入邀请秘钥即可开通经纪公司账号
                </div>
              </div>
            </div>
            <span className="text-xs text-cyan-400 shrink-0">前往 →</span>
          </div>
        </Link>

        <p className="text-[11px] text-gray-600 text-center font-light">
          {"⚠️ dev-login 仅在后端 dev profile 下启用，生产环境会返回 404。"}
        </p>
      </div>
    </div>
  );
}
