"use client";

// Creator-Friendly landing —— celebrity 子产品对外公开页。
// 视觉来源：AI IP Design Directions 02（奶油底 + 紫罗兰 + 暖色点缀 + 柔阴影 + 大圆角）。
// 工作台落地：登录后跳 /console。

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  LogOut,
  Megaphone,
  Play,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Video,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { Button, Card, Chip } from "@/components/creator";

const FEATURES = [
  {
    icon: Star,
    title: "明星授权与复刻",
    body: "授权管理、形象复刻、肖像合规审计。让真人明星的 AI 表达边界清晰、可控、可审计。",
    tone: "accent" as const,
    bg: "var(--accent-soft)",
  },
  {
    icon: Video,
    title: "短视频与切片",
    body: "模板生成、分镜配音、视频中心与多平台发布一体化。工业级出片节奏，单人也能盘大盘。",
    tone: "peach" as const,
    bg: "color-mix(in srgb, var(--extra-peach) 12%, transparent)",
  },
  {
    icon: ShoppingBag,
    title: "带货与变现",
    body: "商品库、数据看板、漏斗复盘 + 钱包结算。把明星 IP 价值真正转化为可结算的 GMV。",
    tone: "lime" as const,
    bg: "color-mix(in srgb, var(--extra-lime) 20%, transparent)",
  },
];

const STATS = [
  { label: "签约明星", value: "12+", hint: "已上线 IP" },
  { label: "30 日 GMV", value: "¥8.4M", hint: "全渠道汇总" },
  { label: "短视频产出", value: "42K", hint: "本月切片数" },
  { label: "覆盖品牌", value: "168", hint: "意向 + 已签" },
];

