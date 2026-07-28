"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { AssetApi, awaitJob, useApi, SPACE_LABELS, SOURCE_LABELS } from "./api";
import {
  RegNo, FieldCard, SectionLabel, SourceChip, AssetImage, AppliedTo, BottomBar, HeroHeader, EmptyBlock,
} from "./asset-kit";

// ============================================================
// N4 场景详情 —— 规格档案 · 光线变体 · 已用于
//
// 场景是轻资产：只记来源（实拍上传 / AI 生成），不进授权登记。
// ============================================================
const hS: any = React.createElement;
const { useState: useStateS, useEffect: useEffectS } = React;

const VARIANT_CHOICES = ["午后", "夜晚", "清晨", "阴天", "黄昏"];

/** 生成光线变体的选择 sheet（按张扣费，勾几个算几个）。 */
function VariantSheet({ scene, onClose, onSubmit }) {
  const [picks, setPicks] = useStateS<string[]>(
    VARIANT_CHOICES.filter((l) => !(scene.variants || []).some((v: any) => v.label === l)).slice(0, 2));
  const toggle = (l: string) =>
    setPicks((p: string[]) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));
  return hS(React.Fragment, null,
    hS("div", { className: "m-sheet-backdrop", onClick: onClose }),
    hS("div", { className: "m-sheet", style: { padding: "0 18px calc(18px + var(--home-ind))" } },
      hS("div", { className: "m-sheet-grip" }),
      hS("div", { style: { padding: "6px 0 14px" } },
        hS("div", { style: { fontFamily: "var(--font-disp)", fontWeight: 800, fontSize: 18 } }, "生成光线变体"),
        hS("div", { style: { fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 } },
          "同一空间、同一机位，只换光线 —— 生成后可直接用于合成。")),
      hS("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 } },
        VARIANT_CHOICES.map((l) => {
          const on = picks.includes(l);
          return hS("button", { key: l, onClick: () => toggle(l), className: "m-tap", style: {
            height: 34, padding: "0 14px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
            border: "1px solid " + (on ? "var(--ink)" : "var(--line-2)"),
            background: on ? "var(--ink)" : "var(--surface)", color: on ? "#fff" : "var(--ink-2)" } }, l);
        })),
      hS(UI.Button, { variant: "primary", full: true, size: "lg", icon: Icons.sparkle,
        disabled: picks.length === 0, onClick: () => onSubmit(picks) },
        picks.length ? `生成 ${picks.length} 个变体` : "请选择变体")));
}

