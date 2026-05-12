"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, type LucideIcon } from "lucide-react";

export interface ProductLandingFeature {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface ProductLandingProps {
  /** URL 段，如 "music"。用于 CTA 中 ?from=/<product> 回跳。 */
  product: "music" | "drama" | "celebrity";
  /** 顶栏与 hero 的产品中文名，如 "AI 音乐人"。 */
  label: string;
  /** Hero 一句价值主张，限 30 字内。 */
  tagline: string;
  /** Hero 下方简介段落，120 字内。 */
  description: string;
  /** Lucide icon constructor，作为产品 mark。 */
  icon: LucideIcon;
  /**
   * Tailwind 渐变 token：用于 hero 背景光晕、CTA、产品 mark。
   * 例 "from-purple-500 via-fuchsia-500 to-purple-600"。
   */
  accentGradient: string;
  /** 渐变对应的强调文字色，例 "text-purple-300"。 */
  accentText: string;
  /** 三张能力卡，限 3 条。 */
  features: ProductLandingFeature[];
}

export function ProductLanding({
  product,
  label,
  tagline,
  description,
  icon: Icon,
  accentGradient,
  accentText,
  features,
}: ProductLandingProps) {
  const loginHref = `/login?from=${encodeURIComponent(`/${product}`)}`;
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[480px] w-[1100px] bg-gradient-to-br ${accentGradient} opacity-[0.12] blur-[120px] rounded-full`}
      />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${accentGradient} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {label}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-[0.18em]">AI Star Eco</div>
          </div>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="#trial"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition"
          >
            申请试用
          </Link>
          <Link
            href={loginHref}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg bg-gradient-to-r ${accentGradient} hover:opacity-90 transition shadow-lg`}
          >
            立即登录
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="px-6 md:px-12 py-20 md:py-28 max-w-5xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] mb-6 ${accentText}`}>
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs font-medium tracking-wide">{label} · 独立工作台</span>
          </div>
          <h1
            className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className={`bg-gradient-to-r ${accentGradient} bg-clip-text text-transparent`}>{label}</span>
          </h1>
          <p className="text-lg md:text-2xl text-gray-200 max-w-3xl mx-auto mb-4 leading-relaxed">{tagline}</p>
          <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">{description}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={loginHref}
              className={`inline-flex items-center justify-center gap-2 text-sm font-semibold text-white px-6 py-3 rounded-lg bg-gradient-to-r ${accentGradient} hover:opacity-90 transition shadow-lg shadow-black/30`}
            >
              立即登录
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#trial"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-gray-200 px-6 py-3 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition"
            >
              申请试用
            </Link>
          </div>
        </section>

        <section className="px-6 md:px-12 pb-24 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-5">
            {features.map((f) => {
              const FIcon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm p-6 transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accentGradient} flex items-center justify-center mb-4 shadow-md`}>
                    <FIcon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer id="trial" className="relative z-10 border-t border-white/5 px-6 md:px-12 py-10 text-xs text-gray-500">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${accentGradient}`} />
            <span>AI Star Eco · {label}</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/" className="hover:text-gray-300 transition">
              产品矩阵
            </Link>
            <Link href={loginHref} className="hover:text-gray-300 transition">
              登录
            </Link>
            <span className="text-gray-600">商务咨询请联系：bd@aistareco.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
