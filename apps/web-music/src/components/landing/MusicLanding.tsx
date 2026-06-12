"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MusicLanding — web-music 本地 landing 组件
//
// 历史背景：packages/landing/ProductLanding 是给 music / drama / celebrity 三端
// 共用的模板，使用 渐变文字 / bg-black / 玻璃 feature 卡 / Sparkles 等 AI demo
// 视觉，与 PRODUCT.md「confident, calm, professional」相左。
//
// 本组件先把 music 这一条独立出来，按 product register 重写：
//   - H1 用纯色 + 大字号 + 粗体（不再 bg-clip-text 渐变）
//   - 背景使用 token (--background)，不写 #000
//   - feature 卡用 token (bg-card + 实底)，告别玻璃
//   - mark 用 AudioLines 替代 Sparkles
//
// 后续 drama / celebrity 想跟进时，应各自 fork 一份，不再共用模板。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { ArrowRight, LogOut, Mic2, TrendingUp, Shield } from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";

const POST_LOGIN_PATH = "/dashboard";
const LOGIN_HREF = `/login?from=${encodeURIComponent(POST_LOGIN_PATH)}`;

interface Feature {
  icon: typeof Mic2;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: Mic2,
    title: "歌手 IP 孵化",
    body: "声线设计、形象锻造、造型与道具一体化，从零到出道仅需数日。",
  },
  {
    icon: TrendingUp,
    title: "单曲发布与商业",
    body: "创作工坊、音乐商业、版权资产、全网分发，覆盖发行全链路。",
  },
  {
    icon: Shield,
    title: "合规与变现",
    body: "版权登记、平台审计、收益结算贯穿主线，让 MCN 经营更可预期。",
  },
];

export function MusicLanding() {
  const { user, logout } = useAuth();
  // SSR 时无法读 localStorage —— 先按未登录态渲染避免 hydration mismatch，
  // mount 之后再根据 user 切换 CTA。
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  const isLoggedIn = mounted && !!user;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <img src="/brand/logo.svg" alt="AI 音乐人" className="h-10 w-auto" />
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="#trial"
            className="hidden sm:inline-flex items-center text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition"
          >
            申请试用
          </Link>
          {isLoggedIn ? (
            <>
              <Link
                href={POST_LOGIN_PATH}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
              >
                进入工作台
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={logout}
                title="退出登录"
                className="p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <Link
              href={LOGIN_HREF}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              立即登录
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </nav>
      </header>

      <main>
        <section className="px-6 md:px-12 pt-20 md:pt-28 pb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border bg-secondary/60 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground">AI 音乐人 · 独立工作台</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-foreground">
            为 MCN 机构打造
            <br />
            歌手 IP 的全周期工作台。
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed mb-10">
            从 AI 形象锻造、声线设计、单曲制作到版权登记与全网分发，一站式贯通歌手类数字人 IP 的孵化与商业化路径，让 MCN 与厂牌以更小团队跑通更稳的发行节奏。
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={isLoggedIn ? POST_LOGIN_PATH : LOGIN_HREF}
              className="inline-flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
            >
              {isLoggedIn ? "进入工作台" : "立即登录"}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#trial"
              className="inline-flex items-center justify-center gap-2 text-sm font-medium px-5 py-2.5 rounded-md border border-border text-foreground hover:bg-secondary transition"
            >
              申请试用
            </Link>
          </div>
        </section>

        <section className="px-6 md:px-12 pb-24 max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {FEATURES.map((f) => {
              const FIcon = f.icon;
              return (
                <div key={f.title} className="bg-card p-7">
                  <FIcon className="w-5 h-5 text-primary mb-5" strokeWidth={2} />
                  <h3 className="text-base font-semibold mb-2 text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer id="trial" className="border-t border-border px-6 md:px-12 py-8 text-xs text-muted-foreground">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <span>AI Star Eco · AI 音乐人</span>
          <div className="flex items-center gap-5">
            <Link href="/" className="hover:text-foreground transition">
              产品矩阵
            </Link>
            <Link href={LOGIN_HREF} className="hover:text-foreground transition">
              登录
            </Link>
            <span>商务咨询：bd@aistareco.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
