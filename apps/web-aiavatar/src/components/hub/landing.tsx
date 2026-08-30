"use client";
// ============================================================
// 公开宣传页（访客看到的首页门面）：未登录访问 / 时展示。
// 视觉方向「青雾产品秀」：青色氛围光 + 悬浮的真实界面预览卡 + 图文卖点。
// 配图为 AI 生成的品牌插画（public/landing/*.jpg），加载失败时优雅隐藏。
// ============================================================
import React, { useState } from "react";
import Link from "next/link";

const ASSET_KINDS = ["数字人", "明星形象", "声音", "歌曲", "场景", "产品", "风格"];

function Illustration({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 18, overflow: "hidden", background: "var(--primary-tint)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

function Cta({ label }: { label: string }) {
  return (
    <Link href="/login?next=/" style={{ textDecoration: "none", display: "inline-block" }}>
      <span
        style={{
          height: 50,
          padding: "0 30px",
          display: "inline-flex",
          alignItems: "center",
          borderRadius: 999,
          background: "linear-gradient(135deg, #2BC2E8, #0E9CC4)",
          color: "#fff",
          fontSize: 15,
          fontWeight: 800,
          boxShadow: "0 10px 26px rgba(18,179,222,.4)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </Link>
  );
}

function Feature({ image, title, copy }: { image: string; title: string; copy: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 22,
        padding: 14,
        boxShadow: "0 2px 12px rgba(20,40,60,.07)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <Illustration src={image} alt={title} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px 4px" }}>
        <span style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: "-.01em" }}>{title}</span>
        <span style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.8 }}>{copy}</span>
      </div>
    </div>
  );
}

/** 悬浮的真实界面预览卡：让访客先看到产品长什么样。 */
function AppPreview() {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 24,
        padding: 18,
        boxShadow: "0 24px 60px rgba(20,50,70,.16), 0 4px 14px rgba(20,50,70,.06)",
        transform: "rotate(-1.6deg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink-2)" }}>我的资产</span>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-4)" }}>ASSET LEDGER</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 15, background: "var(--primary-tint)" }}>
        <div
          style={{
            width: 46,
            height: 58,
            borderRadius: 10,
            background: "linear-gradient(160deg, #BFE6F2, #8CCFE6)",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontFamily: "var(--font-serif)",
            fontSize: 21,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          晚
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600 }}>林晚</span>
            <span className="mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>DH-2044</span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <span
              style={{
                height: 19,
                padding: "0 8px",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "var(--ok-s)",
                color: "var(--ok)",
                borderRadius: 999,
                fontSize: 9.5,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 4, height: 4, borderRadius: 99, background: "var(--ok)" }} />
              授权有效
            </span>
            <span
              style={{
                height: 19,
                padding: "0 8px",
                display: "inline-flex",
                alignItems: "center",
                background: "var(--primary-soft)",
                color: "var(--primary-700)",
                borderRadius: 999,
                fontSize: 9.5,
                fontWeight: 700,
              }}
            >
              被使用 12 次
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
        {[
          { label: "拍短剧", icon: <><rect x="2" y="4" width="20" height="16" rx="3" /><polygon points="10 9 15 12 10 15 10 9" /></> },
          { label: "做音乐", icon: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></> },
          { label: "去带货", icon: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></> },
        ].map((t) => (
          <div
            key={t.label}
            style={{
              borderRadius: 13,
              background: "var(--canvas)",
              padding: "10px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0EA5D3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              {t.icon}
            </svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-2)" }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #DFF3FA 0%, #F0FAFD 30%, var(--canvas) 56%)",
        paddingBottom: 46,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -120,
          right: -140,
          width: 380,
          height: 380,
          borderRadius: 999,
          background: "radial-gradient(circle, rgba(18,179,222,.22), rgba(18,179,222,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* 顶栏 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "calc(env(safe-area-inset-top, 0px) + 18px) 20px 0",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 11,
              background: "linear-gradient(150deg, #2BC2E8, #0E9CC4)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 4px 12px rgba(18,179,222,.35)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 22 8 12 14 2 8 12 2" />
              <polyline points="2 13 12 19 22 13" />
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.01em" }}>数字资产</span>
        </div>
        <Link
          href="/login?next=/"
          style={{
            height: 34,
            padding: "0 16px",
            display: "inline-flex",
            alignItems: "center",
            background: "var(--surface)",
            border: "1px solid rgba(18,179,222,.3)",
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--primary-700)",
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(20,40,60,.06)",
          }}
        >
          登录
        </Link>
      </div>

      {/* Hero */}
      <div
        style={{
          padding: "34px 20px 0",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <span
          style={{
            height: 26,
            padding: "0 13px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--surface)",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: "var(--primary-700)",
            boxShadow: "0 2px 8px rgba(20,40,60,.07)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--primary)" }} />
          短剧 · 音乐 · 带货 都能用
        </span>
        <h1 style={{ margin: 0, fontSize: 31, fontWeight: 800, lineHeight: 1.38, letterSpacing: "-.01em" }}>
          把你的数字形象
          <br />
          变成<span style={{ color: "#0EA5D3" }}>随时能开工</span>的资产
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.85 }}>
          形象、声音、人设存一次，授权记在账上。
          <br />
          之后拍短剧、做音乐、带货出片，直接拿来用。
        </p>
        <div style={{ marginTop: 4 }}>
          <Cta label="免费创建我的数字人" />
        </div>
      </div>

      {/* 主视觉 */}
      <div style={{ padding: "26px 20px 0", position: "relative" }}>
        <Illustration src="/landing/hero.jpg" alt="数字资产" />
      </div>

      {/* 资产类型 */}
      <div style={{ padding: "20px 20px 0", position: "relative" }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center" }}>
          {ASSET_KINDS.map((k) => (
            <span
              key={k}
              style={{
                height: 29,
                display: "inline-flex",
                alignItems: "center",
                padding: "0 13px",
                borderRadius: 999,
                background: "var(--surface)",
                border: "1px solid var(--line-2)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-2)",
              }}
            >
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* 界面预览 */}
      <div style={{ padding: "34px 30px 0", position: "relative" }}>
        <AppPreview />
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>你的资产库长这样：谁、授权到什么时候、被用过几次</span>
        </div>
      </div>

      {/* 卖点 */}
      <div style={{ padding: "36px 20px 0", position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
        <Feature
          image="/landing/clone.jpg"
          title="一段视频就能开始"
          copy="上传一段视频，或者让 AI 直接生成一个形象。用真人的话，要本人确认协议、本人刷脸核验，两步都做完才能用。"
        />
        <Feature
          image="/landing/license.jpg"
          title="每次使用都有授权在案"
          copy="谁授权的、能用在哪、什么时候到期，一张证书写清楚。没有有效授权，出片这一步就走不下去。"
        />
        <Feature
          image="/landing/hub.jpg"
          title="存一次，三个应用都能用"
          copy="资产登记一次，短剧、音乐、带货里直接选。用过几次、用在哪条片子，都记在这个资产名下。"
        />
      </div>

      {/* 底部 CTA */}
      <div
        style={{
          padding: "40px 20px 0",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.5 }}>
          先建一个数字人，
          <br />
          剩下的可以慢慢补
        </span>
        <Cta label="登录 / 注册" />
        <span style={{ fontSize: 10.5, color: "var(--ink-3)" }}>注册需要激活码 · 真人形象需本人授权后才能使用</span>
      </div>
    </div>
  );
}
