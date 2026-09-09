"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 画布的设备闸 —— **柔性提示，不是拦路**。
//
// 手机上先给一屏说明（画布确实挤：要拖节点、连线、框选参考图，还要同时看得见
// 一整条生成链），但**用户可以选择继续打开**。理由很实在：出门在外想看看昨天那条链
// 出了什么效果、想临时改一句提示词重跑一次，这些都是真实需求，不该被一个断点判死。
// 画布核心用的是 PointerEvent，拖拽 / 平移在触屏上是通的，缩放有左下角的按钮 ——
// 够用来「看一眼、改一点」，只是不适合从头搭一条链。
//
// 为什么仍然要这一屏（而不是直接进）：CanvasHost 走 `dynamic({ ssr: false })`，
// 那 15k 行画布 + antd + zustand 的 chunk **只有在真的要进画布时才下载**。
// 手机默认不付这份流量；选择进入的人才付 —— 这就是「柔性」与「不下载」两者兼得的办法。
// （CSS 藏起来做不到这一点：组件照样 mount、chunk 照样下。）
//
// 选择记在 sessionStorage：同一次使用里在几个项目之间来回，不该每次都拦一下；
// 下次重新打开又会提示一次 —— 提示便宜，而永久静音之后就再也没人看得见了。
//
// 断点取 1024 而不是 packages/ui 里 useIsMobile 的 768：竖持平板（768–1024）上
// 那套 600px 的节点面板同样施展不开，也该看到这一屏。
//
// 挂载前先渲染同一个「正在打开画布…」占位（画布自己 loading 时也是这句），
// 所以不会出现「先闪一下另一套 UI」——两边的首帧是同一屏。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Monitor, Copy, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { DESKTOP_MIN_WIDTH, resolvedLayout, storedLayout, setLayout } from "@/shell/layout-mode";

/** 「这次就在手机上用」的记忆。sessionStorage：本次使用有效，下次重新提示。 */
const OPT_IN_KEY = "ip-canvas-mobile-optin";

const CanvasHost = dynamic(
  () => import("./canvas-host").then((m) => ({ default: m.CanvasHost })),
  { ssr: false, loading: () => <Opening /> },
);

function Opening() {
  return (
    <div className="ip-surface" style={{ height: "100%", display: "grid", placeItems: "center", background: "var(--canvas)" }}>
      <span style={{ fontSize: 13.5, color: "var(--ink-3)" }}>正在打开画布…</span>
    </div>
  );
}

/**
 * 当前是不是桌面形态。SSR 与首帧一律返回 null（= 未知），避免把手机先当成桌面渲染一遍。
 *
 * 读的是 `<html data-layout>` —— 与外壳 CSS **同一个真值**（shell/layout-mode.ts）。
 * 此前这里自己 matchMedia(1024)，于是用户在手机浏览器里选了「请求桌面版网站」
 * （布局视口约 980）时，外壳和画布可以各判各的。现在只有一处判定。
 */
function useIsDesktopLayout(): boolean | null {
  const [desktop, setDesktop] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const read = () => setDesktop(resolvedLayout() === "desktop");
    read();
    // 没有显式选择时才跟着视口变（转屏 / 拖窗口）；选过就以选择为准
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const sync = () => { if (!storedLayout()) read(); };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desktop;
}

function projectUrl(projectId: string) {
  return typeof window === "undefined"
    ? `/projects/${projectId}`
    : `${window.location.origin}/projects/${projectId}`;
}

/** 复制项目地址。剪贴板在非 https / 无权限时会抛 —— 不装作成功。 */
function useCopyLink(projectId: string) {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(projectUrl(projectId));
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setFailed(true);
    }
  }, [projectId]);
  return { copied, failed, copy };
}

function MobileNotice({ projectId, onProceed }: { projectId: string; onProceed: () => void }) {
  const { copied, failed, copy } = useCopyLink(projectId);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "36px 20px 40px", minHeight: "100dvh", background: "var(--canvas)" }}>
      <Link
        href="/projects"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-3)", textDecoration: "none", marginBottom: 26 }}
      >
        <ArrowLeft size={15} /> 自由画布
      </Link>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, display: "grid", placeItems: "center", background: "var(--surface-2)" }}>
          <Monitor size={26} strokeWidth={1.6} style={{ color: "var(--ink-3)" }} />
        </div>
      </div>

      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 21, fontWeight: 500, textAlign: "center", margin: "0 0 10px" }}>
        画布在电脑上更顺手
      </h1>
      <p style={{ fontSize: 13.5, lineHeight: 1.75, color: "var(--ink-2)", textAlign: "center", margin: "0 0 24px" }}>
        它要拖节点、连线、框选参考图，还要同时看得见一整条生成链 —— 手机屏幕上会比较挤。
        <br />
        <span style={{ color: "var(--ink-3)" }}>
          想看看效果、临时改一句提示词重跑一次，在手机上也能做。
        </span>
      </p>

      {/* 主按钮就是「继续打开」—— 提示归提示，路不该被堵死 */}
      <button
        onClick={onProceed}
        style={{
          width: "100%", height: 46, borderRadius: 12, border: "none", cursor: "pointer",
          background: "var(--primary)", color: "var(--on-primary, #fff)",
          fontSize: 14.5, fontWeight: 600,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}
      >
        仍然在手机上打开 <ArrowRight size={16} />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 14px" }}>
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>或者发到电脑上继续</span>
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

      <button
        onClick={() => void copy()}
        style={{
          width: "100%", height: 44, borderRadius: 12, cursor: "pointer",
          background: "var(--surface)", border: "1px solid var(--line-2)",
          color: copied ? "var(--ok, #12a150)" : "var(--ink-2)",
          fontSize: 13.5, fontWeight: 600,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}
      >
        {copied ? <><Check size={16} /> 已复制</> : <><Copy size={16} /> 复制项目链接</>}
      </button>

      {/* 复制不成时把地址亮出来让人自己选 —— 别只留一个点了没反应的按钮 */}
      {failed && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 4 }}>复制没成功，手动选中这段地址：</div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--ink-2)", wordBreak: "break-all", userSelect: "all" }}>
            {projectUrl(projectId)}
          </div>
        </div>
      )}

      {/* 第三条路：把整个应用切成桌面版。手机浏览器的「请求桌面版网站」（布局视口约 980）
          现在会被自动认出来，这个按钮是给那些认不出来的情况留的手动开关。 */}
      <button
        onClick={() => setLayout("desktop")}
        style={{
          width: "100%", marginTop: 10, height: 40, borderRadius: 12, cursor: "pointer",
          background: "transparent", border: "none", color: "var(--ink-3)", fontSize: 12.5,
        }}
      >
        按桌面版布局打开（整个应用）
      </button>

      <p style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", marginTop: 16, lineHeight: 1.7 }}>
        形象做完发布之后，资产、造型和数字名片在手机上都能看能改。
      </p>
    </div>
  );
}

