"use client";
// ============================================================
// 移动端 · App 根 — 路由 / Tab / 覆盖页栈 / 创建入口 / 登录门
//   live 模式（NEXT_PUBLIC_USE_MOCK=0）：未登录 → 登录屏；401 → 自动回登录屏。
// ============================================================
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { AvatarApi, VoiceApi, AuthApi, AssetApi, ComposeApi, useApi, useIdentity, seed, auth, onAuthExpired, USE_MOCK } from "./api";
import { MShell } from "./shell";
import { toast } from "./toast";
import { MHome } from "./screen-home";
import { MDetail } from "./screen-library";
import { MAssetLibrary } from "./screen-assets";
import { AssetCreateSheet, useAssetCreate } from "./asset-create";
import { MVoice, MApps } from "./screen-voiceapps";
import { MLicenses, MRealMaterials, MTasks, MMe, MTrash } from "./screen-lictaskme";
import { MLogin } from "./screen-login";

const hA : any = React.createElement;
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA, useCallback: useCallbackA, Suspense: SuspenseA } = React;
const { PhoneFrame, WxTabBar } = MShell;

const lazyScreen = (loader: any, exportName: string) =>
  React.lazy(() => loader().then((mod: any) => ({ default: mod[exportName] })));

const LAZY_OVERLAYS: any = {
  looks: lazyScreen(() => import("./screen-avatar"), "MLooksGrid"),
  designlooks: lazyScreen(() => import("./screen-avatar"), "MDesignLooks"),
  derivview: lazyScreen(() => import("./screen-more"), "MDerivView"),
  settings: lazyScreen(() => import("./screen-more"), "MSettings"),
  security: lazyScreen(() => import("./screen-more"), "MSecurity"),
  membership: lazyScreen(() => import("./screen-more"), "MMembership"),
  storage: lazyScreen(() => import("./screen-more"), "MStorage"),
  voiceclone: lazyScreen(() => import("./screen-more"), "MVoiceClone"),
  realcapture: lazyScreen(() => import("./screen-real"), "MRealCapture"),
  realauthresume: lazyScreen(() => import("./screen-real"), "MRealAuthResume"),
  create: lazyScreen(() => import("./screen-chain"), "MCreate"),
  aicreate: lazyScreen(() => import("./screen-aicreate"), "MAICreate"),
  choosevoice: lazyScreen(() => import("./screen-voicepick"), "MChooseVoice"),
  // 数字资产平台：IP 容器 / 场景 / 产品 / 风格 / 跨资产合成
  ipdetail: lazyScreen(() => import("./screen-ip"), "MIpDetail"),
  iplicense: lazyScreen(() => import("./screen-ip"), "MIpLicense"),
  scenedetail: lazyScreen(() => import("./screen-scene"), "MSceneDetail"),
  productdetail: lazyScreen(() => import("./screen-product"), "MProductDetail"),
  styledetail: lazyScreen(() => import("./screen-assets"), "MStyleDetail"),
  compose: lazyScreen(() => import("./screen-compose"), "MCompose"),
  composeresult: lazyScreen(() => import("./screen-compose"), "MComposeResult"),
};

// 合成一个新建草稿数字人（驱动创建向导首屏；live 模式在流程内落 server）
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


function OverlayLoading({ label }) {
  return hA("div", { style: {
    flex: 1, display: "grid", placeItems: "center", padding: 24, background: "var(--canvas)", color: "var(--ink-2)",
  } },
    hA("div", { style: { display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 700 } },
      hA(UI.Spinner, { size: 18 }),
      hA("span", null, (label || "页面") + "加载中")));
}

