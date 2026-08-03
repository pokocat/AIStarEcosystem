"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { MaterialApi } from "./api";
import { toast } from "./toast";

// ============================================================
// v0.105 · 素材平台审核 + 刷脸核验徽标（授权登记页 / 人物资产详情共用）
//
// 素材提交内容安全审核后按 待审核 → 审核中 → 已通过 / 未通过 流转；
// 未通过时给出可读原因并允许重新提交。
// ============================================================
const hM: any = React.createElement;
const { useState: useStateM, useEffect: useEffectM, useCallback: useCallbackM } = React;

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "待审核", tone: "mute" },
  reviewing: { label: "审核中", tone: "warn" },
  approved: { label: "已通过", tone: "ok" },
  failed: { label: "未通过", tone: "err" },
};

const TYPE_ICON: Record<string, any> = {
  image: Icons.image,
  video: Icons.film,
  audio: Icons.mic,
};

/** 审核状态徽章（定宽不溢出）。 */
export function MaterialBadge({ status }: any) {
  const m = STATUS_META[status] || { label: "审核中", tone: "mute" };
  return hM(UI.Badge, { tone: m.tone, dot: status === "pending" || status === "reviewing" }, m.label);
}

/** 「已刷脸核验」徽标 —— 只在核验方式为本人刷脸时出现，未核验不显示任何负面文案。 */
export function LivenessBadge({ verifyMethod, evidenceStatus, style }: any) {
  if (verifyMethod !== "liveness" || evidenceStatus === "legacy_unconfirmed") return null;
  return hM("span", {
    title: "该授权已记录平台授权确认与本人刷脸核验证据",
    style: {
      display: "inline-flex", alignItems: "center", gap: 4, flex: "0 0 auto",
      maxWidth: 108, height: 20, padding: "0 8px", borderRadius: 999,
      background: "var(--ok-s)", color: "var(--ok)", fontSize: 10.5, fontWeight: 700,
      overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", ...(style || {}),
    },
  }, hM(Icons.shield, { size: 11, stroke: 2.2, style: { flex: "0 0 auto" } }), "证据已核验");
}

/** 单条素材行：类型图标 + 名称（省略号）+ 状态徽章；未通过原因次行可换行。 */
export function MaterialRow({ item, last }: any) {
  const Ico = TYPE_ICON[item.type] || Icons.image;
  return hM("div", {
    style: {
      padding: "10px 0",
      borderBottom: last ? "none" : "1px solid var(--line)",
    },
  },
    hM("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
      item.sourceUrl ? hM(item.type === "video" ? "video" : "img", {
        src: item.sourceUrl, muted: true, playsInline: true, preload: "metadata", alt: item.name,
        style: { width: 42, height: 42, flex: "0 0 42px", borderRadius: 9, objectFit: "cover", background: "var(--surface-3)" },
      }) : hM("span", {
        style: {
          display: "grid", placeItems: "center", width: 42, height: 42, flex: "0 0 42px",
          borderRadius: 8, background: "var(--surface-3)", color: "var(--ink-2)",
        },
      }, hM(Ico, { size: 14, stroke: 2 })),
      hM("span", { style: { flex: 1, minWidth: 0 } },
        hM("span", {
          title: item.name,
          style: { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        }, item.name),
        item.status === "approved" && item.qassetUri && hM("span", { className: "mono", style: { display: "block", marginTop: 3, fontSize: 9.5, color: "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, item.qassetUri)),
      hM(MaterialBadge, { status: item.status })),
    item.status === "failed" && item.failReason && hM("div", {
      style: {
        marginTop: 5, marginLeft: 52, fontSize: 11.5, color: "var(--err)",
        lineHeight: 1.45, wordBreak: "break-word",
      },
    }, item.failReason));
}

/** 素材列表（无记录时不渲染）。 */
export function MaterialRows({ items }: any) {
  if (!items || !items.length) return null;
  return hM("div", { style: { display: "flex", flexDirection: "column" } },
    items.map((m: any, i: number) => hM(MaterialRow, { key: m.id || i, item: m, last: i === items.length - 1 })));
}

/**
 * 「平台审核」区块。
 *   mode="submit"   → 无记录时给「提交平台审核」按钮，未通过时给「重新提交」（AI 原创人物）
 *   mode="readonly" → 只读展示审核记录，没有记录时整块不渲染（真人复刻人物）
 */
export function MaterialSection({ refType, refId, mode = "submit", title = "平台审核", hint, style }: any) {
  const [items, setItems] = useStateM([] as any[]);
  const [loaded, setLoaded] = useStateM(false);
  const [busy, setBusy] = useStateM(false);

  const load = useCallbackM(() => {
    if (!refId) return;
    MaterialApi.listByRef(refType, refId)
      .then((l: any[]) => { setItems(l || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [refType, refId]);

  useEffectM(() => { load(); }, [load]);

  // 有在途记录时轻量轮询，让「审核中 → 已通过」在页面上自然翻转
  useEffectM(() => {
    const pending = items.some((m) => m.status === "pending" || m.status === "reviewing");
    if (!pending) return;
    const iv = setInterval(load, 2000);
    return () => clearInterval(iv);
  }, [items, load]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await MaterialApi.submit(refType, refId);
      toast("已提交平台审核", { tone: "ok" });
      load();
    } catch (e: any) {
      toast(e?.message || "提交失败，请稍后重试", { tone: "err" });
    } finally { setBusy(false); }
  };

  const failedOnly = items.length > 0 && items.every((m) => m.status === "failed");
  const canSubmit = mode === "submit" && (items.length === 0 || failedOnly);

  // 只读模式下没有任何记录 → 整块不渲染（不做常驻空状态）
  if (mode === "readonly" && (!loaded || items.length === 0)) return null;

  return hM("div", { className: "m-card", style: { padding: "14px 16px", ...(style || {}) } },
    hM("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: items.length ? 4 : 8 } },
      hM(Icons.shield, { size: 15, stroke: 2, style: { color: "var(--primary)", flex: "0 0 auto" } }),
      hM("span", { style: { fontSize: 13.5, fontWeight: 700, flex: 1, minWidth: 0 } }, title)),

    hM(MaterialRows, { items }),

    canSubmit && hM("div", { style: { marginTop: items.length ? 12 : 0 } },
      hint && hM("p", {
        style: { fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5, margin: "0 0 10px" },
      }, hint),
      hM(UI.Button, {
        variant: failedOnly ? "soft" : "line", size: "sm",
        icon: failedOnly ? Icons.retry : Icons.upload,
        disabled: busy, onClick: submit,
      }, busy ? "提交中…" : failedOnly ? "重新提交" : "提交平台审核")));
}
