"use client";
// ============================================================
// 资产卡片（首页 / 资产库 / 发现共用）
// ============================================================
import React from "react";
import Link from "next/link";
import { DATA } from "@/proto/api";
import type { Avatar, License, StarGrant } from "@/proto/data";
import { AssetPortrait, Badge, Card, Chevron, RegNo } from "@/components/hub/ui";

/**
 * 授权徽章按 License 实体的真实状态判断（review #2：`c.license` 只是登记号，
 * 过期 / 待补确认时它依然存在，不能用"有没有 ID"冒充"授权是否有效"）。
 * 授权列表还没加载出来 / 加载失败时不下结论（返回 null）。
 */
export function licenseBadge(c: Avatar, license: License | null, known: boolean) {
  if (c.path === "ai") return <Badge tone="mute">AI 原创 · 无需授权</Badge>;
  if (!known) return null;
  if (license?.status === "active") return <Badge tone="ok" dot>授权有效</Badge>;
  if (license?.status === "expired") return <Badge tone="err" dot>授权已到期</Badge>;
  return <Badge tone="warn" dot>待完成授权</Badge>;
}

const serifName: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 19,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const subLine: React.CSSProperties = {
  fontSize: 10,
  color: "var(--ink-3)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export function AvatarCard({ c, license, licenseKnown }: { c: Avatar; license: License | null; licenseKnown: boolean }) {
  const status = DATA.STATUS[c.status];
  return (
    <Link href={`/assets/${c.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <AssetPortrait name={c.name} imageUrl={c.imageUrl} hue={c.hue} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={serifName}>{c.name}</span>
            <RegNo>{`${c.id} · V${c.versions || 1}`}</RegNo>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {licenseBadge(c, license, licenseKnown)}
            <span style={{ fontSize: 10.5, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{c.archetype}</span>
          </div>
          <span className="mono" style={subLine}>
            {status ? `${status.label} · ` : ""}更新于 {c.updated}
          </span>
        </div>
        <Chevron />
      </Card>
    </Link>
  );
}

/** 授权给我的明星形象卡（celebrity 域投影；申请审批走带货线，这里只展示与进入名片）。 */
export function StarGrantCard({ g }: { g: StarGrant }) {
  return (
    <Link href={`/stars/${g.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <AssetPortrait name={g.starName} imageUrl={g.starAvatar} hue={35} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={serifName}>{g.starName}</span>
            <RegNo>{`明星形象 · ${g.starId}`}</RegNo>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Badge tone="primary" dot>
              {g.scenes.length > 0
                ? `授权给我 · ${g.scenes.slice(0, 2).join(" / ")}${g.scenes.length > 2 ? " 等" : ""}`
                : "授权给我"}
            </Badge>
            {g.category && <span style={{ fontSize: 10.5, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{g.category}</span>}
          </div>
          <span className="mono" style={subLine}>
            {g.expireDate ? `有效期至 ${g.expireDate}` : "有效期以授权约定为准"}
          </span>
        </div>
        <Chevron />
      </Card>
    </Link>
  );
}

/**
 * 官方角色卡（B 版：立绘铺满、名字压在图上）。
 * 授权本身尚未打通，卡片只标「可授权」不标价 —— 价格字段还不存在，不编造（§3.3）。
 */
export function OfficialCard({ c, height = 190 }: { c: Avatar; height?: number }) {
  return (
    <Link href={`/market/${c.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div
        style={{
          position: "relative",
          height,
          borderRadius: 18,
          overflow: "hidden",
          background: `linear-gradient(160deg, hsl(${c.hue ?? 200} 55% 82%), hsl(${c.hue ?? 200} 48% 66%))`,
        }}
      >
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt={c.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-serif)", fontSize: 62, color: "rgba(255,255,255,.85)" }}>
            {(c.name || "?").trim().slice(0, 1)}
          </span>
        )}
        <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(12,20,34,0) 48%, rgba(12,20,34,.74))" }} />
        <span style={{ position: "absolute", top: 10, right: 10, height: 19, padding: "0 7px", display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(255,255,255,.9)", color: "var(--primary-700)", fontSize: 9, fontWeight: 800 }}>
          可授权
        </span>
        <div style={{ position: "absolute", left: 12, right: 12, bottom: 11, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.name}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.archetype}
          </span>
        </div>
      </div>
    </Link>
  );
}
