"use client";
// ============================================================
// AI 数字名片 · 公开页 /card/p/<slug>
//
// 访客视角，**不需要登录、不走开通门** —— 见客户扫码就得能打开。
// 因此这里刻意不调 useRequireAuth / EnrollmentGate；server 侧对应的
// GET /api/v1/card/p/{slug} 须登记进 ProductRouteTable.PUBLIC_GETS。
//
// 一期只做展示。方案见 docs/digital-business-card-plan.md。
// ============================================================
import React, { use as usePromise, useEffect, useState } from "react";
import CardView from "@/components/card/card-view";
import { CardApi, type CardProfile } from "@/proto/card";

type Load =
  | { state: "loading" }
  | { state: "ok"; card: CardProfile }
  | { state: "missing" }
  | { state: "error"; message: string };

export default function CardPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = usePromise(params);
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    let alive = true;
    setLoad({ state: "loading" });
    CardApi.bySlug(slug)
      .then((card) => {
        if (!alive) return;
        setLoad(card ? { state: "ok", card } : { state: "missing" });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoad({ state: "error", message: e instanceof Error ? e.message : "名片打不开了" });
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (load.state === "loading") return <Placeholder />;
  if (load.state === "ok") return <CardView card={load.card} />;

  return (
    <Notice
      title={load.state === "missing" ? "这张名片不存在" : "名片暂时打不开"}
      body={
        load.state === "missing"
          ? "链接可能已经失效，或者名片主人取消了发布。找他要一张新的吧。"
          : `${load.message}。稍后再试，或者直接联系名片主人。`
      }
    />
  );
}

/** 骨架：跟首屏同一套骨架，避免加载完跳版。 */
function Placeholder() {
  return (
    <div style={{ minHeight: "100dvh", background: "#FFFFFF", display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top, 0px) + 18px) 18px 24px" }}>
      <div className="m-skel" style={{ height: 12, width: 180, borderRadius: 2 }} />
      <div className="m-skel" style={{ height: 56, marginTop: 16, borderRadius: 2 }} />
      <div className="m-skel" style={{ height: 22, width: "60%", marginTop: 14, borderRadius: 2 }} />
      <div className="m-skel" style={{ height: 22, width: "78%", marginTop: 8, borderRadius: 2 }} />
      <div className="m-skel" style={{ flex: 1, minHeight: 220, marginTop: 22, borderRadius: 2 }} />
      <div className="m-skel" style={{ height: 92, marginTop: 16, borderRadius: 2 }} />
      <div className="m-skel" style={{ height: 46, marginTop: 12, borderRadius: 2 }} />
      <span className="mono" style={{ marginTop: 14, textAlign: "center", fontSize: 10, letterSpacing: ".1em", color: "var(--ink-4)" }}>
        正在打开名片
      </span>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 32px", textAlign: "center" }}>
      <span aria-hidden style={{ width: 8, height: 8, background: "var(--line-3)" }} />
      <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.01em" }}>{title}</span>
      <p style={{ fontSize: 13.5, lineHeight: 1.75, color: "var(--ink-2)", maxWidth: 300, margin: 0 }}>{body}</p>
    </div>
  );
}
