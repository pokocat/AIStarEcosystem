"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { AssetApi, AvatarApi, useApi, seed, USE_MOCK } from "./api";
import { MShell } from "./shell";
import { Portrait } from "./portrait";
import {
  RegNo, FieldCard, SectionLabel, LicenseBadge, AssetImage, EmptyBlock, BottomBar, AppliedTo,
} from "./asset-kit";

// ============================================================
// N1 IP 详情 · 资产容器 / N2 IP 授权
//
// IP 是六类资产里唯一的容器：下挂 人物 / 场景 / 产品 / 声音；
// 合成产物回流登记为它的衍生物（作品 tab），授权 tab 管 LIC 凭证与续签。
// ============================================================
const hI: any = React.createElement;
const { useState: useStateI, useEffect: useEffectI, useCallback: useCallbackI } = React;
const { WxNav: WxNavI } = MShell;

// ── 关联成员选择 sheet ──────────────────────────────────────
function AttachSheet({ ipId, kind, onClose, onDone }) {
  const [busy, setBusy] = useStateI("");
  const label = { character: "人物", scene: "场景", product: "产品" }[kind] || "资产";
  const pool = useApi(
    () => (kind === "character" ? AvatarApi.list("mine")
      : kind === "scene" ? AssetApi.scenes()
      : AssetApi.products()),
    kind === "character" ? seed.avatars() : kind === "scene" ? seed.scenes2() : seed.products(),
    [kind],
  );
  const free = (pool || []).filter((x: any) => !x.ipId || x.ipId === ipId);

  const attach = async (x: any) => {
    setBusy(x.id);
    try {
      await AssetApi.ipMember(ipId, { assetType: kind, assetId: x.id, attach: x.ipId !== ipId });
      onDone();
    } catch (e: any) {
      (window as any).toast?.(e?.message || "关联失败", { tone: "err" });
    } finally { setBusy(""); }
  };

  return hI(React.Fragment, null,
    hI("div", { className: "m-sheet-backdrop", onClick: onClose }),
    hI("div", { className: "m-sheet", style: { padding: "0 16px calc(16px + var(--home-ind))", maxHeight: "76%", display: "flex", flexDirection: "column" } },
      hI("div", { className: "m-sheet-grip" }),
      hI("div", { style: { padding: "6px 4px 14px" } },
        hI("div", { style: { fontFamily: "var(--font-disp)", fontWeight: 800, fontSize: 18 } }, "关联" + label),
        hI("div", { style: { fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 } },
          "把已有" + label + "收拢进这个 IP；再点一次即取消关联。")),
      hI("div", { className: "no-bar", style: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 4 } },
        free.length === 0 && hI(EmptyBlock, { compact: true, icon: Icons.folder, title: "还没有可关联的" + label }),
        free.map((x: any) => {
          const on = x.ipId === ipId;
          return hI("button", { key: x.id, onClick: () => attach(x), disabled: !!busy, className: "m-tap", style: {
            display: "flex", alignItems: "center", gap: 12, padding: 10, width: "100%", textAlign: "left",
            background: "var(--surface)", border: "1px solid " + (on ? "var(--primary)" : "var(--line)"),
            borderRadius: 14, cursor: "pointer", opacity: busy && busy !== x.id ? 0.5 : 1 } },
            kind === "character"
              ? hI(Portrait, { char: x, variant: "key", ratio: "1 / 1", radius: 10, style: { width: 46, flex: "0 0 46px" } })
              : hI(AssetImage, { url: x.imageUrl, ratio: "1 / 1", radius: 10, label: x.name, style: { width: 46, flex: "0 0 46px" } }),
            hI("div", { style: { flex: 1, minWidth: 0 } },
              hI("div", { className: "asset-name m-clip1", style: { fontSize: 15.5 } }, x.name),
              hI(RegNo, { id: x.id, style: { fontSize: 10, marginTop: 3 } })),
            busy === x.id
              ? hI(UI.Spinner, { size: 16 })
              : hI("span", { style: { fontSize: 12.5, fontWeight: 700, color: on ? "var(--ink-3)" : "var(--primary)", flex: "0 0 auto" } },
                  on ? "取消关联" : "关联"));
        }))));
}

