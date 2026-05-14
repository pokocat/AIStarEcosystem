"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Clapperboard, KeyRound, Loader2, LogIn } from "lucide-react";
import { AuthApi, useAuth } from "@ai-star-eco/api-client";
import { STUDIO_KIND_LABEL_ZH, type StudioKind } from "@ai-star-eco/types/account";
import { Button, Card } from "@/components/premium";

function DramaLoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") || "/dashboard";
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
      {/* 背景光晕 */}
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          top: -200,
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 500,
          background: "var(--gradient-hero)",
          opacity: 0.16,
          filter: "blur(120px)",
        }}
      />
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          bottom: -180,
          left: -120,
          width: 520,
          height: 360,
          background: "var(--gradient-gold)",
          opacity: 0.1,
          filter: "blur(100px)",
        }}
      />

      <div style={{ position: "relative", zIndex: 5, width: "100%", maxWidth: 460 }}>
        {/* brand */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-md)",
                background: "var(--gradient-gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 32px rgba(212,175,106,0.25)",
              }}
            >
              <Clapperboard size={20} color="#1a1410" strokeWidth={2.4} />
            </div>
            <div style={{ textAlign: "left", lineHeight: 1.1 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "var(--tracking-tight)",
                }}
              >
                AI 短剧
              </div>
              <div className="eyebrow" style={{ fontSize: 9.5 }}>
                AI Star Eco · Cinematic
              </div>
            </div>
          </div>
          <h1
            style={{
              fontSize: 32,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              letterSpacing: "var(--tracking-tight)",
              margin: "0 0 10px",
              lineHeight: 1.15,
            }}
          >
            选择
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              {" "}经纪公司{" "}
            </span>
            登录
          </h1>
          <p style={{ fontSize: 13, color: "var(--fg-2)", maxWidth: 360, margin: "0 auto", lineHeight: 1.55 }}>
            开发模式 · 免密切换账户。每个账号对应一家经纪公司，登录后进入工作台。
          </p>
        </div>

        {/* account picker */}
        <Card glass style={{ padding: "22px 22px 18px" }}>
          {error && (
            <div
              style={{
                fontSize: 12,
                color: "var(--danger)",
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
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
                height: 96,
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
                        padding: "14px 16px",
                        borderRadius: "var(--radius-md)",
                        background: active
                          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                          : "rgba(255,255,255,0.02)",
                        border: active
                          ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                          : "1px solid var(--line)",
                        cursor: submitting ? "not-allowed" : "pointer",
                        transition: "background 160ms ease, border-color 160ms ease",
                        opacity: submitting ? 0.7 : 1,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--fg-0)",
                          marginBottom: 4,
                        }}
                      >
                        {a.studioName || a.displayName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--fg-2)",
                          fontFamily: "var(--font-mono)",
                          letterSpacing: 0.3,
                        }}
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
              </Button>
            </>
          )}

          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid var(--line)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 8 }}>手动输入用户名（调试）</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                placeholder="studio_starlight"
                disabled={submitting}
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  fontSize: 12,
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

        {/* activate link */}
        <Link
          href={{ pathname: "/activate", query: { from } }}
          style={{ display: "block", marginTop: 14 }}
        >
          <Card
            style={{
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              cursor: "pointer",
              border: "1px solid var(--line)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <KeyRound size={16} color="var(--accent)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>新用户？秘钥激活注册</div>
                <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 2 }}>
                  输入邀请秘钥即可开通经纪公司账号
                </div>
              </div>
            </div>
            <span style={{ fontSize: 11, color: "var(--accent)" }}>前往 →</span>
          </Card>
        </Link>

        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "var(--fg-3)",
            marginTop: 18,
            fontFamily: "var(--font-mono)",
            letterSpacing: 0.4,
          }}
        >
          ⚠ dev-login 仅在后端 dev profile 下启用，生产会返回 404。
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
          }}
        >
          正在加载登录页...
        </div>
      }
    >
      <DramaLoginInner />
    </React.Suspense>
  );
}
