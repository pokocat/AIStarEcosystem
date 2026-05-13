"use client";

// Creator-Friendly login — 奶油底 light mode + 紫罗兰主按钮 + 大圆角卡片。

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound, Loader2, LogIn, Megaphone, Sparkles } from "lucide-react";
import { AuthApi, useAuth } from "@ai-star-eco/api-client";
import { STUDIO_KIND_LABEL_ZH, type StudioKind } from "@ai-star-eco/types/account";
import { Button, Card } from "@/components/creator";

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
        position: "relative",
        overflow: "hidden",
        background: "var(--bg-0)",
        color: "var(--fg-0)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* 背景光斑 */}
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          top: -180,
          right: -120,
          width: 720,
          height: 720,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(124,92,255,0.16), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          bottom: -180,
          left: -120,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(255,138,91,0.14), transparent 70%)",
        }}
      />

      <div style={{ position: "relative", zIndex: 5, width: "100%", maxWidth: 480 }}>
        {/* brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 24, textDecoration: "none" }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "var(--radius-md)",
                background: "var(--gradient-violet)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <Megaphone size={20} color="#ffffff" strokeWidth={2.4} />
            </div>
            <div style={{ textAlign: "left", lineHeight: 1.1 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "var(--tracking-tight)",
                  color: "var(--fg-0)",
                }}
              >
                AI 明星带货
              </div>
              <div className="creator-eyebrow" style={{ fontSize: 9.5 }}>
                AI Star Eco · Creator
              </div>
            </div>
          </Link>
          <h1
            style={{
              fontSize: 32,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              letterSpacing: "var(--tracking-tight)",
              margin: "0 0 10px",
              lineHeight: 1.2,
              color: "var(--fg-0)",
            }}
          >
            选择
            <span
              className="creator-text-gradient"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              {" "}
              经纪公司{" "}
            </span>
            登录
          </h1>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--fg-2)",
              maxWidth: 380,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            开发模式 · 免密切换账户。每个账号对应一家经纪公司，登录后进入工作台。
          </p>
        </div>

        {/* 主卡片 */}
        <Card xl elevated style={{ padding: "28px 28px 24px" }}>
          {error && (
            <div
              style={{
                fontSize: 12.5,
                color: "var(--danger)",
                background: "color-mix(in srgb, var(--danger) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                marginBottom: 16,
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
                height: 96,
                color: "var(--fg-2)",
                fontSize: 13,
              }}
            >
              <Loader2 size={14} className="animate-spin" style={{ marginRight: 8 }} />
              载入账号中...
            </div>
          ) : accounts.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "var(--fg-2)",
                fontSize: 13,
                padding: "24px 0",
              }}
            >
              后端未种子任何 STUDIO 账户。请先启动 server（dev profile）。
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                {accounts.map((a) => {
                  const active = selected === a.username;
                  return (
                    <button
                      key={a.username}
                      onClick={() => setSelected(a.username)}
                      disabled={submitting}
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        borderRadius: "var(--radius-lg)",
                        background: active ? "var(--accent-soft)" : "var(--bg-1)",
                        border: active
                          ? "1px solid var(--accent)"
                          : "1px solid var(--line)",
                        cursor: submitting ? "not-allowed" : "pointer",
                        transition: "background 160ms ease, border-color 160ms ease",
                        opacity: submitting ? 0.7 : 1,
                        fontFamily: "var(--font-sans)",
                        boxShadow: active ? "var(--shadow-sm)" : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14.5,
                            fontWeight: 600,
                            color: "var(--fg-0)",
                          }}
                        >
                          {a.studioName || a.displayName}
                        </div>
                        {active && (
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: "var(--accent)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Sparkles size={10} color="#ffffff" />
                          </div>
                        )}
                      </div>
                      <div
                        className="creator-mono"
                        style={{ fontSize: 11.5, color: "var(--fg-2)", letterSpacing: 0.2 }}
                      >
                        @{a.username}
                        {a.studioKind && (
                          <span style={{ marginLeft: 10, color: "var(--accent)" }}>
                            · {STUDIO_KIND_LABEL_ZH[a.studioKind as StudioKind] ?? a.studioKind}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={() => handleLogin(selected)}
                disabled={submitting || !selected}
                size="lg"
                style={{ width: "100%" }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                {submitting ? "登录中..." : "登录进入"}
                {!submitting && <ArrowRight size={14} />}
              </Button>
            </>
          )}

          <div
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: "1px solid var(--line)",
            }}
          >
            <div className="creator-eyebrow" style={{ marginBottom: 10 }}>
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
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                  fontSize: 13,
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
          style={{ display: "block", marginTop: 16, textDecoration: "none" }}
        >
          <Card
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              cursor: "pointer",
              borderColor: "var(--line)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-md)",
                  background: "var(--accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <KeyRound size={16} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)" }}>
                  新用户？秘钥激活注册
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 2 }}>
                  输入邀请秘钥即可开通经纪公司账号
                </div>
              </div>
            </div>
            <ArrowRight size={14} color="var(--accent)" />
          </Card>
        </Link>

        <p
          style={{
            textAlign: "center",
            fontSize: 11.5,
            color: "var(--fg-3)",
            marginTop: 20,
            fontFamily: "var(--font-mono)",
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
