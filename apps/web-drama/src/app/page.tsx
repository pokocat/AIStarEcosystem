"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  LayoutTemplate,
  LogOut,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { Button, Card, Chip } from "@/components/premium";

// Premium cinematic landing —— drama 子产品对外公开页。
// 视觉来源：AI IP Design Directions 03（dark + gold + glass + hero gradient）。
// 工作台落地：登录后跳 /dashboard。

// v0.197：只写现在真能用的（「多平台发布」「数据分析」还在「即将上线」，不当卖点）。
const FEATURES = [
  {
    icon: Wand2,
    title: "和 AI 聊出一部短剧",
    body: "说一个想法，AI 陪你聊出故事大纲和分集剧情，再按集拆成分镜，一镜一镜生成画面和视频，拼成完整的一集。",
    accent: "var(--accent)",
  },
  {
    icon: ClipboardList,
    title: "粘贴脚本，直接拆分镜",
    body: "手里有写好的脚本、分镜稿或 AI 视频提示词，贴进来，AI 按原文拆成分镜，做成一条短视频。拆分镜不花积分。",
    accent: "var(--extra-violet)",
  },
  {
    icon: Users,
    title: "数字人演员，每集长相一致",
    body: "在 AiAvatar（数字人平台）建好的数字人可以绑定到角色上，同一个角色换了集、换了镜头，长相都保持一致。",
    accent: "var(--info)",
  },
] as const;

// 官方模板案例 —— 真实封面取自 web-drama/public/recipes/home/*（与模板广场内置模板同源）。
const SHOWREEL = [
  {
    title: "婚礼上掏出的不是戒指",
    genre: "悬疑爱情",
    cover: "/recipes/home/wedding-missing.jpg",
    tone: "danger" as const,
  },
  {
    title: "相亲角随手指了个首富",
    genre: "甜宠爽剧",
    cover: "/recipes/home/flash-marriage.jpg",
    tone: "accent" as const,
  },
  {
    title: "重回高考前那个夏天",
    genre: "催泪青春",
    cover: "/recipes/home/exam-summer.jpg",
    tone: "info" as const,
  },
  {
    title: "一觉醒来成了王府厨娘",
    genre: "古装轻喜",
    cover: "/recipes/home/royal-kitchen-maid.jpg",
    tone: "warning" as const,
  },
  {
    title: "冷宫醒来的第一夜",
    genre: "古装权谋",
    cover: "/recipes/home/cold-palace.jpg",
    tone: "violet" as const,
  },
  {
    title: "重生进自己追的漫画",
    genre: "脑洞漫剧",
    cover: "/recipes/home/comic-rebirth.jpg",
    tone: "success" as const,
  },
];

const CONTACT_MAILTO = "mailto:bd@aistareco.com?subject=%E5%BC%80%E9%80%9A%E7%9F%AD%E5%89%A7%E5%B7%A5%E5%9D%8A";

