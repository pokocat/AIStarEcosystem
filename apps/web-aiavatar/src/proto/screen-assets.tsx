"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { AssetApi, AvatarApi, VoiceApi, useApi, seed, USE_MOCK, SPACE_LABELS } from "./api";
import { Portrait } from "./portrait";
import { LiveJobBadge } from "./job-badge";
import { MLibrary } from "./screen-library";
import { useAssetCreate } from "./asset-create";
import {
  RegNo, SectionLabel, SourceChip, AssetImage, AddTile, EmptyBlock, LicenseBadge, kindIcon,
} from "./asset-kit";

// ============================================================
// T2 资产库（原「数字人库」）—— 顶部分类在 人物 · IP · 场景 · 产品 · 声音 · 风格 之间穿行
//
// 「全部」= 跨类型分区总览；选中某类 = 该类专属库
// （N3 场景库 / N5 产品库 / N9 风格模板库都在这里）。
// 「资产广场」沿用既有的数字人广场（只读样板形象 + 运营内嵌后台）。
// ============================================================
const hA: any = React.createElement;
const { useState: useStateA, useEffect: useEffectA, useCallback: useCallbackA } = React;

const CATS = [
  { key: "all", label: "全部" },
  { key: "character", label: "人物" },
  { key: "ip", label: "IP" },
  { key: "scene", label: "场景" },
  { key: "product", label: "产品" },
  { key: "voice", label: "声音" },
  { key: "style", label: "风格" },
];

// ── 分类 pill 条 ────────────────────────────────────────────
function CatPills({ cat, counts, onPick }) {
  return hA("div", { className: "no-bar", style: { display: "flex", gap: 8, padding: "13px 18px 0", overflowX: "auto" } },
    CATS.map((c) => {
      const on = cat === c.key;
      const n = c.key === "all" ? counts.__total : counts[c.key];
      return hA("button", { key: c.key, onClick: () => onPick(c.key), className: "m-tap", style: {
        flex: "0 0 auto", height: 34, padding: "0 14px", borderRadius: 999, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
        border: "1px solid " + (on ? "var(--ink)" : "var(--line-2)"),
        background: on ? "var(--ink)" : "var(--surface)", color: on ? "#fff" : "var(--ink-2)" } },
        c.label,
        n != null && hA("span", { className: "mono", style: { fontSize: 10.5, opacity: .75 } }, n));
    }));
}