function MSceneDetail({ scene: initial, ctx }) {
  const id = initial?.id;
  const [seq, setSeq] = useStateS(0);
  const [sheet, setSheet] = useStateS(false);
  const [busy, setBusy] = useStateS(false);
  const [pct, setPct] = useStateS(0);
  const s = useApi(() => AssetApi.scene(id), initial, [id, seq]) || initial || {};
  const usages = useApi(() => AssetApi.usages("scene", id), [], [id, seq]);

  // 场景仍在生成中 → 轮询到完成后自动刷新（进详情页时任务可能还没跑完）
  useEffectS(() => {
    if (s.status !== "running" || !s.jobId) return;
    let live = true;
    awaitJob(s.jobId, (j) => { if (live) setPct(j.pct); })
      .then(() => { if (live) setSeq((n) => n + 1); })
      .catch(() => { if (live) setSeq((n) => n + 1); });
    return () => { live = false; };
  }, [s.status, s.jobId]);

  const genVariants = async (labels: string[]) => {
    setSheet(false);
    setBusy(true);
    setPct(0);
    try {
      const r: any = await AssetApi.sceneVariants(id, labels);
      const jobId = r?.job?.id;
      if (jobId) await awaitJob(jobId, (j) => setPct(j.pct));
      setSeq((n) => n + 1);
      (window as any).toast?.(`已生成 ${labels.length} 个光线变体`, { tone: "ok" });
    } catch (e: any) {
      (window as any).toast?.(e?.message || "生成失败，请稍后重试", { tone: "err" });
    } finally { setBusy(false); }
  };

  const remove = async () => {
    try {
      await AssetApi.removeScene(id);
      (window as any).toast?.("场景已删除", { tone: "ok" });
      ctx.back();
      ctx.reload?.();
    } catch (e: any) {
      (window as any).toast?.(e?.message || "删除失败", { tone: "err" });
    }
  };
  const [confirm, setConfirm] = useStateS(false);

  const running = s.status === "running";

  return hS("div", { className: "m-overlay", "data-screen-label": "场景详情" },
    hS(HeroHeader, {
      url: s.imageUrl, onBack: ctx.back, onMore: () => setConfirm(true),
      chips: [
        hS(SourceChip, { key: "src", source: s.source, style: { fontSize: 10, padding: "4px 8px" } }),
        s.spec && s.spec !== "—" && hS("span", { key: "spec", className: "mono", style: {
          fontSize: 10, color: "var(--ink)", background: "rgba(255,255,255,.92)", padding: "4px 8px", borderRadius: 6 } }, s.spec),
      ].filter(Boolean),
    }),

    hS("div", { className: "m-body", style: { padding: "0 18px 96px" } },
      hS("div", { style: { padding: "16px 0 0" } },
        hS(RegNo, { id: s.id }),
        hS("div", { className: "asset-name-lg", style: { fontSize: 26, marginTop: 7 } }, s.name),
        s.description && hS("div", { style: { fontSize: 13, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.55 } }, s.description)),

      running && hS("div", { className: "m-card", style: { padding: "13px 15px", marginTop: 14, display: "flex", alignItems: "center", gap: 11 } },
        hS(UI.Spinner, { size: 16 }),
        hS("div", { style: { flex: 1 } },
          hS("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 6 } }, "场景生成中"),
          hS(UI.Progress, { pct: Math.max(6, pct), h: 5 }))),

      hS(FieldCard, { style: { marginTop: 16 }, fields: [
        { k: "SOURCE", v: SOURCE_LABELS[s.source] || s.source },
        { k: "SPACE", v: SPACE_LABELS[s.space] || s.space },
        { k: "LIGHT", v: s.light },
        { k: "RESOLUTION", v: s.spec },
        { k: "IP", v: s.ipId || "未归入 IP" },
      ] }),

      hS(AppliedTo, { usages, onOpen: (u: any) => ctx.openComposeResult({ id: u.usedById }) }),

      // VARIANTS · 光线变体
      hS("div", { style: { marginTop: 18 } },
        hS(SectionLabel, { label: "VARIANTS · 光线变体", count: (s.variants || []).length }),
        (s.variants || []).length === 0
          ? hS(EmptyBlock, { compact: true, icon: Icons.sparkle, title: "还没有光线变体",
              desc: "同一空间同机位换光，让一个场景覆盖全天时段" })
          : hS("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 } },
              hS(AssetImage, { key: "__origin", url: s.imageUrl, ratio: "16 / 11", radius: 10,
                badge: hS("span", { className: "mono", style: { fontSize: 8.5, color: "var(--ink)",
                  background: "rgba(255,255,255,.88)", padding: "2px 5px", borderRadius: 4 } }, "原片") }),
              (s.variants || []).map((v: any) => hS(AssetImage, {
                key: v.label, url: v.url, ratio: "16 / 11", radius: 10, label: v.label,
                badge: hS("span", { className: "mono", style: { fontSize: 8.5, color: "var(--ink)",
                  background: "rgba(255,255,255,.88)", padding: "2px 5px", borderRadius: 4 } }, v.label) }))))),

    hS(BottomBar, {
      busy,
      secondaryLabel: "生成变体",
      onSecondary: () => (running ? (window as any).toast?.("等场景生成完成后再做变体", { tone: "warn" }) : setSheet(true)),
      primaryLabel: "用此场景合成",
      primaryIcon: Icons.sparkle,
      onPrimary: () => (running
        ? (window as any).toast?.("场景还在生成中", { tone: "warn" })
        : ctx.openCompose({ scene: s })),
    }),

    sheet && hS(VariantSheet, { scene: s, onClose: () => setSheet(false), onSubmit: genVariants }),
    hS(UI.Confirm, {
      open: confirm, onClose: () => setConfirm(false), onConfirm: remove,
      title: "删除这个场景？", desc: "删除后已用它合成的作品不受影响，但无法再用它出新片。",
      confirmText: "删除",
    }));
}

export { MSceneDetail };
