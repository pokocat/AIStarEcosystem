"use client";

// 公开 landing — 明星商务工作台。浅色高级质感：白底 + 红黑灰 + 星光金。

import Link from "next/link";
import {
  ArrowRight, Building2, FileCheck2, Fingerprint, Handshake, Layers,
  ShieldCheck, Star, TrendingUp,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";

const PIPELINE = [
  { icon: Fingerprint, label: "IP 资产托管", desc: "肖像 / 切片 / 数字人 / 法务底档，四类资产一站接入火山引擎" },
  { icon: ShieldCheck, label: "分级审核", desc: "绿黄橙红四区规则，报白、数字人、AI 形象逐级把关" },
  { icon: Layers, label: "商品准入", desc: "三源选品 6 步入库，平台与明星双路寄样验收" },
  { icon: TrendingUp, label: "收益结算", desc: "GMV 透明可追溯，按月分成、按单下钻" },
];

const FEATURES = [
  {
    icon: Handshake,
    title: "带货授权闭环",
    body: "创作者在 AI 明星带货端发起的授权申请实时流转到工作台，批准即开放 AI 复刻带货场景，驳回留痕可追溯。",
  },
  {
    icon: FileCheck2,
    title: "全链路审核中枢",
    body: "账号报白五步推进、数字人三用途授权、AI 形象三级风控、内容审看驳回返工 —— 所有商业化请求一处收口。",
  },
  {
    icon: Building2,
    title: "品牌合作与法务",
    body: "品牌授权双层审核与双向寄样，侵权全网巡查一键处置，三类授权合同电子化管理、到期自动提醒。",
  },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg-0)" }}>
      {/* ── 顶栏 ── */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-star)" }}>
            <Star className="w-4.5 h-4.5 text-white" fill="currentColor" />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: "var(--ink-0)" }}>明星商务工作台</div>
            <div className="text-[10px] tracking-wide" style={{ color: "var(--ink-2)" }}>AI STAR ECO · CELEBRITY BUSINESS</div>
          </div>
        </div>
        <Link
          href={user ? "/dashboard" : "/login"}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--ink-0)" }}
        >
          {user ? "进入工作台" : "登录"} <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 star-grid-pattern" aria-hidden />
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[380px] rounded-full blur-3xl opacity-25"
          style={{ background: "var(--gradient-star)" }}
          aria-hidden
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6"
            style={{ background: "#f59e0b14", color: "var(--star-gold-deep)", border: "1px solid #f59e0b33" }}
          >
            <Star className="w-3 h-3" fill="currentColor" /> 明星本人 / 经纪团队专属端
          </div>
          <h1
            className="text-4xl md:text-5xl font-black leading-tight tracking-tight text-balance"
            style={{ color: "var(--ink-0)", fontFamily: "var(--font-display)" }}
          >
            你的 IP 商业化
            <span className="mx-2" style={{ color: "var(--star-gold-deep)" }}>审核与运营中枢</span>
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-base leading-relaxed" style={{ color: "var(--ink-1)" }}>
            从 IP 资产托管、授权审核、内容把关、商品准入到收益结算 ——
            所有商业化请求经你的审批阀门流转，人设、合规与法律边界尽在掌控。
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href={user ? "/dashboard" : "/login"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white transition hover:opacity-90 hover:shadow-lg"
              style={{ background: "var(--gradient-star)" }}
            >
              进入工作台 <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center px-6 py-3 rounded-full text-sm font-bold transition hover:bg-white"
              style={{ color: "var(--ink-0)", border: "1px solid var(--line-strong)" }}
            >
              了解能力
            </a>
          </div>

          {/* 授权链路 */}
          <div className="mt-14 star-card max-w-4xl mx-auto p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PIPELINE.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="flex flex-col items-center text-center gap-2">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-2)" }}>
                        <Icon className="w-5 h-5" style={{ color: "var(--star-gold-deep)" }} />
                      </div>
                      <span
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                        style={{ background: "var(--ink-0)" }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <div className="text-[13px] font-bold" style={{ color: "var(--ink-0)" }}>{step.label}</div>
                    <div className="text-[11px] leading-relaxed" style={{ color: "var(--ink-1)" }}>{step.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── 能力列 ── */}
      <section id="features" className="max-w-4xl mx-auto px-6 pb-20">
        <div className="star-card overflow-hidden">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="flex flex-col sm:flex-row sm:items-start gap-4 px-6 py-6 transition-colors hover:bg-[var(--bg-2)]/40"
                style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}
              >
                <div className="flex items-center gap-3 sm:w-56 shrink-0">
                  <span className="text-2xl font-black tabular leading-none" style={{ color: "var(--line-strong)", fontFamily: "var(--font-display)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-base font-bold" style={{ color: "var(--ink-0)" }}>{f.title}</h3>
                </div>
                <p className="text-[13px] leading-relaxed flex-1" style={{ color: "var(--ink-1)" }}>{f.body}</p>
                <Icon className="hidden sm:block w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--star-gold-deep)" }} />
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 页脚 ── */}
      <footer className="py-8 text-center text-xs" style={{ color: "var(--ink-2)", borderTop: "1px solid var(--line)" }}>
        AI Star Eco · 明星商务工作台 — 与 AI 明星带货端数据互通
      </footer>
    </div>
  );
}