// v0.53 平台门禁拦截屏：账号已登录但未开通「数字人资产平台」(aiavatar) 子产品。
// 支持输入新秘钥「追加激活」（开通本子应用 + 发放该批次积分），或退出换号。
function MPlatformGate({ onActivated, onLogout }) {
  const [code, setCode] = useStateA("");
  const [busy, setBusy] = useStateA(false);
  const doActivate = async () => {
    if (!code.trim()) { toast("请输入激活码", { tone: "warn" }); return; }
    setBusy(true);
    try {
      const r = await AuthApi.activateLicense(code.trim());
      if (r?.user) auth.setSession(auth.token() || "", r.user);
      toast(`开通成功，已发放 ${r?.creditsGranted ?? 0} 积分`, { tone: "ok" });
      onActivated();
    } catch (e: any) {
      toast(e?.message || "激活失败，请检查激活码", { tone: "err" });
    } finally { setBusy(false); }
  };
  const btn = (label, onClick, primary = false) => hA("button", { className: "m-tap", onClick, disabled: busy, style: {
    width: "100%", padding: "13px 16px", borderRadius: "var(--r-md)", fontSize: 14.5, fontWeight: 700, cursor: "pointer",
    border: primary ? "none" : "1px solid var(--line)",
    background: primary ? "var(--grad)" : "var(--surface)",
    color: primary ? "#fff" : "var(--ink-2)", opacity: busy ? 0.65 : 1 } }, label);
  return hA("div", { style: { position: "absolute", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 26px", background: "var(--canvas)", textAlign: "center" }, "data-screen-label": "未开通" },
    hA("div", { style: { width: 58, height: 58, borderRadius: "50%", background: "rgba(18,179,222,.12)", display: "grid", placeItems: "center", marginBottom: 16 } },
      hA(Icons.lock || Icons.person, { size: 27, stroke: 1.9, style: { color: "var(--primary)" } })),
    hA("div", { style: { fontFamily: "var(--font-disp)", fontSize: 19, fontWeight: 800, marginBottom: 8 } }, "当前账号未开通数字人资产平台"),
    hA("p", { style: { fontSize: 13, color: "var(--ink-2)", lineHeight: 1.65, margin: "0 0 20px" } },
      "你的账号还没有本平台的使用权限。", hA("br", null), "有对应的激活码可直接开通；没有请联系客户经理或换号登录。"),
    hA("div", { style: { width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 11 } },
      hA(UI.Input, { value: code, onChange: setCode, placeholder: "输入激活码开通本平台", disabled: busy }),
      btn(busy ? "开通中…" : "激活开通", doActivate, true),
      btn("退出并切换账号", onLogout)));
}

// ── 哈希路由 ──────────────────────────────────────────────────
// 把当前视图（tab + 覆盖页栈顶）映射成可分享 / 可刷新的 URL（永久链接），
// 并通过 pushState/popstate 让浏览器与系统返回 / 前进键自然驱动导航。
export type StudioStart = "sheet" | "real" | "ai" | "compose";

const TAB_KEYS = ["home", "library", "apps", "me"];
const TAB_LABEL: any = { home: "首页", library: "资产库", apps: "应用中心", me: "我的" };
const OVERLAY_LABEL: any = { voice: "声音工作室", licenses: "授权登记", realmaterials: "真人授权素材库", tasks: "任务中心", settings: "设置", security: "账号与安全", membership: "会员与算力", storage: "存储用量", voiceclone: "声音克隆", trash: "回收站", detail: "资产详情", derivview: "衍生查看", looks: "造型档案", designlooks: "设计造型", choosevoice: "选择音色", create: "创建链路", aicreate: "AI 创建", realcapture: "真人素材授权", realauthresume: "本人确认结果", ipdetail: "IP 详情", iplicense: "IP 授权", scenedetail: "场景详情", productdetail: "产品详情", styledetail: "风格模板", compose: "合成工作台", composeresult: "合成结果" };
// 无需实体参数、可从 URL 直接还原的简单覆盖页
const SIMPLE_OVERLAYS = ["tasks", "licenses", "realmaterials", "voice", "settings", "security", "membership", "storage", "trash", "voiceclone"];
// 临时流程（创建向导等）：URL 会更新，但冷启动不强行还原（缺上下文 / 会污染状态）
const FLOW_SCREENS = ["create", "aicreate", "realcapture", "choosevoice", "designlooks", "voiceclone", "compose"];

/** 资产覆盖页 → URL 段 / props 键（六类资产共用一套深链规则）。 */
const ASSET_ROUTES: any = {
  ipdetail:       { seg: "ip",      prop: "ip" },
  iplicense:      { seg: "ip",      prop: "ip", sub: "license" },
  scenedetail:    { seg: "scene",   prop: "scene" },
  productdetail:  { seg: "product", prop: "product" },
  styledetail:    { seg: "style",   prop: "style" },
  composeresult:  { seg: "compose", prop: "composition" },
};

function hashForView(tab: string, stack: any[]): string {
  const top = stack[stack.length - 1];
  if (!top) return "#/" + tab;
  const p = top.props || {};
  const id = p.char && p.char.id;
  const asset = ASSET_ROUTES[top.screen];
  if (asset) {
    const aid = p[asset.prop] && p[asset.prop].id;
    return aid ? "#/" + asset.seg + "/" + aid + (asset.sub ? "/" + asset.sub : "") : "#/library";
  }
  switch (top.screen) {
    case "detail":      return id ? "#/avatar/" + id : "#/library";
    case "derivview":   return id ? "#/avatar/" + id + "/" + (p.deriv || "atlas") : "#/library";
    case "looks":       return id ? "#/avatar/" + id + "/looks" : "#/library";
    case "designlooks": return id ? "#/avatar/" + id + "/design" : "#/library";
    case "choosevoice": return id ? "#/avatar/" + id + "/voice" : "#/library";
    case "aicreate":    return "#/create/ai";
    // 带既有资产进来的认证流程把 id 写进 URL（便于分享定位）；临时流程冷启动仍回基座
    case "realcapture": return id && id !== "DH-NEW" ? "#/create/real/" + id : "#/create/real";
    case "realauthresume": return p.sessionId ? "#/real-auth/" + p.sessionId : "#/library";
    case "create":      return "#/create";
    case "compose":     return "#/compose";
    default:            return "#/" + top.screen;
  }
}

/** URL 段 → { screen, 取实体的 fetch }。冷启动 / 粘贴链接时按它把资产页还原出来。 */
const ASSET_SEGMENTS: any = {
  ip:      { screen: "ipdetail", subScreen: { license: "iplicense" }, prop: "ip",         fetch: (id: string) => AssetApi.ip(id).then((d: any) => d?.ip || d) },
  scene:   { screen: "scenedetail",                                  prop: "scene",      fetch: (id: string) => AssetApi.scene(id) },
  product: { screen: "productdetail",                                prop: "product",    fetch: (id: string) => AssetApi.product(id) },
  style:   { screen: "styledetail",                                  prop: "style",      fetch: (id: string) => AssetApi.style(id) },
  compose: { screen: "composeresult",                                prop: "composition", fetch: (id: string) => ComposeApi.get(id) },
};

function parseHash(): { tab: string; screen?: string; id?: string; deriv?: string; assetSeg?: string } {
  const raw = (typeof location !== "undefined" ? location.hash : "") || "";
  const seg = raw.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!seg.length) return { tab: "home" };
  if (TAB_KEYS.indexOf(seg[0]) >= 0) return { tab: seg[0] };
  if (seg[0] === "avatar" && seg[1]) {
    const id = seg[1], sub = seg[2];
    if (!sub) return { tab: "library", screen: "detail", id };
    if (sub === "looks") return { tab: "library", screen: "looks", id };
    if (sub === "design") return { tab: "library", screen: "designlooks", id };
    if (sub === "voice") return { tab: "library", screen: "choosevoice", id };
    return { tab: "library", screen: "derivview", id, deriv: sub };
  }
  if (ASSET_SEGMENTS[seg[0]] && seg[1]) {
    const def = ASSET_SEGMENTS[seg[0]];
    const screen = (seg[2] && def.subScreen && def.subScreen[seg[2]]) || def.screen;
    return { tab: "library", screen, id: seg[1], assetSeg: seg[0] };
  }
  if (seg[0] === "compose") return { tab: "library", screen: "compose" };
  if (seg[0] === "real-auth" && seg[1]) return { tab: "library", screen: "realauthresume", id: seg[1] };
  if (seg[0] === "create") return { tab: "home", screen: seg[1] === "ai" ? "aicreate" : seg[1] === "real" ? "realcapture" : "create" };
  if (SIMPLE_OVERLAYS.indexOf(seg[0]) >= 0) return { tab: "home", screen: seg[0] };
  return { tab: "home" };
}

/**
 * @param embedded 内嵌进新版外壳（/studio）：隐藏老 SPA 自带的 5 tab，
 *                 改由外壳经 tabBar 传入的新版 HubTabBar 承载，避免两套底部导航。
 * @param tabBar   内嵌模式下的底部导航节点；与老 tab 栏同一个显示条件（覆盖页上隐藏）。
 * @param start    进入即打开某个创建流程（新版「创作」页的落点）。
 *                 这些流程属于 FLOW_SCREENS —— 冷启动不按 hash 还原（缺角色上下文），
 *                 所以不能靠 `#/create/real` 深链，必须由外壳显式发起。
 */
export function App({ embedded = false, start, tabBar }: { embedded?: boolean; start?: StudioStart; tabBar?: any } = {}) {
  const [authed, setAuthed] = useStateA(USE_MOCK ? true : null as any); // null = 挂载前未知（避免 SSR 闪登录屏）
  // v0.53 平台门禁：null=待检 / true=已开通 / false=未开通（渲染拦截屏）
  const [platformOk, setPlatformOk] = useStateA(USE_MOCK ? true : null as any);
  const [tab, setTab] = useStateA("home");
  const [stack, setStack] = useStateA([]);
  const [sheet, setSheet] = useStateA(false);
  const [label, setLabel] = useStateA("首页");
  const [voiceByChar, setVoiceByChar] = useStateA({});
  const [reloadKey, setReloadKey] = useStateA(0);
  const [refreshSeq, setRefreshSeq] = useStateA(0); // 下拉刷新：递增 → 重挂当前屏 → 重新拉数据
  const canLoadPrivateData = USE_MOCK || authed === true;
  const identity = useIdentity();
  const avatars = useApi(
    () => (canLoadPrivateData ? AvatarApi.list("mine") : Promise.resolve(seed.avatars())),
    seed.avatars(),
    [reloadKey, canLoadPrivateData],
  );

  // 登录态：挂载后读 localStorage；401 全局回登录屏
  useEffectA(() => {
    if (USE_MOCK) return;
    setAuthed(auth.isAuthed());
    return onAuthExpired(() => { setStack([]); setSheet(false); setAuthed(false); setPlatformOk(null); });
  }, []);

  // v0.53 平台门禁：登录后拉 /api/me 校验能否使用 aiavatar。
  // v0.149：权益真值改为后端 enrollments（status=active）；老后端不返回该字段时
  // 回落历史的 platforms 判定。拉取失败（网络/老后端）宽松放行，避免误锁。
  useEffectA(() => {
    if (USE_MOCK) return;
    if (authed !== true) { setPlatformOk(null); return; }
    let cancelled = false;
    AuthApi.me()
      .then((me) => {
        if (cancelled) return;
        const enrollments = me?.enrollments;
        if (Array.isArray(enrollments)) {
          setPlatformOk(enrollments.some((e: any) => e?.product === "aiavatar" && e?.status === "active"));
          return;
        }
        const ps = me?.platforms;
        setPlatformOk(!Array.isArray(ps) || ps.length === 0 || ps.includes("aiavatar"));
      })
      .catch(() => { if (!cancelled) setPlatformOk(true); });
    return () => { cancelled = true; };
  }, [authed]);

  // ── 哈希路由状态：当前视图 ⇄ URL，支持永久链接 / 刷新 / 浏览器前进后退 ──
  const stackRef = useRefA(stack); stackRef.current = stack;
  const sheetRef = useRefA(sheet); sheetRef.current = sheet;
  const depthRef = useRefA(0);          // 上一次同步到 URL 的覆盖深度（stack + sheet）
  const restoringRef = useRefA(false);  // 正在由 popstate / 冷启动还原 → 跳过 URL 回写
  const bootedRef = useRefA(false);

  // 按 URL 还原视图（冷启动 / 前进键 / 外部粘贴永久链接）。
  const restoreFromHash = useCallbackA(() => {
    const r = parseHash();
    restoringRef.current = true;                 // 抑制本轮 URL 回写（避免还原过程把 URL 改坏）
    // 七牛本人刷脸回跳：sessionId 自足，不依赖创建流程内存状态，可刷新恢复。
    if (r.screen === "realauthresume" && r.id) {
      setSheet(false); setTab(r.tab);
      setStack([{ screen: "realauthresume", props: { sessionId: r.id } }]);
      setLabel(OVERLAY_LABEL.realauthresume); depthRef.current = 1;
      return;
    }
    // 六类资产覆盖页（IP / 场景 / 产品 / 风格 / 合成结果）：与数字人同样先取实体再一次性落栈
    if (r.assetSeg && r.id) {
      const def = ASSET_SEGMENTS[r.assetSeg];
      def.fetch(r.id).then((entity: any) => {
        restoringRef.current = true;
        setSheet(false); setTab(r.tab);
        if (!entity || !entity.id) { setStack([]); setLabel(TAB_LABEL[r.tab]); depthRef.current = 0; return; }
        setStack([{ screen: r.screen, props: { [def.prop]: entity } }]);
        setLabel(OVERLAY_LABEL[r.screen!] || r.screen);
        depthRef.current = 1;
      }).catch(() => {
        restoringRef.current = true; setSheet(false); setTab(r.tab); setStack([]); depthRef.current = 0;
      });
      return;
    }
    // 需实体参数的覆盖页：先取数据，拿到后「一次性」落 tab+stack（不提前改 tab，否则会先把 URL 覆写成 #/library）
    if (r.id) {
      AvatarApi.get(r.id).then((c: any) => {
        restoringRef.current = true;
        setSheet(false); setTab(r.tab);
        if (!c || !c.id) { setStack([]); setLabel(TAB_LABEL[r.tab]); depthRef.current = 0; return; }
        const props: any = { char: c };
        if (r.screen === "derivview") props.deriv = r.deriv;
        setStack([{ screen: r.screen, props }]);
        setLabel(OVERLAY_LABEL[r.screen] || r.screen);
        depthRef.current = 1;
      }).catch(() => { restoringRef.current = true; setSheet(false); setTab(r.tab); setStack([]); depthRef.current = 0; });
      return;
    }
    setSheet(false);
    setTab(r.tab);
    if (!r.screen || FLOW_SCREENS.indexOf(r.screen) >= 0) {
      setLabel(TAB_LABEL[r.tab]); setStack([]); depthRef.current = 0; return;   // 根 tab / 不可冷还原的临时流程 → 回基座
    }
    setStack([{ screen: r.screen, props: {} }]);
    setLabel(OVERLAY_LABEL[r.screen] || r.screen);
    depthRef.current = 1;
  }, []);

  // 冷启动：按 URL 还原一次，然后开启 URL 回写。
  useEffectA(() => {
    if (typeof window === "undefined") return;
    restoreFromHash();
    bootedRef.current = true;
  }, [restoreFromHash]);

  // 视图变化 → 写回 URL（变深 push 新历史项，否则 replace；还原引发的变化跳过）。
  useEffectA(() => {
    if (typeof window === "undefined" || !bootedRef.current) return;
    if (restoringRef.current) { restoringRef.current = false; depthRef.current = stack.length + (sheet ? 1 : 0); return; }
    const depth = stack.length + (sheet ? 1 : 0);
    const hash = hashForView(tab, stack);
    try {
      if (depth > depthRef.current) history.pushState({ aia: depth }, "", hash);
      else if ((location.hash || "") !== hash) history.replaceState({ aia: depth }, "", hash);
    } catch { /* noop */ }
    depthRef.current = depth;
  }, [tab, stack, sheet]);

  // 系统 / 浏览器返回 / 前进键。
  useEffectA(() => {
    if (typeof window === "undefined") return;
    const onPop = () => {
      if (sheetRef.current) { restoringRef.current = true; setSheet(false); depthRef.current = Math.max(0, depthRef.current - 1); return; }
      if (stackRef.current.length > 0) { restoringRef.current = true; setStack((s) => s.slice(0, -1)); depthRef.current = Math.max(0, depthRef.current - 1); return; }
      restoreFromHash();   // 根层：来自前进键 / 外部改 hash → 按 URL 还原
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [restoreFromHash]);

  const reload = useCallbackA(() => setReloadKey((k) => k + 1), []);

  // 外壳发起的创建流程要用到 ctx，但 ctx 在下面才组装 —— 用 ref 打通
  const ctxRef = useRefA(null as any);

  // 「创作」页落点：进来直接进对应流程，而不是丢到老首页。
  // 只在挂载后发起一次；之后用户自己的导航不受影响。
  const startedRef = useRefA(false);
  const canStart = USE_MOCK || (authed === true && platformOk !== false);
  useEffectA(() => {
    if (!start || startedRef.current || !canStart || !ctxRef.current) return;   // 等登录与平台门禁放行再发起
    startedRef.current = true;
    if (start === "sheet") { setSheet(true); return; }
    if (start === "compose") { ctxRef.current.openCompose({}); return; }
    ctxRef.current.startCreate(start);
  }, [start, canStart]);
  // 下拉刷新：重挂当前屏（触发其挂载期数据拉取）+ 刷新共享资产列表。
  const doRefresh = useCallbackA(() => { setRefreshSeq((s) => s + 1); setReloadKey((k) => k + 1); }, []);

  const top = stack[stack.length - 1];

  const ctx: any = {
    toast: (m, o) => toast(m, o),
    firstAvatar: avatars[0],
    avatars,
    reload,
    tab: (k) => { setStack([]); setTab(k); setSheet(false); setLabel(TAB_LABEL[k]); },
    go: (screen, props) => { setStack((s) => [...s, { screen, props: props || {} }]); setLabel(OVERLAY_LABEL[screen] || screen); },
    openChar: (char) => { setStack((s) => [...s, { screen: "detail", props: { char } }]); setLabel("资产详情"); },

    // ── 数字资产平台：六类资产的覆盖页入口 ──
    // opts.replace=true → 替换栈顶（合成工作台 → 结果页，返回时不再回到已提交的工作台）
    openIp: (ip) => { setStack((s) => [...s, { screen: "ipdetail", props: { ip } }]); setLabel("IP 详情"); },
    openIpLicense: (ip) => { setStack((s) => [...s, { screen: "iplicense", props: { ip } }]); setLabel("IP 授权"); },
    openScene: (scene) => { setStack((s) => [...s, { screen: "scenedetail", props: { scene } }]); setLabel("场景详情"); },
    openProduct: (product) => { setStack((s) => [...s, { screen: "productdetail", props: { product } }]); setLabel("产品详情"); },
    openStyle: (style) => { setStack((s) => [...s, { screen: "styledetail", props: { style } }]); setLabel("风格模板"); },
    openCompose: (preset, opts) => {
      setStack((s) => [...(opts?.replace ? s.slice(0, -1) : s), { screen: "compose", props: { preset: preset || {} } }]);
      setLabel("合成工作台");
    },
    openComposeResult: (composition, opts) => {
      setStack((s) => [...(opts?.replace ? s.slice(0, -1) : s), { screen: "composeresult", props: { composition } }]);
      setLabel("合成结果");
    },
    openDeriv: (char, deriv) => { setStack((s) => [...s, { screen: "derivview", props: { char, deriv } }]); setLabel("衍生查看"); },
    openLooks: (char) => { setStack((s) => [...s, { screen: "looks", props: { char } }]); setLabel("造型档案"); },
    designLooks: (char) => { setStack((s) => [...s, { screen: "designlooks", props: { char } }]); setLabel("设计造型"); },
    chooseVoice: (char, onPick) => { setStack((s) => [...s, { screen: "choosevoice", props: { char, onPick } }]); setLabel("选择音色"); },
    voiceFor: (char) => (char && (char.voiceName || voiceByChar[char.id])) || "亲和邻家女声",
    setVoice: (char, name) => {
      if (!char) return;
      setVoiceByChar((m) => ({ ...m, [char.id]: name }));
      if (char.id && char.id !== "DH-NEW" && !char._fresh) {
        VoiceApi.bind(char.id, name).then(reload).catch((e) => toast(e?.message || "音色保存失败", { tone: "err" }));
      }
    },
    // v0.149：id 模式下 auth.logout() 会整页跳账号中心统一登出（下面的状态重置不会被看到）。
    logout: () => { auth.logout(); setStack([]); setSheet(false); setTab("home"); if (!USE_MOCK) setAuthed(false); toast("已退出登录", { tone: "ok" }); },
    back: () => setStack((s) => s.slice(0, -1)),
    startCreate: (path, char) => { setSheet(false); setStack((s) => [...s, { screen: path === "ai" && !char ? "aicreate" : "create", props: { char: char || freshChar(path, avatars) } }]); setLabel(path === "ai" && !char ? "AI 创建" : "创建链路"); },
    startRealClone: (char) => { setSheet(false); setStack((s) => [...s, { screen: "realcapture", props: { char: char || freshChar("real", avatars), materialOnly: true } }]); setLabel("新增真人素材"); },
    startRealMaterial: (char) => { setSheet(false); setStack((s) => [...s, { screen: "realcapture", props: { char: char || freshChar("real", avatars), materialOnly: true } }]); setLabel("新增真人素材"); },
    /**
     * 「去确认」入口：带既有真人资产进入平台协议确认与七牛本人刷脸流程。
     * 认证需要本人素材，因此仍从录制引导起步；真人流程内部会复用传入的资产不再新建。
     */
    startRealAuth: (char) => { setSheet(false); setStack((s) => [...s, { screen: "realcapture", props: { char: char || freshChar("real", avatars), materialOnly: true } }]); setLabel("真人授权确认"); },
    realToWizard: (char) => { setStack((s) => { const ns = s.slice(0, -1); ns.push({ screen: "create", props: { char } }); return ns; }); setLabel("创建链路"); },
    continueAdjust: (char) => {
      setStack((s) => {
        const ns = s.slice(0, -1);
        ns.push({ screen: "create", props: { char: { ...char, _startAdjust: true } } });
        return ns;
      });
      setLabel("创建链路");
    },
    finishCreate: (char) => { reload(); setStack((s) => { const ns = s.slice(0, -1); ns.push({ screen: "detail", props: { char } }); return ns; }); setLabel("资产详情"); },
    /** 提交生成后回资产库（生成中的资产在卡片上显示实时进度）。 */
    submitToLibrary: () => { reload(); setSheet(false); setStack([]); setTab("library"); setLabel("资产库"); },
    openCreateSheet: () => setSheet(true),
  };
  ctxRef.current = ctx;

  // 六类资产的新建流程（IP / 场景 / 产品 / 风格 就地完成；人物 / 声音转既有创建链路）。
  // 挂在根上，让底部 ＋ 创建键在任何 tab 都能拉起同一套流程。
  const assetCreate = useAssetCreate(ctx, (kind, asset) => {
    reload();
    if (kind === "ip" && asset) ctx.openIp(asset);
    else if (kind === "scene" && asset) ctx.openScene(asset);
    else if (kind === "product" && asset) ctx.openProduct(asset);
    else if (kind === "style" && asset) ctx.openStyle(asset);
  });

  // 登录门（live 模式）：authed=null 渲染空白避免闪屏；false 渲染登录
  if (!USE_MOCK && authed !== true) {
    return hA(React.Fragment, null,
      hA(PhoneFrame, null,
        authed === false && hA(MLogin, { onLoggedIn: () => { setAuthed(true); setPlatformOk(null); restoreFromHash(); reload(); } })),
      hA(UI.ToastHost, null));
  }

  // v0.53 平台门禁（live 模式）：已登录但账号未开通 aiavatar → 拦截屏（可激活码追加开通）
  if (!USE_MOCK && platformOk === false) {
    return hA(React.Fragment, null,
      hA(PhoneFrame, null,
        hA(MPlatformGate, {
          onActivated: () => { setPlatformOk(true); reload(); },
          onLogout: ctx.logout,
        })),
      hA(UI.ToastHost, null));
  }

  const tabScreen = { home: MHome, library: MAssetLibrary, apps: MApps, me: MMe }[tab];
  const overlayScreen = top && ({
    detail: MDetail,
    voice: MVoice,
    licenses: MLicenses,
    realmaterials: MRealMaterials,
    tasks: MTasks,
    trash: MTrash,
    ...LAZY_OVERLAYS,
  } as any)[top.screen];
  const hideTabBar = !!top;   // 覆盖页 / 创建流程屏上不显示底部导航，避免挡住主按钮

  // 「我的」tab 头像：用当前账号名首字（真源 /api/me），拿不到就回退通用图标 ——
  // 不再硬编与用户无关的字，也不读 id 模式下永远为空的本地用户缓存。
  const meInitial = String(identity?.displayName || "").trim().slice(0, 1);
  // 下拉刷新：临时流程屏（创建向导等）不允许刷新重挂（会丢进度）。
  const canRefresh = !top || FLOW_SCREENS.indexOf(top.screen) < 0;

  return hA(React.Fragment, null,
    hA(PhoneFrame, { onRefresh: canRefresh ? doRefresh : undefined, embedded, reserveTabBar: !hideTabBar },
      hA("div", { key: tab + ":" + refreshSeq, style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column" } },
        hA(tabScreen, { ctx })),

      overlayScreen && hA("div", { key: stack.length + top.screen + ":" + refreshSeq, className: "m-page-in", style: { position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", background: "var(--canvas)" } },
        hA(SuspenseA, { fallback: hA(OverlayLoading, { label }) },
          hA(overlayScreen, { ...top.props, ctx }))),

      !hideTabBar && (embedded ? tabBar : hA(WxTabBar, { active: tab, onTab: ctx.tab, onCreate: ctx.openCreateSheet, meInitial })),

      sheet && hA(AssetCreateSheet, {
        onClose: () => setSheet(false),
        onPick: (pick) => { setSheet(false); assetCreate.start(pick); },
      }),
      assetCreate.node),

    hA(UI.ToastHost, null));
}
