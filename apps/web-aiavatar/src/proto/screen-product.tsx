"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { AssetApi, awaitJob, useApi, SOURCE_LABELS } from "./api";
import {
  RegNo, FieldCard, SectionLabel, AssetImage, AppliedTo, BottomBar, EmptyBlock,
} from "./asset-kit";
import { MShell } from "./shell";

// ============================================================
// N6 产品详情 —— 多角度 + 品牌授权备注
//
// 产品是轻资产：只记来源与「品牌方授权」备注，不进平台 LIC 授权登记
// （设计 §02：只有真人肖像与 IP 需要授权，授权徽标因此仍然稀有）。
// ============================================================
const hP: any = React.createElement;
const { useState: useStateP, useEffect: useEffectP } = React;
const { WxNav: WxNavP } = MShell;

const ANGLE_CHOICES = ["45°", "背面", "细节", "侧面", "俯视"];
/** 有了产品图后可以直接产出的内容（点一下即带着这件产品进合成工作台）。 */
const READY_FOR = ["人物手持图", "场景摆拍", "带货短视频", "主图套图"];

function AngleSheet({ product, onClose, onSubmit }) {
  const [picks, setPicks] = useStateP<string[]>(
    ANGLE_CHOICES.filter((l) => !(product.angles || []).some((a: any) => a.label === l)).slice(0, 3));
  const toggle = (l: string) =>
    setPicks((p: string[]) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));
  return hP(React.Fragment, null,
    hP("div", { className: "m-sheet-backdrop", onClick: onClose }),
    hP("div", { className: "m-sheet", style: { padding: "0 18px calc(18px + var(--home-ind))" } },
      hP("div", { className: "m-sheet-grip" }),
      hP("div", { style: { padding: "6px 0 14px" } },
        hP("div", { style: { fontFamily: "var(--font-disp)", fontWeight: 800, fontSize: 18 } }, "补充角度"),
        hP("div", { style: { fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 } },
          "锁同一件商品，只换机位 —— 角度越全，合成时越好用。")),
      hP("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 } },
        ANGLE_CHOICES.map((l) => {
          const on = picks.includes(l);
          return hP("button", { key: l, onClick: () => toggle(l), className: "m-tap", style: {
            height: 34, padding: "0 14px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
            border: "1px solid " + (on ? "var(--ink)" : "var(--line-2)"),
            background: on ? "var(--ink)" : "var(--surface)", color: on ? "#fff" : "var(--ink-2)" } }, l);
        })),
      hP(UI.Button, { variant: "primary", full: true, size: "lg", icon: Icons.sparkle,
        disabled: picks.length === 0, onClick: () => onSubmit(picks) },
        picks.length ? `生成 ${picks.length} 个角度` : "请选择角度")));
}

