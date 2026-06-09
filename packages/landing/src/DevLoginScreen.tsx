"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Loader2, KeyRound, type LucideIcon } from "lucide-react";
import { AuthApi, useAuth } from "@ai-star-eco/api-client";
import { STUDIO_KIND_LABEL_ZH, type StudioKind } from "@ai-star-eco/types/account";

export interface DevLoginScreenProps {
  /** 顶栏品牌字，例 "AI 音乐人"。 */
  label: string;
  /** Lucide icon constructor，作品牌 mark。 */
  icon: LucideIcon;
  /**
   * Tailwind 渐变 token，例 "from-violet-500 via-fuchsia-500 to-purple-600"。
   * 用于主按钮 / 品牌字渐变。
   */
  accentGradient: string;
  /** 渐变对应的强调文字色，例 "text-fuchsia-300"。 */
  accentText: string;
  /**
   * 选中账号时给 button 的 className（边框 / 背景 / ring 任意 Tailwind 类）。
   * 不传走中性白色高亮。注意：Tailwind v4 source(none) 不扫描运行时拼接的
   * 类名，必须传完整字面量（如 "border-fuchsia-400/40 bg-fuchsia-500/10"）。
   */
  selectedClassName?: string;
  /**
   * 登录成功后的 fallback 路径。若 URL 上带 `?from=`，优先使用 query。
   * 不传则回退到 "/"。
   */
  defaultPostLoginPath?: string;
}

function DevLoginScreenInner({
  label,
  icon: Icon,
  accentGradient,
  accentText,
  selectedClassName = "border-white/40 bg-white/[0.06]",
  defaultPostLoginPath = "/",
}: DevLoginScreenProps) {
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") || defaultPostLoginPath;
  const { loginAs, user } = useAuth();

  const [accounts, setAccounts] = React.useState<AuthApi.DevAccount[] | null>(null);
  const [selected, setSelected] = React.useState<string>("");
  const [manualUsername, setManualUsername] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) router.replace(from);
  }, [user, from, router]);

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
      router.replace(from);
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
            <Icon className={`w-6 h-6 ${accentText}`} />
            <span
              className={`text-xl font-bold tracking-tight bg-gradient-to-r ${accentGradient} bg-clip-text text-transparent`}
            >
              {label}
            </span>
          </div>
          <h1
            className="text-2xl font-extrabold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            选择经纪公司登录
          </h1>
          <p className="text-sm text-gray-500 font-light">
            内部体验入口。每个账号对应一家经纪公司，登录后进入工作台。
          </p>
        </div>

        <div className="rounded-2xl bg-gray-900/60 border border-white/5 p-5 space-y-4">
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
              当前没有可用的内部验证账号，请改用手机号登录或联系管理员。
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
                        ? selectedClassName
                        : "bg-white/[0.02] border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {a.studioName || a.displayName}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        @{a.username}
                        {a.studioKind && (
                          <span className={`ml-2 opacity-70 ${accentText}`}>
                            ·{" "}
                            {STUDIO_KIND_LABEL_ZH[a.studioKind as StudioKind] ??
                              a.studioKind}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleLogin(selected)}
                disabled={submitting || !selected}
                className={`w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-lg bg-gradient-to-r ${accentGradient} hover:opacity-90 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                {submitting ? "登录中..." : "登录进入"}
              </button>
            </>
          )}

          <div className="pt-3 border-t border-white/5 space-y-2">
            <div className="text-[11px] text-gray-500">输入授权账号</div>
            <div className="flex items-center gap-2">
              <input
                value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                placeholder="studio_starlight"
                disabled={submitting}
                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none"
              />
              <button
                onClick={() => handleLogin(manualUsername.trim() || undefined)}
                disabled={submitting}
                className="px-3 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-xs transition disabled:opacity-50"
              >
                登录
              </button>
            </div>
          </div>
        </div>

        <Link
          href={{ pathname: "/activate", query: { from } }}
          className="block"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition">
            <div className="flex items-center gap-2 min-w-0">
              <KeyRound className={`w-4 h-4 ${accentText} shrink-0`} />
              <div className="min-w-0">
                <div className="text-sm font-semibold">新用户？秘钥激活注册</div>
                <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                  输入邀请秘钥即可开通经纪公司账号
                </div>
              </div>
            </div>
            <span className={`text-xs ${accentText} shrink-0`}>前往 →</span>
          </div>
        </Link>

        <p className="text-[11px] text-gray-600 text-center font-light">
          内部体验入口仅面向已授权验证，正式账号请使用手机号登录。
        </p>
      </div>
    </div>
  );
}

export function DevLoginScreen(props: DevLoginScreenProps) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-500">
          正在加载登录页...
        </div>
      }
    >
      <DevLoginScreenInner {...props} />
    </React.Suspense>
  );
}
