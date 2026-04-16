"use client";

import { useState } from "react";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
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
      setError("请输入账号和密码");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请检查账号或密码");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f7f9fc_0%,_#edf2fb_100%)]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1280px] items-center gap-8 px-6 py-10 lg:grid-cols-[1.1fr_420px]">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
            AI Star Eco 平台运营后台
          </div>

          <div className="space-y-3">
            <p className="text-[12px] font-semibold tracking-[0.18em] text-sky-700">
              ACCOUNT & ENTITLEMENT PLATFORM
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">
              统一管理账户、租户、卡密、积分与审计数据。
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-slate-600">
              仅限平台运营、财务和渠道管理角色登录。普通用户通过激活码进入产品前台，不具备后台访问权限。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: "账户管理", desc: "集中处理账号状态、角色与资料核验。" },
              { title: "商业运营", desc: "统一查看套餐、权益、卡密与积分流水。" },
              { title: "审计留痕", desc: "覆盖关键操作记录，便于复盘与合规核查。" },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
              >
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="border-slate-200/90 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 text-slate-500">
              <LockKeyhole className="h-4 w-4" />
              <span className="text-[12px] font-medium">管理员登录</span>
            </div>
            <CardTitle className="text-2xl text-slate-950">登录后台</CardTitle>
            <CardDescription className="leading-6 text-slate-600">
              请输入管理员账号。支持使用用户名或邮箱登录。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700">
                  账号
                </Label>
                <Input
                  id="username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="请输入用户名或邮箱"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="border-slate-200 bg-white text-slate-900"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">
                  密码
                </Label>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="请输入登录密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-slate-200 bg-white text-slate-900"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] leading-6 text-rose-900">
                  {error}
                </div>
              )}

              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-[13px] leading-6 text-sky-900">
                <p className="font-medium">开发环境默认账号</p>
                <p className="mt-1">平台运营：`admin / admin123`</p>
                <p>财务管理员：`finance / finance123`</p>
              </div>

              <Button type="submit" className="h-10 w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登录中…
                  </>
                ) : (
                  "进入后台"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
