"use client";

export const dynamic = "force-dynamic";

// 模板广场（v0.7）：精选爆款赛道模板，一键带入「短剧创作 · 极速模式」。
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { Button, Card, Chip } from "@/components/premium";
import { ViewHeader, ComingSoon } from "@/components/common";
import { DRAMA_TEMPLATES } from "@/lib/drama-templates";

export default function TemplatesPage() {
  const router = useRouter();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="模板广场"
        title={
          <>
            爆款{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              模板广场
            </span>
          </>
        }
        meta="挑一个赛道模板，一键带入极速模式，改改台词与商品就能出片。"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {DRAMA_TEMPLATES.map((t) => (
          <Card key={t.id} style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Chip tone="accent">{t.track}</Chip>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>{t.genre} · {t.durationSec}s</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--fg-0)" }}>{t.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.6, flex: 1 }}>{t.blurb}</div>
            <div style={{ fontSize: 12, color: "var(--fg-2)", fontStyle: "italic", fontFamily: "var(--font-serif)", lineHeight: 1.55, padding: "8px 10px", background: "var(--surface-1)", borderRadius: "var(--radius-sm)" }}>
              “{t.theme}”
            </div>
            <Button variant="primary" size="md" onClick={() => router.push(`/create?mode=express&tpl=${t.id}`)}>
              用此模板创作 <ArrowRight size={14} />
            </Button>
          </Card>
        ))}
      </div>

      <ComingSoon
        icon={<Clock size={22} />}
        title="社区模板库"
        eta="后续版本"
        description="按甜宠 / 逆袭 / 带货 / 科普等赛道分类的海量模板、用户投稿与一键复刻即将上线。"
      />
    </div>
  );
}
