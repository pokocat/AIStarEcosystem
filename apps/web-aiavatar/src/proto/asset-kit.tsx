"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { ASSET_TYPES, SOURCE_LABELS, SPACE_LABELS, assetTypeOf } from "./api";

// ============================================================
// 数字资产平台 · 六类资产共用原语
//
// 统一登记语言：衬线资产名 + REG 编号 + 版本 + 更新时间。
// 分类靠**前缀与图标**区分，**不靠颜色** —— 单青色皮肤纪律，
// 授权徽标因此仍然稀有，一眼可信。
// ============================================================
const hK: any = React.createElement;

/** 六类资产的图标（对齐 ASSET_TYPES.icon）。 */
export const kindIcon = (kind: string) =>
  (Icons as any)[assetTypeOf(kind)?.icon || "folder"] || Icons.folder;

export const kindLabel = (kind: string) => assetTypeOf(kind)?.label || kind;
export const kindPrefix = (kind: string) => assetTypeOf(kind)?.prefix || "";
export const sourceLabel = (s?: string | null) => (s ? SOURCE_LABELS[s] || s : "");
export const spaceLabel = (s?: string | null) => (s ? SPACE_LABELS[s] || s : "");

export { ASSET_TYPES };

/** 登记号（REG · SC-0312）。 */
export function RegNo({ id, style }: any) {
  return hK("span", { className: "reg-no", style }, id);
}

/** 档案字段行：mono 标签 + 虚线引导 + 值。 */
export function FieldRow({ k, v }: any) {
  return hK("div", { style: { display: "flex", alignItems: "baseline", padding: "6px 0" } },
    hK("span", { className: "field-label" }, k),
    hK("span", { className: "leader" }),
    hK("span", { style: { fontSize: 13, fontWeight: 600, color: "var(--ink)", textAlign: "right",
      maxWidth: "62%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: String(v ?? "") },
      v == null || v === "" ? "—" : v));
}

/** 档案字段卡（一组 FieldRow）。 */
export function FieldCard({ fields, style }: any) {
  return hK("div", { className: "m-card", style: { padding: "8px 16px", ...style } },
    (fields || []).map((f: any, i: number) => hK(FieldRow, { key: i, k: f.k, v: f.v })));
}

/** 分区小标题（mono 大写 + 可选右侧动作 / 计数）。 */
export function SectionLabel({ label, count, action, onAction, style }: any) {
  return hK("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10, ...style } },
    hK("span", { className: "field-label" }, label),
    hK("span", { style: { flex: 1, borderBottom: "1px dotted var(--line-3)", marginBottom: 3 } }),
    count != null && hK("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-4)" } }, count),
    action && hK("button", { onClick: onAction, className: "m-tap", style: {
      background: "none", border: "none", padding: 0, cursor: "pointer",
      fontSize: 12, fontWeight: 700, color: "var(--primary)", flex: "0 0 auto" } }, action));
}

/** 来源角标（实拍上传 / AI 生成）—— 轻资产不进授权登记，只记这一项。 */
export function SourceChip({ source, style }: any) {
  return hK("span", { className: "mono", style: {
    fontSize: 9, letterSpacing: ".04em", color: "var(--ink)", background: "rgba(255,255,255,.9)",
    padding: "2px 6px", borderRadius: 5, whiteSpace: "nowrap", ...style } }, sourceLabel(source));
}

/**
 * 授权徽标 —— 只有真人肖像人物与 IP 会出现；轻资产传 `source` 走 SourceChip。
 * status: active | pending | expired | null（未登记）。
 */
export function LicenseBadge({ status, licenseId, style }: any) {
  if (!status) return hK(UI.Badge, { tone: "mute", style }, "未登记授权");
  const tone = status === "active" ? "ok" : status === "expired" ? "err" : "warn";
  const label = status === "active" ? (licenseId ? `授权中 · ${licenseId}` : "授权中")
    : status === "expired" ? "授权已过期" : "授权待签署";
  return hK(UI.Badge, { tone, style: { maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis",
    whiteSpace: "nowrap", display: "inline-block", lineHeight: "23px", ...style }, title: label }, label);
}

