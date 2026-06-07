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
import { MDerivView, MMembership, MSettings, MStorage, MVoiceClone } from "./screen-more";
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
  const avatars = useApi(() => AvatarApi.list("mine"), seed.avatars(), [reloadKey, authed]);

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

  // 浏览器 / 系统返回键：关闭最上层覆盖页或 Sheet，而不是直接退出应用。
  const open = stack.length + (sheet ? 1 : 0);
  const openRef = useRefA(0); openRef.current = open;
  const sheetRef = useRefA(false); sheetRef.current = sheet;
  const armedRef = useRefA(false);
  useEffectA(() => {
    if (typeof window === "undefined") return;
    const onPop = () => {
      const o = openRef.current;
      if (o <= 0) return;                                  // 已在根层 → 放行（离开应用）
      if (sheetRef.current) setSheet(false);
      else setStack((s) => s.slice(0, -1));
      if (o - 1 > 0) { try { history.pushState({ aia: 1 }, ""); } catch {} }  // 仍有层 → 续上返回陷阱
      else armedRef.current = false;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // 进入第一层覆盖时埋一个返回陷阱（单哨兵，深度无关）。
  useEffectA(() => {
    if (typeof window === "undefined") return;
    if (open > 0 && !armedRef.current) { try { history.pushState({ aia: 1 }, ""); } catch {} armedRef.current = true; }
    if (open === 0) armedRef.current = false;
  }, [open]);

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

  const reload = useCallbackA(() => setReloadKey((k) => k + 1), []);

  const top = stack[stack.length - 1];

  const ctx: any = {
    toast: (m, o) => toast(m, o),
    firstAvatar: avatars[0],
    avatars,
    reload,
    tab: (k) => { setStack([]); setTab(k); setSheet(false); setLabel({ home: "首页", library: "数字人库", apps: "应用中心", me: "我的" }[k]); },
    go: (screen, props) => { setStack((s) => [...s, { screen, props: props || {} }]); setLabel({ voice: "声音工作室", licenses: "授权登记", tasks: "作业队列", settings: "设置", membership: "会员与算力", storage: "存储用量", voiceclone: "声音克隆", trash: "回收站" }[screen] || screen); },
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
    settings: MSettings, membership: MMembership, storage: MStorage, voiceclone: MVoiceClone, trash: MTrash, derivview: MDerivView, looks: MLooksGrid, designlooks: MDesignLooks, aicreate: MAICreate, choosevoice: MChooseVoice }[top.screen];
  const hideTabBar = !!top;

  return hA(React.Fragment, null,
    hA(PhoneFrame, null,
      hA("div", { key: tab, style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column" } },
        hA(tabScreen, { ctx })),

      overlayScreen && hA("div", { key: stack.length + top.screen, className: "m-page-in", style: { position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", background: "var(--canvas)" } },
        hA(overlayScreen, { ...top.props, ctx })),

      !hideTabBar && hA(WxTabBar, { active: tab, onTab: ctx.tab, onCreate: ctx.openCreateSheet }),

      sheet && hA(CreateSheet, { onPick: (p) => (p === "real" ? ctx.startRealClone() : ctx.startCreate(p)), onClose: () => setSheet(false) })),

    hA(UI.ToastHost, null));
}