function MProductDetail({ product: initial, ctx }) {
  const id = initial?.id;
  const [seq, setSeq] = useStateP(0);
  const [sheet, setSheet] = useStateP(false);
  const [confirm, setConfirm] = useStateP(false);
  const [busy, setBusy] = useStateP(false);
  const [pct, setPct] = useStateP(0);
  const [angleIdx, setAngleIdx] = useStateP(0);
  const p = useApi(() => AssetApi.product(id), initial, [id, seq]) || initial || {};
  const usages = useApi(() => AssetApi.usages("product", id), [], [id, seq]);
  const angles = p.angles || [];
  const main = angles[angleIdx] || angles[0] || null;
  const running = p.status === "running";

  useEffectP(() => {
    if (!running || !p.jobId) return;
    let live = true;
    awaitJob(p.jobId, (j) => { if (live) setPct(j.pct); })
      .then(() => { if (live) setSeq((n) => n + 1); })
      .catch(() => { if (live) setSeq((n) => n + 1); });
    return () => { live = false; };
  }, [running, p.jobId]);

  const genAngles = async (labels: string[]) => {
    setSheet(false);
    setBusy(true);
    setPct(0);
    try {
      const r: any = await AssetApi.productAngles(id, labels);
      const jobId = r?.job?.id;
      if (jobId) await awaitJob(jobId, (j) => setPct(j.pct));
      setSeq((n) => n + 1);
      (window as any).toast?.(`已补充 ${labels.length} 个角度`, { tone: "ok" });
    } catch (e: any) {
      (window as any).toast?.(e?.message || "生成失败，请稍后重试", { tone: "err" });
    } finally { setBusy(false); }
  };

  const remove = async () => {
    try {
      await AssetApi.removeProduct(id);
      (window as any).toast?.("产品已删除", { tone: "ok" });
      ctx.back();
      ctx.reload?.();
    } catch (e: any) {
      (window as any).toast?.(e?.message || "删除失败", { tone: "err" });
    }
  };

  return hP("div", { className: "m-overlay", "data-screen-label": "产品详情" },
    hP(WxNavP, { title: "产品详情", onBack: ctx.back,
      right: hP("button", { onClick: () => setConfirm(true), "aria-label": "更多", className: "nav-spacer m-tap", style: {
        background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)", display: "grid", placeItems: "center" } },
        hP(Icons.dots, { size: 18, stroke: 2 })) }),

    hP("div", { className: "m-body", style: { padding: "0 18px 96px" } },
      // 主图 + 角度缩略
      hP(AssetImage, { url: main?.url, label: main ? `产品主图 · ${main.label}` : "待生成", ratio: "3 / 2", radius: 15,
        running,
        badge: main?.spec && hP("span", { className: "mono", style: { fontSize: 9, color: "var(--ink)",
          background: "rgba(255,255,255,.92)", padding: "3px 7px", borderRadius: 5 } }, main.spec) }),

      angles.length > 0 && hP("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 9 } },
        angles.slice(0, 8).map((a: any, i: number) => hP("button", {
          key: a.label + i, onClick: () => setAngleIdx(i), className: "m-tap",
          "aria-label": a.label, style: { padding: 0, background: "none", cursor: "pointer",
            border: "1px solid " + (i === angleIdx ? "var(--primary)" : "transparent"), borderRadius: 11 } },
          hP(AssetImage, { url: a.url, label: a.label, ratio: "1 / 1", radius: 10 })))),

      running && hP("div", { className: "m-card", style: { padding: "13px 15px", marginTop: 14, display: "flex", alignItems: "center", gap: 11 } },
        hP(UI.Spinner, { size: 16 }),
        hP("div", { style: { flex: 1 } },
          hP("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 6 } }, "产品图生成中"),
          hP(UI.Progress, { pct: Math.max(6, pct), h: 5 }))),

      hP("div", { style: { marginTop: 16 } },
        hP(RegNo, { id: p.id }),
        hP("div", { className: "asset-name-lg", style: { fontSize: 25, marginTop: 7 } }, p.name),
        hP("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" } },
          p.brandAuthorized
            ? hP(UI.Badge, { tone: "ok", dot: true },
                "品牌方授权" + (p.brandLicenseUntil ? " · 至 " + p.brandLicenseUntil : ""))
            : hP(UI.Badge, { tone: "mute" }, "未登记品牌授权"),
          p.ipId && hP(UI.Badge, { tone: "mute" }, "归属 " + p.ipId)),
        p.description && hP("div", { style: { fontSize: 13, color: "var(--ink-2)", marginTop: 9, lineHeight: 1.55 } }, p.description)),

      hP(FieldCard, { style: { marginTop: 14 }, fields: [
        { k: "CATEGORY", v: p.category },
        { k: "SOURCE", v: SOURCE_LABELS[p.source] || p.source },
        { k: "ANGLES", v: angles.length ? angles.length + " 张" : "—" },
        { k: "UPDATED", v: p.updated },
      ] }),

      hP(AppliedTo, { usages, onOpen: (u: any) => ctx.openComposeResult({ id: u.usedById }) }),

      // READY FOR · 可直接产出
      hP("div", { style: { marginTop: 18 } },
        hP(SectionLabel, { label: "READY FOR · 可直接产出" }),
        hP("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 } },
          READY_FOR.map((l) => hP("button", { key: l, className: "m-tap",
            onClick: () => ctx.openCompose({ product: p }), style: {
              display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
              borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line-2)",
              fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", cursor: "pointer" } }, l)))),
    ),

    hP(BottomBar, {
      busy,
      secondaryLabel: "补充角度",
      onSecondary: () => (running ? (window as any).toast?.("等产品图生成完成后再补角度", { tone: "warn" }) : setSheet(true)),
      primaryLabel: "生成带货素材",
      primaryIcon: Icons.sparkle,
      onPrimary: () => (running
        ? (window as any).toast?.("产品图还在生成中", { tone: "warn" })
        : ctx.openCompose({ product: p })),
    }),

    sheet && hP(AngleSheet, { product: p, onClose: () => setSheet(false), onSubmit: genAngles }),
    hP(UI.Confirm, {
      open: confirm, onClose: () => setConfirm(false), onConfirm: remove,
      title: "删除这个产品？", desc: "删除后已用它合成的作品不受影响，但无法再用它出新片。",
      confirmText: "删除",
    }));
}

export { MProductDetail };
