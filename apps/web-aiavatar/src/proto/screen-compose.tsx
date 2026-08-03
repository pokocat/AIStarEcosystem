"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { AssetApi, AvatarApi, ComposeApi, awaitJob, useApi, seed } from "./api";
import { MShell } from "./shell";
import { Portrait } from "./portrait";
import {
  RegNo, SectionLabel, AssetImage, EmptyBlock, BottomBar, SourceChip,
} from "./asset-kit";

// ============================================================
// N7 合成工作台 · 选料 / N8 合成结果 · 入库
//
// 人物 × 场景 × 产品 → 成片。出片前核对授权（真人复刻必须有生效 LIC），
// 产物入库登记为所属 IP 的衍生物，并给每个用到的资产写一条「已用于」。
// ============================================================
const hC: any = React.createElement;
const { useState: useStateC, useEffect: useEffectC } = React;
const { WxNav: WxNavC } = MShell;

const SLOT_META: any = {
  character: { en: "CHARACTER · 人物", empty: "选择要出镜的人物", hint: "必选 · 决定这组内容的身份" },
  scene: { en: "SCENE · 场景", empty: "选择拍摄场景", hint: "必选 · 决定环境与光线" },
  product: { en: "PRODUCT · 产品", empty: "选择要展示的产品", hint: "可选 · 不选则只出人物与场景" },
};

