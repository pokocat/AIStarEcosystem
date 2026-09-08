"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 画布的设备闸 —— 桌面进画布，手机给一屏说明。
//
// 为什么是 JS 闸而不是 CSS：CSS 只能把元素藏起来，组件照样会 mount、照样发请求，
// 那 15k 行画布 + antd + zustand 的 chunk 也照样下载。手机用户不该为一个用不了的
// 功能付这份流量。所以 CanvasHost 走 `dynamic({ ssr: false })`，只有判定为宽屏
// 之后才第一次 import —— 窄屏永远不会去取那个 chunk。
//
// 断点取 1024 而不是 packages/ui 里 useIsMobile 的 768：画布需要真实宽度，
// 竖持平板（768–1024）上那套 600px 的节点面板同样施展不开。
//
// 挂载前先渲染同一个「正在打开画布…」占位（画布自己 loading 时也是这句），
// 所以不会出现「先闪一下另一套 UI」——两边的首帧是同一屏。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Monitor, Copy, Check, ArrowLeft } from "lucide-react";

const DESKTOP_MIN_WIDTH = 1024;

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

/** 宽屏判定。SSR 与首帧一律返回 null（= 未知），避免把手机先当成桌面渲染一遍。 */
function useIsWide(): boolean | null {
  const [wide, setWide] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

function MobileNotice({ projectId }: { projectId: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板在非 https / 无权限时会抛 —— 不装作成功，把地址显示出来让人自己复制
      setCopied(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px", minHeight: "100dvh", background: "var(--canvas)" }}>
      <Link
        href="/projects"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-3)", textDecoration: "none", marginBottom: 28 }}
      >
        <ArrowLeft size={15} /> 项目
      </Link>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, display: "grid", placeItems: "center", background: "var(--surface-2)" }}>
          <Monitor size={26} strokeWidth={1.6} style={{ color: "var(--ink-3)" }} />
        </div>
      </div>

      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 21, fontWeight: 500, textAlign: "center", margin: "0 0 10px" }}>
        画布请到电脑上打开
      </h1>
      <p style={{ fontSize: 13.5, lineHeight: 1.75, color: "var(--ink-2)", textAlign: "center", margin: "0 0 26px" }}>
        无限画布要拖节点、连线、框选参考图，还要同时看得见一整条生成链 ——
        这些在手机屏幕上做不了。用电脑打开下面这个地址就能接着做。
      </p>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 5 }}>
          项目地址
        </div>
        <div style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", color: "var(--ink-2)", wordBreak: "break-all" }}>
          {typeof window !== "undefined" ? `${window.location.origin}/projects/${projectId}` : `/projects/${projectId}`}
        </div>
      </div>

      <button
        onClick={() => void copy()}
        style={{
          width: "100%", height: 44, borderRadius: 12, border: "none", cursor: "pointer",
          background: copied ? "var(--ok, #12a150)" : "var(--primary)", color: "#fff",
          fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}
      >
        {copied ? <><Check size={16} /> 已复制</> : <><Copy size={16} /> 复制链接</>}
      </button>

      <p style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", marginTop: 22, lineHeight: 1.7 }}>
        形象做完发布之后，资产、造型和数字名片在手机上都能看能改。
      </p>
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

function DesktopCanvas({ projectId }: { projectId: string }) {
  useBodyScopeWhileMounted();
  return <CanvasHost projectId={projectId} />;
}

export function CanvasGate({ projectId }: { projectId: string }) {
  const wide = useIsWide();
  if (wide === null) return <Opening />;
  if (!wide) return <MobileNotice projectId={projectId} />;
  return <DesktopCanvas projectId={projectId} />;
}
