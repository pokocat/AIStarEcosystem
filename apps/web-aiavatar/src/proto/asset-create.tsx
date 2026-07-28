"use client";
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { AssetApi, awaitJob, ASSET_TYPES } from "./api";
import { kindIcon } from "./asset-kit";

// ============================================================
// C0 新建资产 —— 先选类型，再选来源
//
// 「实拍上传」与「AI 生成」两条路径并重；系统按类型自动分配登记号
// （DH- / IP- / SC- / PD- / VO- / ST-）。
// 人物与声音走既有的创建链路，另四类在这里就地完成。
// ============================================================
const hN: any = React.createElement;
const { useState: useStateN, useRef: useRefN } = React;

export type CreatePath = { kind: string; path: 0 | 1 };

/** 六类资产选择 sheet（每行右侧两个来源 chip，点哪个就走哪条路径）。 */
export function AssetCreateSheet({ onPick, onClose }) {
  return hN(React.Fragment, null,
    hN("div", { className: "m-sheet-backdrop", onClick: onClose }),
    hN("div", { className: "m-sheet", style: { padding: "0 14px calc(14px + var(--home-ind))" } },
      hN("div", { className: "m-sheet-grip" }),
      hN("div", { style: { padding: "12px 6px 6px" } },
        hN("div", { style: { fontFamily: "var(--font-disp)", fontSize: 19, fontWeight: 800, letterSpacing: "-.02em" } }, "新建资产"),
        hN("div", { style: { fontSize: 12.5, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 } },
          "先选类型，再选来源 —— 实拍上传与 AI 生成两条路径并重。")),
      hN("div", { style: { padding: "8px 0 4px", display: "flex", flexDirection: "column", gap: 6 } },
        ASSET_TYPES.map((t: any) => hN("div", { key: t.key, style: {
          display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 15,
          background: "var(--surface)", border: "1px solid var(--line)" } },
          hN("span", { style: { width: 38, height: 38, flex: "0 0 38px", borderRadius: 12, display: "grid", placeItems: "center",
            background: t.key === "character" ? "var(--primary-soft)" : "var(--surface-3)",
            color: t.key === "character" ? "var(--primary)" : "var(--ink-2)" } },
            hN(kindIcon(t.key), { size: 19, stroke: 1.9 })),
          hN("div", { style: { flex: 1, minWidth: 0 } },
            hN("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
              hN("span", { style: { fontSize: 14.5, fontWeight: 700 } }, t.label),
              hN("span", { className: "mono", style: { fontSize: 9.5, color: "var(--ink-4)" } }, t.prefix)),
            hN("div", { className: "m-clip1", style: { fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 } }, t.desc)),
          hN("div", { style: { display: "flex", gap: 6, flex: "0 0 auto" } },
            t.paths.map((p: string, i: number) => hN("button", {
              key: p, onClick: () => onPick({ kind: t.key, path: i }), className: "m-tap", style: {
                height: 26, padding: "0 9px", borderRadius: 999, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                background: i === 1 ? "var(--primary-soft)" : "var(--surface-3)",
                color: i === 1 ? "var(--primary)" : "var(--ink-2)" } }, p)))))),
      hN("div", { style: { padding: "10px 8px 4px", display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ink-3)" } },
        hN(Icons.bolt, { size: 13, stroke: 2, style: { color: "var(--primary)", flex: "0 0 auto" } }),
        "批量上传时可一次入库多张，系统自动按类型分配登记号")));
}

/** 隐藏的 file input：点一下选图，选完立刻回调。 */
export function useFilePicker(onFiles: (files: File[]) => void) {
  const ref = useRefN<HTMLInputElement>(null);
  const node = hN("input", {
    ref, type: "file", accept: "image/*", multiple: true, style: { display: "none" },
    onChange: (e: any) => {
      const files: File[] = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length) onFiles(files);
    },
  });
  return { node, open: () => ref.current?.click() };
}