/**
 * 手机上画布顶上的那条细栏。
 *
 * 不做成可关闭的浮层，是因为它同时是**这一页在手机上唯一的导航** ——
 * 桌面顶栏 <1024 不渲染，画布页也不走 HubScreen 的底部 tab 栏，关掉之后
 * 想回项目列表就只剩浏览器返回键了。34px 换一个回得去、发得走，划算。
 */
function MobileCanvasBar({ projectId }: { projectId: string }) {
  const { copied, copy } = useCopyLink(projectId);
  return (
    <div
      style={{
        height: 34, flexShrink: 0, display: "flex", alignItems: "center", gap: 10,
        padding: "0 12px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)",
      }}
    >
      <Link
        href="/projects"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-2)", textDecoration: "none", flexShrink: 0 }}
      >
        <ArrowLeft size={13} /> 画布
      </Link>
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        电脑上操作更顺手
      </span>
      <button
        onClick={() => void copy()}
        style={{
          flexShrink: 0, height: 22, padding: "0 9px", borderRadius: 7, cursor: "pointer",
          border: "1px solid var(--line-2)", background: "var(--surface)",
          color: copied ? "var(--ok, #12a150)" : "var(--ink-2)", fontSize: 11.5, fontWeight: 600,
        }}
      >
        {copied ? "已复制" : "复制链接"}
      </button>
    </div>
  );
}

/**
 * 画布挂载期间给 `<body>` 也带上 `.ip-surface`。
 *
 * 为什么必须这么做：画布里有 7 处手写 `createPortal(..., document.body)`
 * （四个设置浮层、两个引用菜单、蒙版编辑），antd 的 Modal / Dropdown / Popover /
 * message 默认也挂 body —— 它们**渲染在 `.ip-surface` 子树之外**，拿不到作用域里的
 * 令牌。而 ipstudio 有 52 个 aiavatar 根本没定义的变量：实测 body 直属节点上
 * `--paper` 与 `--action` 解析为**空**，`background: var(--paper)` 整条声明失效
 * → 透明的浮层；`--primary` 还会拿到 aiavatar 的青色而不是群青。
 *
 * 逐个去改那 7 个 vendored 文件违反「搬来的文件尽量少改」，而且以后每加一个浮层
 * 都要记得改一次。挂在 body 上是一处解决全部：画布页整页都是工作台内容，
 * 作用域覆盖到 body 不会波及别人 —— 而且**只在画布挂载期间**，卸载即摘。
 */
function useBodyScopeWhileMounted() {
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("ip-surface");
    return () => document.body.classList.remove("ip-surface");
  }, []);
}

function Canvas({ projectId, narrow }: { projectId: string; narrow: boolean }) {
  useBodyScopeWhileMounted();
  if (!narrow) return <CanvasHost projectId={projectId} />;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <MobileCanvasBar projectId={projectId} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <CanvasHost projectId={projectId} />
      </div>
    </div>
  );
}

export function CanvasGate({ projectId }: { projectId: string }) {
  const wide = useIsDesktopLayout();
  // null = 还没读过 sessionStorage（SSR / 首帧）。与 wide 一样，不知道就先不渲染分支。
  const [optedIn, setOptedIn] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    try {
      setOptedIn(window.sessionStorage.getItem(OPT_IN_KEY) === "1");
    } catch {
      setOptedIn(false);   // 隐私模式下 sessionStorage 会抛：当作没选过，提示照给
    }
  }, []);

  const proceed = React.useCallback(() => {
    try { window.sessionStorage.setItem(OPT_IN_KEY, "1"); } catch { /* 存不下也照样进 */ }
    setOptedIn(true);
  }, []);

  if (wide === null || optedIn === null) return <Opening />;
  if (!wide && !optedIn) return <MobileNotice projectId={projectId} onProceed={proceed} />;
  return <Canvas projectId={projectId} narrow={!wide} />;
}
