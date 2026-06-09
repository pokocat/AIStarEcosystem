"use client";
// ============================================================
// 移动端 · App 根 — 路由 / Tab / 覆盖页栈 / 创建入口 / 登录门
//   live 模式（NEXT_PUBLIC_USE_MOCK=0）：未登录 → 登录屏；401 → 自动回登录屏。
// ============================================================
import React from "react";
import { Icons } from "./icons";
import * as UI from "./ui";
import { AvatarApi, VoiceApi, AuthApi, useApi, seed, auth, onAuthExpired, USE_MOCK } from "./api";
import { MShell } from "./shell";
import { toast } from "./toast";
import { MHome } from "./screen-home";
import { MLibrary, MDetail } from "./screen-library";
import { MLooksGrid, MDesignLooks } from "./screen-avatar";
import { MVoice, MApps } from "./screen-voiceapps";
import { MLicenses, MTasks, MMe, MTrash } from "./screen-lictaskme";
import { MDerivView, MMembership, MSettings, MSecurity, MStorage, MVoiceClone } from "./screen-more";
import { MRealCapture } from "./screen-real";
import { MCreate } from "./screen-chain";
import { MAICreate } from "./screen-aicreate";
import { MChooseVoice } from "./screen-voicepick";
import { MLogin } from "./screen-login";

const hA : any = React.createElement;
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA, useCallback: useCallbackA } = React;
const { PhoneFrame, WxTabBar } = MShell;

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

const CREATE_ENTRY_IMAGES = {
  ai: "/generated/create-entry/ai-design.jpg",
  real: "/generated/create-entry/real-clone.jpg",
};

