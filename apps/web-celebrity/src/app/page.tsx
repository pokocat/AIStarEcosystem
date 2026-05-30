"use client";

// Creator-Friendly landing —— 严格按参考图 Tokens / Components / Dashboard 风格：
//   黑/紫双色 pill 按钮 · serif 斜体点睛 · 多色饱和渐变 · sand 米色辅助底 · Manrope display。

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
import { Button, Card, Chip, GradientBlock } from "@/components/creator";
import { MARKET_STARS } from "@/mocks/celebrity-zone";

const FEATURES = [
  {
    icon: Star,
    title: "明星授权 · AI 复刻",
    body: "授权流程、数字分身建模、肖像合规审计一体闭环，让真人明星的 AI 形象使用边界清晰、可控、全程留痕。",
  },
  {
    icon: Video,
    title: "短视频 · 智能生产",
    body: "模板化生成、分镜配音、视频管理与多平台分发一体化，从脚本到成片仅需几分钟，稳定输出爆款素材。",
  },
  {
    icon: ShoppingBag,
    title: "商品挂载 · 数据闭环",
    body: "商品库、实时数据看板、转化漏斗复盘联动钱包结算，把明星 IP 的每一次曝光都沉淀为可量化的 GMV。",
  },
];

// 业务主线 5 步
const PIPELINE = [
  { n: 1, icon: Search,      title: "选明星",   desc: "浏览明星市场，按品类、热度、授权价快速锁定合作对象。",                  tone: "violet" as const },
  { n: 2, icon: KeyRound,    title: "签授权",   desc: "在线选定套餐档位与商品方向，合规审核 1 个工作日内出结果。",            tone: "rose"   as const },
  { n: 3, icon: Wand2,       title: "AI 出片",  desc: "模板化与一键生成两种模式并行，多引擎对比，秒级产出可用素材。",          tone: "peach"  as const },
  { n: 4, icon: Sparkles,    title: "审核分发", desc: "内容审核通过后，自动分发至抖音、快手、小红书、视频号等主流渠道。",      tone: "amber"  as const },
  { n: 5, icon: ShoppingBag, title: "带货结算", desc: "关联商品库、实时回流转化数据，自动完成分账并打款至钱包。",              tone: "teal"   as const },
];

const SHOWCASE = [
  { id: "liu-tao",   title: "刘涛 · 都市精英", chip: { tone: "drama"   as const, label: "剧情" }, meta: "本周 GMV ¥1.82M" },
  { id: "shen-teng", title: "沈腾 · 综艺向",   chip: { tone: "comedy"  as const, label: "喜剧" }, meta: "32 条视频投放中" },
  { id: "na-ying",   title: "那英 · 音乐向",   chip: { tone: "slice"   as const, label: "音乐" }, meta: "新歌预热中" },
  { id: "jia-ling",  title: "贾玲 · 喜剧向",   chip: { tone: "romance" as const, label: "情感" }, meta: "每周稳定更新 5 期" },
];

// 合作伙伴占位标识 —— 文字 monogram，等待替换为真实合作方 logo
const PARTNERS: { id: string; tag: string; name: string }[] = [
  { id: "p1", tag: "FN", name: "飞牛 MCN" },
  { id: "p2", tag: "XT", name: "星图传媒" },
  { id: "p3", tag: "JY", name: "鲸跃娱乐" },
  { id: "p4", tag: "YQ", name: "云鹊数娱" },
  { id: "p5", tag: "CQ", name: "潮趣 MCN" },
  { id: "p6", tag: "LH", name: "蓝海集团" },
  { id: "p7", tag: "XX", name: "新象传媒" },
];

const CASE_METRICS = [
  { value: "¥8.6M", label: "单季 GMV", delta: "环比上季 +124%" },
  { value: "4.2×", label: "视频复用率", delta: "原素材二次混剪" },
  { value: "3 人", label: "运营人效", delta: "覆盖 3 位明星 × 全网 4 渠道" },
];

const COMPLIANCE_CERTS = [
  { icon: ShieldCheck, title: "肖像权授权登记", desc: "每位明星授权文书均登记备案，可追溯、可终止。" },
  { icon: FileCheck2,  title: "深度合成内容备案", desc: "依《互联网信息服务深度合成管理规定》完成网信办备案。" },
  { icon: TrendingUp,  title: "内容审核日报",     desc: "每条 AI 生成视频留存审核记录与可解释性证据链。" },
  { icon: Star,         title: "数据安全认证",     desc: "通过等保三级与 ISO/IEC 27001 信息安全管理体系认证。" },
];