// ── 各类型卡片 ──────────────────────────────────────────────
function CharacterTile({ char, onOpen, onJobDone }) {
  return hA("button", { onClick: () => onOpen(char), className: "m-press", style: {
    padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%" } },
    hA("div", { style: { position: "relative" } },
      hA(Portrait, { char, variant: "key", ratio: "4 / 5", radius: 12 }),
      hA(LiveJobBadge, { char, onDone: onJobDone, compact: true })),
    hA("div", { className: "asset-name m-clip1", style: { fontSize: 13.5, marginTop: 6 } }, char.name),
    hA(RegNo, { id: char.id, style: { fontSize: 9 } }));
}

function IpRow({ ip, onOpen }) {
  return hA("button", { onClick: () => onOpen(ip), className: "m-tap", style: {
    display: "flex", alignItems: "center", gap: 12, padding: 10, width: "100%", textAlign: "left",
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 15, cursor: "pointer" } },
    hA(AssetImage, { url: ip.coverUrl, ratio: "1 / 1", radius: 12, label: ip.name, style: { width: 52, flex: "0 0 52px" } }),
    hA("div", { style: { flex: 1, minWidth: 0 } },
      hA("div", { style: { display: "flex", alignItems: "center", gap: 7, minWidth: 0 } },
        hA("span", { className: "asset-name m-clip1", style: { fontSize: 16, minWidth: 0 } }, ip.name),
        hA(LicenseBadge, { status: ip.licenseStatus, style: { flex: "0 0 auto", maxWidth: 96 } })),
      hA("div", { className: "m-clip1", style: { fontSize: 11.5, color: "var(--ink-3)", marginTop: 3 } },
        `${ip.members?.characters || 0} 人物 · ${ip.members?.scenes || 0} 场景 · ${ip.members?.products || 0} 产品 · ${ip.members?.voices || 0} 音色`)),
    hA(Icons.chevR, { size: 18, stroke: 2, style: { color: "var(--ink-4)", flex: "0 0 auto" } }));
}

function SceneTile({ scene, onOpen }) {
  return hA("button", { onClick: () => onOpen(scene), className: "m-press", style: {
    padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%" } },
    hA(AssetImage, {
      url: scene.imageUrl, label: scene.name, ratio: "16 / 11", radius: 12,
      running: scene.status === "running",
      badge: scene.status !== "running" && hA(SourceChip, { source: scene.source }),
    }),
    hA("div", { className: "asset-name m-clip1", style: { fontSize: 15, marginTop: 7 } }, scene.name),
    hA("div", { className: "mono m-clip1", style: { fontSize: 9.5, color: "var(--ink-4)", marginTop: 2 } },
      `${scene.id} · ${scene.status === "running" ? "生成中" : scene.spec}`));
}

function ProductTile({ product, onOpen }) {
  return hA("button", { onClick: () => onOpen(product), className: "m-press", style: {
    padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%" } },
    hA(AssetImage, {
      url: product.imageUrl, label: product.name, ratio: "1 / 1", radius: 12,
      running: product.status === "running",
      badge: product.brandAuthorized && hA("span", { className: "mono", style: {
        fontSize: 8.5, color: "var(--ok)", background: "rgba(255,255,255,.92)", padding: "2px 5px", borderRadius: 4 } }, "已授权"),
    }),
    hA("div", { className: "asset-name m-clip1", style: { fontSize: 13.5, marginTop: 6 } }, product.name),
    hA("div", { className: "mono m-clip1", style: { fontSize: 9, color: "var(--ink-4)" } }, product.id));
}

function StyleRow({ style: s, onOpen }) {
  return hA("button", { onClick: () => onOpen(s), className: "m-tap", style: {
    display: "flex", alignItems: "center", gap: 12, padding: 12, width: "100%", textAlign: "left",
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 15, cursor: "pointer" } },
    hA("span", { style: { width: 38, height: 38, flex: "0 0 38px", borderRadius: 11, display: "grid", placeItems: "center",
      background: "var(--surface-3)", color: "var(--ink-2)" } }, hA(Icons.palette, { size: 19, stroke: 1.9 })),
    hA("div", { style: { flex: 1, minWidth: 0 } },
      hA("div", { className: "m-clip1", style: { fontSize: 14.5, fontWeight: 700 } }, s.name),
      hA("div", { className: "m-clip1", style: { fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 } },
        s.summary || (s.tags || []).join(" · ") || "未填写基调")),
    hA("div", { style: { flex: "0 0 auto", textAlign: "right" } },
      hA(RegNo, { id: s.id, style: { fontSize: 9.5 } }),
      hA("div", { className: "mono", style: { fontSize: 9.5, color: "var(--ink-4)", marginTop: 3 } }, "用过 " + (s.useCount || 0) + " 次")));
}

function VoiceRow({ voice }) {
  return hA("div", { style: {
    display: "flex", alignItems: "center", gap: 12, padding: 12,
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 15 } },
    hA("span", { style: { width: 38, height: 38, flex: "0 0 38px", borderRadius: 11, display: "grid", placeItems: "center",
      background: "var(--surface-3)", color: "var(--ink-2)" } }, hA(Icons.mic, { size: 19, stroke: 1.9 })),
    hA("div", { style: { flex: 1, minWidth: 0 } },
      hA("div", { className: "m-clip1", style: { fontSize: 14.5, fontWeight: 700 } }, voice.name),
      hA("div", { className: "m-clip1", style: { fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 } },
        [voice.gender, voice.tone, voice.dur].filter(Boolean).join(" · "))),
    hA(RegNo, { id: voice.id, style: { fontSize: 9.5, flex: "0 0 auto" } }));
}

// ── 主屏 ────────────────────────────────────────────────────
function MAssetLibrary({ ctx }) {
  const [top, setTop] = useStateA("mine");        // mine | plaza
  const [cat, setCat] = useStateA("all");
  const [q, setQ] = useStateA("");
  const [srcFilter, setSrcFilter] = useStateA("all");   // 场景/产品的来源筛选
  const [spaceFilter, setSpaceFilter] = useStateA("all");
  const [seq, setSeq] = useStateA(0);

  const reload = useCallbackA(() => { setSeq((s) => s + 1); ctx.reload?.(); }, [ctx]);
  const create = useAssetCreate(ctx, (kind, asset) => {
    reload();
    if (kind === "ip" && asset) ctx.openIp(asset);
    if (kind === "scene" && asset) setCat("scene");
    if (kind === "product" && asset) setCat("product");
    if (kind === "style") setCat("style");
  });

  const summary = useApi(() => AssetApi.summary(), seed.assetSummary(), [seq]);
  const chars = useApi(() => AvatarApi.list("mine"), seed.avatars(), [seq]);
  const ips = useApi(() => AssetApi.ips(), seed.ips(), [seq]);
  const scenes = useApi(() => AssetApi.scenes(), seed.scenes2(), [seq]);
  const products = useApi(() => AssetApi.products(), seed.products(), [seq]);
  const styles = useApi(() => AssetApi.styles(), seed.styles(), [seq]);
  const voices = useApi(() => VoiceApi.mine(), seed.myVoices(), [seq]);

  const counts: any = {
    character: chars.length, ip: ips.length, scene: scenes.length,
    product: products.length, voice: voices.length, style: styles.length,
  };
  counts.__total = summary?.totalCount ?? Object.values(counts).reduce((a: any, b: any) => a + b, 0);

  const hit = (s: string) => !q || String(s || "").toLowerCase().includes(q.toLowerCase());
  const fChars = chars.filter((c: any) => hit(c.name + c.id + (c.archetype || "")));
  const fIps = ips.filter((x: any) => hit(x.name + x.id + (x.tagline || "")));
  const fScenes = scenes
    .filter((s: any) => hit(s.name + s.id + (s.description || "")))
    .filter((s: any) => srcFilter === "all" || s.source === srcFilter)
    .filter((s: any) => spaceFilter === "all" || s.space === spaceFilter);
  const fProducts = products
    .filter((p: any) => hit(p.name + p.id + (p.category || "")))
    .filter((p: any) => srcFilter === "all" || p.source === srcFilter);
  const fStyles = styles.filter((s: any) => hit(s.name + s.id + (s.summary || "")));
  const fVoices = voices.filter((v: any) => hit(v.name + v.id));

  // 切分类时重置二级筛选，避免「切到产品还留着室内筛选」这种隐形空结果
  useEffectA(() => { setSrcFilter("all"); setSpaceFilter("all"); }, [cat]);

  const sub = (label: string, key: string, cur: string, set: any) => hA("button", {
    key, onClick: () => set(key), className: "m-tap", style: {
      flex: "0 0 auto", height: 30, padding: "0 13px", borderRadius: 999, cursor: "pointer",
      fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
      border: "1px solid " + (cur === key ? "var(--ink)" : "var(--line-2)"),
      background: cur === key ? "var(--ink)" : "var(--surface)", color: cur === key ? "#fff" : "var(--ink-2)" } }, label);

  const sectionHead = (kind: string, count: number, onAll: any) =>
    hA("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 11 } },
      hA("span", { style: { color: "var(--ink-2)", display: "grid", placeItems: "center" } },
        hA(kindIcon(kind), { size: 16, stroke: 1.85 })),
      hA("span", { style: { fontSize: 14.5, fontWeight: 700 } }, CATS.find((c) => c.key === kind)?.label),
      hA("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-4)" } }, count),
      hA("span", { style: { flex: 1 } }),
      hA("button", { onClick: onAll, className: "m-tap", style: {
        background: "none", border: "none", padding: 0, cursor: "pointer",
        fontSize: 12.5, fontWeight: 700, color: "var(--primary)" } }, "全部 ›"));

  // ── 资产广场：沿用既有的数字人广场（只读样板 + 运营后台）──
  if (top === "plaza") {
    return hA("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column" } },
      hA(TopTabs, { top, setTop }),
      hA("div", { style: { flex: 1, minHeight: 0, position: "relative" } },
        hA(MLibrary, { ctx, plazaOnly: true })));
  }

  return hA("div", { className: "m-body has-tabbar", "data-screen-label": "资产库" },
    hA(TopTabs, { top, setTop }),

    // 搜索
    hA("div", { style: { display: "flex", alignItems: "center", gap: 9, padding: "6px 18px 0" } },
      hA("div", { style: { position: "relative", flex: 1 } },
        hA(Icons.search, { size: 16, stroke: 1.9, style: { position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", pointerEvents: "none" } }),
        hA("input", { value: q, placeholder: "搜索资产名 / 登记号…", onChange: (e: any) => setQ(e.target.value), style: {
          width: "100%", height: 42, padding: "0 14px 0 38px", background: "var(--surface)", border: "1px solid var(--line-2)",
          borderRadius: "var(--r-pill)", fontSize: 14, fontFamily: "var(--font-ui)", color: "var(--ink)", outline: "none", boxShadow: "var(--sh-1)" } })),
      hA("button", { onClick: ctx.openCreateSheet, "aria-label": "新建资产", className: "m-tap", style: {
        flex: "0 0 auto", width: 42, height: 42, borderRadius: "var(--r-pill)", border: "1px solid var(--line-2)",
        background: "var(--surface)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink-2)" } },
        hA(Icons.plus, { size: 19, stroke: 2 }))),

    hA(CatPills, { cat, counts, onPick: setCat }),

    // 二级筛选（场景 / 产品）
    cat === "scene" && hA("div", { className: "no-bar", style: { display: "flex", gap: 8, padding: "12px 18px 0", overflowX: "auto" } },
      sub("全部", "all", srcFilter, setSrcFilter),
      sub("实拍上传", "shot", srcFilter, setSrcFilter),
      sub("AI 生成", "ai", srcFilter, setSrcFilter),
      hA("span", { key: "gap", style: { flex: "0 0 6px" } }),
      ...Object.entries(SPACE_LABELS).map(([k, l]) => sub(l as string, k, spaceFilter, setSpaceFilter))),
    cat === "product" && hA("div", { className: "no-bar", style: { display: "flex", gap: 8, padding: "12px 18px 0", overflowX: "auto" } },
      sub("全部", "all", srcFilter, setSrcFilter),
      sub("实拍上传", "shot", srcFilter, setSrcFilter),
      sub("AI 生成", "ai", srcFilter, setSrcFilter)),

    // ── 全部：跨类型分区总览 ──
    cat === "all" && hA("div", { className: "m-fade" },
      hA("div", { style: { padding: "18px 18px 0" } },
        sectionHead("character", counts.character, () => setCat("character")),
        fChars.length === 0
          ? hA(EmptyBlock, { compact: true, icon: Icons.person, title: "还没有人物资产",
              desc: "真人授权复刻或 AI 原创，都从这里开始", action: "新建人物", onAction: ctx.openCreateSheet })
          : hA("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 } },
              fChars.slice(0, 6).map((c: any) => hA(CharacterTile, { key: c.id, char: c, onOpen: ctx.openChar, onJobDone: reload })))),

      hA("div", { style: { padding: "20px 18px 0" } },
        sectionHead("ip", counts.ip, () => setCat("ip")),
        fIps.length === 0
          ? hA(EmptyBlock, { compact: true, icon: Icons.gem, title: "还没有 IP",
              desc: "IP 是容器 —— 把人物 / 场景 / 产品收拢成一个可授权的整体",
              action: "新建 IP", onAction: () => create.start({ kind: "ip", path: 0 }) })
          : hA("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
              fIps.slice(0, 3).map((x: any) => hA(IpRow, { key: x.id, ip: x, onOpen: ctx.openIp })))),

      hA("div", { style: { padding: "20px 18px 0" } },
        sectionHead("scene", counts.scene, () => setCat("scene")),
        fScenes.length === 0
          ? hA(EmptyBlock, { compact: true, icon: Icons.image, title: "还没有场景",
              desc: "实拍空间入库，或用一句描述生成背景",
              action: "上传 / 生成场景", onAction: () => create.start({ kind: "scene", path: 0 }) })
          : hA("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 9px" } },
              fScenes.slice(0, 4).map((s: any) => hA(SceneTile, { key: s.id, scene: s, onOpen: ctx.openScene })))),

      hA("div", { style: { padding: "20px 18px 0" } },
        sectionHead("product", counts.product, () => setCat("product")),
        fProducts.length === 0
          ? hA(EmptyBlock, { compact: true, icon: Icons.cube, title: "还没有产品",
              desc: "商品多角度图入库后，可直接合成带货素材",
              action: "上传 / 生成产品", onAction: () => create.start({ kind: "product", path: 0 }) })
          : hA("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px 8px" } },
              fProducts.slice(0, 4).map((p: any) => hA(ProductTile, { key: p.id, product: p, onOpen: ctx.openProduct })))),

      hA("div", { style: { padding: "20px 18px 8px" } },
        sectionHead("style", counts.style, () => setCat("style")),
        fStyles.length === 0
          ? hA(EmptyBlock, { compact: true, icon: Icons.palette, title: "还没有风格模板",
              desc: "把一组出片基调存成模板，合成时一键复用",
              action: "新建模板", onAction: () => create.start({ kind: "style", path: 1 }) })
          : hA("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
              fStyles.slice(0, 3).map((s: any) => hA(StyleRow, { key: s.id, style: s, onOpen: ctx.openStyle }))))),

    // ── 人物 ──
    cat === "character" && hA("div", { className: "m-stagger", style: { padding: "14px 18px 8px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px 8px" } },
      hA("button", { key: "__new", onClick: ctx.openCreateSheet, className: "m-tap", style: {
        aspectRatio: "4 / 5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 8, cursor: "pointer", border: "1.5px dashed var(--line-3)", background: "var(--surface-2)",
        borderRadius: 12, color: "var(--ink-2)" } },
        hA("span", { style: { width: 34, height: 34, borderRadius: 99, background: "var(--surface)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center", color: "var(--primary)" } },
          hA(Icons.plus, { size: 17, stroke: 2 })),
        hA("span", { style: { fontSize: 12, fontWeight: 700 } }, "新建人物")),
      fChars.map((c: any) => hA(CharacterTile, { key: c.id, char: c, onOpen: ctx.openChar, onJobDone: reload }))),

    // ── IP ──
    cat === "ip" && hA("div", { className: "m-stagger", style: { padding: "14px 18px 8px", display: "flex", flexDirection: "column", gap: 9 } },
      fIps.map((x: any) => hA(IpRow, { key: x.id, ip: x, onOpen: ctx.openIp })),
      hA(AddTile, { key: "__new", label: "新建 IP 容器", height: 84, onClick: () => create.start({ kind: "ip", path: 0 }) })),

    // ── N3 场景库 ──
    cat === "scene" && hA("div", { className: "m-stagger", style: { padding: "14px 18px 8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 12px" } },
      hA(AddTile, { key: "__new", label: "上传 / 生成场景", height: 118, onClick: () => create.start({ kind: "scene", path: 0 }) }),
      fScenes.map((s: any) => hA(SceneTile, { key: s.id, scene: s, onOpen: ctx.openScene })),
      fScenes.length === 0 && hA("div", { key: "__hint", style: { gridColumn: "1 / -1", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.6 } },
        "还没有匹配的场景。点左边的卡片上传实拍图，或用一句描述生成一个空景板。")),

    // ── N5 产品库 ──
    cat === "product" && hA("div", { className: "m-stagger", style: { padding: "14px 18px 8px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px 10px" } },
      hA(AddTile, { key: "__new", label: "上传产品", ratio: "1 / 1", onClick: () => create.start({ kind: "product", path: 0 }) }),
      fProducts.map((p: any) => hA(ProductTile, { key: p.id, product: p, onOpen: ctx.openProduct })),
      fProducts.length === 0 && hA("div", { key: "__hint", style: { gridColumn: "1 / -1", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.6 } },
        "还没有匹配的产品。上传实拍图会自动记为「正面」角度，之后可一键补 45° / 背面 / 细节。")),

    // ── 声音 ──
    cat === "voice" && hA("div", { className: "m-stagger", style: { padding: "14px 18px 8px", display: "flex", flexDirection: "column", gap: 9 } },
      fVoices.length === 0
        ? hA(EmptyBlock, { icon: Icons.mic, title: "还没有我的声线",
            desc: "克隆自己的声音，或在声音工作室挑一款内置音色绑定到人物。",
            action: "去声音工作室", onAction: () => ctx.go("voice") })
        : fVoices.map((v: any) => hA(VoiceRow, { key: v.id, voice: v })),
      fVoices.length > 0 && hA(AddTile, { key: "__new", label: "克隆一段新声音", height: 84, onClick: () => ctx.go("voiceclone") })),

    // ── N9 风格模板库 ──
    cat === "style" && hA("div", { className: "m-stagger", style: { padding: "14px 18px 8px", display: "flex", flexDirection: "column", gap: 9 } },
      fStyles.map((s: any) => hA(StyleRow, { key: s.id, style: s, onOpen: ctx.openStyle })),
      hA(AddTile, { key: "__new", label: "新建风格模板", height: 84, onClick: () => create.start({ kind: "style", path: 1 }) })),

    create.node);
}

function TopTabs({ top, setTop }) {
  return hA("div", { className: "wx-nav", style: { paddingLeft: 18, flex: "0 0 auto" } },
    hA("div", { style: { flex: 1, minWidth: 0, display: "flex", gap: 22 } },
      [["mine", "我的资产"], ["plaza", "资产广场"]].map(([k, l]) => {
        const on = top === k;
        return hA("button", { key: k, onClick: () => setTop(k), style: {
          position: "relative", background: "none", border: "none", cursor: "pointer", padding: "0 0 6px",
          fontFamily: "var(--font-disp)", fontSize: 16.5, fontWeight: on ? 800 : 600,
          color: on ? "var(--ink)" : "var(--ink-3)", whiteSpace: "nowrap" } },
          l, on && hA("span", { style: { position: "absolute", left: 0, right: 0, bottom: -1, height: 3, borderRadius: 99, background: "var(--primary)" } }));
      })));
}

// ── 风格模板详情（轻量：编辑名称 / 基调 / 删除）──────────────
function MStyleDetail({ style: initial, ctx }) {
  const id = initial?.id;
  const [seq, setSeq] = useStateA(0);
  const [busy, setBusy] = useStateA(false);
  const [confirm, setConfirm] = useStateA(false);
  const s = useApi(() => AssetApi.style(id), initial, [id, seq]) || initial || {};
  const [name, setName] = useStateA(s.name || "");
  const [summary, setSummary] = useStateA(s.summary || "");
  const [prompt, setPrompt] = useStateA(s.promptEn || "");
  useEffectA(() => { setName(s.name || ""); setSummary(s.summary || ""); setPrompt(s.promptEn || ""); }, [s.id]);

  const save = async () => {
    setBusy(true);
    try {
      await AssetApi.patchStyle(id, { name, summary, promptEn: prompt });
      (window as any).toast?.("已保存", { tone: "ok" });
      setSeq((n) => n + 1);
      ctx.reload?.();
    } catch (e: any) {
      (window as any).toast?.(e?.message || "保存失败", { tone: "err" });
    } finally { setBusy(false); }
  };
  const remove = async () => {
    try {
      await AssetApi.removeStyle(id);
      (window as any).toast?.("风格模板已删除", { tone: "ok" });
      ctx.back();
      ctx.reload?.();
    } catch (e: any) {
      (window as any).toast?.(e?.message || "删除失败", { tone: "err" });
    }
  };

  return hA("div", { className: "m-overlay", "data-screen-label": "风格模板" },
    hA("div", { className: "wx-nav" },
      hA("button", { className: "nav-back m-tap", onClick: ctx.back, "aria-label": "返回" }, hA(Icons.chevL, { size: 24, stroke: 2.2 })),
      hA("span", { className: "nav-title" }, "风格模板"),
      hA("button", { onClick: () => setConfirm(true), "aria-label": "更多", className: "nav-spacer m-tap", style: {
        background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)", display: "grid", placeItems: "center" } },
        hA(Icons.dots, { size: 18, stroke: 2 }))),

    hA("div", { className: "m-body", style: { padding: "4px 18px 30px" } },
      hA(RegNo, { id: s.id }),
      hA("div", { className: "asset-name-lg", style: { fontSize: 25, margin: "7px 0 4px" } }, s.name),
      hA("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: "wrap" } },
        hA(UI.Badge, { tone: "mute" }, s.source === "work" ? "从作品提炼" : "手动新建"),
        hA(UI.Badge, { tone: "mute" }, "被合成用过 " + (s.useCount || 0) + " 次")),

      hA(UI.Field, { label: "模板名称", style: { marginBottom: 14 } },
        hA(UI.Input, { value: name, onChange: setName })),
      hA(UI.Field, { label: "一句话说明", style: { marginBottom: 14 } },
        hA(UI.Input, { value: summary, onChange: setSummary, placeholder: "暖调 · 柔光 · 干净留白" })),
      hA(UI.Field, { label: "出片基调（英文）", hint: "合成时会叠加进出图提示词；留空则只作为标签", style: { marginBottom: 18 } },
        hA(UI.Textarea, { value: prompt, onChange: setPrompt, rows: 3 })),

      (s.tags || []).length > 0 && hA("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 } },
        (s.tags || []).map((t: string) => hA(UI.Badge, { key: t, tone: "mute" }, t))),

      hA(UI.Button, { variant: "primary", full: true, size: "lg", icon: Icons.check, disabled: busy, onClick: save },
        busy ? "保存中…" : "保存修改")),

    hA(UI.Confirm, {
      open: confirm, onClose: () => setConfirm(false), onConfirm: remove,
      title: "删除这个风格模板？", desc: "已经用它出过的片不受影响。", confirmText: "删除",
    }));
}

export { MAssetLibrary, MStyleDetail };
