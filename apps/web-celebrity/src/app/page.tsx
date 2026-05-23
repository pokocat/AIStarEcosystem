"use client";

// Creator-Friendly landing —— 严格按参考图 Tokens / Components / Dashboard 风格：
//   黑/紫双色 pill 按钮 · serif 斜体点睛 · 多色饱和渐变 · sand 米色辅助底 · Manrope display。

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, KeyRound, LogOut, Search, ShoppingBag, Sparkles, Star, Video, Wand2 } from "lucide-react";
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

        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
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
              <Button variant="icon" size="sm" onClick={logout} title="退出登录" style={{ width: 32, padding: 0 }}>
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

        {/* showcase 多色卡 */}
        <section id="showcase" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 32px 48px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
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

        {/* 5 步业务主线 */}
        <section id="pipeline" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 32px 64px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 32 }}>
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
                    <Icon size={15} color={colorVar} strokeWidth={2} />
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
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16 }}>
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
                    strokeWidth={isHero ? 1.75 : 2}
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

        {/* CTA */}
        <section id="trial" style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 32px 80px" }}>
          <Card
            style={{
              padding: "44px 44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
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
            <span>bd@aistareco.com</span>
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
