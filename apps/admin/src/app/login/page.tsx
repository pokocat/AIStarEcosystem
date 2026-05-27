"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Loader2, ShieldCheck, History, LifeBuoy, AlertCircle } from "lucide-react";
import { login, operatorLogin } from "@/api/auth";
import { getAuthToken } from "@/api/_client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LoginMode = "admin" | "operator";

function nextPathFromLocation(): string {
  if (typeof window === "undefined") return "/";
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw.startsWith("/admin/") ? raw.slice("/admin".length) || "/" : raw;
}

type Env = { label: string; tone: "production" | "staging" | "local" };

function detectEnv(): Env {
  if (typeof window === "undefined") return { label: "生产环境", tone: "production" };
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return { label: "本地开发", tone: "local" };
  }
  if (host.includes("staging") || host.includes("preview") || host.includes("test")) {
    return { label: "预发环境", tone: "staging" };
  }
  return { label: "生产环境", tone: "production" };
}

const ENV_TONE: Record<Env["tone"], { dot: string; chip: string }> = {
  production: { dot: "bg-success", chip: "border-success/30 text-success" },
  staging: { dot: "bg-warning", chip: "border-warning/40 text-warning" },
  local: { dot: "bg-info", chip: "border-info/30 text-info" },
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<LoginMode>("admin");
  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const env = React.useMemo(detectEnv, []);

  React.useEffect(() => {
    if (getAuthToken()) router.replace(nextPathFromLocation());
  }, [router]);

  // 切 tab 时清错 + 重置默认 username
  function handleModeChange(next: LoginMode) {
    setMode(next);
    setError(null);
    setUsername(next === "admin" ? "admin" : "celebrity_operator");
    setPassword("");
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const fn = mode === "operator" ? operatorLogin : login;
      await fn({ username: username.trim(), password });
      router.replace(nextPathFromLocation());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  const envClasses = ENV_TONE[env.tone];

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-[13px] tracking-tight">
              AS
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">AI Star Eco</span>
              <span className="text-xs text-muted-foreground">运营工作台</span>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border bg-surface px-2 py-0.5 text-[11px] font-medium ${envClasses.chip}`}
            title={`当前域：${typeof window !== "undefined" ? window.location.host : ""}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${envClasses.dot}`} />
            {env.label}
          </span>
        </header>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">登录到运营工作台</h1>
            <p className="text-xs text-muted-foreground">
              {mode === "admin"
                ? "管理员账号体系（admin_users 表）"
                : "v0.37：平台运营账号体系（AepUser.operatorRole，与 web-celebrity 共用账号）"}
            </p>
          </div>

          <Tabs value={mode} onValueChange={(v) => handleModeChange(v as LoginMode)} className="mb-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="admin">管理员账号</TabsTrigger>
              <TabsTrigger value="operator">平台运营账号</TabsTrigger>
            </TabsList>
          </Tabs>

          <form className="space-y-3.5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/80" htmlFor="username">
                用户名 / 邮箱
              </label>
              <Input
                id="username"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/80" htmlFor="password">
                密码
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !username.trim() || !password}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LockKeyhole className="h-4 w-4" />
              )}
              登录
            </Button>
          </form>
        </div>

        <ul className="space-y-1.5 px-1 text-[11px] leading-5 text-muted-foreground">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" />
            <span>登录及后续敏感操作将完整记录到审计日志。</span>
          </li>
          <li className="flex items-start gap-2">
            <History className="mt-0.5 h-3 w-3 shrink-0" />
            <span>会话默认 1 小时；闲置后请重新登录。</span>
          </li>
          <li className="flex items-start gap-2">
            <LifeBuoy className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              账号问题请联系{" "}
              <a className="text-foreground hover:underline" href="mailto:platform@aistar.example">
                platform@aistar.example
              </a>
              。
            </span>
          </li>
        </ul>
      </div>
    </main>
  );
}
