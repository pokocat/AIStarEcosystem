"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Film,
  Layers,
  LogOut,
  PlayCircle,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { Button, Card, Chip } from "@/components/premium";

// Premium cinematic landing —— drama 子产品对外公开页。
// 视觉来源：AI IP Design Directions 03（dark + gold + glass + hero gradient）。
// 工作台落地：登录后跳 /dashboard。

const FEATURES = [
  {
    icon: Film,
    title: "演员 IP 阵容",
    body: "形象塑造、表演风格、人物档案统一治理，跨剧集复用角色资产与肖像授权。",
    accent: "var(--accent)",
  },
  {
    icon: Wand2,
    title: "脚本工坊与脑暴",
    body: "AI 辅助分场分镜、人物弧光与桥段建议，小团队也能拥有完整的创意中台。",
    accent: "var(--extra-violet)",
  },
  {
    icon: Layers,
    title: "短剧项目与分发",
    body: "项目流水线、剪辑流转、多平台投放与上线追踪，闭环短剧生意。",
    accent: "var(--info)",
  },
] as const;

const SHOWREEL = [
  { title: "《暮色未央》", role: "都市悬疑", episode: "EP01-03 上线", tone: "accent" as const },
  { title: "《盛夏来信》", role: "青春治愈", episode: "EP12 制作中", tone: "violet" as const },
  { title: "《摩天与月光》", role: "都市情感", episode: "5 月 17 日首映", tone: "info" as const },
];

