"use client";

// 画布顶栏：标题（点一下改名）、全剧风格 chip、画幅 chip（只读）、页面自己的插槽、保存状态、积分余额；
// 下面一条 stale 横条「这张画布在别的页面改过了　[载入最新]」。
//
// 页面往顶栏里放东西用 <CanvasTopbarSlot slot="left|right">：left 在标题和 chip 后面（如单集编辑器的
// 「逐集制作 / 第 1 集」），right 在保存状态前面（如「视频模型 ▾」「合成成片」）。顶栏在 layout 里，
// 页面拿不到它的 props，所以用 portal 挂进去。
import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Coins, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useCanvasDoc } from "@/canvas/core";
import { useWallet } from "@/lib/use-wallet";
import { StylePickerButton } from "./style-picker";

type SlotName = "left" | "right";

const SlotContext = React.createContext<{
  els: Partial<Record<SlotName, HTMLElement | null>>;
  register: (name: SlotName, el: HTMLElement | null) => void;
} | null>(null);

/** CanvasShell 挂一次。 */
export function CanvasTopbarSlotProvider({ children }: { children: React.ReactNode }) {
  const [els, setEls] = React.useState<Partial<Record<SlotName, HTMLElement | null>>>({});
  const register = React.useCallback((name: SlotName, el: HTMLElement | null) => {
    setEls((cur) => (cur[name] === el ? cur : { ...cur, [name]: el }));
  }, []);
  const value = React.useMemo(() => ({ els, register }), [els, register]);
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

export interface CanvasTopbarSlotProps {
  /** left：标题与 chip 之后；right：保存状态之前。 */
  slot: SlotName;
  children: React.ReactNode;
}

/** 把页面自己的东西放进画布顶栏（页面卸载时自动撤掉）。 */
export function CanvasTopbarSlot({ slot, children }: CanvasTopbarSlotProps) {
  const ctx = React.useContext(SlotContext);
  const el = ctx?.els[slot];
  return el ? createPortal(children, el) : null;
}

function SlotHost({ name, className }: { name: SlotName; className: string }) {
  const ctx = React.useContext(SlotContext);
  const register = ctx?.register;
  const ref = React.useCallback((el: HTMLDivElement | null) => register?.(name, el), [register, name]);
  return <div ref={ref} className={className} />;
}

function TitleEditor() {
  const { meta, rename, readOnly } = useCanvasDoc();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(meta.title);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!editing) setDraft(meta.title);
  }, [meta.title, editing]);
  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== meta.title) rename(t);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cv-title-input"
        value={draft}
        maxLength={64}
        aria-label="画布名"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(meta.title);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className="cv-title"
      onClick={() => !readOnly && setEditing(true)}
      disabled={readOnly}
      title={readOnly ? meta.title : `${meta.title}（点一下改名）`}
    >
      {meta.title || "未命名画布"}
    </button>
  );
}

function SaveState() {
  const { saveState, status, flush } = useCanvasDoc();
  if (status === "stale") return null;
  if (saveState === "failed") {
    return (
      <button type="button" className="cv-save cv-save-failed" onClick={() => void flush()} title="改动没保存上，点一下再存一次">
        <TriangleAlert size={13} />
        <span>没保存上，重试</span>
      </button>
    );
  }
  if (saveState === "saving" || saveState === "dirty") {
    return (
      <span className="cv-save" aria-live="polite" title="保存中…">
        <Loader2 size={13} className="cv-spin" />
        <span className="cv-save-text">保存中…</span>
      </span>
    );
  }
  return (
    <span className="cv-save" aria-live="polite" title="已保存">
      <Check size={13} />
      <span className="cv-save-text">已保存</span>
    </span>
  );
}

function Balance() {
  const router = useRouter();
  const { wallet } = useWallet();
  return (
    <button
      type="button"
      className="cv-balance"
      onClick={() => router.push("/wallet")}
      title="积分余额，点开可充值、看明细"
      aria-label={wallet ? `积分余额 ${wallet.totalBalance}，点开可充值、看明细` : "积分余额，点开可充值、看明细"}
    >
      <Coins size={13} />
      <span className="num">{wallet ? wallet.totalBalance.toLocaleString("zh-CN") : "—"}</span>
    </button>
  );
}

/** 画布顶栏（CanvasShell 里挂一次，页面不用管）。 */
export function CanvasTopbar() {
  const { doc, meta, update, readOnly, status, reload } = useCanvasDoc();
  const [reloading, setReloading] = React.useState(false);
  return (
    <>
      <header className="cv-topbar">
        <div className="cv-topbar-main">
          <Link href="/canvas" className="cv-topbar-back" aria-label="回到我的画布" title="回到我的画布">
            <ChevronLeft size={18} />
          </Link>
          <TitleEditor />
          <StylePickerButton
            className="chip cv-topbar-chip"
            value={doc.style}
            disabled={readOnly}
            onChange={(style) => update((d) => ({ ...d, style }))}
            note="改了风格，之后新生成的图和视频按新风格出；已经生成的不会变。"
          />
          <span className="chip static cv-topbar-chip cv-ratio" title="画幅在新建时定好，之后不能改">
            {meta.ratio}
          </span>
          <SlotHost name="left" className="cv-topbar-slot" />
        </div>
        <div className="cv-topbar-side">
          <SlotHost name="right" className="cv-topbar-slot" />
          <SaveState />
          <Balance />
        </div>
      </header>
      {status === "stale" && (
        <div className="cv-stale" role="status">
          <TriangleAlert size={15} />
          <span className="cv-stale-text">这张画布在别的页面改过了</span>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={reloading}
            onClick={async () => {
              setReloading(true);
              try {
                await reload();
              } finally {
                setReloading(false);
              }
            }}
          >
            <RefreshCw size={13} /> 载入最新
          </button>
        </div>
      )}
    </>
  );
}