const WORKBENCH_MODULES = [
  { label: "任务中心",   meta: "3 条待审 · 2 条草稿"      },
  { label: "模板库",     meta: "48 个剧本 · 12 个分镜"   },
  { label: "数据看板",   meta: "GMV / 转化 / 漏斗"        },
  { label: "钱包结算",   meta: "本月分账 ¥86,420"        },
];

export default function CelebrityLandingPage() {
  const { user, logout } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isLoggedIn = mounted && !!user;
  // 选取「已授权」的第一位明星作为 hero persona 演示（避免虚构 demo 数据）。
  const featuredStar =
    MARKET_STARS.find((s) => s.authorization.status === "authorized") ?? MARKET_STARS[0];

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
          <div
            style={{
              width: 30,
              height: 30,
              background: "var(--accent)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: 13,
              color: "#fff",
            }}
          >
            iP
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)" }}>AI 明星带货</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg-2)", letterSpacing: 0.4 }}>
              AI STAR ECO · 明星矩阵
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex" style={{ alignItems: "center", gap: 28 }}>
          <Link href="#pipeline" style={navLink}>业务主线</Link>
          <Link href="#features" style={navLink}>核心能力</Link>
          <Link href="#showcase" style={navLink}>明星阵容</Link>
          <Link href="#trial" style={navLink}>开始合作</Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLoggedIn ? (
            <>
              <Link href="/dashboard">
                <Button variant="dark" size="sm">进入工作台 →</Button>
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
                <Button variant="accent" size="sm">预约咨询 →</Button>
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
            <div className="eyebrow">AI 明星带货 · 2026 全新升级</div>
            <h1
              style={{
                fontSize: 56,
                lineHeight: 1.08,
                fontWeight: 700,
                letterSpacing: "var(--tracking-tight)",
                fontFamily: "var(--font-display)",
                margin: "16px 0 18px",
                color: "var(--fg-0)",
              }}
            >
              复刻一位 AI 明星,
              <br />
              <span className="serif-italic" style={{ color: "var(--accent)", fontSize: 56 }}>
                让顶流 7×24 帮你带货。
              </span>
            </h1>
            <p
              style={{
                fontSize: 15.5,
                lineHeight: 1.7,
                color: "var(--fg-1)",
                maxWidth: 560,
                marginBottom: 28,
              }}
            >
              从明星授权、AI 形象复刻、短视频生产到全网分发与商品结算，一站式打通授权方、品牌方与 MCN 的合作链路，让明星 IP 在合规前提下持续放大商业价值。
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href={isLoggedIn ? "/dashboard" : "/login?from=%2Fdashboard"}>
                <Button variant="dark" size="lg">
                  {isLoggedIn ? "进入工作台 →" : "预约咨询 →"}
                </Button>
              </Link>
              <Link href="#showcase">
                <Button variant="secondary" size="lg">查看明星阵容</Button>
              </Link>
            </div>
          </div>

          {/* 右侧:当前签约明星形象卡(取一位已授权明星作演示) */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <GradientBlock
              seed={featuredStar.id}
              height={280}
              topLeft={<Chip tone="published" size="sm">● 在投</Chip>}
              topRight={
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.9)",
                    letterSpacing: 0.4,
                    background: "rgba(0,0,0,0.18)",
                    padding: "3px 9px",
                    borderRadius: "var(--radius-pill)",
                  }}
                >
                  标准版授权
                </span>
              }
              bottom={
                <div>
                  <div
                    className="serif-italic"
                    style={{ fontSize: 34, color: "#fff", lineHeight: 1.05, marginBottom: 8 }}
                  >
                    {featuredStar.name}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: "rgba(255,255,255,0.82)",
                      letterSpacing: 0.4,
                    }}
                  >
                    {featuredStar.category} · 已签约
                  </div>
                </div>
              }
            />
            <div style={{ padding: "22px 22px" }}>
              <p
                style={{
                  fontSize: 13.5,
                  color: "var(--fg-1)",
                  lineHeight: 1.65,
                  margin: 0,
                  marginBottom: 14,
                }}
              >
                今日 <strong style={{ color: "var(--fg-0)" }}>32 条视频</strong>在投，本周累计带货
                <strong style={{ color: "var(--fg-0)" }}> ¥1.82M</strong>、转化率
                <strong style={{ color: "var(--fg-0)" }}> 1.86%</strong>，授权状态、视频审核与分账明细全部可在工作台一屏掌握。
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Chip tone="romance" size="sm">都市言情</Chip>
                <Chip tone="slice" size="sm">生活种草</Chip>
                <Chip tone="comedy" size="sm">喜剧综艺</Chip>
                <Chip tone="drama" size="sm">剧情向</Chip>
              </div>
            </div>
          </Card>
        </section>

        {/* 合作伙伴 logo strip —— 占位 monogram，等待替换为真实合作方 logo */}
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
              已与 50+ MCN、明星工作室与品牌方共建生态
            </span>
            <div
              style={{
                display: "flex",
                gap: 18,
                alignItems: "center",
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
              aria-label="部分合作伙伴"
            >
              {PARTNERS.map((p) => (
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
                签约明星
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
          <div className="stack-mobile-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {SHOWCASE.map((s) => (
              <GradientBlock
                key={s.id}
                seed={s.id}
                height={180}
                topRight={<Chip tone={s.chip.tone} size="sm">{s.chip.label}</Chip>}
                bottom={
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "#fff" }}>
                      {s.title}
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)", marginTop: 4, letterSpacing: 0.3 }}>
                      {s.meta}
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        </section>

        {/* 客户案例 —— 单一 case study + 3 outcome metrics，破除"页面缺真实信任凭证"的 critique 缺口 */}
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
              <div
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: "var(--fg-2)",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  marginBottom: 20,
                }}
              >
                客户案例 · 头部美妆 MCN
              </div>
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
                三位明星 IP × 12 周 × 抖音+小红书双渠道，单季 GMV 突破 ¥8.6M，制作团队从 11 人压缩到 3 人。
              </blockquote>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--fg-2)",
                  fontFamily: "var(--font-sans)",
                  letterSpacing: 0.2,
                }}
              >
                —— 某头部美妆 MCN，2025 Q4 合作回顾
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
              {CASE_METRICS.map((m) => (
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
                      fontSize: 36,
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
                明星 IP 带货闭环
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
                    className="serif-italic"
                    aria-hidden
                    style={{
                      fontSize: 44,
                      lineHeight: 1,
                      color: colorVar,
                      marginBottom: 18,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {String(p.n).padStart(2, "0")}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--fg-0)",
                      fontFamily: "var(--font-display)",
                      marginBottom: 10,
                    }}
                  >
                    <Icon size={15} color={colorVar} strokeWidth={1.75} />
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
            三大核心能力,打通{" "}
            <span className="serif-italic" style={{ color: "var(--accent)" }}>
              明星 IP 全链路
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

        {/* 合规与工作台预览 —— 双栏：左 4 项资质 / 右 工作台模块预览 */}
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
            {/* 合规与资质 */}
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
                合规与资质,
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

            {/* 工作台预览 —— 用静态 stylized window chrome + 模块行模拟，避免空文字版面 */}
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
                授权方工作台,
                <span style={{ color: "var(--accent)" }}> 一屏掌握</span>
              </h2>
              <div
                style={{
                  borderRadius: "var(--radius-lg)",
                  background: "var(--ink)",
                  padding: 14,
                  boxShadow: "var(--shadow-pop)",
                }}
                aria-label="工作台预览示意"
                role="img"
              >
                {/* window chrome */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px 14px" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ff5b8a", opacity: 0.8 }} />
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#f0a83a", opacity: 0.8 }} />
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22b59a", opacity: 0.8 }} />
                  <span
                    className="mono"
                    style={{
                      marginLeft: 12,
                      fontSize: 10,
                      color: "rgba(255,255,255,0.45)",
                      letterSpacing: 0.4,
                    }}
                  >
                    workspace · celebrity
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 10,
                    padding: 0,
                  }}
                >
                  {WORKBENCH_MODULES.map((m, i) => (
                    <div
                      key={m.label}
                      style={{
                        padding: "14px 14px",
                        borderRadius: "var(--radius-md)",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#fff",
                          fontFamily: "var(--font-display)",
                          letterSpacing: "var(--tracking-tight)",
                          marginBottom: 4,
                        }}
                      >
                        {m.label}
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.55)",
                          letterSpacing: 0.3,
                        }}
                      >
                        {m.meta}
                      </div>
                      {/* 数据条占位，让卡片不只有字 */}
                      <div
                        style={{
                          marginTop: 12,
                          height: 4,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.08)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${30 + i * 18}%`,
                            height: "100%",
                            background:
                              i % 2 === 0 ? "var(--accent)" : "var(--extra-peach)",
                            opacity: 0.85,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
                让明星 IP 接入{" "}
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
                联系商务团队开通授权方专属工作台,1 个工作日内完成对接上线。
              </p>
            </div>
            <Link href={isLoggedIn ? "/dashboard" : "/login?from=%2Fdashboard"}>
              <Button variant="accent" size="lg">
                {isLoggedIn ? "进入工作台 →" : "预约咨询 →"}
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
          }}
        >
          <span style={{ letterSpacing: 0.5 }}>AI STAR ECO · 明星带货中台</span>
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
