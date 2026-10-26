"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ai-star-eco/ui/ui/card";
import { Input } from "@ai-star-eco/ui/ui/input";
import { Label } from "@ai-star-eco/ui/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@ai-star-eco/ui/ui/tabs";
import { AuthApi } from "@/lib/api";
import { safeStudioAdminNext } from "@/lib/app-path";

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}

function LoginForm() {
  const params = useSearchParams();
  const [source, setSource] = React.useState<"admin" | "operator">("admin");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await AuthApi.login(username.trim(), password, source);
      const next = params.get("next");
      window.location.assign(safeStudioAdminNext(next));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-svh place-items-center bg-[#f4f6fb] p-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-[#4f6692] text-white shadow-sm">
            <Sparkles className="size-5" />
          </span>
          <div><div className="font-bold text-slate-950">Studio Ops</div><div className="text-xs text-slate-500">独立只读运营后台</div></div>
        </div>
        <Card className="studio-panel gap-5 border-slate-200">
          <CardHeader>
            <CardTitle className="text-xl">登录运营后台</CardTitle>
            <CardDescription>继续使用平台已有后台身份；跨账户数据由服务端角色强制校验。</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={source} onValueChange={(value) => setSource(value as "admin" | "operator")} className="mb-5">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="admin">管理员账号</TabsTrigger>
                <TabsTrigger value="operator">平台运营账号</TabsTrigger>
              </TabsList>
            </Tabs>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-1.5"><Label htmlFor="username">账号</Label><Input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div>
              <div className="space-y-1.5"><Label htmlFor="password">密码</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
              {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <Button className="w-full" disabled={loading}><LockKeyhole className="size-4" />{loading ? "正在登录…" : "登录"}</Button>
            </form>
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs leading-5 text-slate-700">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />页面只提供查询能力，不执行补扣、退款、重跑、发布或服务器操作。
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