export default function DramaLandingPage() {
  const { user, logout } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isLoggedIn = mounted && !!user;

  return (
    <div
      className="public-page"
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "var(--bg-0)",
        color: "var(--fg-0)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* hero 光晕 */}
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          top: -240,
          left: "50%",
          transform: "translateX(-50%)",
          width: 1200,
          height: 600,
          background: "var(--gradient-hero)",
          opacity: 0.18,
          filter: "blur(140px)",
          borderRadius: "50%",
        }}
      />
      {/* 底部金色光晕 */}
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          bottom: -180,
          right: -120,
          width: 720,
          height: 420,
          background: "var(--gradient-gold)",
          opacity: 0.1,
          filter: "blur(120px)",
          borderRadius: "50%",
        }}
      />

      {/* 顶栏 */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "16px clamp(16px, 4vw, 48px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "var(--radius-md)",
              background: "var(--gradient-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(212,175,106,0.25)",
            }}
          >
            <Clapperboard size={18} color="#1a1410" strokeWidth={2.4} />
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "var(--tracking-tight)",
                fontFamily: "var(--font-display)",
              }}
            >
              AI 短剧
            </div>
            <div className="eyebrow" style={{ fontSize: 9.5 }}>
              AI STAR ECO · 短剧工坊
            </div>
          </div>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="#trial"
            style={{
              fontSize: 13,
              color: "var(--fg-1)",
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
            }}
          >
            申请试用
          </Link>
          {isLoggedIn ? (
            <>
              <Link href="/dashboard">
                <Button variant="primary" size="md">
                  进入工作台
                  <ArrowRight size={14} />
                </Button>
              </Link>
              <button
                onClick={logout}
                title="退出登录"
                style={{
                  padding: 9,
                  borderRadius: "var(--radius-md)",
                  background: "transparent",
                  color: "var(--fg-2)",
                  border: "1px solid var(--line-2)",
                  cursor: "pointer",
                }}
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <Link href="/login?from=%2Fdashboard">
              <Button variant="primary" size="md">
                立即登录
                <ArrowRight size={14} />
              </Button>
            </Link>
          )}
        </nav>
      </header>

      {/* hero */}
      <main style={{ position: "relative", zIndex: 5 }}>
        <section
          style={{
            padding: "clamp(56px, 10vw, 96px) clamp(20px, 5vw, 48px) 64px",
            maxWidth: 1180,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--line-2)",
              background: "rgba(255,255,255,0.03)",
              marginBottom: 28,
            }}
          >
            <Sparkles size={14} color="var(--accent)" />
            <span className="mono" style={{ fontSize: 11, letterSpacing: "var(--tracking-wide)", color: "var(--fg-1)" }}>
              短剧工坊 · 2026 影视年
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(40px, 9vw, 88px)",
              lineHeight: 0.98,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              letterSpacing: "var(--tracking-tight)",
              margin: "0 0 8px",
            }}
          >
            <span style={{ display: "block" }}>把短剧</span>
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, display: "inline-block", paddingBottom: 6, color: "var(--accent)" }}>
              工业流
            </span>
            <span>，</span>
            <span style={{ display: "block", marginTop: 4 }}>搬进数字人世界</span>
          </h1>

          <p
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--fg-1)",
              maxWidth: 720,
              margin: "32px auto 12px",
            }}
          >
            演员 IP 阵容 · 脚本工坊 · 项目流水线 · 多平台分发——
            <br />
            让创作团队以更轻的人力跑出更密的内容节奏。
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 14,
              marginTop: 40,
            }}
          >
            <Link href={isLoggedIn ? "/dashboard" : "/login?from=%2Fdashboard"}>
              <Button variant="primary" size="lg">
                {isLoggedIn ? "进入工作台" : "立即登录"}
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="#showreel">
              <Button variant="secondary" size="lg">
                <PlayCircle size={16} />
                看一眼现作
              </Button>
            </Link>
          </div>
        </section>

        {/* showreel 横幅 */}
        <section
          id="showreel"
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "8px clamp(16px, 4vw, 48px) 48px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 18,
            }}
          >
            {SHOWREEL.map((s, i) => (
              <Card
                key={s.title}
                glass
                style={{
                  padding: 0,
                  overflow: "hidden",
                  position: "relative",
                  height: 220,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: [
                      "linear-gradient(135deg, rgba(212,175,106,0.25), rgba(164,76,255,0.18))",
                      "linear-gradient(135deg, rgba(164,76,255,0.3), rgba(61,224,255,0.18))",
                      "linear-gradient(135deg, rgba(61,224,255,0.22), rgba(255,61,138,0.2))",
                    ][i],
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    padding: "20px 22px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <Chip tone={s.tone}>{s.episode}</Chip>
                  <div>
                    <div className="eyebrow">{s.role}</div>
                    <div
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: 30,
                        lineHeight: 1.1,
                        marginTop: 8,
                        fontStyle: "italic",
                        color: "var(--fg-0)",
                      }}
                    >
                      {s.title}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* features */}
        <section style={{ maxWidth: 1180, margin: "0 auto", padding: "32px clamp(16px, 4vw, 48px) 96px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 18,
            }}
          >
            {FEATURES.map((f) => {
              const FIcon = f.icon;
              return (
                <Card key={f.title} style={{ padding: "28px 24px", background: "var(--bg-1)", border: "1px solid var(--line)" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md)",
                      background: `color-mix(in srgb, ${f.accent} 14%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${f.accent} 30%, transparent)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 18,
                    }}
                  >
                    <FIcon size={20} color={f.accent} />
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      fontFamily: "var(--font-display)",
                      marginBottom: 10,
                      letterSpacing: -0.1,
                    }}
                  >
                    {f.title}
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--fg-1)" }}>{f.body}</div>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      {/* footer */}
      <footer
        id="trial"
        style={{
          position: "relative",
          zIndex: 5,
          padding: "28px clamp(16px, 4vw, 48px)",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            fontSize: 12,
            color: "var(--fg-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--gradient-gold)",
              }}
            />
            <span className="mono" style={{ letterSpacing: 0.6 }}>AI STAR ECO · 短剧工业流</span>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <Link href="/" style={{ color: "var(--fg-2)" }}>产品矩阵</Link>
            <Link href={isLoggedIn ? "/dashboard" : "/login?from=%2Fdashboard"} style={{ color: "var(--fg-2)" }}>
              {isLoggedIn ? "工作台" : "登录"}
            </Link>
            <span style={{ color: "var(--fg-3)" }}>商务咨询：bd@aistareco.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