export default function DramaLandingPage() {
  const { user, logout } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isLoggedIn = mounted && !!user;
  const templatesHref = isLoggedIn ? "/templates" : "/login?from=%2Ftemplates";

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
        className="landing-head"
        style={{
          position: "relative",
          zIndex: 10,
          padding: "14px clamp(16px, 4vw, 48px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="短剧工坊" className="landing-logo" />
        </Link>
        <nav>
          <a
            href={CONTACT_MAILTO}
            className="landing-contact"
            style={{
              fontSize: 13,
              color: "var(--fg-1)",
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
            }}
          >
            联系开通
          </a>
          {isLoggedIn ? (
            <>
              <Link href="/dashboard">
                <Button variant="primary" size="md">
                  进入工作台
                  <ArrowRight size={14} />
                </Button>
              </Link>
              <button
                type="button"
                onClick={logout}
                title="退出登录"
                aria-label="退出登录"
                style={{
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
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
                登录 / 注册
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
              短剧工坊 · AI 做短剧和短视频
            </span>
          </div>

          <h1
            className="landing-hero-title"
            style={{
              fontSize: "clamp(32px, 9vw, 88px)",
              lineHeight: 0.98,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              letterSpacing: "var(--tracking-tight)",
              margin: "0 0 8px",
            }}
          >
            <span style={{ display: "block" }}>好故事</span>
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, display: "inline-block", paddingBottom: 6, color: "var(--accent)" }}>
              值得被拍出来
            </span>
            <span>，</span>
            <span className="keep-line" style={{ display: "block", marginTop: 4 }}>哪怕只有你一个人</span>
          </h1>

          <p
            style={{
              fontSize: "clamp(15px, 2.2vw, 18px)",
              lineHeight: 1.65,
              color: "var(--fg-1)",
              maxWidth: 680,
              margin: "28px auto 12px",
              textWrap: "pretty",
            }}
          >
            说一个想法，或者贴一段写好的脚本。AI 帮你拆成分镜、定好角色，一镜一镜生成画面和视频，拼成完整的短剧或短视频。
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 36,
            }}
          >
            <Link href={isLoggedIn ? "/dashboard" : "/login?from=%2Fdashboard"}>
              <Button variant="primary" size="lg">
                {isLoggedIn ? "进入工作台" : "登录 / 注册"}
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="#showreel">
              <Button variant="secondary" size="lg">
                <LayoutTemplate size={16} />
                看看模板
              </Button>
            </Link>
          </div>
          {!isLoggedIn && (
            <p style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 16 }}>
              第一次使用需要激活码，
              <a href={CONTACT_MAILTO} style={{ color: "var(--accent)" }}>
                联系我们开通
              </a>
            </p>
          )}
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
          <div style={{ marginBottom: 24 }}>
            <div className="eyebrow">官方模板</div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(22px, 3vw, 34px)",
                lineHeight: 1.2,
                marginTop: 8,
                color: "var(--fg-0)",
                textWrap: "balance",
              }}
            >
              挑一个官方模板，改成你自己的故事
            </h2>
          </div>
          <div className="landing-reel keep-cols">
            {SHOWREEL.map((s) => (
              <Link
                key={s.title}
                href={templatesHref}
                aria-label={`${s.title}，去模板广场看看`}
                style={{ display: "block", color: "inherit", textDecoration: "none" }}
              >
              <Card
                glass
                className="landing-reel-card"
                style={{
                  padding: 0,
                  overflow: "hidden",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.cover}
                  alt={s.title}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(6,6,10,0.30) 0%, rgba(6,6,10,0.10) 38%, rgba(6,6,10,0.70) 78%, rgba(6,6,10,0.95) 100%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    padding: "clamp(12px, 3vw, 18px) clamp(12px, 3vw, 20px)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <Chip tone={s.tone} solid>
                      {s.genre}
                    </Chip>
                  </div>
                  <div style={{ textShadow: "0 1px 8px rgba(0,0,0,0.85)" }}>
                    <div
                      className="landing-reel-title"
                      style={{
                        fontFamily: "var(--font-serif)",
                        lineHeight: 1.25,
                        fontWeight: 600,
                        color: "#fff",
                      }}
                    >
                      {s.title}
                    </div>
                  </div>
                </div>
              </Card>
              </Link>
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
        id="contact"
        style={{
          position: "relative",
          zIndex: 5,
          padding: "24px clamp(16px, 4vw, 48px)",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div
          className="landing-foot"
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px 16px",
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
                flex: "none",
              }}
            />
            <span style={{ letterSpacing: 0.4 }}>短剧工坊 · AI Star Eco</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0 16px", flexWrap: "wrap" }}>
            <Link href={isLoggedIn ? "/dashboard" : "/login?from=%2Fdashboard"}>
              {isLoggedIn ? "进入工作台" : "登录"}
            </Link>
            <a href={CONTACT_MAILTO}>开通和商务合作：bd@aistareco.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