/** 生成中占位（条纹 + 剩余提示）。 */
export function RunningPlate({ label = "生成中", ratio = "16 / 11", radius = 12 }: any) {
  return hK("div", { style: {
    position: "relative", aspectRatio: ratio, borderRadius: radius, overflow: "hidden",
    border: "1px solid var(--line)", background: "linear-gradient(155deg,#F2F5F8,#E4EAF0)" } },
    hK("span", { style: { position: "absolute", inset: 0,
      background: "repeating-linear-gradient(135deg, rgba(20,36,55,.03) 0 7px, transparent 7px 14px)" } }),
    hK("span", { className: "mono", style: { position: "absolute", left: 0, right: 0, bottom: 8,
      fontSize: 9, color: "var(--ink-3)", textAlign: "center" } }, label));
}

/** 资产图（有图出图，无图出条纹占位 + 标签）。 */
export function AssetImage({ url, label, ratio = "16 / 11", radius = 12, running, badge, style, onClick }: any) {
  if (running) return hK("div", { onClick, style: { cursor: onClick ? "pointer" : "default", ...style } },
    hK(RunningPlate, { ratio, radius, label: "生成中 · 稍候" }));
  return hK("div", { onClick, style: {
    position: "relative", aspectRatio: ratio, borderRadius: radius, overflow: "hidden",
    border: "1px solid var(--line)", background: "linear-gradient(155deg,#F5F7FA,#E7EDF2)",
    display: "grid", placeItems: "center", cursor: onClick ? "pointer" : "default", ...style } },
    url
      ? hK("img", { src: url, alt: label || "", loading: "lazy", decoding: "async", draggable: false,
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } })
      : hK(React.Fragment, null,
          hK("span", { style: { position: "absolute", inset: 0,
            background: "repeating-linear-gradient(135deg, rgba(20,36,55,.028) 0 6px, transparent 6px 12px)" } }),
          hK("span", { className: "mono", style: { position: "relative", fontSize: 9.5, color: "var(--ink-3)",
            textAlign: "center", padding: "0 8px", lineHeight: 1.35 } }, label || "待生成")),
    badge && hK("span", { style: { position: "absolute", top: 6, left: 6 } }, badge));
}

/** 空态块（分区内联，不占满屏）。 */
export function EmptyBlock({ icon, title, desc, action, onAction, compact }: any) {
  return hK("div", { style: {
    border: "1.5px dashed var(--line-3)", borderRadius: "var(--r-lg)", background: "var(--surface-2)",
    padding: compact ? "20px 16px" : "30px 20px", textAlign: "center" } },
    hK("span", { style: { width: 40, height: 40, borderRadius: 99, margin: "0 auto 11px", display: "grid",
      placeItems: "center", background: "var(--surface)", border: "1px solid var(--line-2)", color: "var(--primary)" } },
      hK(icon || Icons.plus, { size: 19, stroke: 1.9 })),
    hK("div", { style: { fontSize: 14, fontWeight: 700, color: "var(--ink-2)" } }, title),
    desc && hK("div", { style: { fontSize: 12, color: "var(--ink-3)", marginTop: 5, lineHeight: 1.5 } }, desc),
    action && hK("div", { style: { marginTop: 14 } },
      hK(UI.Button, { variant: "primary", size: "sm", icon: Icons.plus, onClick: onAction }, action)));
}

/** 「＋ 新建」虚线卡（网格里与真实卡同尺寸）。 */
export function AddTile({ label, onClick, ratio = "16 / 11", height }: any) {
  return hK("button", { onClick, className: "m-tap", style: {
    width: "100%", aspectRatio: height ? undefined : ratio, height,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9,
    border: "1.5px dashed var(--line-3)", background: "var(--surface-2)", borderRadius: 15,
    cursor: "pointer", color: "var(--ink-2)" } },
    hK("span", { style: { width: 40, height: 40, borderRadius: 99, background: "var(--surface)",
      border: "1px solid var(--line-2)", display: "grid", placeItems: "center", color: "var(--primary)" } },
      hK(Icons.upload, { size: 19, stroke: 2 })),
    hK("span", { style: { fontSize: 13, fontWeight: 700 } }, label));
}

