"use client";

// 素材运营共享小件 + 格式化 helper（creator 配色换肤版）。

import * as React from "react";
import { Coins, FlaskConical } from "lucide-react";
import { TIER_META } from "@/constants/material-ops-ui";
import type { ScriptBlock, Tier } from "./types";
import { SHOT_KIND_META } from "@/constants/material-ops-ui";
import { formatCredits } from "@ai-star-eco/api-client/format";

// ── 生成消耗提示行：派单底栏统一展示「预计消耗 + 余额」，余额不足时转红。 ─────────
export function CostLine({
  count,
  credits,
  balance,
  unit = "视频",
}: {
  count: number;
  credits: number;
  balance: number | null;
  unit?: string;
}) {
  const insufficient = balance != null && balance < credits;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--fg-2)", minWidth: 0 }}>
      <Coins size={13} color={insufficient ? "var(--danger)" : "var(--accent)"} style={{ flexShrink: 0 }} />
      <span>
        共 {count} 条{unit} · 预计消耗{" "}
        <strong style={{ color: insufficient ? "var(--danger)" : "var(--fg-0)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
          {credits} 积分
        </strong>
      </span>
      {balance != null && (
        <span style={{ color: insufficient ? "var(--danger)" : "var(--fg-3)", whiteSpace: "nowrap" }}>
          · 余额 {formatCredits(balance)}
          {insufficient && " · 不足"}
        </span>
      )}
    </div>
  );
}

// ── 颜色 helper：hex + 两位 alpha（"14" ≈ 8%，"22" ≈ 13%，"33" ≈ 20%） ─────────
export function hexA(hex: string, aa: string): string {
  return `${hex}${aa}`;
}

// ── 智能体本周学到（智能体训练 + 效果回流 复用同一张卡，单一真源） ─────────────
// 强调短语统一中性加粗，不再一句话里多种饱和色。
export const AGENT_LEARNINGS: React.ReactNode[] = [
  <>
    <strong style={{ color: "var(--fg-0)" }}>蓝领情感故事</strong> 钩子在抖音 25-35 男性受众完播率提升 32%
  </>,
  <>
    “<strong style={{ color: "var(--fg-0)" }}>反差</strong>” 类钩子在小红书命中率下降 12%，建议切到 “
    <strong style={{ color: "var(--fg-0)" }}>测评对比</strong>”
  </>,
  <>
    <strong style={{ color: "var(--fg-0)" }}>低糖燕麦</strong> 类目同质化严重，差异度需从 65 提至 80
  </>,
  <>
    视频号 <strong style={{ color: "var(--fg-0)" }}>父女视角</strong> 比夫妻视角 GMV 高 2.4 倍
  </>,
];

export function AgentLearningsCard({
  items = AGENT_LEARNINGS,
  action,
}: {
  items?: React.ReactNode[];
  action?: React.ReactNode;
}) {
  return (
    <div style={{ padding: 18, borderRadius: "var(--radius-lg)", background: "var(--bg-1)", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius-md)",
          background: hexA("#7c5cff", "16"),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <FlaskConical size={16} color="var(--accent)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 600 }}>智能体本周学到</span>
          <Tag color="var(--accent)">{items.length} 条新规律</Tag>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--fg-1)", lineHeight: 1.8 }}>
          {items.map((it, i) => (
            <span key={i}>
              {i > 0 && <>&nbsp;&nbsp;</>}
              {`①②③④⑤⑥`[i] ?? "·"} {it}
            </span>
          ))}
        </div>
      </div>
      {action}
    </div>
  );
}

