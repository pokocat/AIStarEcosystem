import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/creator";
import { MARKET_STARS } from "@/mocks/celebrity-zone";
import { CastGrid, EmptyCallout, Section } from "../_shared/dashboard-fragments";

// 我的明星 —— 已签约 / 审核中 / 已过期 三段。
export default function CelebrityCastPage() {
  const authorized = MARKET_STARS.filter((s) => s.authorization.status === "authorized");
  const pending = MARKET_STARS.filter((s) => s.authorization.status === "pending");
  const expired = MARKET_STARS.filter((s) => s.authorization.status === "expired");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow">My Cast · 已签约明星</div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              margin: "8px 0 6px",
              color: "var(--fg-0)",
            }}
          >
            我的{" "}
            <span className="serif-italic" style={{ color: "var(--accent)" }}>
              明星阵容
            </span>
          </h1>
          <div style={{ fontSize: 13, color: "var(--fg-2)" }}>
            已授权 {authorized.length} · 审核中 {pending.length} · 已过期 {expired.length}
          </div>
        </div>
        <Link href="/market">
          <Button variant="dark" size="md">
            <Plus size={13} /> 新增授权
          </Button>
        </Link>
      </div>

      <Section title="已授权" count={authorized.length}>
        {authorized.length === 0 ? (
          <EmptyCallout
            title="还没有已授权的明星"
            desc="从明星市场挑选合适的 IP，申请授权即可开始带货。"
            ctaHref="/market"
            ctaLabel="浏览市场"
          />
        ) : (
          <CastGrid stars={authorized} />
        )}
      </Section>

      {pending.length > 0 && (
        <Section title="审核中" count={pending.length}>
          <CastGrid stars={pending} />
        </Section>
      )}

      {expired.length > 0 && (
        <Section title="已过期" count={expired.length}>
          <CastGrid stars={expired} />
        </Section>
      )}
    </div>
  );
}
