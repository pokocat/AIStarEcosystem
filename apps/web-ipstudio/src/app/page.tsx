"use client";

// 公开 landing — AI IP 工作台。克制的浅色档案室质感：冷白画布 + 墨色标题 + 单一青色主操作。

import Link from "next/link";
import { ArrowRight, Camera, Layers, Palette, Send, Sparkles } from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";

const PIPELINE = [
  { icon: Camera, label: "上传一张照片", desc: "只要一张正脸清晰的照片，就能起一个 IP" },
  { icon: Sparkles, label: "抽出人物特征", desc: "自动写成一张可改的特征卡，之后每张图都复用它" },
  { icon: Palette, label: "挑一套风格", desc: "潮玩、Q 版、三维动画等内置风格，逐字进提示词不跑偏" },
  { icon: Layers, label: "批量出形象", desc: "一次定主形象，其余造型都以它为锚，人不会变样" },
];

const FEATURES = [
  {
    title: "同一个人，换装不换脸",
    body: "主形象选定后成为下游每张图的第一参考，配合固定的特征卡与风格文案，一组形象看下来是同一个人。",
  },
  {
    title: "每一次生成都看得见",
    body: "本次实际用的提示词、哪几张参考图真正生效、花了多少积分，都摆在属性面板里，不做黑箱。",
  },
  {
    title: "产出即资产",
    body: "满意的一组形象一键发布到数字资产平台，成为可授权、可被音乐 / 短剧 / 带货各线引用的数字人与造型。",
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const entry = user ? "/projects" : "/login";

  return (
    <div className="min-h-dvh" style={{ background: "var(--canvas)" }}>
      <header className="max-w-5xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex flex-col">
          <span className="asset-name text-[20px]" style={{ color: "var(--ink)" }}>AI IP 工作台</span>
          <span className="reg">IP STUDIO</span>
        </div>
        <Link
          href={entry}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition hover:opacity-90"
          style={{ background: "var(--primary)", color: "var(--on-primary)" }}
        >
          {user ? "进入工作台" : "登录"} <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-12 pb-16 text-center">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mb-6"
          style={{ background: "var(--primary-soft)", color: "var(--primary-700)" }}
        >
          <Sparkles className="w-3 h-3" /> 与数字资产平台同一个账号
        </div>
        <h1 className="asset-name text-[40px] md:text-[52px] leading-[1.08]" style={{ color: "var(--ink)" }}>
          一张照片，一整套<br />立得住的 IP 形象
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          在一张画布上把照片、人物特征、风格与造型连起来。特征卡与主形象双重锁定，
          让十张图里的人是同一个人 —— 这才是能拿去做 IP 的形象。
        </p>
        <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href={entry}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition hover:opacity-90"
            style={{ background: "var(--primary)", color: "var(--on-primary)", boxShadow: "var(--shadow-card)" }}
          >
            开始创建 IP <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#how"
            className="inline-flex items-center px-6 py-3 rounded-full text-sm font-bold transition hover:bg-white"
            style={{ color: "var(--ink)", border: "1px solid var(--line-2)" }}
          >
            看它怎么工作
          </a>
        </div>

        <div id="how" className="mt-16 ledger-card max-w-4xl mx-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {PIPELINE.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex flex-col items-center text-center gap-2 min-w-0">
                  <div className="relative">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <Icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 reg" style={{ color: "var(--ink-4)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>{step.label}</div>
                  <div className="text-[11px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{step.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="ledger-card overflow-hidden">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="px-6 py-6"
              style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}
            >
              <h3 className="text-[15px] font-bold mb-1.5" style={{ color: "var(--ink)" }}>{f.title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
          <Send className="w-3.5 h-3.5" /> 发布后的形象在数字资产平台统一管理与授权
        </div>
      </section>

      <footer className="py-8 text-center text-[11px]" style={{ color: "var(--ink-3)", borderTop: "1px solid var(--line)" }}>
        AI Star Eco · AI IP 工作台
      </footer>
    </div>
  );
}
