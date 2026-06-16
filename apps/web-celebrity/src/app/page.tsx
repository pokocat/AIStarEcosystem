"use client";

// web-celebrity landing: AI 数字人明星带货首页。
// 只展示虚拟角色资产，避免真实艺人、假精确数据和伪截图式预览。

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FileCheck2,
  KeyRound,
  LogOut,
  Quote,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Video,
  Wand2,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { Button, Card, Chip } from "@/components/creator";

const FEATURES = [
  {
    icon: Star,
    title: "虚拟代言人资产库",
    body: "按品类、人设和内容风格管理 AI 数字明星，统一记录可用范围、商品边界和合成标识。",
  },
  {
    icon: Video,
    title: "短视频智能生产",
    body: "把商品卖点转成口播、剧情和混剪脚本，再沉淀成可复用模板，减少反复搬运素材。",
  },
  {
    icon: ShoppingBag,
    title: "分发和数据回流",
    body: "按角色、商品、模板和渠道拆分复盘，让内容团队知道哪些人设和素材值得继续加码。",
  },
];

// 业务主线 5 步
const PIPELINE = [
  { n: 1, icon: Search,      title: "AI数字明星就位", desc: "24小时带货不停播",                               tone: "violet" as const },
  { n: 2, icon: KeyRound,    title: "定边界",   desc: "配置商品类目、使用范围、合成标识和审核规则。",          tone: "rose"   as const },
  { n: 3, icon: Wand2,       title: "出脚本",   desc: "围绕商品卖点生成口播、剧情和混剪脚本。",                tone: "peach"  as const },
  { n: 4, icon: Sparkles,    title: "出成片",   desc: "套用模板生成多版素材，保留审核和修改记录。",            tone: "amber"  as const },
  { n: 5, icon: ShoppingBag, title: "做复盘",   desc: "按角色、商品和渠道回看表现，沉淀下一轮素材。",          tone: "teal"   as const },
];

const SHOWCASE = [
  {
    id: "shen-xinglan",
    title: "沈星澜 · 美妆生活",
    chip: { tone: "romance" as const, label: "美妆" },
    meta: "AI 虚拟明星 · 高端美妆种草",
    imageUrl: "/ai-stars/shen-xinglan.jpg",
  },
  {
    id: "lin-lubai",
    title: "林鹿白 · 健康家用",
    chip: { tone: "slice" as const, label: "生活" },
    meta: "AI 虚拟明星 · 家庭健康场景",
    imageUrl: "/ai-stars/lin-lubai.jpg",
  },
  {
    id: "gu-ran",
    title: "顾燃 · 潮流运动",
    chip: { tone: "comedy" as const, label: "运动" },
    meta: "AI 虚拟明星 · 潮流运动装备",
    imageUrl: "/ai-stars/gu-ran.jpg",
  },
];

const HERO_STAR = {
  id: "shen-xinglan",
  name: "沈星澜",
  category: "AI 数字人明星",
  imageUrl: "/ai-stars/shen-xinglan.jpg",
};

const AUDIENCES: { id: string; tag: string; name: string }[] = [
  { id: "brand", tag: "品牌", name: "品牌市场" },
  { id: "mcn", tag: "制作", name: "MCN 团队" },
  { id: "agent", tag: "经纪", name: "经纪团队" },
  { id: "review", tag: "合规", name: "内容审核" },
  { id: "commerce", tag: "电商", name: "电商运营" },
  { id: "media", tag: "投放", name: "渠道投放" },
];

const WORKFLOW_BENEFITS = [
  { value: "少搬运", label: "脚本到成片", delta: "商品、角色、模板在同一条工作流里流转。" },
  { value: "少返工", label: "审核前置", delta: "角色边界和合成标识在生成前就被约束。" },
  { value: "可复盘", label: "渠道回流", delta: "每条素材能追到角色、商品、模板和分发批次。" },
];

