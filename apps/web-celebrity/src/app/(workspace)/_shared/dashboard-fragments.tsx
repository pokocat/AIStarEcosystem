// dashboard-fragments.tsx — dashboard / cast 两个页面共用的局部组件与常量。
// 抽自原 console/page.tsx；新版每个 tab 独立成 page，仅这些片段被复用。

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar, Button, Card, Chip, GradientBlock } from "@/components/creator";
import type { MARKET_STARS as MarketStarsType } from "@/mocks/celebrity-zone";

export const PROJECT_STATUS_TONE = {
  "进行中": "filming",
  "筹备中": "scripting",
  "已完成": "published",
} as const;

export const AUTH_STATUS_TONE = {
  authorized: "published",
  pending: "scripting",
  unauthorized: "draft",
  expired: "danger",
} as const;

export const AUTH_STATUS_LABEL = {
  authorized: "已授权",
  pending: "审核中",
  unauthorized: "未授权",
  expired: "已过期",
} as const;

export const DATE_LINE = (() => {
  const d = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${weekdays[d.getDay()]} · ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
})();

export const inlineLink: React.CSSProperties = {
  fontSize: 12,
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  textDecoration: "none",
  letterSpacing: 0.3,
};

export function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-0)" }}>{title}</div>
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            color: "var(--fg-3)",
            background: "var(--bg-2)",
            padding: "2px 8px",
            borderRadius: "var(--radius-pill)",
          }}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

export function CastGrid({ stars }: { stars: typeof MarketStarsType }) {
  return (
    <div className="stack-mobile-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      {stars.map((s) => (
        <Link key={s.id} href={`/star/${s.id}`} style={{ textDecoration: "none" }}>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <GradientBlock
              seed={s.id}
              height={140}
              topLeft={
                <Chip tone={AUTH_STATUS_TONE[s.authorization.status]} size="sm">
                  {AUTH_STATUS_LABEL[s.authorization.status]}
                </Chip>
              }
              topRight={s.isHot ? <Chip tone="romance" size="sm">热门</Chip> : undefined}
              bottom={
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "#fff" }}>
                    {s.name}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)", marginTop: 4, letterSpacing: 0.3 }}
                  >
                    {s.category}
                  </div>
                </div>
              }
            />
            <div style={{ padding: "12px 14px" }}>
              {s.quotaTotal != null ? (
                <QuotaBar used={s.quotaUsed ?? 0} total={s.quotaTotal} />
              ) : (
                <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)", letterSpacing: 0.3 }}>
                  起拍价 {s.startingPrice}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  fontSize: 11,
                  color: "var(--fg-2)",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: 0.3,
                }}
              >
                <span>{s.stats.totalGenerated} 切片</span>
                <span style={{ color: "var(--accent)" }}>{s.stats.gmv}</span>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function QuotaBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color =
    pct > 90 ? "var(--danger)"
      : pct > 70 ? "var(--warning)"
      : "var(--accent)";
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10.5,
          fontFamily: "var(--font-mono)",
          color: "var(--fg-2)",
          marginBottom: 3,
          letterSpacing: 0.3,
        }}
      >
        <span>已用 {used} / {total}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 3,
          background: "var(--bg-2)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

export function EmptyCallout({
  title,
  desc,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  desc: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div
      style={{
        padding: "20px 18px",
        background: "var(--bg-2)",
        border: "1px dashed var(--line-2)",
        borderRadius: "var(--radius-md)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 12, lineHeight: 1.5 }}>{desc}</div>
      <Link href={ctaHref}>
        <Button variant="secondary" size="sm">
          {ctaLabel} <ArrowRight size={11} />
        </Button>
      </Link>
    </div>
  );
}