/** AI 生成场景 / 产品的描述表单 sheet。 */
export function DescribeAssetSheet({ kind, onClose, onSubmit, busy }) {
  const isScene = kind === "scene";
  const [name, setName] = useStateN("");
  const [prompt, setPrompt] = useStateN("");
  const [category, setCategory] = useStateN("");
  const [space, setSpace] = useStateN("indoor");
  const examples = isScene
    ? ["晨光洒进的北欧风起居室，浅木地板与米色布艺沙发", "夜晚城市天台，远处霓虹与玻璃幕墙", "极简白色无缝背景棚，均匀顶光"]
    : ["磨砂玻璃瓶身的精华液，银色压泵，冷调质感", "复古铁罐装手冲咖啡粉，牛皮纸标签", "浅灰色人体工学办公椅，网布靠背"];

  return hN(React.Fragment, null,
    hN("div", { className: "m-sheet-backdrop", onClick: busy ? undefined : onClose }),
    hN("div", { className: "m-sheet", style: { padding: "0 18px calc(18px + var(--home-ind))", maxHeight: "86%", overflowY: "auto" } },
      hN("div", { className: "m-sheet-grip" }),
      hN("div", { style: { padding: "6px 0 14px" } },
        hN("div", { style: { fontFamily: "var(--font-disp)", fontWeight: 800, fontSize: 18 } },
          isScene ? "AI 生成场景" : "AI 生成产品图"),
        hN("div", { style: { fontSize: 12.5, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 } },
          isScene
            ? "描述一个空间 —— 生成的是不含人物的场景板，合成时人物才会站进去。"
            : "描述一件商品 —— 生成纯净底的产品主图，方便后续抠图与合成。")),

      hN(UI.Field, { label: isScene ? "场景描述" : "产品描述", required: true, style: { marginBottom: 14 } },
        hN(UI.Textarea, { value: prompt, onChange: setPrompt, rows: 3,
          placeholder: isScene ? "例如：晨光侧逆的家庭厨房，木质台面与浅陶器" : "例如：磨砂玻璃瓶身的精华液，银色压泵" })),

      hN("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 } },
        examples.map((x) => hN("button", { key: x, onClick: () => setPrompt(x), className: "m-tap", style: {
          maxWidth: "100%", height: 30, padding: "0 11px", borderRadius: 999, border: "1px solid var(--line-2)",
          background: "var(--surface)", color: "var(--ink-2)", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: x }, x))),

      hN(UI.Field, { label: "资产名（留空自动取描述前几个字）", style: { marginBottom: 14 } },
        hN(UI.Input, { value: name, onChange: setName, placeholder: isScene ? "暖光烘焙厨房" : "初见气垫粉底" })),

      isScene
        ? hN(UI.Field, { label: "空间归类", style: { marginBottom: 18 } },
            hN("div", { style: { display: "flex", gap: 7 } },
              [["indoor", "室内"], ["outdoor", "户外"], ["studio", "影棚"]].map(([k, l]) => hN("button", {
                key: k, onClick: () => setSpace(k), className: "m-tap", style: {
                  height: 34, padding: "0 15px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
                  border: "1px solid " + (space === k ? "var(--ink)" : "var(--line-2)"),
                  background: space === k ? "var(--ink)" : "var(--surface)", color: space === k ? "#fff" : "var(--ink-2)" } }, l))))
        : hN(UI.Field, { label: "品类", style: { marginBottom: 18 } },
            hN(UI.Input, { value: category, onChange: setCategory, placeholder: "美妆 · 底妆" })),

      hN(UI.Button, {
        variant: "primary", full: true, size: "lg", icon: Icons.sparkle, disabled: busy || !prompt.trim(),
        onClick: () => onSubmit({ prompt: prompt.trim(), name: name.trim() || undefined, space, category: category.trim() || undefined }),
      }, busy ? "生成中…" : "开始生成")));
}

/** 新建 IP / 风格模板的简单表单 sheet。 */
export function SimpleAssetSheet({ kind, onClose, onSubmit, busy }) {
  const isIp = kind === "ip";
  const [name, setName] = useStateN("");
  const [tagline, setTagline] = useStateN("");
  const [prompt, setPrompt] = useStateN("");
  return hN(React.Fragment, null,
    hN("div", { className: "m-sheet-backdrop", onClick: busy ? undefined : onClose }),
    hN("div", { className: "m-sheet", style: { padding: "0 18px calc(18px + var(--home-ind))", maxHeight: "86%", overflowY: "auto" } },
      hN("div", { className: "m-sheet-grip" }),
      hN("div", { style: { padding: "6px 0 14px" } },
        hN("div", { style: { fontFamily: "var(--font-disp)", fontWeight: 800, fontSize: 18 } },
          isIp ? "新建 IP" : "新建风格模板"),
        hN("div", { style: { fontSize: 12.5, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 } },
          isIp
            ? "IP 是容器 —— 建好后把人物 / 场景 / 产品收拢进来，就能整体授权、整体合成。"
            : "把一组出片基调存成模板，合成时一键复用。")),
      hN(UI.Field, { label: isIp ? "IP 名称" : "模板名称", required: true, style: { marginBottom: 14 } },
        hN(UI.Input, { value: name, onChange: setName, placeholder: isIp ? "星岚 Sēlan" : "品牌基调" })),
      hN(UI.Field, { label: isIp ? "一句话定位" : "一句话说明", style: { marginBottom: 14 } },
        hN(UI.Input, { value: tagline, onChange: setTagline, placeholder: isIp ? "银河旅人 · 品牌虚拟代言 IP" : "暖调 · 柔光 · 干净留白" })),
      !isIp && hN(UI.Field, { label: "出片基调（英文，直接叠加进出图提示词）", hint: "留空则只作为标签使用", style: { marginBottom: 18 } },
        hN(UI.Textarea, { value: prompt, onChange: setPrompt, rows: 2,
          placeholder: "warm brand tone, soft diffused light, clean negative space" })),
      hN(UI.Button, {
        variant: "primary", full: true, size: "lg", icon: Icons.check, disabled: busy || !name.trim(),
        onClick: () => onSubmit({ name: name.trim(), tagline: tagline.trim() || undefined,
          summary: tagline.trim() || undefined, promptEn: prompt.trim() || undefined }),
      }, busy ? "创建中…" : "创建")));
}

/**
 * 四类资产（IP / 场景 / 产品 / 风格）的新建流程宿主。
 * 挂在需要「＋新建」的屏上，用 `start({kind, path})` 触发；完成后回调 onCreated。
 * 人物与声音不在这里 —— 它们走既有的创建链路（AI 创建 / 真人捕获 / 声音工作室）。
 */
export function useAssetCreate(ctx: any, onCreated: (kind: string, asset: any) => void) {
  const [flow, setFlow] = useStateN(null as any);   // { kind, mode: 'describe'|'simple' }
  const [busy, setBusy] = useStateN(false);
  const [uploadKind, setUploadKind] = useStateN("");

  const picker = useFilePicker(async (files) => {
    const kind = uploadKind;
    setUploadKind("");
    if (!kind) return;
    setBusy(true);
    try {
      let last: any = null;
      for (const f of files) {
        last = kind === "scene" ? await AssetApi.uploadScene(f) : await AssetApi.uploadProduct(f);
      }
      (window as any).toast?.(
        files.length > 1 ? `${files.length} 个资产已入库` : `已入库 ${last?.id || ""}`, { tone: "ok" });
      onCreated(kind, last);
    } catch (e: any) {
      (window as any).toast?.(e?.message || "上传失败", { tone: "err" });
    } finally { setBusy(false); }
  });

  /** 按 {kind, path} 分派到对应路径；path=0 是左侧 chip，path=1 是右侧 chip。 */
  const start = (pick: CreatePath) => {
    const { kind, path } = pick;
    switch (kind) {
      case "character":
        if (path === 0) ctx.startRealClone(); else ctx.startCreate("ai");
        return;
      case "voice":
        if (path === 0) ctx.go("voiceclone"); else ctx.go("voice");
        return;
      case "ip":
        setFlow({ kind: "ip", mode: "simple" });
        return;
      case "style":
        setFlow({ kind: "style", mode: "simple" });
        return;
      case "scene":
      case "product":
        if (path === 0) { setUploadKind(kind); setTimeout(picker.open, 0); }
        else setFlow({ kind, mode: "describe" });
        return;
      default:
        return;
    }
  };

  const submitDescribe = async (body: any) => {
    const kind = flow.kind;
    setBusy(true);
    try {
      const r: any = kind === "scene"
        ? await AssetApi.createScene({ prompt: body.prompt, name: body.name, space: body.space })
        : await AssetApi.createProduct({ prompt: body.prompt, name: body.name, category: body.category });
      const asset = r?.scene || r?.product;
      const jobId = r?.job?.id;
      setFlow(null);
      (window as any).toast?.("已提交生成，完成后自动入库", { tone: "ok" });
      onCreated(kind, asset);
      if (jobId) {
        awaitJob(jobId)
          .then(() => { (window as any).toast?.(`${asset?.name || "资产"} 已生成`, { tone: "ok" }); onCreated(kind, asset); })
          .catch((e: any) => (window as any).toast?.(e?.message || "生成失败", { tone: "err" }));
      }
    } catch (e: any) {
      (window as any).toast?.(e?.message || "提交失败", { tone: "err" });
    } finally { setBusy(false); }
  };

  const submitSimple = async (body: any) => {
    const kind = flow.kind;
    setBusy(true);
    try {
      const asset = kind === "ip"
        ? await AssetApi.createIp({ name: body.name, tagline: body.tagline, summary: body.summary })
        : await AssetApi.createStyle({ name: body.name, summary: body.summary, promptEn: body.promptEn });
      setFlow(null);
      (window as any).toast?.(`${asset.id} 已登记`, { tone: "ok" });
      onCreated(kind, asset);
    } catch (e: any) {
      (window as any).toast?.(e?.message || "创建失败", { tone: "err" });
    } finally { setBusy(false); }
  };

  const node = hN(React.Fragment, null,
    picker.node,
    flow?.mode === "describe" && hN(DescribeAssetSheet, {
      kind: flow.kind, busy, onClose: () => setFlow(null), onSubmit: submitDescribe,
    }),
    flow?.mode === "simple" && hN(SimpleAssetSheet, {
      kind: flow.kind, busy, onClose: () => setFlow(null), onSubmit: submitSimple,
    }));

  return { start, node, busy };
}