// 创建路径选择 sheet
function CreateSheet({ onPick, onClose }) {
  const opt = (path, icon, name, desc, grad, image) => hA("button", { onClick: () => onPick(path), className: "m-tap", style: {
    position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 13, width: "100%", minHeight: 106,
    padding: "15px 14px", textAlign: "left", cursor: "pointer", background: "#F8FCFD",
    border: "1px solid rgba(255,255,255,.78)", borderRadius: "var(--r-xl)",
    boxShadow: "0 14px 30px rgba(76,92,125,.10), 0 1px 0 rgba(255,255,255,.9) inset" } },
    hA("img", { src: image, alt: "", draggable: false, style: {
      position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: .95, pointerEvents: "none" } }),
    hA("span", { style: { position: "absolute", inset: 0, background:
      "linear-gradient(102deg, rgba(255,255,255,.98) 0%, rgba(255,255,255,.92) 46%, rgba(255,255,255,.48) 76%, rgba(255,255,255,.18) 100%)" } }),
    hA("span", { style: { position: "absolute", inset: "1px 1px auto", height: "52%", borderRadius: "calc(var(--r-xl) - 1px) calc(var(--r-xl) - 1px) 0 0",
      background: "linear-gradient(180deg, rgba(255,255,255,.88), transparent)", pointerEvents: "none" } }),
    hA("div", { style: { position: "relative", width: 48, height: 48, flex: "0 0 48px", borderRadius: 15, background: grad, display: "grid", placeItems: "center",
      color: "#fff", boxShadow: "0 10px 24px rgba(18,179,222,.24), 0 1px 0 rgba(255,255,255,.34) inset" } }, hA(icon, { size: 24, stroke: 1.9 })),
    hA("div", { style: { position: "relative", flex: 1, minWidth: 0, paddingRight: 16 } },
      hA("div", { style: { fontSize: 16, fontWeight: 800, color: "var(--ink)" } }, name),
      hA("div", { style: { fontSize: 12, color: "rgba(37,47,62,.68)", marginTop: 4, lineHeight: 1.45, fontWeight: 600 } }, desc)),
    hA(Icons.chevR, { size: 18, stroke: 2.2, style: { position: "relative", color: "rgba(34,43,58,.42)", flex: "0 0 auto" } }));
  return hA(React.Fragment, null,
    hA("div", { className: "m-sheet-backdrop", onClick: onClose }),
    hA("div", { className: "m-sheet", style: { padding: "0 18px calc(18px + var(--home-ind))" } },
      hA("div", { className: "m-sheet-grip" }),
      hA("div", { style: { textAlign: "center", padding: "6px 0 16px" } },
        hA("div", { style: { fontFamily: "var(--font-disp)", fontWeight: 700, fontSize: 18 } }, "创建数字人"),
        hA("div", { style: { fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 } }, "选择创建路径")),
      hA("div", { style: { display: "flex", flexDirection: "column", gap: 11 } },
        opt("ai", Icons.sparkle, "AI 原创", "一句文字描述，从零原创一个虚构形象，版权自有", "linear-gradient(155deg,#2C67F2,#8F6BFF)", CREATE_ENTRY_IMAGES.ai),
        opt("real", Icons.person, "真人授权复刻", "录一段动作 / 上传素材，签署授权合规复刻", "var(--grad)", CREATE_ENTRY_IMAGES.real))));
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
const TAB_KEYS = ["home", "library", "apps", "me"];
const TAB_LABEL: any = { home: "首页", library: "数字人库", apps: "应用中心", me: "我的" };
const OVERLAY_LABEL: any = { voice: "声音工作室", licenses: "授权登记", tasks: "任务中心", settings: "设置", security: "账号与安全", membership: "会员与算力", storage: "存储用量", voiceclone: "声音克隆", trash: "回收站", detail: "资产详情", derivview: "衍生查看", looks: "造型档案", designlooks: "设计造型", choosevoice: "选择音色", create: "创建链路", aicreate: "AI 创建", realcapture: "真人捕获" };
// 无需实体参数、可从 URL 直接还原的简单覆盖页
const SIMPLE_OVERLAYS = ["tasks", "licenses", "voice", "settings", "security", "membership", "storage", "trash", "voiceclone"];
// 临时流程（创建向导等）：URL 会更新，但冷启动不强行还原（缺上下文 / 会污染状态）
const FLOW_SCREENS = ["create", "aicreate", "realcapture", "choosevoice", "designlooks", "voiceclone"];

function hashForView(tab: string, stack: any[]): string {
  const top = stack[stack.length - 1];
  if (!top) return "#/" + tab;
  const p = top.props || {};
  const id = p.char && p.char.id;
  switch (top.screen) {
    case "detail":      return id ? "#/avatar/" + id : "#/library";
    case "derivview":   return id ? "#/avatar/" + id + "/" + (p.deriv || "atlas") : "#/library";
    case "looks":       return id ? "#/avatar/" + id + "/looks" : "#/library";
    case "designlooks": return id ? "#/avatar/" + id + "/design" : "#/library";
    case "choosevoice": return id ? "#/avatar/" + id + "/voice" : "#/library";
    case "aicreate":    return "#/create/ai";
    case "realcapture": return "#/create/real";
    case "create":      return "#/create";
    default:            return "#/" + top.screen;
  }
}

function parseHash(): { tab: string; screen?: string; id?: string; deriv?: string } {
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
  if (seg[0] === "create") return { tab: "home", screen: seg[1] === "ai" ? "aicreate" : seg[1] === "real" ? "realcapture" : "create" };
  if (SIMPLE_OVERLAYS.indexOf(seg[0]) >= 0) return { tab: "home", screen: seg[0] };
  return { tab: "home" };
}

export function App() {
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

  // v0.53 平台门禁：登录后拉 /api/me 校验 platforms 是否含 aiavatar。
  // 拉取失败（网络/老后端）宽松放行，避免误锁；platforms 缺失/空 = 全平台。
  useEffectA(() => {
    if (USE_MOCK) return;
    if (authed !== true) { setPlatformOk(null); return; }
    let cancelled = false;
    AuthApi.me()
      .then((me) => {
        if (cancelled) return;
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
  // 下拉刷新：重挂当前屏（触发其挂载期数据拉取）+ 刷新共享资产列表。
  const doRefresh = useCallbackA(() => { setRefreshSeq((s) => s + 1); setReloadKey((k) => k + 1); }, []);

  const top = stack[stack.length - 1];

  const ctx: any = {
    toast: (m, o) => toast(m, o),
    firstAvatar: avatars[0],
    avatars,
    reload,
    tab: (k) => { setStack([]); setTab(k); setSheet(false); setLabel({ home: "首页", library: "数字人库", apps: "应用中心", me: "我的" }[k]); },
    go: (screen, props) => { setStack((s) => [...s, { screen, props: props || {} }]); setLabel(OVERLAY_LABEL[screen] || screen); },
    openChar: (char) => { setStack((s) => [...s, { screen: "detail", props: { char } }]); setLabel("资产详情"); },
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
    logout: () => { auth.clear(); setStack([]); setSheet(false); setTab("home"); if (!USE_MOCK) setAuthed(false); toast("已退出登录", { tone: "ok" }); },
    back: () => setStack((s) => s.slice(0, -1)),
    startCreate: (path, char) => { setSheet(false); setStack((s) => [...s, { screen: path === "ai" && !char ? "aicreate" : "create", props: { char: char || freshChar(path, avatars) } }]); setLabel(path === "ai" && !char ? "AI 创建" : "创建链路"); },
    startRealClone: (char) => { setSheet(false); setStack((s) => [...s, { screen: "realcapture", props: { char: char || freshChar("real", avatars) } }]); setLabel("真人捕获"); },
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
    /** 提交生成后回数字人库（生成中的资产在卡片上显示实时进度）。 */
    submitToLibrary: () => { reload(); setSheet(false); setStack([]); setTab("library"); setLabel("数字人库"); },
    openCreateSheet: () => setSheet(true),
  };

  // 登录门（live 模式）：authed=null 渲染空白避免闪屏；false 渲染登录
  if (!USE_MOCK && authed !== true) {
    return hA(React.Fragment, null,
      hA(PhoneFrame, null,
        authed === false && hA(MLogin, { onLoggedIn: () => { setAuthed(true); setPlatformOk(null); reload(); } })),
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

  const tabScreen = { home: MHome, library: MLibrary, apps: MApps, me: MMe }[tab];
  const overlayScreen = top && { detail: MDetail, voice: MVoice, licenses: MLicenses, tasks: MTasks, create: MCreate, realcapture: MRealCapture,
    settings: MSettings, security: MSecurity, membership: MMembership, storage: MStorage, voiceclone: MVoiceClone, trash: MTrash, derivview: MDerivView, looks: MLooksGrid, designlooks: MDesignLooks, aicreate: MAICreate, choosevoice: MChooseVoice }[top.screen];
  const hideTabBar = !!top;

  // 「我的」tab 头像：用登录用户名首字（live），无则回退通用图标 —— 不再硬编与用户无关的字。
  const sessionUser = (typeof window !== "undefined" && !USE_MOCK) ? auth.user() : null;
  const meInitial = sessionUser ? String(sessionUser.displayName || sessionUser.studioName || sessionUser.username || "").trim().slice(0, 1) : "";
  // 下拉刷新：临时流程屏（创建向导等）不允许刷新重挂（会丢进度）。
  const canRefresh = !top || FLOW_SCREENS.indexOf(top.screen) < 0;

  return hA(React.Fragment, null,
    hA(PhoneFrame, { onRefresh: canRefresh ? doRefresh : undefined },
      hA("div", { key: tab + ":" + refreshSeq, style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column" } },
        hA(tabScreen, { ctx })),

      overlayScreen && hA("div", { key: stack.length + top.screen + ":" + refreshSeq, className: "m-page-in", style: { position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", background: "var(--canvas)" } },
        hA(overlayScreen, { ...top.props, ctx })),

      !hideTabBar && hA(WxTabBar, { active: tab, onTab: ctx.tab, onCreate: ctx.openCreateSheet, meInitial }),

      sheet && hA(CreateSheet, { onPick: (p) => (p === "real" ? ctx.startRealClone() : ctx.startCreate(p)), onClose: () => setSheet(false) })),

    hA(UI.ToastHost, null));
}
