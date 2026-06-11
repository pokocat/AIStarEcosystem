import Link from "next/link";
import { ArrowLeft, Compass, Star } from "lucide-react";

// 品牌化 404 — 浅色主题,提供回工作台 / 回首页两条出路(不留死胡同)。

export default function NotFound() {
  return (
    <div className="min-h-dvh relative flex items-center justify-center px-4 py-12" style={{ background: "var(--bg-0)" }}>
      <div className="absolute inset-x-0 top-0 h-64 star-grid-pattern" aria-hidden />
      <div className="relative star-card max-w-md w-full p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-star)" }}>
          <Star className="w-6 h-6 text-white" fill="currentColor" />
        </div>
        <div
          className="mt-5 text-5xl font-black tracking-tight tabular leading-none"
          style={{ color: "var(--ink-0)", fontFamily: "var(--font-display)" }}
        >
          404
        </div>
        <h1 className="mt-3 text-base font-bold" style={{ color: "var(--ink-0)" }}>页面不存在</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-1)" }}>
          你访问的地址有误，或该页面已被移除。
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 flex-wrap max-sm:[&>a]:flex-auto">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 max-sm:min-h-[44px] rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "var(--ink-0)" }}
          >
            <Compass className="w-4 h-4" /> 返回工作台
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 max-sm:min-h-[44px] rounded-xl text-sm font-bold transition hover:bg-white"
            style={{ color: "var(--ink-0)", border: "1px solid var(--line-strong)" }}
          >
            <ArrowLeft className="w-4 h-4" /> 回到首页
          </Link>
        </div>
      </div>
    </div>
  );
}
