"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ADMIN_SESSION_COOKIE } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    document.cookie = `${ADMIN_SESSION_COOKIE}=active; path=/; max-age=28800; SameSite=Lax`;
    window.setTimeout(() => {
      router.push("/admin");
      router.refresh();
    }, 300);
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#0f172a_0%,#132a3f_52%,#0d9488_130%)] lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.26),transparent_28%),radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.08),transparent_18%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.22),transparent_24%)]" />
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 text-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-cyan-100/72">AI Star Eco</p>
              <h1 className="text-2xl font-semibold">Admin Codex</h1>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-100/70">Operator Console</p>
            <h2 className="mt-5 max-w-lg text-5xl font-semibold leading-tight">
              统一管控账号、权益、卡密、积分与平台治理节奏。
            </h2>
            <p className="mt-6 max-w-md text-base leading-8 text-slate-200/82">
              这套新后台以附录 B/C 的平台治理流程为主线，面向 SUPER_ADMIN 与 OPERATOR 的高频巡检和处置动作而设计。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
              <p className="text-sm text-cyan-100/76">当前聚焦</p>
              <p className="mt-2 text-lg font-medium">平台用户与管理员彻底分离</p>
              <p className="mt-3 text-sm leading-7 text-slate-200/74">
                支持管理员账号 CRUD、用户权益开通、人工调差积分与批次归属巡检。
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
              <p className="text-sm text-cyan-100/76">运行方式</p>
              <p className="mt-2 text-lg font-medium">独立站点，复用统一后端</p>
              <p className="mt-3 text-sm leading-7 text-slate-200/74">
                对接 `/api/admin/**`，适配内网部署、白名单访问和独立发布节奏。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10 sm:px-8 lg:px-14">
        <Card className="w-full max-w-xl border-white/70 bg-white/84 shadow-[0_28px_90px_rgba(15,23,42,0.10)] backdrop-blur">
          <CardHeader className="gap-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-900">
              <ShieldCheck className="size-3.5" />
              管理员登录
            </div>
            <CardTitle className="text-3xl">进入统一运营后台</CardTitle>
            <CardDescription className="text-sm leading-7">
              演示站点默认使用本地会话模拟登录，便于直接预览导航结构、数据面板与治理页面。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={handleLogin}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="username">管理员账号</FieldLabel>
                  <FieldContent>
                    <Input id="username" defaultValue="admin" placeholder="输入用户名" />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">密码</FieldLabel>
                  <FieldContent>
                    <Input id="password" type="password" defaultValue="admin123" placeholder="输入密码" />
                  </FieldContent>
                </Field>
              </FieldGroup>
              <div className="rounded-2xl border border-dashed border-border bg-secondary/55 p-4 text-sm leading-7 text-muted-foreground">
                默认示例账号：`admin / admin123` 或 `operator / operator123`
              </div>
              <Button className="w-full" disabled={loading} type="submit">
                <ArrowRight data-icon="inline-end" />
                {loading ? "正在进入后台…" : "登录并进入控制台"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-between text-xs text-muted-foreground">
            <span>建议在 1440px 宽度以上查看完整数据密度。</span>
            <span>Port 3002</span>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}