// ── 格式化 ────────────────────────────────────────────────────────────────────
export function fmtWan(n: number): string {
  if (!n) return "—";
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
  if (n >= 10000000) return `${(n / 10000000).toFixed(0)}kw`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}w`;
  return n.toLocaleString();
}

export function fmtW(n: number | string): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  if (v >= 10000) return `${(v / 10000).toFixed(0)}w`;
  return v.toLocaleString();
}

export function parsePlays(s?: string | number | null): number {
  if (s == null) return 0;
  if (typeof s === "number") return s;
  const m = String(s).match(/([\d.]+)(w|kw|k|m)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const suf = (m[2] || "").toLowerCase();
  if (suf === "w") return n * 10000;
  if (suf === "kw") return n * 10000000;
  if (suf === "k") return n * 1000;
  if (suf === "m") return n * 1000000;
  return n;
}

export function formatLastUsed(iso?: string): string {
  if (!iso || iso === "—" || iso === "...") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 1000 / 3600;
  if (diffH < 0) return "刚刚";
  if (diffH < 2) return `${Math.max(1, Math.round(diffH * 60))} 分钟前`;
  if (diffH < 24) return `${Math.round(diffH)} 小时前`;
  if (diffH < 24 * 7) return `${Math.round(diffH / 24)} 天前`;
  return d.toISOString().slice(5, 10).replace("-", "/");
}

// ── EmptyState（统一空态：图标 + 主文案 + 提示 + 可选操作） ────────────────────
export function EmptyState({
  icon,
  title,
  hint,
  action,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: compact ? "40px 24px" : "64px 24px",
        textAlign: "center",
      }}
    >
      {icon && (
        <div style={{ color: "var(--fg-3)", display: "inline-flex", marginBottom: 2 }}>{icon}</div>
      )}
      <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 500 }}>{title}</div>
      {hint && <div style={{ fontSize: 12.5, color: "var(--fg-3)", maxWidth: 360, lineHeight: 1.6 }}>{hint}</div>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

// ── Eyebrow（mono 小标题） ────────────────────────────────────────────────────
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--fg-3)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Tag（任意 hex 色的浅底彩字胶囊，替代原型 StatusBadge/Chip 的彩色态） ───────
export function Tag({
  color,
  children,
  solid,
  style,
}: {
  color: string;
  children: React.ReactNode;
  solid?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "var(--radius-pill)",
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: "nowrap",
        color: solid ? "#fff" : color,
        background: solid ? color : hexA(color, "1f"),
        border: `1px solid ${hexA(color, solid ? "00" : "55")}`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ── TierBadge（S 爆款 / A 优质 / B 普通 / D 草稿） ────────────────────────────
export function TierBadge({ tier, withLabel = true }: { tier: Tier; withLabel?: boolean }) {
  const m = TIER_META[tier];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 7px",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 700,
        color: m.toneVar,
        background: hexA(m.toneVar, "1f"),
        border: `1px solid ${hexA(m.toneVar, "55")}`,
      }}
    >
      {tier}
      {withLabel && <span style={{ fontWeight: 500 }}>{m.label}</span>}
    </span>
  );
}

// ── 小封面块（脚本/视频缩略，按 cover_color 渐变 + icon/emoji） ─────────────────
export function CoverTile({
  color,
  emoji,
  icon,
  w = 30,
  h = 38,
  radius = 6,
}: {
  color: string;
  emoji?: string;
  icon?: React.ReactNode;
  w?: number;
  h?: number;
  radius?: number;
}) {
  return (
    <span
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        flexShrink: 0,
        background: `linear-gradient(160deg, ${hexA(color, "cc")}, ${hexA(color, "55")})`,
        border: "1px solid var(--line)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(h * 0.42),
        color: "#fff",
      }}
    >
      {emoji ?? icon}
    </span>
  );
}

// ── MetricTile（指标卡） ──────────────────────────────────────────────────────
export function MetricTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        padding: "9px 11px",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          fontWeight: 700,
          color: tone ?? "var(--fg-0)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--fg-2)", marginTop: 2 }}>{label}</div>
      {hint && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", marginTop: 1 }}>{hint}</div>
      )}
    </div>
  );
}

export function MetricInline({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: tone, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)" }}>{label}</span>
    </span>
  );
}

// ── Spark（迷你折线，效果回流 KPI 用） ────────────────────────────────────────
export function Spark({ data, height = 36, color = "#7c5cff", filled }: { data: number[]; height?: number; color?: string; filled?: boolean }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const w = 100;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = height - ((v - min) / (max - min || 1)) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      {filled && <polygon points={`0,${height} ${pts} ${w},${height}`} fill={hexA(color, "26")} />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

// ── ShotTimeline（按时长比例的彩色镜头条） ────────────────────────────────────
export function ShotTimeline({ blocks }: { blocks: ScriptBlock[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 14 }}>
      {blocks.map((b, i) => (
        <div
          key={i}
          title={`${b.label} · ${b.dur}s`}
          style={{
            flex: b.dur,
            height: "100%",
            background: SHOT_KIND_META[b.kind].toneVar,
            opacity: 0.85,
            borderRadius: i === 0 ? "3px 0 0 3px" : i === blocks.length - 1 ? "0 3px 3px 0" : 0,
          }}
        />
      ))}
    </div>
  );
}

// ── 搜索框（统一样式） ────────────────────────────────────────────────────────
export function SearchInput({
  value,
  onChange,
  placeholder,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number | string;
}) {
  return (
    <div
      className="mo-input"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 11px",
        borderRadius: "var(--radius-pill)",
        background: "var(--bg-1)",
        width,
        minWidth: 0,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: 0,
          outline: "none",
          fontSize: 12.5,
          color: "var(--fg-0)",
          fontFamily: "var(--font-sans)",
        }}
      />
    </div>
  );
}

// ── 段控（SegControl，creator pill 样式） ─────────────────────────────────────
export function Seg<T extends string | number>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "5px 11px" : "7px 14px";
  const fs = size === "sm" ? 11.5 : 12.5;
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-pill)",
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            style={{
              padding: pad,
              fontSize: fs,
              fontFamily: "var(--font-sans)",
              fontWeight: active ? 600 : 500,
              borderRadius: "var(--radius-pill)",
              border: "none",
              background: active ? "var(--bg-1)" : "transparent",
              color: active ? "var(--fg-0)" : "var(--fg-2)",
              cursor: "pointer",
              transition: "background 120ms, color 120ms",
              boxShadow: active ? "var(--shadow-soft)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── FilterChip（筛选 chip，可点） ─────────────────────────────────────────────
export function FilterChip({
  active,
  onClick,
  children,
  color = "#7c5cff",
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 11px",
        borderRadius: "var(--radius-pill)",
        fontSize: 12,
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        cursor: "pointer",
        color: active ? color : "var(--fg-1)",
        background: active ? hexA(color, "1f") : "var(--bg-2)",
        border: `1px solid ${active ? color : "var(--line-2)"}`,
        transition: "all 120ms",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

// ── PageHeader（页面标题区） ──────────────────────────────────────────────────
export function PageHeader({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 700,
            margin: "4px 0 0",
            letterSpacing: "-0.01em",
            color: "var(--fg-0)",
          }}
        >
          {title}
        </h1>
        {sub && <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 4 }}>{sub}</div>}
      </div>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{right}</div>}
    </div>
  );
}