export default function CelebrityLandingPage() {
  const { user, logout } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isLoggedIn = mounted && !!user;

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "var(--bg-0)",
        color: "var(--fg-0)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* hero 暖色光斑 */}
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          top: -180,
          left: "55%",
          width: 720,
          height: 720,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(124,92,255,0.16), transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      <div
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          top: 80,
          left: -160,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(255,138,91,0.14), transparent 70%)",
          filter: "blur(20px)",
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
          padding: "22px 48px",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              background: "var(--gradient-violet)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Megaphone size={18} color="#ffffff" strokeWidth={2.4} />
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div
              style={{
                fontSize: 17,
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

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 8px",
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-pill)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Link href="#features" style={navLink}>核心能力</Link>
          <Link href="#stats" style={navLink}>数据矩阵</Link>
          <Link href="#trial" style={navLink}>申请试用</Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isLoggedIn ? (
            <>
              <Link href="/console">
                <Button variant="primary" size="md">
                  进入工作台 <ArrowRight size={14} />
                </Button>
              </Link>
              <button
                onClick={logout}
                title="退出登录"
                style={iconBtn}
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <Link href="/login?from=%2Fconsole">
              <Button variant="primary" size="md">
                立即登录 <ArrowRight size={14} />
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* hero */}
      <main style={{ position: "relative", zIndex: 5 }}>
        <section
          style={{
            padding: "60px 48px 30px",
            maxWidth: 1180,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
            gap: 48,
            alignItems: "center",
          }}
        >
          <div>
            <Chip tone="accent">
              <Sparkles size={11} /> 2026 · 明星 IP × AI
            </Chip>
            <h1
              style={{
                fontSize: 76,
                lineHeight: 1.02,
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                letterSpacing: "var(--tracking-tight)",
                margin: "24px 0 8px",
                color: "var(--fg-0)",
              }}
            >
              让明星 IP，<br />
              成为可{" "}
              <span
                className="creator-text-gradient"
                style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
              >
                持续变现
              </span>
              <br />
              的资产。
            </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.6,
                color: "var(--fg-1)",
                maxWidth: 520,
                marginTop: 24,
                marginBottom: 32,
              }}
            >
              授权管理 · 形象复刻 · 短视频工坊 · 直播 + 切片分发 · 商品与结算。
              一站串通授权方、品牌方、MCN 的全链路营销动作，让明星价值在合规边界内被持续放大。
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <Link href={isLoggedIn ? "/console" : "/login?from=%2Fconsole"}>
                <Button variant="primary" size="lg">
                  {isLoggedIn ? "进入工作台" : "立即开始"} <ArrowRight size={16} />
                </Button>
              </Link>
              <Link href="#showcase">
                <Button variant="secondary" size="lg">
                  <Play size={14} /> 看一眼现作
                </Button>
              </Link>
            </div>
          </div>

          {/* 右侧：视觉拼贴 */}
          <div style={{ position: "relative", height: 460 }}>
            <Card
              xl
              elevated
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 280,
                height: 360,
                padding: 0,
                overflow: "hidden",
                transform: "rotate(3deg)",
              }}
            >
              <div
                style={{
                  height: 280,
                  background: "var(--gradient-violet)",
                  position: "relative",
                }}
              >
                <div style={{ position: "absolute", top: 14, left: 14 }}>
                  <Chip solid tone="lime">
                    HOT
                  </Chip>
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 14,
                    left: 16,
                    right: 16,
                    color: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    刘涛 · 都市精英
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                    本周 GMV ¥1.82M
                  </div>
                </div>
              </div>
              <div style={{ padding: "14px 18px" }}>
                <div className="creator-eyebrow" style={{ fontSize: 9.5 }}>已授权 · 直播 + 短视频</div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--fg-1)",
                    marginTop: 6,
                    fontFamily: "var(--font-serif)",
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}
                >
                  "把同款风格直接切给抖音矩阵。"
                </div>
              </div>
            </Card>

            <Card
              xl
              elevated
              style={{
                position: "absolute",
                top: 80,
                left: 0,
                width: 240,
                height: 280,
                padding: 0,
                overflow: "hidden",
                transform: "rotate(-4deg)",
              }}
            >
              <div
                style={{
                  height: 200,
                  background: "var(--gradient-peach)",
                  position: "relative",
                }}
              >
                <div style={{ position: "absolute", top: 14, left: 14 }}>
                  <Chip tone="info">实时</Chip>
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 14,
                    left: 16,
                    right: 16,
                    color: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    沈腾 · 综艺向
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>
                    32 条切片在投
                  </div>
                </div>
              </div>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div className="creator-eyebrow" style={{ fontSize: 9.5 }}>本月转化</div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: "var(--font-display)",
                      color: "var(--accent)",
                    }}
                  >
                    +24%
                  </div>
                </div>
              </div>
            </Card>

            <Card
              elevated
              style={{
                position: "absolute",
                bottom: 30,
                right: 60,
                width: 220,
                padding: "14px 16px",
                transform: "rotate(2deg)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--gradient-violet)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-0)" }}>
                    新品上线
                  </div>
                  <div className="creator-mono" style={{ fontSize: 10, color: "var(--fg-2)", marginTop: 2 }}>
                    11:24 · ¥199 SKU
                  </div>
                </div>
                <Chip tone="success">已签</Chip>
              </div>
            </Card>
          </div>
        </section>

        {/* 数据矩阵 */}
        <section
          id="stats"
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "32px 48px 48px",
          }}
        >
          <Card
            xl
            style={{
              padding: "32px 36px",
              background: "var(--bg-1)",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 32,
            }}
          >
            {STATS.map((s, i) => (
              <div key={s.label}>
                <div className="creator-eyebrow">{s.label}</div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    fontFamily: "var(--font-display)",
                    letterSpacing: "var(--tracking-tight)",
                    color: i === 0 ? "var(--accent)" : "var(--fg-0)",
                    marginTop: 8,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
                <div
                  className="creator-mono"
                  style={{
                    fontSize: 11,
                    color: "var(--fg-2)",
                    marginTop: 8,
                    letterSpacing: 0.3,
                  }}
                >
                  {s.hint}
                </div>
              </div>
            ))}
          </Card>
        </section>

        {/* features */}
        <section
          id="features"
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "32px 48px 64px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32 }}>
            <div>
              <div className="creator-eyebrow">核心能力</div>
              <h2
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "var(--tracking-tight)",
                  margin: "10px 0 0",
                  color: "var(--fg-0)",
                }}
              >
                三个动作，跑通{" "}
                <span
                  className="creator-text-gradient"
                  style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
                >
                  整个 IP
                </span>{" "}
                生意。
              </h2>
            </div>
            <Link
              href="#trial"
              style={{
                fontSize: 13,
                color: "var(--accent)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "var(--font-mono)",
                letterSpacing: 0.3,
                textDecoration: "none",
              }}
            >
              申请试用 <ArrowUpRight size={12} />
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} xl elevated style={{ padding: "28px 26px" }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "var(--radius-lg)",
                      background: f.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 20,
                    }}
                  >
                    <Icon size={22} color={`var(--${f.tone === "lime" ? "extra-lime" : f.tone === "peach" ? "extra-peach" : "accent"})`} />
                  </div>
                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 700,
                      fontFamily: "var(--font-display)",
                      letterSpacing: -0.2,
                      marginBottom: 10,
                      color: "var(--fg-0)",
                    }}
                  >
                    {f.title}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: "var(--fg-1)",
                    }}
                  >
                    {f.body}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section
          id="trial"
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 48px 64px",
          }}
        >
          <Card
            xl
            style={{
              padding: "48px 52px",
              background: "var(--gradient-violet)",
              border: "none",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 32,
            }}
          >
            <div>
              <div className="creator-eyebrow" style={{ color: "rgba(255,255,255,0.75)" }}>
                Ready when you are
              </div>
              <h3
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "var(--tracking-tight)",
                  margin: "10px 0 8px",
                  color: "#ffffff",
                }}
              >
                把明星 IP 接入 AI Star Eco
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.85)",
                  margin: 0,
                  maxWidth: 460,
                  lineHeight: 1.6,
                }}
              >
                联系商务团队开通授权方专属工作台，预计 1 个工作日内完成对接。
              </p>
            </div>
            <Link href={isLoggedIn ? "/console" : "/login?from=%2Fconsole"}>
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 28px",
                  fontSize: 14.5,
                  fontWeight: 600,
                  fontFamily: "var(--font-sans)",
                  background: "#ffffff",
                  color: "var(--accent-strong)",
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  cursor: "pointer",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                {isLoggedIn ? "进入工作台" : "立即开始"} <ArrowRight size={16} />
              </button>
            </Link>
          </Card>
        </section>
      </main>

      {/* footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 5,
          maxWidth: 1180,
          margin: "0 auto",
          padding: "20px 48px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12.5,
          color: "var(--fg-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--gradient-violet)",
            }}
          />
          <span className="creator-mono" style={{ letterSpacing: 0.4 }}>
            AI STAR ECO · CELEBRITY COMMERCE
          </span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/" style={{ color: "var(--fg-2)", textDecoration: "none" }}>
            产品矩阵
          </Link>
          <Link
            href={isLoggedIn ? "/console" : "/login?from=%2Fconsole"}
            style={{ color: "var(--fg-2)", textDecoration: "none" }}
          >
            {isLoggedIn ? "工作台" : "登录"}
          </Link>
          <span style={{ color: "var(--fg-3)" }}>商务咨询：bd@aistareco.com</span>
        </div>
      </footer>
    </div>
  );
}

const navLink: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: 12.5,
  color: "var(--fg-1)",
  borderRadius: "var(--radius-pill)",
  textDecoration: "none",
  fontWeight: 500,
};

const iconBtn: React.CSSProperties = {
  padding: 9,
  borderRadius: "50%",
  background: "var(--bg-1)",
  border: "1px solid var(--line)",
  color: "var(--fg-2)",
  cursor: "pointer",
  boxShadow: "var(--shadow-sm)",
};