// ── 槽位卡 ──────────────────────────────────────────────────
function SlotCard({ kind, value, sub, thumb, onPick, onClear, active }) {
  const meta = SLOT_META[kind];
  if (!value) {
    return hC("button", { onClick: onPick, className: "m-tap", style: {
      display: "flex", alignItems: "center", gap: 12, padding: 11, width: "100%", textAlign: "left",
      background: "var(--surface-2)", border: "1.5px dashed var(--line-3)", borderRadius: 15, cursor: "pointer" } },
      hC("span", { style: { width: 58, height: 58, flex: "0 0 58px", borderRadius: 12, border: "1px solid var(--line-2)",
        background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--primary)" } },
        hC(Icons.plus, { size: 20, stroke: 2 })),
      hC("div", { style: { flex: 1, minWidth: 0 } },
        hC("div", { className: "field-label" }, meta.en),
        hC("div", { style: { fontSize: 14.5, fontWeight: 700, color: "var(--ink-2)", marginTop: 4 } }, meta.empty),
        hC("div", { style: { fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 } }, meta.hint)));
  }
  return hC("div", { style: {
    display: "flex", alignItems: "center", gap: 12, padding: 11,
    background: "var(--surface)", borderRadius: 15,
    border: "1px solid " + (active ? "var(--primary)" : "var(--line)"),
    boxShadow: active ? "var(--ring)" : "var(--sh-1)" } },
    thumb,
    hC("div", { style: { flex: 1, minWidth: 0 } },
      hC("div", { className: "field-label" }, meta.en),
      hC("div", { className: "asset-name m-clip1", style: { fontSize: 17, marginTop: 3 } }, value),
      hC("div", { className: "mono m-clip1", style: { fontSize: 9.5, color: "var(--ink-4)", marginTop: 2 } }, sub)),
    hC("div", { style: { display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto", alignItems: "flex-end" } },
      hC("button", { onClick: onPick, className: "m-tap", style: {
        background: "none", border: "none", padding: 0, cursor: "pointer",
        fontSize: 12.5, fontWeight: 700, color: "var(--primary)" } }, "更换"),
      onClear && hC("button", { onClick: onClear, className: "m-tap", style: {
        background: "none", border: "none", padding: 0, cursor: "pointer",
        fontSize: 11.5, fontWeight: 600, color: "var(--ink-4)" } }, "移除")));
}

// ── 选料 sheet ──────────────────────────────────────────────
function PickerSheet({ kind, onClose, onPick }) {
  const title = { character: "选择人物", scene: "选择场景", product: "选择产品", style: "选择风格模板" }[kind];
  const list = useApi(
    () => (kind === "character" ? AvatarApi.list("mine")
      : kind === "scene" ? AssetApi.scenes()
      : kind === "product" ? AssetApi.products()
      : AssetApi.styles()),
    kind === "character" ? seed.avatars()
      : kind === "scene" ? seed.scenes2()
      : kind === "product" ? seed.products() : seed.styles(),
    [kind],
  );
  // 人物必须已有定妆形象、场景 / 产品必须已出图，否则合成时会被后端挡下
  const items = (list || []).filter((x: any) =>
    kind === "character" ? (x.imageUrl || (x.shotImages && Object.keys(x.shotImages).length))
      : kind === "style" ? true
      : x.status !== "running");

  return hC(React.Fragment, null,
    hC("div", { className: "m-sheet-backdrop", onClick: onClose }),
    hC("div", { className: "m-sheet", style: { padding: "0 16px calc(16px + var(--home-ind))", maxHeight: "78%", display: "flex", flexDirection: "column" } },
      hC("div", { className: "m-sheet-grip" }),
      hC("div", { style: { padding: "6px 4px 12px", display: "flex", alignItems: "baseline", gap: 8 } },
        hC("div", { style: { fontFamily: "var(--font-disp)", fontWeight: 800, fontSize: 18 } }, title),
        hC("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-4)" } }, items.length)),
      hC("div", { className: "no-bar", style: { flex: 1, overflowY: "auto", paddingBottom: 4 } },
        items.length === 0
          ? hC(EmptyBlock, { icon: Icons.folder, title: "还没有可用的" + (title || "").slice(2),
              desc: kind === "character" ? "先创建一个数字人并完成出图" : "先上传或生成一个资产" })
          : kind === "style"
          ? hC("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
              items.map((x: any) => hC("button", { key: x.id, onClick: () => onPick(x), className: "m-tap", style: {
                display: "flex", alignItems: "center", gap: 12, padding: 12, width: "100%", textAlign: "left",
                background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, cursor: "pointer" } },
                hC("span", { style: { width: 38, height: 38, flex: "0 0 38px", borderRadius: 11, display: "grid",
                  placeItems: "center", background: "var(--surface-3)", color: "var(--ink-2)" } },
                  hC(Icons.palette, { size: 19, stroke: 1.9 })),
                hC("div", { style: { flex: 1, minWidth: 0 } },
                  hC("div", { className: "m-clip1", style: { fontSize: 14.5, fontWeight: 700 } }, x.name),
                  hC("div", { className: "m-clip1", style: { fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 } }, x.summary || (x.tags || []).join(" · "))),
                hC(RegNo, { id: x.id, style: { fontSize: 9.5, flex: "0 0 auto" } }))))
          : hC("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px 10px" } },
              items.map((x: any) => hC("button", { key: x.id, onClick: () => onPick(x), className: "m-tap", style: {
                padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left" } },
                kind === "character"
                  ? hC(Portrait, { char: x, variant: "key", ratio: "4 / 5", radius: 11 })
                  : hC(AssetImage, { url: x.imageUrl, label: x.name, ratio: kind === "product" ? "1 / 1" : "16 / 11", radius: 11 }),
                hC("div", { className: "asset-name m-clip1", style: { fontSize: 13.5, marginTop: 6 } }, x.name),
                hC("div", { className: "mono m-clip1", style: { fontSize: 9, color: "var(--ink-4)" } }, x.id)))))));
}

// ── N7 合成工作台 ───────────────────────────────────────────
function MCompose({ preset, ctx }) {
  const [avatar, setAvatar] = useStateC(preset?.avatar || null);
  const [scene, setScene] = useStateC(preset?.scene || null);
  const [product, setProduct] = useStateC(preset?.product || null);
  const [style, setStyle] = useStateC(null as any);
  const [ratio, setRatio] = useStateC("9:16");
  const [count, setCount] = useStateC(4);
  const [picker, setPicker] = useStateC("");
  const [busy, setBusy] = useStateC(false);
  const [pct, setPct] = useStateC(0);
  const [stage, setStage] = useStateC("");
  const [authBlocked, setAuthBlocked] = useStateC("");   // 服务端因缺肖像授权拒绝出片时的提示文案

  const options = useApi(() => ComposeApi.options(), seed.composeOptions(), []);
  const perImage = options?.costPerImage ?? 3;
  const ratios = options?.ratios?.length ? options.ratios : ["9:16", "1:1", "16:9"];
  const maxCount = options?.maxCount ?? 8;
  const minCount = options?.minCount ?? 1;
  useEffectC(() => { if (options?.defaultCount) setCount(options.defaultCount); }, [options?.defaultCount]);
  // 默认带上使用最多的那个风格模板（列表已按 useCount 倒序）
  useEffectC(() => { if (!style && options?.styles?.length) setStyle(options.styles[0]); }, [options?.styles]);

  const cost = perImage * count;
  const ready = !!avatar && !!scene;

  // 出片前的授权提示：真人复刻没有生效授权时，这里就明确说不能出片（后端也会拦）
  const licenseNote = (() => {
    if (!ready) return null;
    const parts: string[] = [];
    let blocked = false;
    if (avatar.path === "real") {
      if (avatar.license) parts.push(`人物 ${avatar.license} 有效`);
      else { parts.push("人物是真人复刻但未登记肖像授权"); blocked = true; }
    } else parts.push("人物为 AI 原创，无需肖像授权");
    parts.push(scene.source === "shot" ? "场景为自有实拍" : "场景为 AI 生成");
    if (product) {
      parts.push(product.brandAuthorized
        ? `产品已获品牌方授权${product.brandLicenseUntil ? `（至 ${product.brandLicenseUntil}）` : ""}`
        : "产品未登记品牌方授权，请确认商用范围");
    }
    return { blocked, text: (blocked ? "无法出片：" : "已核对授权：") + parts.join("，") + (blocked ? "。" : "，可商用。") };
  })();

  const pick = (x: any) => {
    if (picker === "character") setAvatar(x);
    else if (picker === "scene") setScene(x);
    else if (picker === "product") setProduct(x);
    else if (picker === "style") setStyle(x);
    setPicker("");
  };

  const submit = async () => {
    if (!ready) { (window as any).toast?.("请先选好人物与场景", { tone: "warn" }); return; }
    if (licenseNote?.blocked) {
      (window as any).toast?.("这个真人复刻形象还没有生效的肖像授权", { tone: "err" });
      return;
    }
    setBusy(true);
    setPct(0);
    setStage("提交中…");
    setAuthBlocked("");
    try {
      const r: any = await ComposeApi.create({
        avatarId: avatar.id, sceneId: scene.id,
        productId: product?.id || null, styleId: style?.id || null,
        ratio, count,
      });
      const comp = r?.composition;
      const jobId = r?.job?.id || comp?.jobId;
      if (jobId) {
        await awaitJob(jobId, (j: any) => { setPct(j.pct); setStage(j.eta || "合成中…"); });
      }
      const fresh = comp?.id ? await ComposeApi.get(comp.id).catch(() => comp) : comp;
      ctx.openComposeResult(fresh, { replace: true });
      ctx.reload?.();
    } catch (e: any) {
      // 缺生效肖像授权被拒（未建单未扣费）→ 给「去完成授权认证」引导，而不是一句干巴巴的报错
      if (e?.code === "DAP_LICENSE_REQUIRED") {
        setAuthBlocked(e?.message || "该真人形象还没有完成肖像授权，无法出片");
      } else {
        (window as any).toast?.(e?.message || "合成失败，请稍后重试", { tone: "err" });
      }
    } finally { setBusy(false); }
  };

  const seg = (v: string, cur: string, onClick: any, label?: string) => hC("button", {
    key: v, onClick, className: "m-tap", style: {
      height: 32, padding: "0 14px", borderRadius: 999, border: "none", cursor: "pointer",
      fontSize: 12.5, fontWeight: v === cur ? 700 : 600,
      background: v === cur ? "var(--ink)" : "var(--surface-3)", color: v === cur ? "#fff" : "var(--ink-2)" } },
    label || v.replace(":", " : "));

  return hC("div", { className: "m-overlay", "data-screen-label": "合成工作台" },
    hC(WxNavC, { title: "合成工作台", onBack: ctx.back,
      right: hC("button", { onClick: () => ctx.go("tasks"), "aria-label": "任务中心", className: "nav-spacer m-tap", style: {
        background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)", display: "grid", placeItems: "center" } },
        hC(Icons.history, { size: 19, stroke: 1.9 })) }),

    hC("div", { className: "m-body", style: { padding: "4px 18px 100px" } },
      preset?.ipName && hC("div", { style: { fontSize: 12, color: "var(--ink-3)", marginBottom: 10 } },
        "正在为 ", hC("b", { style: { color: "var(--ink-2)" } }, preset.ipName), " 合成"),

      // 三个槽位
      hC("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
        hC(SlotCard, {
          kind: "character", value: avatar?.name, active: true,
          sub: avatar ? `${avatar.id} · v${avatar.versions || 1}${avatar.voiceName ? " · 音色 " + avatar.voiceName : ""}` : "",
          thumb: avatar && hC(Portrait, { char: avatar, variant: "key", ratio: "1 / 1", radius: 12, style: { width: 58, flex: "0 0 58px" } }),
          onPick: () => setPicker("character"),
        }),
        hC(SlotCard, {
          kind: "scene", value: scene?.name,
          sub: scene ? `${scene.id} · ${scene.source === "shot" ? "实拍上传" : "AI 生成"}` : "",
          thumb: scene && hC(AssetImage, { url: scene.imageUrl, ratio: "1 / 1", radius: 12, label: scene.name, style: { width: 58, flex: "0 0 58px" } }),
          onPick: () => setPicker("scene"),
        }),
        hC(SlotCard, {
          kind: "product", value: product?.name,
          sub: product ? `${product.id}${product.category ? " · " + product.category : ""}` : "",
          thumb: product && hC(AssetImage, { url: product.imageUrl, ratio: "1 / 1", radius: 12, label: product.name, style: { width: 58, flex: "0 0 58px" } }),
          onPick: () => setPicker("product"),
          onClear: product ? () => setProduct(null) : undefined,
        })),

      // OUTPUT · 出片设置
      hC("div", { className: "m-card", style: { marginTop: 16, padding: "15px 16px" } },
        hC(SectionLabel, { label: "OUTPUT · 出片设置", style: { marginBottom: 12 } }),
        hC("div", { style: { display: "flex", flexDirection: "column", gap: 13 } },
          hC("div", null,
            hC("div", { style: { fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 7 } }, "画幅"),
            hC("div", { style: { display: "flex", gap: 7, flexWrap: "wrap" } },
              ratios.map((r: string) => seg(r, ratio, () => setRatio(r))))),

          hC("div", null,
            hC("div", { style: { fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 7, display: "flex", alignItems: "center", gap: 6 } },
              "风格模板", hC("span", { className: "mono", style: { fontSize: 9.5, color: "var(--ink-4)" } }, "ST-")),
            hC("div", { style: { display: "flex", gap: 7, flexWrap: "wrap" } },
              style && hC("span", { key: "cur", style: {
                display: "inline-flex", alignItems: "center", height: 32, padding: "0 13px", borderRadius: 999,
                background: "var(--primary-soft)", color: "var(--primary)", fontSize: 12.5, fontWeight: 700,
                maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                title: `${style.name} · ${style.id}` }, `${style.name} · ${style.id}`),
              hC("button", { key: "swap", onClick: () => setPicker("style"), className: "m-tap", style: {
                height: 32, padding: "0 13px", borderRadius: 999, border: "none", cursor: "pointer",
                background: "var(--surface-3)", color: "var(--ink-2)", fontSize: 12.5, fontWeight: 600 } },
                style ? "更换" : "选择模板"),
              style && hC("button", { key: "clr", onClick: () => setStyle(null), className: "m-tap", style: {
                height: 32, padding: "0 11px", borderRadius: 999, border: "none", cursor: "pointer",
                background: "none", color: "var(--ink-4)", fontSize: 12, fontWeight: 600 } }, "不用模板"))),

          hC("div", null,
            hC("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 } },
              hC("span", { style: { fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" } }, "出图数量"),
              hC("span", { className: "mono", style: { fontSize: 12, fontWeight: 700, color: "var(--ink)" } }, count + " 张")),
            hC(UI.Slider, { value: count, min: minCount, max: maxCount, onChange: setCount })))),

      // 授权核对
      licenseNote && hC("div", { style: {
        marginTop: 14, display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 14px", borderRadius: 12,
        background: licenseNote.blocked ? "var(--err-s)" : "var(--primary-tint)",
        border: "1px solid " + (licenseNote.blocked ? "var(--err-s)" : "var(--primary-soft)") } },
        hC(licenseNote.blocked ? Icons.warn : Icons.shield, { size: 15, stroke: 2, style: {
          flex: "0 0 auto", marginTop: 1, color: licenseNote.blocked ? "var(--err)" : "var(--primary)" } }),
        hC("div", { style: { flex: 1, minWidth: 0 } },
          hC("div", { style: { fontSize: 12, color: licenseNote.blocked ? "var(--err)" : "var(--ink-2)", lineHeight: 1.5, wordBreak: "break-word" } },
            licenseNote.text),
          licenseNote.blocked && avatar && hC("div", { style: { marginTop: 10 } },
            hC(UI.Button, { variant: "primary", size: "sm", icon: Icons.scan,
              onClick: () => ctx.startRealAuth(avatar) }, "去完成授权认证")))),

      // 服务端授权核对未通过（403）—— 同样给认证引导入口
      authBlocked && hC("div", { style: {
        marginTop: 14, display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 14px", borderRadius: 12,
        background: "var(--err-s)", border: "1px solid var(--err-s)" } },
        hC(Icons.warn, { size: 15, stroke: 2, style: { flex: "0 0 auto", marginTop: 1, color: "var(--err)" } }),
        hC("div", { style: { flex: 1, minWidth: 0 } },
          hC("div", { style: { fontSize: 12, color: "var(--err)", lineHeight: 1.5, wordBreak: "break-word" } }, authBlocked),
          hC("div", { style: { fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45, marginTop: 4 } }, "本次没有建单，也没有扣算力。"),
          avatar && hC("div", { style: { marginTop: 10 } },
            hC(UI.Button, { variant: "primary", size: "sm", icon: Icons.scan,
              onClick: () => ctx.startRealAuth(avatar) }, "去完成授权认证")))),

      busy && hC("div", { className: "m-card", style: { marginTop: 14, padding: "14px 15px" } },
        hC("div", { style: { display: "flex", alignItems: "center", gap: 9, marginBottom: 9 } },
          hC(UI.Spinner, { size: 16 }),
          hC("span", { style: { fontSize: 13, fontWeight: 700 } }, "合成中"),
          hC("span", { style: { flex: 1 } }),
          hC("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-3)" } }, stage)),
        hC(UI.Progress, { pct: Math.max(4, pct), h: 5 }))),

    hC(BottomBar, { busy, primaryLabel: busy ? "合成中…" : "开始合成", primaryIcon: Icons.sparkle, onPrimary: submit },
      hC("div", { style: { flex: "0 0 auto", marginRight: 2 } },
        hC("div", { className: "field-label" }, "COST"),
        hC("div", { className: "mono", style: { fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 2 } },
          cost + " 算力"))),

    picker && hC(PickerSheet, { kind: picker, onClose: () => setPicker(""), onPick: pick }));
}

// ── N8 合成结果 · 入库 ───────────────────────────────────────
function MComposeResult({ composition: initial, ctx }) {
  const id = initial?.id;
  const [lightbox, setLightbox] = useStateC(-1);
  const [seq, setSeq] = useStateC(0);
  const c = useApi(() => ComposeApi.get(id), initial, [id, seq]) || initial || {};
  const outputs = c.outputs || [];
  const done = c.status === "done";

  // 深链 / 后台返回时任务可能还在跑 —— 盯到终态后自动刷出成片，不用用户手动刷新
  useEffectC(() => {
    if (c.status !== "running" || !c.jobId) return;
    let live = true;
    awaitJob(c.jobId)
      .then(() => { if (live) setSeq((n) => n + 1); })
      .catch(() => { if (live) setSeq((n) => n + 1); });
    return () => { live = false; };
  }, [c.status, c.jobId]);

  const download = () => {
    const url = outputs[0]?.url;
    if (!url) { (window as any).toast?.("成片还没有产出", { tone: "warn" }); return; }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.id}-01.png`;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  };

  return hC("div", { className: "m-overlay", "data-screen-label": "合成结果" },
    hC(WxNavC, { title: "合成结果", onBack: ctx.back,
      right: hC("button", { onClick: download, "aria-label": "下载", className: "nav-spacer m-tap", style: {
        background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)", display: "grid", placeItems: "center" } },
        hC(Icons.download, { size: 19, stroke: 2 })) }),

    hC("div", { className: "m-body", style: { padding: "0 18px 100px" } },
      hC("div", { style: { display: "flex", alignItems: "center", gap: 9, padding: "2px 0 14px", flexWrap: "wrap" } },
        done
          ? hC("span", { className: "seal" }, "Archived")
          : hC(UI.Badge, { tone: "info", dot: true }, c.status === "failed" ? "合成失败" : "合成中"),
        hC("span", { style: { fontSize: 12.5, color: "var(--ink-3)", flex: 1, minWidth: 0 } },
          done
            ? `${outputs.length} 张已入库${c.ipId ? `，登记为 ${c.ipId} 的衍生物` : "，未归入 IP"}`
            : c.status === "failed" ? "没有产出，已退回冻结算力" : "正在出片，稍后回来查看")),

      done && outputs.length > 0
        ? hC("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 } },
            outputs.map((o: any, i: number) => hC("button", {
              key: o.id, onClick: () => setLightbox(i), className: "m-tap", "aria-label": "查看第 " + o.no + " 张",
              style: { padding: 0, border: "none", background: "none", cursor: "pointer" } },
              hC(AssetImage, { url: o.url, ratio: "9 / 16", radius: 12, label: o.no,
                badge: hC("span", { className: "mono", style: { fontSize: 8.5, color: "var(--ink)",
                  background: "rgba(255,255,255,.9)", padding: "2px 5px", borderRadius: 4 } }, o.no) }))))
        : hC(EmptyBlock, { icon: c.status === "failed" ? Icons.warn : Icons.clock,
            title: c.status === "failed" ? "这次合成没有成功" : "成片生成中",
            desc: c.status === "failed" ? "冻结的算力已退回，可以回工作台重新出片。" : "可以先去别处逛逛，完成后会在任务中心提醒。" }),

      // SOURCE · 用到的资产
      (c.sources || []).length > 0 && hC("div", { className: "m-card", style: { marginTop: 16, padding: "15px 16px" } },
        hC(SectionLabel, { label: "SOURCE · 用到的资产", style: { marginBottom: 11 } }),
        hC("div", { style: { display: "flex", flexDirection: "column", gap: 9 } },
          (c.sources || []).map((r: any) => hC("div", { key: r.kind + r.id, style: { display: "flex", alignItems: "center", gap: 10 } },
            hC(AssetImage, { url: r.thumbUrl, ratio: "1 / 1", radius: 8, label: r.name, style: { width: 28, flex: "0 0 28px" } }),
            hC("span", { className: "m-clip1", style: { fontSize: 13, fontWeight: 600, color: "var(--ink)", maxWidth: "45%" } }, r.name),
            hC("span", { className: "leader" }),
            hC("span", { className: "mono", style: { fontSize: 10.5, color: "var(--ink-3)", flex: "0 0 auto" } }, r.id))))),

      c.licenseNote && hC("div", { style: {
        marginTop: 14, display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 14px", borderRadius: 12,
        background: "var(--primary-tint)", border: "1px solid var(--primary-soft)" } },
        hC(Icons.shield, { size: 15, stroke: 2, style: { flex: "0 0 auto", marginTop: 1, color: "var(--primary)" } }),
        hC("span", { style: { fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 } }, c.licenseNote)),

      hC("div", { style: { marginTop: 14, display: "flex", gap: 9 } },
        hC(UI.Button, { variant: "line", full: true, size: "md", icon: Icons.retry,
          onClick: () => ctx.openCompose({ recompose: c }, { replace: true }) }, "再合成一组"),
        hC(UI.Button, { variant: "soft", full: true, size: "md", icon: Icons.clapper,
          onClick: () => ctx.tab("apps") }, "送去应用中心"))),

    hC(BottomBar, {
      primaryLabel: "完成 · 回到资产库",
      onPrimary: () => { ctx.reload?.(); ctx.tab("library"); },
    }),

    lightbox >= 0 && hC(ResultLightbox, {
      outputs, index: lightbox, onIndex: setLightbox, onClose: () => setLightbox(-1),
    }));
}

/** 成片大图预览（左右切换 + 计数）。 */
function ResultLightbox({ outputs, index, onIndex, onClose }) {
  const n = outputs.length;
  const cur = outputs[index] || {};
  const nav = (d: number) => onIndex((index + d + n) % n);
  return hC("div", { onClick: onClose, style: {
    position: "fixed", inset: 0, zIndex: 220, background: "rgba(8,14,20,.92)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
    hC("button", { onClick: onClose, "aria-label": "关闭", style: {
      position: "absolute", top: "calc(14px + env(safe-area-inset-top))", right: 16, width: 36, height: 36,
      borderRadius: 99, border: "none", background: "rgba(255,255,255,.16)", color: "#fff",
      display: "grid", placeItems: "center", cursor: "pointer" } }, hC(Icons.x, { size: 20, stroke: 2.2 })),
    cur.url && hC("img", { src: cur.url, alt: cur.no, onClick: (e: any) => e.stopPropagation(), style: {
      maxWidth: "92%", maxHeight: "72%", objectFit: "contain", borderRadius: 12 } }),
    n > 1 && hC("div", { onClick: (e: any) => e.stopPropagation(), style: {
      display: "flex", alignItems: "center", gap: 20, marginTop: 22, color: "#fff" } },
      hC("button", { onClick: () => nav(-1), "aria-label": "上一张", style: {
        width: 40, height: 40, borderRadius: 99, border: "none", background: "rgba(255,255,255,.16)",
        color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" } }, hC(Icons.chevL, { size: 20, stroke: 2.2 })),
      hC("span", { className: "mono", style: { fontSize: 13, opacity: .85 } }, `${index + 1} / ${n}`),
      hC("button", { onClick: () => nav(1), "aria-label": "下一张", style: {
        width: 40, height: 40, borderRadius: 99, border: "none", background: "rgba(255,255,255,.16)",
        color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" } }, hC(Icons.chevR, { size: 20, stroke: 2.2 }))));
}

export { MCompose, MComposeResult };
