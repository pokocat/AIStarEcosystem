"use client";

// Creator-Friendly login —— 严格按参考图：紧凑卡片 + 黑色 dark 按钮 + serif 斜体点睛 + 多色 chip。

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound, Loader2, LogIn } from "lucide-react";
import { AuthApi, useAuth } from "@ai-star-eco/api-client";
import { STUDIO_KIND_LABEL_ZH, type StudioKind } from "@ai-star-eco/types/account";
import { Avatar, Button, Card, Chip } from "@/components/creator";

function CelebrityLoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") || "/console";
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
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-0)",
        color: "var(--fg-0)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                background: "var(--accent)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: 14,
                color: "#fff",
              }}
            >
              iP
            </div>
            <div style={{ textAlign: "left", lineHeight: 1.15 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--fg-0)" }}>
                AI 明星带货
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--fg-2)", letterSpacing: 0.4 }}>
                AI Star Eco · Celebrity
              </div>
            </div>
          </Link>
          <h1
            style={{
              fontSize: 28,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              letterSpacing: "var(--tracking-tight)",
              margin: "0 0 8px",
              lineHeight: 1.25,
              color: "var(--fg-0)",
            }}
          >
            选择
            <span className="serif-italic" style={{ color: "var(--accent)", margin: "0 6px" }}>
              经纪公司
            </span>
            登录
          </h1>
          <p style={{ fontSize: 13, color: "var(--fg-2)", maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
            开发模式 · 免密切换账户。每个账号对应一家经纪公司，登录后进入工作台。
          </p>
        </div>

        {/* 主卡 */}
        <Card style={{ padding: "22px 22px 18px" }}>
          {error && (
            <div
              style={{
                fontSize: 12.5,
                color: "var(--danger)",
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          {!accounts ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 88,
                color: "var(--fg-2)",
                fontSize: 13,
              }}
            >
              <Loader2 size={14} className="animate-spin" style={{ marginRight: 8 }} />
              载入账号中...
            </div>
          ) : accounts.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--fg-2)", fontSize: 13, padding: "24px 0" }}>
              后端未种子任何 STUDIO 账户。请先启动 server（dev profile）。
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {accounts.map((a) => {
                  const active = selected === a.username;
                  return (
                    <button
                      key={a.username}
                      onClick={() => setSelected(a.username)}
                      disabled={submitting}
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        borderRadius: "var(--radius-md)",
                        background: active ? "var(--accent-soft)" : "var(--bg-1)",
                        border: active
                          ? "1px solid var(--accent)"
                          : "1px solid var(--line)",
                        cursor: submitting ? "not-allowed" : "pointer",
                        transition: "background 120ms, border-color 120ms",
                        opacity: submitting ? 0.7 : 1,
                        fontFamily: "var(--font-sans)",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Avatar seed={a.username} size={32} shape="square" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)" }}>
                          {a.studioName || a.displayName}
                        </div>
                        <div
                          className="mono"
                          style={{ fontSize: 10.5, color: "var(--fg-2)", letterSpacing: 0.3, marginTop: 2 }}
                        >
                          @{a.username}
                        </div>
                      </div>
                      {a.studioKind && (
                        <Chip tone={active ? "accent" : "neutral"} size="sm">
                          {STUDIO_KIND_LABEL_ZH[a.studioKind as StudioKind] ?? a.studioKind}
                        </Chip>
                      )}
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={() => handleLogin(selected)}
                disabled={submitting || !selected}
                variant="dark"
                size="lg"
                style={{ width: "100%" }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                {submitting ? "登录中..." : "登录进入"}
                {!submitting && <ArrowRight size={14} />}
              </Button>
            </>
          )}

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              手动输入用户名（调试）
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                placeholder="studio_starlight"
                disabled={submitting}
                style={{
                  flex: 1,
                  background: "var(--bg-2)",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--radius-md)",
                  padding: "9px 12px",
                  fontSize: 12.5,
                  color: "var(--fg-0)",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
              <Button
                variant="secondary"
                size="md"
                onClick={() => handleLogin(manualUsername.trim() || undefined)}
                disabled={submitting}
              >
                登录
              </Button>
            </div>
          </div>
        </Card>

        {/* 激活入口 */}
        <Link
          href={{ pathname: "/activate", query: { from } }}
          style={{ display: "block", marginTop: 14, textDecoration: "none" }}
        >
          <Card style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--radius-md)",
                  background: "var(--accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <KeyRound size={15} color="var(--accent)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)" }}>
                  新用户？秘钥激活注册
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 2 }}>
                  输入邀请秘钥即可开通经纪公司账号
                </div>
              </div>
              <ArrowRight size={14} color="var(--accent)" />
            </div>
          </Card>
        </Link>

        <p
          className="mono"
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "var(--fg-3)",
            marginTop: 16,
            letterSpacing: 0.3,
          }}
        >
          dev-login 仅在后端 dev profile 下启用，生产会返回 404。
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-0)",
            color: "var(--fg-2)",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
          }}
        >
          正在加载登录页...
        </div>
      }
    >
      <CelebrityLoginInner />
    </React.Suspense>
  );
}
