"use client";
// ============================================================
// 移动端 · App 根 — 路由 / Tab / 覆盖页栈 / 创建入口 / 屏幕索引
//   忠实移植自原型 m4/m-app.jsx；适配为 Next 客户端组件（SSR 安全）。
// ============================================================
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { AvatarApi, useApi, seed } from "./api";
import { MShell } from "./shell";
import { toast } from "./toast";
import { MHome } from "./screen-home";
import { MLibrary, MDetail } from "./screen-library";
import { MLooksGrid, MDesignLooks } from "./screen-avatar";
import { MVoice, MApps } from "./screen-voiceapps";
import { MLicenses, MTasks, MMe } from "./screen-lictaskme";
import { MDerivView, MMembership, MSettings, MStorage, MVoiceClone } from "./screen-more";
import { MRealCapture } from "./screen-real";
import { MCreate } from "./screen-chain";
import { MAICreate } from "./screen-aicreate";
import { MChooseVoice } from "./screen-voicepick";

const hA : any = React.createElement;
const { useState: useStateA, useEffect: useEffectA } = React;
const { PhoneFrame, WxTabBar } = MShell;

// 合成一个新建草稿数字人（驱动创建向导）
function freshChar(path, avatars: any[] = []) {
  const base = (avatars || []).find((c) => c.path === path) || avatars[0] || { hue: 250, hairStyle: "short", palette: {} };
  return {
    id: "DH-NEW", name: "新建数字人", codename: "new-character", path,
    archetype: path === "real" ? "真人授权复刻" : "AI 原创形象", tagline: "创建中…",
    status: "draft", updated: "刚刚", fav: false, hue: base.hue, hairStyle: base.hairStyle,
    palette: { ...base.palette }, counts: { atlas: 0, expr: 0, scene: 0, ward: 0, d3: 0, video: 0 },
    deriv: { atlas: "empty", expr: "empty", scene: "empty", ward: "empty", d3: "empty", video: "empty" },
    versions: 1, _fresh: true,
    def: { 设定语: "", 年龄: "—", 气质: "—", 用途: "—", 性格: [], 服饰: "—", 形象来源: path === "real" ? "真人授权" : "AI 原创" },
  };
}