// ── N1 IP 详情 ──────────────────────────────────────────────
function MIpDetail({ ip: initialIp, ctx }) {
  const ipId = initialIp?.id;
  const [tab, setTab] = useStateI("assets");     // assets | works | license
  const [seq, setSeq] = useStateI(0);
  const [attach, setAttach] = useStateI("");
  const [detail, setDetail] = useStateI(null as any);
  const [loading, setLoading] = useStateI(true);

  const load = useCallbackI(() => {
    if (!ipId) return;
    let live = true;
    setLoading(true);
    AssetApi.ip(ipId)
      .then((d) => { if (live) { setDetail(d); setLoading(false); } })
      .catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [ipId]);
  useEffectI(() => { const c = load(); return c; }, [load, seq]);

  const ip = detail?.ip || initialIp || {};
  const chars = detail?.characters || [];
  const scenes = detail?.scenes || [];
  const products = detail?.products || [];
  const voices = detail?.voices || [];
  const works = detail?.compositions || [];
  const m = ip.members || { characters: 0, scenes: 0, products: 0, voices: 0 };

  const stats = [
    { n: m.characters, label: "人物" },
    { n: m.scenes, label: "场景" },
    { n: m.products, label: "产品" },
    { n: m.voices, label: "音色" },
  ];

  const compose = () => {
    const c = chars[0];
    const s = scenes[0];
    ctx.openCompose({ avatar: c || null, scene: s || null, product: products[0] || null, ipName: ip.name });
  };

  return hI("div", { className: "m-overlay", "data-screen-label": "IP 详情" },
    hI(WxNavI, { title: "IP 详情", onBack: ctx.back }),

    hI("div", { className: "m-body", style: { padding: "0 0 96px" } },
      // 身份卡
      hI("div", { className: "m-card", style: { margin: "0 18px", padding: 18, position: "relative", overflow: "hidden" } },
        hI("div", { className: "dossier-paper", style: { position: "absolute", inset: 0, pointerEvents: "none" } }),
        hI("div", { style: { position: "relative", display: "flex", gap: 14 } },
          hI(AssetImage, { url: ip.coverUrl, ratio: "1 / 1", radius: 15, label: ip.name,
            style: { width: 74, flex: "0 0 74px" } }),
          hI("div", { style: { flex: 1, minWidth: 0 } },
            hI(RegNo, { id: ip.id }),
            hI("div", { className: "asset-name-lg m-clip1", style: { fontSize: 26, marginTop: 6 } }, ip.name),
            ip.tagline && hI("div", { className: "m-clip2", style: { fontSize: 12.5, color: "var(--ink-2)", marginTop: 5, lineHeight: 1.45 } }, ip.tagline))),
        hI("div", { style: { position: "relative", display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" } },
          hI(UI.Badge, { tone: "ok", dot: true }, "已就绪"),
          hI(LicenseBadge, { status: ip.licenseStatus, licenseId: ip.licenseId }),
          hI("span", { style: { flex: 1 } }),
          hI("span", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-4)" } }, "v" + (ip.versions || 1)))),

      // 成员统计
      hI("div", { className: "m-card", style: { margin: "14px 18px 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(4,1fr)", overflow: "hidden" } },
        stats.map((s, i) => hI("div", { key: s.label, style: {
          padding: "13px 6px", textAlign: "center", borderRight: i < 3 ? "1px solid var(--line)" : "none" } },
          hI("div", { className: "mono", style: { fontSize: 18, fontWeight: 700, color: "var(--ink)" } }, s.n),
          hI("div", { style: { fontSize: 11, color: "var(--ink-3)", marginTop: 3 } }, s.label)))),

      // tab
      hI("div", { style: { display: "flex", gap: 22, padding: "16px 18px 0", borderBottom: "1px solid var(--line)", margin: "0 0 2px" } },
        [["assets", "资产"], ["works", "作品"], ["license", "授权"]].map(([k, l]) => {
          const on = tab === k;
          return hI("button", { key: k, onClick: () => setTab(k), style: {
            position: "relative", background: "none", border: "none", cursor: "pointer", padding: "0 0 9px",
            fontFamily: "var(--font-disp)", fontSize: 15, fontWeight: on ? 800 : 600,
            color: on ? "var(--ink)" : "var(--ink-3)" } },
            l, on && hI("span", { style: { position: "absolute", left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 99, background: "var(--primary)" } }));
        })),

      loading && !detail
        ? hI("div", { style: { padding: "24px 18px" } },
            hI("div", { className: "m-skel", style: { height: 92, borderRadius: 14 } }))
        : tab === "assets"
        ? hI("div", { className: "m-fade", style: { padding: "14px 18px 0" } },
            // CHARACTERS
            hI(SectionLabel, { label: "CHARACTERS", action: "＋ 关联", onAction: () => setAttach("character") }),
            hI("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 } },
              chars.map((c: any) => hI("button", { key: c.id, onClick: () => ctx.openChar(c), className: "m-tap", style: {
                padding: 0, border: "none", background: "none", cursor: "pointer" } },
                hI(Portrait, { char: c, variant: "key", ratio: "4 / 5", radius: 10 }))),
              hI("button", { onClick: () => setAttach("character"), className: "m-tap", "aria-label": "关联人物", style: {
                aspectRatio: "4 / 5", borderRadius: 10, border: "1.5px dashed var(--line-3)", background: "var(--surface-2)",
                display: "grid", placeItems: "center", color: "var(--primary)", cursor: "pointer" } },
                hI(Icons.plus, { size: 18, stroke: 2 }))),

            // SCENES
            hI("div", { style: { marginTop: 18 } },
              hI(SectionLabel, { label: "SCENES", count: scenes.length, action: "＋ 关联", onAction: () => setAttach("scene") }),
              scenes.length === 0
                ? hI(EmptyBlock, { compact: true, icon: Icons.image, title: "还没有关联场景", desc: "把常用实拍空间收拢进来，合成时可直接取用" })
                : hI("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 } },
                    scenes.map((s: any) => hI("button", { key: s.id, onClick: () => ctx.openScene(s), className: "m-tap", style: { padding: 0, border: "none", background: "none", cursor: "pointer" } },
                      hI(AssetImage, { url: s.imageUrl, label: s.name, ratio: "16 / 11", radius: 10, running: s.status === "running" }))))),

            // PRODUCTS
            hI("div", { style: { marginTop: 18 } },
              hI(SectionLabel, { label: "PRODUCTS", count: products.length, action: "＋ 关联", onAction: () => setAttach("product") }),
              products.length === 0
                ? hI(EmptyBlock, { compact: true, icon: Icons.cube, title: "还没有关联产品", desc: "商品图入库后可直接合成带货素材" })
                : hI("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 } },
                    products.map((p: any) => hI("button", { key: p.id, onClick: () => ctx.openProduct(p), className: "m-tap", style: { padding: 0, border: "none", background: "none", cursor: "pointer" } },
                      hI(AssetImage, { url: p.imageUrl, label: p.name + "\n" + p.id, ratio: "1 / 1", radius: 10, running: p.status === "running" }))))),

            // VOICES —— 声音随其绑定的人物进 IP，不单独关联
            hI("div", { style: { marginTop: 18, paddingBottom: 8 } },
              hI(SectionLabel, { label: "VOICES", count: voices.length }),
              voices.length === 0
                ? hI("div", { style: { fontSize: 12, color: "var(--ink-3)", lineHeight: 1.6 } },
                    "声音随其绑定的人物一起归入本 IP。给上面的人物绑定音色后，这里会自动出现。")
                : hI("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 } },
                    voices.map((v: any) => hI("span", { key: v.id, style: {
                      display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
                      borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line-2)",
                      fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" } },
                      hI(Icons.mic, { size: 13, stroke: 2 }), v.name)))))
        : tab === "works"
        ? hI("div", { className: "m-fade", style: { padding: "16px 18px 0" } },
            works.length === 0
              ? hI(EmptyBlock, { icon: Icons.sparkle, title: "还没有作品",
                  desc: "用合成工作台把 人物 × 场景 × 产品 出成一组内容，产物会自动登记为这个 IP 的衍生物。",
                  action: "打开合成工作台", onAction: compose })
              : hI("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
                  works.map((w: any) => hI("button", { key: w.id, onClick: () => ctx.openComposeResult(w), className: "m-tap", style: {
                    padding: 11, width: "100%", textAlign: "left", background: "var(--surface)",
                    border: "1px solid var(--line)", borderRadius: 15, cursor: "pointer" } },
                    hI("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 9 } },
                      hI(RegNo, { id: w.id }),
                      hI("span", { style: { flex: 1 } }),
                      hI("span", { className: "mono", style: { fontSize: 10, color: "var(--ink-4)" } }, w.created)),
                    hI("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 } },
                      (w.outputs || []).slice(0, 4).map((o: any) =>
                        hI(AssetImage, { key: o.id, url: o.url, ratio: "9 / 16", radius: 9, label: o.no }))),
                    w.status === "running" && hI("div", { style: { marginTop: 9 } },
                      hI(UI.Progress, { pct: 40, h: 4 }))))))
        : hI(MIpLicensePanel, { ip, license: detail?.license, ctx, onChanged: () => setSeq((s) => s + 1) })),

    hI(BottomBar, {
      secondaryLabel: "授权凭证",
      onSecondary: () => setTab("license"),
      primaryLabel: "用这个 IP 合成",
      primaryIcon: Icons.sparkle,
      onPrimary: compose,
    }),

    attach && hI(AttachSheet, {
      ipId, kind: attach,
      onClose: () => setAttach(""),
      onDone: () => { setSeq((s) => s + 1); ctx.reload?.(); },
    }));
}

// ── N2 IP 授权（详情内 tab，同时也是独立可达面板）──────────────
function MIpLicensePanel({ ip, license, ctx, onChanged }) {
  const [busy, setBusy] = useStateI(false);
  const status = ip?.licenseStatus || license?.status || null;

  const act = async () => {
    setBusy(true);
    try {
      await AssetApi.ipLicense(ip.id, {});
      (window as any).toast?.(status ? "授权已续签一年" : "IP 授权已登记", { tone: "ok" });
      onChanged();
    } catch (e: any) {
      (window as any).toast?.(e?.message || "操作失败", { tone: "err" });
    } finally { setBusy(false); }
  };

  if (!status) {
    return hI("div", { className: "m-fade", style: { padding: "16px 18px 0" } },
      hI(EmptyBlock, {
        icon: Icons.shield, title: "这个 IP 还没有授权登记",
        desc: "六类资产里只有真人肖像与 IP 需要授权 —— 登记后会生成 LIC 凭证，合成出片时自动核验。",
        action: busy ? "登记中…" : "登记 IP 授权", onAction: busy ? undefined : act,
      }));
  }

  return hI("div", { className: "m-fade", style: { padding: "16px 18px 0" } },
    hI("div", { className: "m-card", style: { padding: "18px 18px 16px", textAlign: "center", marginBottom: 16 } },
      hI("div", { className: "seal", style: { marginBottom: 14 } }, status === "active" ? "Licensed" : status === "expired" ? "Expired" : "Pending"),
      hI("div", { className: "mono", style: { fontSize: 15, fontWeight: 700, color: "var(--ink)" } }, license?.id || ip.licenseId),
      hI("div", { style: { fontSize: 12.5, color: "var(--ink-3)", marginTop: 5 } },
        status === "active" ? "授权生效中，可用于商业出片" : status === "expired" ? "授权已过期，续签后方可出片" : "授权待签署")),

    hI(FieldCard, { fields: [
      { k: "SUBJECT", v: license?.subject || ip.name },
      { k: "SCOPE", v: license?.scope || "品牌商用 / 全平台" },
      { k: "PERIOD", v: license?.period || "—" },
      { k: "PLATFORMS", v: (license?.platforms || ["全平台"]).join(" · ") },
      { k: "SIGNED", v: license?.signed || "—" },
    ] }),

    hI("div", { style: { display: "flex", gap: 10, marginTop: 16, paddingBottom: 8 } },
      hI(UI.Button, { variant: "line", full: true, size: "lg", icon: Icons.download,
        onClick: () => ctx.go("licenses") }, "在授权登记里查看"),
      hI(UI.Button, { variant: "primary", full: true, size: "lg", icon: Icons.retry, disabled: busy,
        onClick: act }, busy ? "处理中…" : "续签一年")));
}

// ── IP 授权（从授权登记 / 深链直达的独立页）──────────────────
function MIpLicense({ ip, ctx }) {
  const [seq, setSeq] = useStateI(0);
  const detail = useApi(() => AssetApi.ip(ip.id), null as any, [ip?.id, seq]);
  const cur = detail?.ip || ip;
  return hI("div", { className: "m-overlay", "data-screen-label": "IP 授权" },
    hI(WxNavI, { title: "IP 授权", onBack: ctx.back }),
    hI("div", { className: "m-body", style: { padding: "4px 0 30px" } },
      hI("div", { style: { padding: "0 18px 4px" } },
        hI(RegNo, { id: cur.id }),
        hI("div", { className: "asset-name-lg", style: { fontSize: 24, marginTop: 6 } }, cur.name)),
      hI(MIpLicensePanel, { ip: cur, license: detail?.license, ctx, onChanged: () => setSeq((s) => s + 1) })));
}

export { MIpDetail, MIpLicense };
