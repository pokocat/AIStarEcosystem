"use client";

import { useState } from "react";
import { ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请检查用户名和密码");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),linear-gradient(180deg,_#f7f9fc_0%,_#eef3fb_52%,_#e6edf8_100%)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:36px_36px]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-8 lg:grid-cols-[1.08fr_500px]">
          <section className="flex flex-col justify-center space-y-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              平台内部运营工作台
            </div>
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-700">
                AI Star Eco
              </p>
              <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-slate-950">
                面向账户、权益、许可证与积分运营的管理后台。
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                仅限系统管理员登录，支持平台运营和财务管理两种角色。
                普通用户通过秘钥激活注册，不具备后台访问权限。
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
                <p className="text-sm font-medium text-slate-500">管理员角色</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">PLATFORM_OPERATOR</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  拥有所有数据操作权限，可管理用户、租户、权益、许可证与审计数据。
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-slate-950 p-5 text-slate-50 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
                <div className="flex items-center gap-2 text-sm font-medium text-sky-300">
                  <Sparkles className="h-4 w-4" />
                  秘钥注册
                </div>
                <p className="mt-2 text-xl font-semibold">用户通过秘钥激活入驻</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  秘钥支持后台导入，也预留了外部 CRM 系统对接接口。
                </p>
              </div>
            </div>
          </section>

          <Card className="border-slate-200/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur">
            <CardHeader className="space-y-3">
              <CardTitle className="text-2xl text-slate-950">登录管理后台</CardTitle>
              <CardDescription className="text-base leading-7 text-slate-600">
                请使用管理员账户登录。仅 PLATFORM_OPERATOR 和 FINANCE_ADMIN 角色可访问。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-700">
                    用户名 / 邮箱
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700">
                    登录密码
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-slate-200 bg-white text-slate-900"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
                    {error}
                  </div>
                )}

                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
                  开发环境默认账户：admin / admin123（平台运营）或 finance / finance123（财务管理员）
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full bg-slate-950 text-white hover:bg-slate-800"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    "登录"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