/**
 * APPLIED TO · 已用于 —— 资产被哪些合成用过（双向引用的反向视角）。
 * 空列表不渲染（多数资产没有引用，不留空壳）。
 */
export function AppliedTo({ usages, onOpen, label = "APPLIED TO · 已用于" }: any) {
  if (!usages || !usages.length) return null;
  return hK("div", { style: { marginTop: 18 } },
    hK(SectionLabel, { label }),
    hK("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
      usages.map((u: any) => hK("button", {
        key: u.usedById, onClick: onOpen ? () => onOpen(u) : undefined, className: "m-tap",
        style: {
          display: "flex", alignItems: "center", gap: 11, padding: 10, width: "100%", textAlign: "left",
          background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
          cursor: onOpen ? "pointer" : "default" } },
        hK(AssetImage, { url: u.thumbUrl, ratio: "1 / 1", radius: 9,
          style: { width: 40, flex: "0 0 40px" } }),
        hK("div", { style: { flex: 1, minWidth: 0 } },
          hK("div", { className: "m-clip1", style: { fontSize: 13.5, fontWeight: 700 } }, u.title),
          hK("div", { className: "m-clip1", style: { fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 } }, u.meta)),
        hK("span", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)", flex: "0 0 auto" } }, "×" + u.times)))));
}

/** 详情页底部固定操作条（次操作 + 主操作）。 */
export function BottomBar({ secondary, secondaryLabel, onSecondary, primaryLabel, onPrimary, primaryIcon, busy, children }: any) {
  return hK("div", { style: {
    position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 20,
    padding: "12px 18px calc(14px + var(--home-ind))",
    background: "rgba(255,255,255,.94)", backdropFilter: "blur(14px)", borderTop: "1px solid var(--line)",
    display: "flex", alignItems: "center", gap: 10 } },
    children,
    (secondary || secondaryLabel) && hK("button", { onClick: onSecondary, disabled: busy, className: "m-tap", style: {
      flex: "0 0 auto", height: 48, padding: "0 16px", borderRadius: 12, border: "none",
      background: "var(--surface-3)", color: "var(--ink-2)", fontSize: 14.5, fontWeight: 700,
      cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 } }, secondaryLabel || secondary),
    primaryLabel && hK("button", { onClick: onPrimary, disabled: busy, className: "m-tap", style: {
      flex: 1, height: 48, borderRadius: 12, border: "none", background: "var(--primary)", color: "#fff",
      fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.65 : 1,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 7 } },
      busy ? hK(UI.Spinner, { size: 16, c: "#fff" }) : (primaryIcon && hK(primaryIcon, { size: 17, stroke: 2 })),
      primaryLabel));
}

/** 详情页顶部大图头（场景 / 合成结果用）。 */
export function HeroHeader({ url, onBack, chips, onMore }: any) {
  const btn = (icon: any, onClick: any, aria: string) => hK("button", { onClick, "aria-label": aria, className: "m-tap", style: {
    width: 34, height: 34, borderRadius: 99, border: "none", background: "rgba(255,255,255,.9)",
    display: "grid", placeItems: "center", color: "var(--ink)", cursor: "pointer" } }, hK(icon, { size: 20, stroke: 2.1 }));
  return hK("div", { style: { position: "relative", flex: "0 0 auto", height: 208, overflow: "hidden",
    background: "linear-gradient(155deg,#F2F5F8,#E4EAF0)" } },
    url && hK("img", { src: url, alt: "", draggable: false, style: {
      position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } }),
    hK("span", { style: { position: "absolute", inset: 0, background:
      "linear-gradient(180deg, rgba(8,16,24,.42) 0%, transparent 34%, transparent 62%, rgba(8,16,24,.28))" } }),
    hK("div", { style: { position: "absolute", top: "calc(8px + var(--statusbar-h, 0px))", left: 12, right: 12,
      display: "flex", alignItems: "center", justifyContent: "space-between" } },
      btn(Icons.chevL, onBack, "返回"),
      onMore ? btn(Icons.dots, onMore, "更多") : hK("span", { style: { width: 34 } })),
    chips && hK("div", { style: { position: "absolute", bottom: 10, left: 12, display: "flex", gap: 6, flexWrap: "wrap" } }, chips));
}
