import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
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
                面向账户、权益、许可证与积分运营的独立中文管理后台。
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                该站点与用户侧前端完全分离，专注于平台数据核查、租户运营、套餐权益维护与风险审计，
                更适合内部团队进行高密度信息处理和后台操作。
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
                <p className="text-sm font-medium text-slate-500">推荐角色</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">platform_operator</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  适合查看用户、租户、权益、许可证与审计数据的日常运营人员。
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-slate-950 p-5 text-slate-50 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
                <div className="flex items-center gap-2 text-sm font-medium text-sky-300">
                  <Sparkles className="h-4 w-4" />
                  部署说明
                </div>
                <p className="mt-2 text-xl font-semibold">独立运行在 `apps/admin`</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  默认开发端口为 `3001`，与面向用户的 `apps/web` 保持隔离，便于后续内网部署。
                </p>
              </div>
            </div>
          </section>

          <Card className="border-slate-200/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur">
            <CardHeader className="space-y-3">
              <CardTitle className="text-2xl text-slate-950">登录管理后台</CardTitle>
              <CardDescription className="text-base leading-7 text-slate-600">
                当前认证尚未接入，这里先作为后台入口与视觉占位页使用。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">
                  工作邮箱
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="operator@aistareco.com"
                  defaultValue="operator@aistareco.com"
                  className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">
                  登录密码
                </Label>
                <Input
                  id="password"
                  type="password"
                  defaultValue="password"
                  className="border-slate-200 bg-white text-slate-900"
                />
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                临时占位说明：待 Spring Security 管理员认证接入后，这里应对接统一身份登录流程。
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-11 flex-1 bg-slate-950 text-white hover:bg-slate-800">
                  <Link href="/dashboard">进入看板</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 flex-1 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <Link href="/users">预览用户管理</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
