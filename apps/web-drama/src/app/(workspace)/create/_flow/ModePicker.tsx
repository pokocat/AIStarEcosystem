"use client";

// 模式选择：极速（小白）/ 专业（从业者）。
import * as React from "react";
import { ArrowRight, Check, Layers, Zap } from "lucide-react";
import { Card } from "@/components/premium";

export function ModePicker({ onPick }: { onPick: (mode: "express" | "pro") => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
      <ModeCard
        accent="var(--accent)"
        icon={<Zap size={22} />}
        title="极速模式"
        subtitle="一分钟出片 · 零学习成本"
        bullets={["一句话 / 选模板直接生成", "自动走完 剧本 → 分镜 → 生成", "适合快速起号、矩阵铺量"]}
        cta="一句话出片"
        onClick={() => onPick("express")}
      />
      <ModeCard
        accent="var(--extra-violet)"
        icon={<Layers size={22} />}
        title="专业模式"
        subtitle="分步精修 · 掌控每一环"
        bullets={["灵感 → 剧本 → 分镜 → 角色 → 生成", "结构化分镜 + 长文本编剧室（版本树）", "绑定演员 IP、风格变体、多集剧集"]}
        cta="进入工作流"
        onClick={() => onPick("pro")}
      />
    </div>
  );
}

function ModeCard({
  accent,
  icon,
  title,
  subtitle,
  bullets,
  cta,
  onClick,
}: {
  accent: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  cta: string;
  onClick: () => void;
}) {
  return (
    <Card
      style={{ padding: "26px 26px", cursor: "pointer", transition: "border-color 160ms ease, transform 160ms ease" }}
      onClick={onClick}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `color-mix(in srgb, ${accent} 40%, transparent)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)";
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "var(--radius-md)",
          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          color: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--fg-0)" }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 4, marginBottom: 16 }}>{subtitle}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--fg-1)" }}>
            <Check size={14} style={{ color: accent, marginTop: 2, flexShrink: 0 }} />
            <span>{b}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 20, fontSize: 13, fontWeight: 600, color: accent }}>
        {cta} <ArrowRight size={14} />
      </div>
    </Card>
  );
}