const COMPLIANCE_CERTS = [
  { icon: ShieldCheck, title: "角色使用边界", desc: "每个数字人绑定可用行业、商品类目和投放范围。" },
  { icon: FileCheck2,  title: "合成内容标识", desc: "水印、片头提示和元数据留痕可按渠道策略配置。" },
  { icon: TrendingUp,  title: "审核记录留存", desc: "脚本、素材、成片和发布批次保留操作记录。" },
  { icon: Star,        title: "素材归因复盘", desc: "按角色、商品、模板和渠道拆分内容表现。" },
];

const WORKSPACE_AREAS = [
  { label: "角色资产", body: "集中管理人设、声线、可用类目和投放边界。" },
  { label: "商品脚本", body: "从商品卖点生成口播、剧情和混剪脚本。" },
  { label: "成片审核", body: "保留素材来源、修改记录和合成内容标识。" },
  { label: "渠道复盘", body: "按角色、模板、商品和渠道回看内容表现。" },
];

export default function CelebrityLandingPage() {
  const { user, logout } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isLoggedIn = mounted && !!user;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--fg-0)", fontFamily: "var(--font-sans)" }}>
      {/* 顶栏 */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          background: "var(--bg-0)",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/brand/logo.svg" alt="AI 明星带货" style={{ height: 42, width: "auto", display: "block" }} />
        </Link>

        <nav className="hidden md:flex" style={{ alignItems: "center", gap: 28 }}>
          <Link href="#pipeline" style={navLink}>业务主线</Link>
          <Link href="#features" style={navLink}>核心能力</Link>
          <Link href="#showcase" style={navLink}>角色库</Link>
          <Link href="#trial" style={navLink}>开始合作</Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLoggedIn ? (
            <>
              <Link href="/dashboard">
                <Button variant="dark" size="sm">进入工作台</Button>
              </Link>
              <Button
                variant="icon"
                size="sm"
                onClick={logout}
                aria-label="退出登录"
                title="退出登录"
                style={{ width: 32, padding: 0 }}
              >
                <LogOut size={12} />
              </Button>
            </>
          ) : (
            <>
              <Link href="/login?from=%2Fdashboard">
                <Button variant="secondary" size="sm">登录</Button>
              </Link>
              <Link href="/login?from=%2Fdashboard">
                <Button variant="accent" size="sm">预约咨询</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <main>
        {/* hero */}
        <section
          className="stack-mobile"
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "60px 32px 48px",
            display: "grid",
            gridTemplateColumns: "1.25fr 1fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            <div className="eyebrow">AI 数字人带货平台</div>
            <h1
              style={{
                fontSize: "clamp(40px, 5vw, 56px)",
                lineHeight: 1.1,
                fontWeight: 700,
                letterSpacing: "var(--tracking-tight)",
                fontFamily: "var(--font-display)",
                margin: "16px 0 18px",
                color: "var(--fg-0)",
                maxWidth: 680,
              }}
            >
              {"AI数字明星就位，"}
              <span className="serif-italic" style={{ color: "var(--accent)", fontSize: "inherit", lineHeight: 1.14 }}>
                24小时带货不停播
              </span>
            </h1>
            <p
              style={{
                fontSize: 15.5,
                lineHeight: 1.7,
                color: "var(--fg-1)",
                maxWidth: 540,
                marginBottom: 28,
              }}
            >
              为品牌和 MCN 提供虚拟代言人、脚本、成片与分发协同，降低拍摄排期和跨团队沟通成本。
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href={isLoggedIn ? "/dashboard" : "/login?from=%2Fdashboard"}>
                <Button variant="dark" size="lg">
                  {isLoggedIn ? "进入工作台" : "预约咨询"}
                </Button>
              </Link>
              <Link href="#showcase">
                <Button variant="secondary" size="lg">查看角色库</Button>
              </Link>
            </div>
          </div>

          {/* 右侧:AI 数字人明星资产包 */}
          <Card style={{ padding: 14, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.35fr 0.8fr",
                gap: 10,
                minHeight: 300,
              }}
              className="stack-mobile"
            >
              <div
                style={{
                  minHeight: 300,
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--ink)",
                  overflow: "hidden",
                }}
              >
                <img
                  src={HERO_STAR.imageUrl}
                  alt={`${HERO_STAR.name}，${HERO_STAR.category}`}
                  loading="eager"
                  fetchPriority="high"
                  style={{ width: "100%", height: "100%", minHeight: 300, display: "block", objectFit: "cover", objectPosition: "center 24%" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 10 }}>
                {SHOWCASE.slice(1).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--ink)",
                      overflow: "hidden",
                      minHeight: 145,
                    }}
                    aria-label={s.title}
                  >
                    <img
                      src={s.imageUrl}
                      alt={s.title}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", minHeight: 145, display: "block", objectFit: "cover", objectPosition: "center 22%" }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "20px 8px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "var(--fg-0)",
                    fontFamily: "var(--font-display)",
                    letterSpacing: "var(--tracking-tight)",
                  }}
                >
                  AI 数字人资产包
                </div>
                <Chip tone="published" size="sm">已上线</Chip>
              </div>
              <p
                style={{
                  fontSize: 13.5,
                  color: "var(--fg-1)",
                  lineHeight: 1.65,
                  margin: 0,
                  marginBottom: 14,
                }}
              >
                角色人设、商品边界、合成标识和分发权限集中管理，制作人可以直接从资产包进入脚本和成片流程。
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Chip tone="romance" size="sm">{HERO_STAR.name}</Chip>
                <Chip tone="slice" size="sm">角色边界</Chip>
                <Chip tone="comedy" size="sm">合成标识</Chip>
                <Chip tone="drama" size="sm">内容分发</Chip>
              </div>
            </div>
          </Card>
        </section>

        {/* 适配团队与渠道 */}
        <section
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "8px 32px 24px",
          }}
        >
          <div
            className="stack-mobile"
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 32,
              alignItems: "center",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--fg-2)",
                letterSpacing: 0.6,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              适配团队和渠道
            </span>
            <div
              style={{
                display: "flex",
                gap: 18,
                alignItems: "center",
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
              aria-label="适配团队"
            >
              {AUDIENCES.map((p) => (
                <div
                  key={p.id}
                  title={p.name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-1)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--fg-1)",
                      letterSpacing: 0.6,
                    }}
                  >
                    {p.tag}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--fg-2)", fontFamily: "var(--font-sans)" }}>
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* showcase 多色卡 */}
        <section id="showcase" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 32px 48px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                letterSpacing: "var(--tracking-tight)",
                margin: 0,
                color: "var(--fg-0)",
              }}
            >
              已上线的{" "}
              <span className="serif-italic" style={{ color: "var(--accent)" }}>
                AI 虚拟明星
              </span>
            </h2>
            <Link
              href="/login?from=%2Fmarket"
              style={{
                fontSize: 12,
                color: "var(--accent)",
                fontFamily: "var(--font-mono)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                textDecoration: "none",
                letterSpacing: 0.4,
              }}
            >
              查看全部 <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {SHOWCASE.map((s) => (
              <Card
                key={s.id}
                title={`${s.title} · ${s.meta}`}
                style={{ padding: 0, overflow: "hidden" }}
              >
                <div
                  style={{
                    height: 220,
                    backgroundColor: "var(--ink)",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={s.imageUrl}
                    alt={s.title}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", display: "block", objectFit: "cover", objectPosition: "center 28%" }}
                  />
                </div>
                <div style={{ padding: "16px 18px 18px" }}>
                  <Chip tone={s.chip.tone} size="sm">{s.chip.label}</Chip>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-0)", marginTop: 10, letterSpacing: "var(--tracking-tight)" }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 6, lineHeight: 1.55 }}>
                    {s.meta}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* 落地流程 */}
        <section
          id="case-study"
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "32px 32px 48px",
            }}
          >
            <Card
              className="stack-mobile"
              style={{
                padding: 0,
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: "1.1fr 1fr",
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ padding: "44px 44px 40px", borderRight: "1px solid var(--line)" }}>
              <Quote size={28} color="var(--accent)" strokeWidth={1.5} style={{ marginBottom: 12 }} />
              <blockquote
                className="serif-italic"
                style={{
                  fontSize: 24,
                  lineHeight: 1.4,
                  color: "var(--fg-0)",
                  margin: "0 0 22px",
                  fontWeight: 400,
                  letterSpacing: "var(--tracking-tight)",
                }}
              >
                从角色设定到渠道复盘，制作人不再在脚本、素材、审核和发布系统之间来回搬运。
              </blockquote>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--fg-2)",
                  fontFamily: "var(--font-sans)",
                  letterSpacing: 0.2,
                }}
              >
                适合需要稳定产出带货短视频的品牌和 MCN 团队。
              </div>
            </div>
            <div
              style={{
                padding: "44px 44px 40px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 28,
                background: "var(--bg-2)",
              }}
            >
              {WORKFLOW_BENEFITS.map((m) => (
                <div key={m.label}>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: "var(--fg-2)",
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 600,
                      color: "var(--fg-0)",
                      fontFamily: "var(--font-display)",
                      letterSpacing: "var(--tracking-tight)",
                      lineHeight: 1,
                      marginBottom: 4,
                    }}
                  >
                    {m.value}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.45 }}>
                    {m.delta}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* 5 步业务主线 */}
        <section id="pipeline" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 32px 64px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                letterSpacing: "var(--tracking-tight)",
                margin: 0,
                color: "var(--fg-0)",
                maxWidth: 640,
              }}
            >
              五步跑通{" "}
              <span className="serif-italic" style={{ color: "var(--accent)" }}>
                数字人带货闭环
              </span>
              。
            </h2>
            <Link
              href="#features"
              style={{
                fontSize: 12,
                color: "var(--accent)",
                fontFamily: "var(--font-mono)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                textDecoration: "none",
                letterSpacing: 0.4,
              }}
            >
              核心能力 <ArrowUpRight size={12} />
            </Link>
          </div>
          <ol
            className="stack-mobile"
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            {PIPELINE.map((p, idx) => {
              const Icon = p.icon;
              const colorVar = {
                violet: "var(--accent)",
                rose: "var(--extra-rose)",
                peach: "var(--extra-peach)",
                amber: "var(--extra-amber)",
                teal: "var(--extra-teal)",
              }[p.tone];
              return (
                <li
                  key={p.n}
                  style={{
                    padding: "26px 20px 28px",
                    borderRight: idx < PIPELINE.length - 1 ? "1px solid var(--line)" : "none",
                    position: "relative",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-md)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `color-mix(in srgb, ${colorVar} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${colorVar} 22%, transparent)`,
                      marginBottom: 18,
                    }}
                  >
                    <Icon size={17} color={colorVar} strokeWidth={1.75} />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--fg-0)",
                      fontFamily: "var(--font-display)",
                      marginBottom: 10,
                    }}
                  >
                    {p.title}
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.6, margin: 0 }}>{p.desc}</p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* features */}
        <section id="features" style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 32px 56px" }}>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 600,
              fontFamily: "var(--font-display)",
              letterSpacing: "var(--tracking-tight)",
              margin: "0 0 32px",
              color: "var(--fg-0)",
              maxWidth: 640,
            }}
          >
            三大核心能力，打通{" "}
            <span className="serif-italic" style={{ color: "var(--accent)" }}>
              虚拟代言人全链路
            </span>
            。
          </h2>
          <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16 }}>
            {FEATURES.map((f, idx) => {
              const Icon = f.icon;
              const isHero = idx === 0;
              return (
                <Card
                  key={f.title}
                  style={{
                    padding: isHero ? "32px 28px" : "26px 22px",
                    background: isHero ? "var(--bg-1)" : "var(--bg-2)",
                    border: isHero ? "1px solid var(--line-2)" : "1px solid var(--line)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <Icon
                    size={isHero ? 22 : 18}
                    color="var(--accent)"
                    strokeWidth={1.75}
                  />
                  <div
                    style={{
                      fontSize: isHero ? 19 : 15.5,
                      fontWeight: 600,
                      color: "var(--fg-0)",
                      fontFamily: "var(--font-display)",
                      letterSpacing: "var(--tracking-tight)",
                      lineHeight: 1.25,
                    }}
                  >
                    {f.title}
                  </div>
                  <div
                    style={{
                      fontSize: isHero ? 14 : 13,
                      color: "var(--fg-2)",
                      lineHeight: 1.7,
                      marginTop: "auto",
                    }}
                  >
                    {f.body}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 合规与工作区 */}
        <section
          id="trust"
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "32px 32px 56px",
          }}
        >
          <div
            className="stack-mobile"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "var(--tracking-tight)",
                  margin: "0 0 24px",
                  color: "var(--fg-0)",
                }}
              >
                合规治理，
                <span style={{ color: "var(--accent)" }}> 从源头可信</span>
              </h2>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 14,
                }}
              >
                {COMPLIANCE_CERTS.map((c) => {
                  const CIcon = c.icon;
                  return (
                    <li
                      key={c.title}
                      style={{
                        padding: "18px 18px",
                        borderRadius: "var(--radius-md)",
                        background: "var(--bg-1)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <CIcon size={18} color="var(--accent)" strokeWidth={1.75} />
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "var(--fg-0)",
                          fontFamily: "var(--font-display)",
                          marginTop: 10,
                          marginBottom: 6,
                          letterSpacing: "var(--tracking-tight)",
                        }}
                      >
                        {c.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
                        {c.desc}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "var(--tracking-tight)",
                  margin: "0 0 24px",
                  color: "var(--fg-0)",
                }}
              >
                运营工作区，
                <span style={{ color: "var(--accent)" }}> 一条线协作</span>
              </h2>
              <Card
                style={{
                  padding: "24px 24px",
                  background: "var(--ink)",
                  border: "1px solid var(--ink)",
                  color: "#fff",
                }}
              >
                <p style={{ margin: "0 0 20px", color: "rgba(255,255,255,0.72)", fontSize: 13.5, lineHeight: 1.65 }}>
                  角色、商品、脚本、成片和渠道复盘放在同一个业务面里，减少团队之间来回对齐口径。
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {WORKSPACE_AREAS.map((m) => (
                    <div
                      key={m.label}
                      style={{
                        padding: "16px 16px",
                        borderRadius: "var(--radius-md)",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)", color: "#fff", marginBottom: 8 }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.66)", lineHeight: 1.55 }}>
                        {m.body}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="trial" style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 32px 80px" }}>
          <Card
            style={{
              padding: "44px 44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 32,
              background: "var(--ink)",
              border: "1px solid var(--ink)",
              color: "#fff",
            }}
          >
            <div style={{ maxWidth: 560 }}>
              <h3
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "var(--tracking-tight)",
                  margin: "0 0 12px",
                  color: "#fff",
                  lineHeight: 1.15,
                }}
              >
                让数字人内容接入{" "}
                <span className="serif-italic" style={{ color: "#b4a4ff" }}>
                  AI Star Eco
                </span>
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.72)",
                  margin: 0,
                  lineHeight: 1.65,
                }}
              >
                联系商务团队配置角色资产、商品脚本和分发流程，先从一条内容链路跑通。
              </p>
            </div>
            <Link href={isLoggedIn ? "/dashboard" : "/login?from=%2Fdashboard"}>
              <Button variant="accent" size="lg">
                {isLoggedIn ? "进入工作台" : "预约咨询"}
              </Button>
            </Link>
          </Card>
        </section>
      </main>

      {/* footer */}
      <footer
        style={{
          padding: "20px 32px",
          borderTop: "1px solid var(--line)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-3)",
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
            gap: 12,
          }}
        >
          <span style={{ letterSpacing: 0.5 }}>AI STAR ECO · 数字人带货中台</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/" style={{ color: "var(--fg-3)", textDecoration: "none" }}>产品矩阵</Link>
            <Link
              href={isLoggedIn ? "/dashboard" : "/login?from=%2Fdashboard"}
              style={{ color: "var(--fg-3)", textDecoration: "none" }}
            >
              {isLoggedIn ? "工作台" : "登录"}
            </Link>
            <a
              href="mailto:bd@aistareco.com"
              style={{ color: "var(--fg-3)", textDecoration: "none" }}
            >
              bd@aistareco.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const navLink: React.CSSProperties = {
  fontSize: 13,
  color: "var(--fg-1)",
  textDecoration: "none",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
};
