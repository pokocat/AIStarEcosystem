"use client";

// AI 艺人孵化 · 共用小组件：艺人头像、阶段进度、平台标、演示标。

import * as React from "react";
import { gradientForSeed } from "@/components/creator";
import { INCUBATION_STAGES, PLATFORM_META, stageIndex } from "@/constants/incubation-ui";
import type { IncubationArtist, IncubationStageId, MatrixPlatform } from "@/mocks/incubation";

export function ArtistPortrait({
  artist,
  height,
  radius = "var(--radius-lg)",
  children,
}: {
  artist: IncubationArtist;
  height: number | string;
  radius?: string | number;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: radius,
        overflow: "hidden",
        background: artist.imageUrl ? "var(--bg-2)" : gradientForSeed(artist.id),
        flexShrink: 0,
      }}
    >
      {artist.imageUrl ? (
        <img
          src={artist.imageUrl}
          alt={artist.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%", display: "block" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "rgba(255,255,255,0.92)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 44,
          }}
        >
          {artist.name.slice(0, 1)}
        </div>
      )}
      {children}
    </div>
  );
}

/** 五段式阶段条：已完成实心、当前阶段按进度填充、之后的留空 */
export function StageBar({ stage, progress, compact }: { stage: IncubationStageId; progress: number; compact?: boolean }) {
  const current = stageIndex(stage);
  return (
    <div style={{ display: "flex", gap: 3 }} aria-label={`孵化阶段：${INCUBATION_STAGES[current].label}`}>
      {INCUBATION_STAGES.map((s, i) => {
        const fill = i < current ? 100 : i === current ? progress : 0;
        return (
          <div
            key={s.id}
            title={s.label}
            style={{
              flex: 1,
              height: compact ? 4 : 6,
              borderRadius: 99,
              background: "var(--bg-3)",
              overflow: "hidden",
            }}
          >
            <div style={{ width: `${fill}%`, height: "100%", background: "var(--accent)" }} />
          </div>
        );
      })}
    </div>
  );
}

export function PlatformBadge({ platform, size = 22 }: { platform: MatrixPlatform; size?: number }) {
  const meta = PLATFORM_META[platform];
  return (
    <span
      title={meta.label}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: meta.color,
        color: "#fff",
        display: "inline-grid",
        placeItems: "center",
        fontSize: Math.round(size * 0.48),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {meta.short}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span
      title="路演演示版，页面上的数字都是示例"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        border: "1px dashed var(--line-2)",
        color: "var(--fg-2)",
        fontSize: 11.5,
        whiteSpace: "nowrap",
      }}
    >
      演示数据
    </span>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--fg-0)" }}>
          {title}
        </h2>
        {sub && <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 3 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function StatCell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: "var(--fg-2)" }}>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          color: "var(--fg-0)",
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

/** 商单金额（分）按「万元」显示：120_000_000 → "¥120 万" */
export function formatWanYuan(cents: number): string {
  const wan = cents / 100 / 10_000;
  return `¥${Number.isInteger(wan) ? wan : wan.toFixed(1)} 万`;
}
