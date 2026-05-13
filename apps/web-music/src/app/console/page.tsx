"use client";

import Link from "next/link";
import { ArrowLeft, LogOut, Music, Sparkles } from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";

export default function MusicConsolePlaceholder() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[480px] w-[1100px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-purple-600 opacity-[0.12] blur-[120px] rounded-full"
      />
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              AI 音乐人
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-[0.18em]">AI Star Eco</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-gray-400 hidden sm:inline">
              {user.displayName}
            </span>
          )}
          <button
            onClick={logout}
            title="退出登录"
            className="p-2 rounded-lg text-gray-400 hover:bg-white/[0.06] hover:text-white transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 md:px-12 py-20 md:py-28 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-fuchsia-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-xs font-medium tracking-wide">工作台开发中</span>
        </div>
        <h1
          className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent">
            AI 音乐人工作台
          </span>
        </h1>
        <p className="text-base text-gray-400 leading-relaxed">
          歌手 IP 孵化、单曲创作、版权与分发模块即将搬入本独立 app。
          当前阶段（Phase 4b）已完成明星带货专区的迁移，音乐人工作台计划在
          后续 Phase 完成。
        </p>
        <div className="flex justify-center pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-200 px-5 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
        </div>
      </main>
    </div>
  );
}