// 创建路径选择 sheet
function CreateSheet({ onPick, onClose }) {
  const opt = (path, icon, name, desc, grad) => hA("button", { onClick: () => onPick(path), className: "m-tap", style: {
    display: "flex", alignItems: "center", gap: 14, width: "100%", padding: 15, textAlign: "left", cursor: "pointer",
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", boxShadow: "var(--sh-1)" } },
    hA("div", { style: { width: 50, height: 50, flex: "0 0 50px", borderRadius: "var(--r-md)", background: grad, display: "grid", placeItems: "center", color: "#fff", boxShadow: "0 6px 14px rgba(19,192,238,.3)" } }, hA(icon, { size: 25, stroke: 1.9 })),
    hA("div", { style: { flex: 1, minWidth: 0 } },
      hA("div", { style: { fontSize: 15.5, fontWeight: 700 } }, name),
      hA("div", { style: { fontSize: 12, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.45 } }, desc)),
    hA(Icons.chevR, { size: 18, stroke: 2, style: { color: "var(--ink-4)", flex: "0 0 auto" } }));
  return hA(React.Fragment, null,
    hA("div", { className: "m-sheet-backdrop", onClick: onClose }),
    hA("div", { className: "m-sheet", style: { padding: "0 18px calc(18px + var(--home-ind))" } },
      hA("div", { className: "m-sheet-grip" }),
      hA("div", { style: { textAlign: "center", padding: "6px 0 16px" } },
        hA("div", { style: { fontFamily: "var(--font-disp)", fontWeight: 700, fontSize: 18 } }, "创建数字人"),
        hA("div", { style: { fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 } }, "选择创建路径")),
      hA("div", { style: { display: "flex", flexDirection: "column", gap: 11 } },
        opt("ai", Icons.sparkle, "AI 原创", "一句文字描述，从零原创一个虚构形象，版权自有", "linear-gradient(155deg,#1C2B3A,#14202B)"),
        opt("real", Icons.person, "真人授权复刻", "录一段动作 / 上传素材，签署授权合规复刻", "var(--grad)"))));
}

const INDEX = [
  { label: "首页", n: "01", icon: Icons.home, go: (c) => c.tab("home") },
  { label: "数字人库", n: "02", icon: Icons.user, go: (c) => c.tab("library") },
  { label: "资产详情", n: "03", icon: Icons.idcard, go: (c) => c.openChar(c.firstAvatar) },
  { label: "造型档案", n: "04", icon: Icons.images, go: (c) => c.openLooks(c.firstAvatar) },
  { label: "设计造型", n: "05", icon: Icons.wand, go: (c) => c.designLooks(c.firstAvatar) },
  { label: "衍生查看", n: "06", icon: Icons.image, go: (c) => c.openDeriv(c.firstAvatar, "scene") },
  { label: "AI 创建", n: "07", icon: Icons.sparkle, go: (c) => c.startCreate("ai") },
  { label: "真人捕获", n: "08", icon: Icons.film, go: (c) => c.startRealClone() },
  { label: "应用中心", n: "09", icon: Icons.grid, go: (c) => c.tab("apps") },
  { label: "声音工作室", n: "10", icon: Icons.mic, go: (c) => c.go("voice") },
  { label: "选择声音", n: "11", icon: Icons.wave, go: (c) => c.chooseVoice(c.firstAvatar) },
  { label: "声音克隆", n: "12", icon: Icons.mic, go: (c) => c.go("voiceclone") },
  { label: "授权登记", n: "13", icon: Icons.shield, go: (c) => c.go("licenses") },
  { label: "作业队列", n: "14", icon: Icons.bolt, go: (c) => c.go("tasks") },
  { label: "我的", n: "15", icon: Icons.dot, go: (c) => c.tab("me") },
  { label: "会员与算力", n: "16", icon: Icons.gem, go: (c) => c.go("membership") },
  { label: "存储用量", n: "17", icon: Icons.folder, go: (c) => c.go("storage") },
  { label: "设置", n: "18", icon: Icons.settings, go: (c) => c.go("settings") },
];

export function App() {
  const [tab, setTab] = useStateA("home");
  const [stack, setStack] = useStateA([]);
  const [sheet, setSheet] = useStateA(false);
  const [label, setLabel] = useStateA("首页");
  const [voiceByChar, setVoiceByChar] = useStateA({});
  const avatars = useApi(() => AvatarApi.list("mine"), seed.avatars());

  // 深链（hash）支持，挂载后读取，避免 SSR/水合不一致。
  useEffectA(() => {
    const h = (location.hash || "").replace("#", "");
    const tabs = ["home", "library", "apps", "me"];
    if (tabs.includes(h)) { setTab(h); return; }
    if (h === "voice" || h === "licenses" || h === "tasks") { setStack([{ screen: h, props: {} }]); return; }
    if (h === "detail") { setTab("library"); setStack([{ screen: "detail", props: { char: avatars[0] } }]); return; }
    if (h === "create-ai") { setStack([{ screen: "aicreate", props: { char: freshChar("ai", avatars) } }]); return; }
    if (h === "create-real") { setStack([{ screen: "realcapture", props: { char: freshChar("real", avatars) } }]); return; }
  }, []);

  const top = stack[stack.length - 1];

  const ctx: any = {
    toast: (m, o) => toast(m, o),
    firstAvatar: avatars[0],
    tab: (k) => { setStack([]); setTab(k); setSheet(false); setLabel({ home: "首页", library: "数字人库", apps: "应用中心", me: "我的" }[k]); },
    go: (screen, props) => { setStack((s) => [...s, { screen, props: props || {} }]); setLabel({ voice: "声音工作室", licenses: "授权登记", tasks: "作业队列", settings: "设置", membership: "会员与算力", storage: "存储用量", voiceclone: "声音克隆" }[screen] || screen); },
    openChar: (char) => { setStack((s) => [...s, { screen: "detail", props: { char } }]); setLabel("资产详情"); },
    openDeriv: (char, deriv) => { setStack((s) => [...s, { screen: "derivview", props: { char, deriv } }]); setLabel("衍生查看"); },
    openLooks: (char) => { setStack((s) => [...s, { screen: "looks", props: { char } }]); setLabel("造型档案"); },
    designLooks: (char) => { setStack((s) => [...s, { screen: "designlooks", props: { char } }]); setLabel("设计造型"); },
    chooseVoice: (char, onPick) => { setStack((s) => [...s, { screen: "choosevoice", props: { char, onPick } }]); setLabel("选择音色"); },
    voiceFor: (char) => (char && voiceByChar[char.id]) || "亲和邻家女声",
    setVoice: (char, name) => { if (char) setVoiceByChar((m) => ({ ...m, [char.id]: name })); },
    back: () => setStack((s) => s.slice(0, -1)),
    startCreate: (path, char) => { setSheet(false); setStack((s) => [...s, { screen: path === "ai" && !char ? "aicreate" : "create", props: { char: char || freshChar(path, avatars) } }]); setLabel(path === "ai" && !char ? "AI 创建" : "创建链路"); },
    startRealClone: (char) => { setSheet(false); setStack((s) => [...s, { screen: "realcapture", props: { char: char || freshChar("real", avatars) } }]); setLabel("真人捕获"); },
    realToWizard: (char) => { setStack((s) => { const ns = s.slice(0, -1); ns.push({ screen: "create", props: { char } }); return ns; }); setLabel("创建链路"); },
    finishCreate: (char) => { setStack((s) => { const ns = s.slice(0, -1); ns.push({ screen: "detail", props: { char } }); return ns; }); setLabel("资产详情"); },
    openCreateSheet: () => setSheet(true),
  };

  const tabScreen = { home: MHome, library: MLibrary, apps: MApps, me: MMe }[tab];
  const overlayScreen = top && { detail: MDetail, voice: MVoice, licenses: MLicenses, tasks: MTasks, create: MCreate, realcapture: MRealCapture,
    settings: MSettings, membership: MMembership, storage: MStorage, voiceclone: MVoiceClone, derivview: MDerivView, looks: MLooksGrid, designlooks: MDesignLooks, aicreate: MAICreate, choosevoice: MChooseVoice }[top.screen];
  const hideTabBar = !!top;
  const darkCap = false;

  return hA("div", { className: "m-stage" },
    // 屏幕索引（桌面通览）
    hA("div", { className: "m-index" },
      hA("h4", null, "屏幕索引"),
      hA("div", { className: "m-index-hint" }, "点击跳转查看每个页面 · 移动端完整通览"),
      INDEX.map((ix) => hA("button", { key: ix.label, className: "ix" + (label === ix.label ? " on" : ""), onClick: () => ix.go(ctx) },
        hA("span", { className: "n" }, ix.n),
        hA(ix.icon, { size: 17, stroke: 1.85 }),
        hA("span", { style: { flex: 1 } }, ix.label)))),

    // 手机
    hA(PhoneFrame, { darkCap },
      hA("div", { key: tab, style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column" } },
        hA(tabScreen, { ctx })),

      overlayScreen && hA("div", { key: stack.length + top.screen, className: "m-page-in", style: { position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", background: "var(--canvas)" } },
        hA(overlayScreen, { ...top.props, ctx })),

      !hideTabBar && hA(WxTabBar, { active: tab, onTab: ctx.tab, onCreate: ctx.openCreateSheet }),

      sheet && hA(CreateSheet, { onPick: (p) => (p === "real" ? ctx.startRealClone() : ctx.startCreate(p)), onClose: () => setSheet(false) })),

    hA(UI.ToastHost, null));
}
