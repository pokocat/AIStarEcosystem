"use client";

export const dynamic = "force-dynamic";

// 短视频制作 — 设计真源 v4 screens-shorts-v4.jsx `ShortMaker` + `ShortShotCard`:
// 单屏两步:① AI 对话 + 口播脚本表 → ② 视频工厂逐镜出片 → 合成成片。
// v0.76:整页编辑态由后端短视频草稿（/me/drama/shorts）持久化 —— 进页即建/读草稿（id 进 URL），
// 编辑防抖自动保存，刷新 / 返回 / 换设备都能接着做（此前纯内存态，刷新即丢）。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ClipboardPaste,
  CircleStop,
  Clapperboard,
  Edit,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { CreditMark, GenSkeleton } from "@/components/drama-ui";
import { PaneTabs } from "@/components/common/PaneTabs";
import { notifyWalletChanged } from "@/lib/use-wallet";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { type FormShot, type ShotFlow } from "@/components/drama-workshop/shot-form";
import { ShortStoryboardTable } from "@/components/drama-workshop/short-storyboard-table";
import { RenderModelSelect, priceBlockReason, renderCreditCost } from "@/components/drama-workshop/render-model-select";
import { useShotRender } from "@/lib/use-shot-render";
import { listRenderTasks, type AppliedRefs, type DramaRenderTask } from "@/api/render";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { SaveStatus } from "@/components/drama-workshop/save-status";
import { MediaLightbox, type LightboxMedia } from "@/components/drama-workshop/media-lightbox";
import { MarkdownLite } from "@/lib/markdown-lite";
import { SHORT_FORMATS, type Material, type ShortFormat } from "@/mocks/drama-workshop";
import { DapAvatarsApi, DramaAssetsApi, ShortDramaApi, ShortsApi } from "@/api";
import { AIAVATAR_URL } from "@/api/dap-avatars";
import type { DapAvatarLite } from "@/api/dap-avatars";
import type { ScriptMeta, ShortContinuityManifest } from "@/api/short-drama";
import type { ShortDraftData, ShortPreflight, ShortPromptSource, ShortVisualBible } from "@/api/shorts";
import { parsedToDraft } from "@/lib/short-prompt-draft";
import { aiErrorMessage } from "@/lib/ai-error";
import { useSaveStatus } from "@/lib/use-save-status";
import { useDramaConfig } from "@/lib/use-drama-config";
import { invalidate } from "@/lib/drama-query";
import { buildShortClipVars, buildShortFrameVars } from "@/lib/short-render-prompt";
import {
  approvableIds as pickApprovableIds,
  batchTargets,
  canAdoptLateJob,
  clipResultPatch,
  createRunGate,
  frameEditPatch,
  freshFramePatch,
  hasCurrentVideo,
  isInFlight,
  runBatch,
  sumCost,
  type PendingJob,
  type ShotRunResult,
} from "./shot-run";
import { isPollTimeout, peekJob } from "./job-peek";
import { createDraftSync } from "./draft-sync";

/**
 * 这条草稿的读写排队 + 离页后迟到的任务号（见 draft-sync.ts）。模块级：站内离开再进来还是同一个运行时，
 * 旧页面排着的保存要排在新页面的读取前面。制作页里所有 getDraft / saveDraft / deleteDraft 都经它。
 */
const draftSync = createDraftSync({ getDraft: ShortsApi.getDraft, saveDraft: ShortsApi.saveDraft });

/** 短视频分镜 = 结构化表单分镜 + 出镜引擎 */
interface ShortShot extends FormShot {
  engine: string;
  frameIdx: number;
  /** v0.97：本镜节拍语义标签（痛点开场 / 反转 / 强 CTA 收尾…），来自 AI 逐镜生成，缺省回落「镜 N」。 */
  beat?: string;
  /**
   * 进行中的后台渲染任务（首帧 / 视频）：提交后即写入本字段并随 autosave 落库，
   * 用户离开页面后回来可对账恢复（查任务状态 → 回填结果 / 续轮询 / 标可重试）。
   * 出片产物落地或任务终结即清空。此字段随整页草稿 payloadJson 整存整取（后端不解析，原样保留）。
   */
  pendingJob?: PendingJob;
  sceneId?: string;
  parentShotId?: string;
  /** v0.143 提示词直出：本镜出场人物名 / 场景名 / 原时间码（服务端据前两者挂一致性锚点）。 */
  castNames?: string[];
  sceneName?: string;
  timecode?: string;
  audio?: { cdnKey: string; url?: string; durationSec: number; textFingerprint: string; providerTaskId?: string; at?: string };
}

/** 首帧任务 / 视频任务 / 任务快照里的一行：回填只看这几个字段。 */
interface SettledJob {
  status: string;
  frames?: { url: string }[];
  result?: { frames?: { url: string }[]; applied_refs?: AppliedRefs };
  video_url?: string | null;
  applied_refs?: AppliedRefs;
  error_message?: string | null;
}

interface ChatMsg {
  who: "ai" | "me";
  text: string;
}

/** 草稿里的 idea 从哪来（决定开场白）：draft=草稿自带 / typed=做同款时刚补的主题 / created=本页刚按一句话新建。 */
type IdeaOrigin = "draft" | "typed" | "created";

/** 与 styles/pages/shorts-make.css 的 ≤1024 页签断点同一个值（§5.1：CSS 与 JS 用同一个断点）。 */
const NARROW_QUERY = "(max-width: 1024px)";

/** 当前是不是窄屏（对话 / 分镜分页签显示）。首帧按桌面渲染，挂载后再对齐，避免 hydration 不一致。 */
function useNarrowLayout(): boolean {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(NARROW_QUERY);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}

/* 单镜出片卡(竖屏) */

/**
 * 可编辑文本字段：默认看起来就是文本，鼠标移上去（或聚焦）才显高亮底 + 文末铅笔，
 * 明确「这里能点进去改」。input / textarea 通用。
 */
function EditableField({
  value,
  onChange,
  placeholder,
  multiline,
  wrap,
  rows,
  textStyle,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** 单行值但允许折行显示（标题）：用 textarea 展示，回车不换行。 */
  wrap?: boolean;
  rows?: number;
  textStyle?: React.CSSProperties;
  className?: string;
  ariaLabel?: string;
}) {
  const [hover, setHover] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const active = hover || focus;
  const asTextarea = multiline || wrap;
  // 多行字段按内容自动长高：固定行数的 textarea 在窄屏上会把长文字藏进内部滚动里，没人发现。
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const fit = React.useCallback(() => {
    const el = taRef.current;
    if (!el || el.getClientRects().length === 0) return; // 所在页签被隐藏时量不到，等它显示出来再量
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  React.useLayoutEffect(() => {
    fit();
  }, [value, fit]);
  React.useEffect(() => {
    const el = taRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastWidth = 0;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w && w !== lastWidth) {
        lastWidth = w;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);
  const fieldStyle: React.CSSProperties = {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    fontFamily: "inherit",
    color: "var(--ink)",
    ...(asTextarea ? { resize: "none" as const, overflow: "hidden" as const } : null),
    ...textStyle,
  };
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        borderRadius: 8,
        padding: "6px 8px",
        margin: "-6px -8px",
        transition: "background .15s, box-shadow .15s",
        background: active ? "color-mix(in oklch, var(--ink) 5%, transparent)" : "transparent",
        boxShadow: focus ? "inset 0 0 0 1.5px color-mix(in oklch, var(--accent) 55%, transparent)" : "none",
        cursor: "text",
      }}
    >
      {asTextarea ? (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(wrap ? e.target.value.replace(/\n/g, " ") : e.target.value)}
          onKeyDown={(e) => {
            if (wrap && e.key === "Enter") e.preventDefault();
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          rows={rows ?? (wrap ? 1 : 2)}
          className={className}
          style={fieldStyle}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={className}
          style={fieldStyle}
        />
      )}
      {/* hover 提示：文末铅笔（聚焦编辑时隐藏，避免遮挡） */}
      {active && !focus && (
        <Pencil
          size={12}
          style={{
            position: "absolute",
            top: asTextarea ? 9 : "50%",
            right: 8,
            transform: asTextarea ? "none" : "translateY(-50%)",
            color: "var(--ink-3)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

/** 折叠分区：标题行（• 圆点标签 + chevron + 折叠态摘要）可点开合，展开后渲染 children。 */
function CollapsibleOutlineSection({
  label,
  hint,
  summary,
  open,
  onToggle,
  children,
}: {
  label: string;
  hint?: string;
  summary?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="col gap-3">
      <button
        type="button"
        onClick={onToggle}
        className="row gap-2"
        style={{ alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}
        aria-expanded={open}
      >
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "none" }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ink-3)", whiteSpace: "nowrap", flex: "none" }}>{label}</span>
        {hint && (
          <span className="faint smk-outline-hint" style={{ fontSize: 11, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={hint}>
            {hint}
          </span>
        )}
        <span className="grow" />
        {!open && summary && (
          <span className="faint" style={{ fontSize: 12, maxWidth: "45%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>
        )}
        <ChevronDown size={15} style={{ color: "var(--ink-3)", flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && children}
    </div>
  );
}

/** 参考图 / 素材缩略图：点看大图、右上角移除。 */
function RefThumb({ url, from, to, onView, onRemove }: { url: string; from?: string; to?: string; onView: () => void; onRemove: () => void }) {
  return (
    <span
      onClick={onView}
      style={{
        position: "relative", width: 42, height: 56, borderRadius: 8, overflow: "hidden", flex: "none",
        boxShadow: "inset 0 0 0 1px var(--line)", cursor: url ? "zoom-in" : "default",
        background: url ? `center/cover no-repeat url(${url})` : `linear-gradient(135deg, ${from ?? "#f97316"}, ${to ?? "#e11d48"})`,
      }}
    >
      <button
        type="button"
        aria-label="移除"
        className="smk-thumb-x"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.55)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}
      >
        <X size={10} />
      </button>
    </span>
  );
}

/** 上传按钮：label 包裹隐藏 file input，busy 时转圈。 */
function UploadButton({ label, busy, disabled, onFile }: { label: string; busy?: boolean; disabled?: boolean; onFile: (f: File) => void }) {
  return (
    <label className="btn btn-line btn-sm" style={{ cursor: disabled ? "default" : "pointer", opacity: disabled && !busy ? 0.6 : 1 }}>
      {busy ? <Loader2 size={13} style={{ animation: "drama-spin .7s linear infinite" }} /> : <Upload size={13} />} {label}
      <input
        type="file"
        accept="image/*"
        hidden
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

/** 绑定数字人弹窗：从「我的数字人」（AiAvatar）网格选一个作为主角形象。 */
function AvatarPickerModal({
  onPick,
  onClose,
  onOpenAiAvatar,
}: {
  onPick: (a: { id: string; name: string; image: string }) => void;
  onClose: () => void;
  /** 去 AiAvatar 之前先把草稿存一下（新标签页打开，回来接着做）。 */
  onOpenAiAvatar?: () => void;
}) {
  const [list, setList] = React.useState<DapAvatarLite[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const panelRef = React.useRef<HTMLDivElement>(null);
  useModalA11y(panelRef, onClose);
  React.useEffect(() => {
    let alive = true;
    setErr(null);
    DapAvatarsApi.listMyDapAvatars()
      .then((r) => alive && setList(r))
      .catch((e) => alive && setErr(aiErrorMessage(e, "数字人列表没读出来，请稍后重试")));
    return () => {
      alive = false;
    };
  }, [reloadKey]);
  const reload = () => {
    setList(null);
    setReloadKey((k) => k + 1);
  };
  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 95 }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
        tabIndex={-1}
        className="col smk-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 94vw)", maxHeight: "80vh", background: "var(--surface)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-lg)", outline: "none" }}
      >
        <div className="row gap-2" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", flex: "none", alignItems: "center" }}>
          <div className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
            <span id="avatar-picker-title" style={{ fontWeight: 800, fontSize: 15 }}>绑定数字人</span>
            <span className="faint" style={{ fontSize: 11.5, lineHeight: 1.5 }}>选一个你的数字人当主角，配音也用它的声音</span>
          </div>
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="scroll" style={{ padding: 18, minHeight: 0 }}>
          {err ? (
            <div className="col gap-2" style={{ alignItems: "flex-start" }}>
              <div className="muted" style={{ fontSize: 13 }}>{err}</div>
              <button type="button" className="btn btn-line btn-sm" onClick={reload}>
                <RefreshCw size={13} /> 重试
              </button>
            </div>
          ) : !list ? (
            <div className="row gap-2 faint" style={{ fontSize: 13 }}>
              <Loader2 size={14} className="spin" /> 加载中…
            </div>
          ) : list.length === 0 ? (
            <div className="col center" style={{ padding: "26px 10px", gap: 12, textAlign: "center" }}>
              <div className="muted" style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.7 }}>
                你还没有数字人。数字人在 AiAvatar（数字人平台）里创建，建好回到这里就能选。没有数字人，有台词的镜头没法配音，这条短视频也就合成不了。
              </div>
              <div className="row gap-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
                <a
                  href={AIAVATAR_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-grad btn-sm"
                  style={{ textDecoration: "none" }}
                  onClick={() => onOpenAiAvatar?.()}
                >
                  <Sparkles size={13} /> 去 AiAvatar 创建数字人 <ExternalLink size={12} />
                </a>
                <button type="button" className="btn btn-line btn-sm" onClick={reload}>
                  <RefreshCw size={13} /> 建好了，刷新
                </button>
              </div>
              <div className="faint" style={{ fontSize: 11.5 }}>会在新标签页打开，这条草稿已自动保存。</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 12 }}>
              {list.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={!a.imageUrl}
                  title={a.imageUrl ? a.name : `${a.name}：还没有定妆照，先去 AiAvatar 给它补一张`}
                  onClick={() => {
                    if (!a.imageUrl) return;
                    onPick({ id: a.id, name: a.name, image: a.imageUrl });
                    onClose();
                  }}
                  className="col"
                  style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--surface-2)", cursor: a.imageUrl ? "pointer" : "not-allowed", padding: 0, textAlign: "left", gap: 0, minWidth: 0 }}
                >
                  {a.imageUrl ? (
                    <div style={{ width: "100%", aspectRatio: "3/4", background: `center/cover no-repeat url(${a.imageUrl})` }} />
                  ) : (
                    // 没有定妆照：原因就写在卡上（手机上没有 hover，title 看不到）。
                    <div
                      className="col center"
                      style={{ width: "100%", aspectRatio: "3/4", background: "linear-gradient(135deg,var(--surface-3),var(--surface-2))", padding: 10, gap: 6, textAlign: "center", color: "var(--ink-3)" }}
                    >
                      <ImageIcon size={18} style={{ flex: "none" }} />
                      <span style={{ fontSize: 11, lineHeight: 1.5 }}>还没有定妆照，选不了</span>
                    </div>
                  )}
                  <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 8px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: a.imageUrl ? undefined : "var(--ink-3)" }}>{a.name}</span>
                </button>
              ))}
            </div>
          )}
          {list && list.some((a) => !a.imageUrl) && (
            <div className="row gap-2" style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.6, alignItems: "center", flexWrap: "wrap", rowGap: 6 }}>
              <span className="faint" style={{ minWidth: 0, flex: "1 1 220px" }}>
                出图时照着定妆照画主角。没有定妆照的数字人，先去{" "}
                <a href={AIAVATAR_URL} target="_blank" rel="noreferrer" onClick={() => onOpenAiAvatar?.()} style={{ color: "var(--accent)" }}>
                  AiAvatar
                </a>{" "}
                补一张，回来刷新就能选。
              </span>
              <button type="button" className="btn btn-line btn-sm" style={{ flex: "none" }} onClick={reload}>
                <RefreshCw size={13} /> 刷新
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShortMakerPage() {
  return (
    <React.Suspense fallback={<ShortMakerLoading />}>
      <ShortMakerGate />
    </React.Suspense>
  );
}

/**
 * 草稿网关：解析 URL 的 draft id —— 有则读取草稿，无则按 fmt / idea(sessionStorage) / reopen 新建一条草稿，
 * 把 id 写进 URL（刷新后命中读取分支）。就绪后渲染制作页，整页状态由该草稿承载。
 */
function ShortMakerGate() {
  const router = useRouter();
  const sp = useSearchParams();
  const draftIdParam = sp.get("draft");
  const fmtKey = sp.get("fmt");
  const reopenParam = sp.get("reopen");

  // 幂等键：由新建控制台带入（一次创建意图一个），本页新建草稿时回传服务端查重防双扣。
  const createKeyRef = React.useRef<string | null | undefined>(undefined);
  if (createKeyRef.current === undefined) {
    if (typeof window !== "undefined") {
      const v = sessionStorage.getItem("drama.shorts.createKey");
      if (v) sessionStorage.removeItem("drama.shorts.createKey");
      createKeyRef.current = v ?? null;
    } else {
      createKeyRef.current = null;
    }
  }
  // 点子经 sessionStorage 一次性带入（不入 URL：文案长/含敏感内容），读完即清。
  const ideaRef = React.useRef<string | null | undefined>(undefined);
  if (ideaRef.current === undefined) {
    if (typeof window !== "undefined") {
      const v = sessionStorage.getItem("drama.shorts.idea");
      if (v) sessionStorage.removeItem("drama.shorts.idea");
      ideaRef.current = v ?? null;
    } else {
      ideaRef.current = null;
    }
  }

  const [draftId, setDraftId] = React.useState<string | null>(draftIdParam);
  const [initial, setInitial] = React.useState<ShortDraftData | null>(null);
  const [initialStatus, setInitialStatus] = React.useState<"draft" | "done">("draft");
  // 草稿里的 idea 是哪来的：draft=草稿自带（聊天页选「单条短视频」时服务端写进去的故事）/
  // typed=用户在「做同款」对话框里刚补的主题 / created=本页按新建控制台带来的一句话刚建的草稿。决定开场白怎么说。
  const [ideaOrigin, setIdeaOrigin] = React.useState<IdeaOrigin>("draft");
  const [err, setErr] = React.useState<string | null>(null);
  const startedRef = React.useRef(false);
  const createdIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // 已是我们刚建并写进 URL 的 id：无需再拉。
    if (draftIdParam && draftIdParam === createdIdRef.current) return;
    if (startedRef.current && !draftIdParam) return; // 防 StrictMode / 重入重复建
    let alive = true;
    (async () => {
      try {
        if (draftIdParam) {
          // 排在这条草稿还没发完的保存后面读：刚离开又打开时，旧页面的补存先落库，这里读到的才是最新的。
          const detail = await draftSync.enqueue(draftIdParam, () => ShortsApi.getDraft(draftIdParam));
          if (!alive) return;
          const data = detail.data;
          // 从创意市场「试试同款」套用而来的草稿（idea 空、尚无分镜）：若用户在对话框
          // 又补了一句自由主题（经 sessionStorage 带入），注入它 —— 工厂据「创意风格 + 你的主题」起草。
          if (ideaRef.current && !data.idea && !(data.shots && data.shots.length)) {
            data.idea = ideaRef.current;
            setIdeaOrigin("typed");
          }
          setDraftId(draftIdParam);
          setInitial(data);
          setInitialStatus(detail.meta.status === "done" ? "done" : "draft");
          return;
        }
        startedRef.current = true;
        const fmt = fmtKey ? SHORT_FORMATS.find((f) => f.key === fmtKey) : null;
        const detail = await ShortsApi.createDraft({
          fmtKey: fmtKey ?? null,
          fmtName: fmt?.name,
          coverFrom: fmt?.from,
          coverTo: fmt?.to,
          idea: ideaRef.current,
          reopen: reopenParam,
          clientRequestId: createKeyRef.current ?? undefined,
        });
        // 新建结果即使在 StrictMode 清理后也要落地，否则会卡在加载态。
        createdIdRef.current = detail.meta.id;
        setIdeaOrigin("created");
        setDraftId(detail.meta.id);
        setInitial(detail.data);
        setInitialStatus(detail.meta.status === "done" ? "done" : "draft");
        invalidate("/me/drama/shorts");
        const params = new URLSearchParams();
        params.set("draft", detail.meta.id);
        if (fmtKey) params.set("fmt", fmtKey);
        router.replace(`/shorts/make?${params.toString()}`);
      } catch (e) {
        if (alive) setErr(aiErrorMessage(e, "这条短视频草稿没打开，请回到「我的短视频」再试一次"));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftIdParam]);

  if (err) return <ShortMakerError msg={err} onBack={() => router.push("/shorts")} />;
  if (!draftId || !initial) return <ShortMakerLoading />;
  return (
    <ShortMakerInner
      key={draftId}
      draftId={draftId}
      fmtKey={fmtKey}
      reopen={reopenParam}
      initial={initial}
      initialStatus={initialStatus}
      ideaOrigin={ideaOrigin}
    />
  );
}

function ShortMakerLoading() {
  return (
    <div className="col center ws-flush" style={{ background: "var(--bg)", gap: 14 }}>
      <span
        aria-hidden
        style={{
          width: 34,
          height: 34,
          border: "3px solid var(--line)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "drama-spin .8s linear infinite",
        }}
      />
      <div className="muted" style={{ fontSize: 13 }}>正在打开短视频草稿…</div>
    </div>
  );
}

function ShortMakerError({ msg, onBack }: { msg: string; onBack: () => void }) {
  return (
    <div className="col center ws-flush" style={{ background: "var(--bg)", gap: 14, textAlign: "center" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>打不开这条短视频</h1>
      <div className="muted" style={{ maxWidth: 360 }}>{msg}</div>
      <button type="button" className="btn btn-line" onClick={onBack}>
        <ChevronLeft size={16} /> 返回我的短视频
      </button>
    </div>
  );
}

function ShortMakerInner({
  draftId,
  fmtKey,
  reopen,
  initial,
  initialStatus,
  ideaOrigin,
}: {
  draftId: string;
  fmtKey: string | null;
  reopen: string | null;
  initial: ShortDraftData;
  initialStatus: "draft" | "done";
  ideaOrigin: IdeaOrigin;
}) {
  const router = useRouter();
  const resolvedFmtKey = fmtKey ?? initial.fmtKey ?? null;
  const hasTemplate = !!resolvedFmtKey;
  // fmt 仅作 genre / 时长默认兜底（始终非空）；是否「套了模版」看 hasTemplate。
  const fmt = SHORT_FORMATS.find((f) => f.key === resolvedFmtKey) ?? SHORT_FORMATS[0];
  const realIdea = initial.idea || initial.reopen || reopen; // 仅当真带入点子时非空

  // 草稿自带故事：聊天页选「单条短视频」进来的，服务端把故事大纲的一句话剧情 + 主线写进了 idea。
  // 这种草稿进来就自动写脚本，开场白说「照这个故事写」；它不是模板，也不是风格 ——
  // 旧的 mock / 旧服务端会顺手把故事名、剧情塞进 styleName / styleRef，这里一律不当风格用，
  // 免得开场白变成「照【故事名】的风格来做」、再让用户把故事讲一遍。
  // 「做同款」进来的只有 styleRef（idea 为空，或是用户刚在对话框里补的 = typed），仍按模板风格走。
  const storyFromDraft = ideaOrigin === "draft" && !!initial.idea && !hasTemplate && !initial.reopen;
  // v0.77：由创意市场「单集创意」套用而来 —— 不套短视频模版，而是按创意风格出脚本。
  const styleName = initial.styleName ?? "";
  const styleRef = initial.styleRef ?? "";
  const hasStyle = !hasTemplate && !!styleRef && !storyFromDraft;
  // 显示用的「类型」标签：套了模版才用模版名；套了创意风格用风格名；都没有就中性「短视频」，
  // 不要回落到 SHORT_FORMATS[0]（「口播带货」）—— 那只是 fmt 的兜底，拿来展示会误导。
  // 提示词直出线用拆解出的风格标签（= initial.fmtName）当类型标签，比中性「短视频」更有信息量。
  const displayName = hasTemplate
    ? fmt.name
    : hasStyle
      ? styleName || "风格模板"
      : initial.promptSource?.raw && initial.fmtName
        ? initial.fmtName
        : "短视频";
  // 真正发给图像/视频模型的风格名：未套模板时绝不能回落到 SHORT_FORMATS[0]（口播带货）。
  const renderStyleName = hasTemplate
    ? fmt.name
    : hasStyle
      ? styleName || "风格短片"
      : initial.fmtName || "风格短片";

  // 套模版上下文：仅当确实选了模版，才把模版节拍作为 AI 生成参考。
  const templateRef = hasTemplate && fmt.beats?.length
    ? `「${fmt.name}」模版（${fmt.beats.length} 镜 · 约 ${fmt.dur}s）：` +
      fmt.beats.map((b, i) => `镜${i + 1}(${b.dur}s) 画面:${b.visual} 口播:${b.vo}`).join("；")
    : "";
  // 创意风格参考：把创意名 + 风格说明喂给出脚本 AI，让成片照这个风格走（不直接复述说明）。
  const styleRefLine = hasStyle ? `参考创意风格【${styleName || "风格短片"}】：${styleRef}` : "";
  const aiReference = [templateRef, styleRefLine].filter(Boolean).join(" ");
  const tplIntro = initial.reopen
    ? "接着改这条短视频：说要怎么调，AI 重写口播和分镜。"
    : storyFromDraft
      ? "照你定好的故事来做。AI 先写口播脚本、拆好分镜，写完你可以接着说哪里要改。"
      : hasStyle
        ? `照【${styleName || "这个模板"}】的风格来做。说说你的主题或产品，AI 按这个风格写口播和分镜。`
        : hasTemplate && fmt.beats?.length
          ? `用的是【${fmt.name}】模板（${fmt.beats.length} 镜，约 ${fmt.dur} 秒）。说说你的主题或产品，AI 照这个模板的镜头顺序拆分镜。`
          : "这条短视频讲什么、卖什么？说一句，AI 写口播脚本、拆好分镜。";

  // v0.88：单页化后不再切步骤；step 仍随草稿保存（兼容旧字段）。
  const [step] = React.useState<"script" | "factory">(initial.step ?? "script");
  const [phase, setPhase] = React.useState<"idle" | "gen" | "done">(initial.shots.length ? "done" : "idle");
  const [shots, setShots] = React.useState<ShortShot[]>(() => initial.shots ?? []);
  // 整体短视频说明（标题 / 风格 / 场景 / 主角）—— AI 先定调，统领分镜与逐镜出片。
  const [meta, setMeta] = React.useState<ScriptMeta | null>(initial.meta ?? null);
  const [continuityManifest, setContinuityManifest] = React.useState<ShortContinuityManifest | undefined>(initial.continuityManifest);
  // 一句话故事大纲（AI logline）—— 展示在标题下，可直接改。
  const [logline, setLogline] = React.useState<string>(() => initial.logline ?? "");
  const cfg = useDramaConfig();
  const [busy, setBusyState] = React.useState<{ id: string; to: ShotFlow } | null>(null);
  // busyRef 与 busy 同步置位：连跑循环和连点时读的是它（state 要等下一次渲染才变，读到的会是旧值）。
  const busyRef = React.useRef<{ id: string; to: ShotFlow } | null>(null);
  const setBusy = React.useCallback((next: { id: string; to: ShotFlow } | null) => {
    busyRef.current = next;
    setBusyState(next);
  }, []);
  // 一键连跑态：进度（已完成/总数）+ 这一轮的开关（镜间检查：点停止 / 离开页面 = 当前镜做完不再继续）。
  const [runProgress, setRunProgress] = React.useState<{ done: number; total: number } | null>(null);
  // runGate 供连跑循环即时读取（不触发重渲染）；stopping state 只管「停止」按钮的禁用态 + 文案。
  const runGateRef = React.useRef(createRunGate());
  const [stopping, setStopping] = React.useState(false);
  // 后台任务轮询超时后，页面在后台接着等它（不占 busy，不挡别的镜）；这里记着正在等哪几镜。
  const watchingRef = React.useRef(new Set<string>());
  const [watching, setWatching] = React.useState<ReadonlySet<string>>(() => new Set());
  // 组件是否还挂着：卸载后不再发起任何新的轮询 / 提交。
  const aliveRef = React.useRef(true);
  const [refs, setRefs] = React.useState<Material[]>(() => initial.refs ?? []); // @数字人参考
  const [chat, setChat] = React.useState<ChatMsg[]>(() =>
    initial.chat?.length
      ? (initial.chat as ChatMsg[])
      : realIdea
        ? [
            { who: "ai", text: tplIntro },
            { who: "me", text: realIdea },
          ]
        : [{ who: "ai", text: tplIntro }],
  );
  const [draft, setDraft] = React.useState("");
  const [draftStatus, setDraftStatus] = React.useState<"draft" | "done">(initialStatus);
  const [assembled, setAssembled] = React.useState(() => initial.assembled);
  const [assembling, setAssembling] = React.useState(false);
  const [assembleError, setAssembleError] = React.useState<string | null>(null);
  const [preflight, setPreflight] = React.useState<ShortPreflight | null>(null);
  const [preflightBusy, setPreflightBusy] = React.useState(false);
  const [preflightError, setPreflightError] = React.useState<string | null>(null);
  const [audioBusy, setAudioBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  // 后续推荐 action：AI 每生成 / 改写一版脚本就刷新（来自后端 suggestions），并随草稿持久化、重开恢复。
  const [suggestions, setSuggestions] = React.useState<string[]>(() => initial.suggestions ?? []);
  // v0.143 提示词直出：全片视觉设定 + 来源提示词 + 拆解说明。
  // 必须随 dataRef 一起回写，否则自动保存会把它们从草稿里抹掉（服务端整存整取 payload）。
  const [visualBible, setVisualBible] = React.useState<ShortVisualBible | undefined>(() => initial.visualBible);
  const [promptSource] = React.useState<ShortPromptSource | undefined>(() => initial.promptSource);
  const [promptNotes, setPromptNotes] = React.useState<string[]>(() => initial.promptNotes ?? []);
  const fromPrompt = !!promptSource?.raw;
  const [bibleOpen, setBibleOpen] = React.useState(false);
  const [rawPromptOpen, setRawPromptOpen] = React.useState(false);
  const rawPromptRef = React.useRef<HTMLDivElement>(null);
  useModalA11y(rawPromptRef, () => setRawPromptOpen(false), rawPromptOpen);
  // 左侧 AI 对话可折叠（收起成细边栏，给右侧大纲 / 分镜更多空间）。
  const [chatCollapsed, setChatCollapsed] = React.useState(false);
  // v0.197 窄屏（≤1024）：对话和分镜一次只显示一栏，顶部用页签切换；断点与 shorts-make.css 一致。
  // 桌面上两栏都在，pane 只决定窄屏显示哪一栏。
  const narrow = useNarrowLayout();
  const [pane, setPaneState] = React.useState<"chat" | "board">(() => (initial.shots.length ? "board" : "chat"));
  const paneRef = React.useRef(pane);
  paneRef.current = pane;
  const [chatDot, setChatDot] = React.useState(false);
  const setPane = React.useCallback((next: "chat" | "board") => {
    setPaneState(next);
    if (next === "chat") setChatDot(false);
  }, []);
  /** AI 在对话里回了话、而用户正看着分镜页签时，在「对话」页签上打个点。 */
  const flagChatReply = () => {
    if (paneRef.current === "board") setChatDot(true);
  };
  // 窄屏上没有收起对话这回事（收起按钮和竖条都藏了）；桌面上收起过再缩窄，也要能看到对话。
  const chatHidden = chatCollapsed && !narrow;
  // 分镜表放大：全屏弹层展示，方便逐镜编辑。
  const [tableMax, setTableMax] = React.useState(false);
  const tableMaxRef = React.useRef<HTMLDivElement>(null);
  useModalA11y(tableMaxRef, () => setTableMax(false), tableMax);
  // C-3 逐镜渲染共享引擎（短视频线走 ref_slots 显式槽位：主角 + 场景参考，服务端按 capability 裁剪 + 回报）。
  // D-11：出片模型（候选端点）缺省 / 单候选 → 下拉隐藏，走后端默认端点。
  const shotRender = useShotRender({ projectId: draftId, kind: "short", ratio: "9:16" });
  const renderModels = shotRender.models;
  // 主角 / 主场景 折叠（默认收起，展开后可上传参考图 / 绑定数字人 / 上传素材）。
  const [charOpen, setCharOpen] = React.useState(false);
  const [sceneOpen, setSceneOpen] = React.useState(false);
  const [charRef, setCharRef] = React.useState(() => initial.characterRef ?? null);
  const [charAvatar, setCharAvatar] = React.useState(() => initial.characterAvatar ?? null);
  const [sceneRef, setSceneRef] = React.useState(() => initial.sceneRef ?? null);
  const [uploading, setUploading] = React.useState<"char" | "scene" | "mat" | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<LightboxMedia | null>(null);

  const total = shots.reduce((a, s) => a + s.dur, 0);
  const doneCount = shots.filter((s) => s.flow === "done").length;
  // 镜头进度的口径：没有当前视频的（要生成；其中有的正在后台生成）/ 视频生成好了还没点「就用这版」的（要确认）。
  // 「当前视频」只认 flow 为 clip / done 的：重出首帧之后，旧首帧那条视频不算数（见 shot-run.ts）。
  const busyId = busy?.id ?? null;
  const noVideoCount = shots.filter((s) => !hasCurrentVideo(s)).length;
  const inFlight = shots.filter((s) => !hasCurrentVideo(s) && isInFlight(s, busyId));
  const inFlightCount = inFlight.length;
  // 在途的是首帧还是视频（首帧在途的镜，首帧回来后还要再生成视频，文案不能说「好了就有视频」）。
  const inFlightFrames = inFlight.filter((s) => (s.pendingJob?.kind ?? (busy?.id === s.id ? busy.to : "clip")) === "frame").length;
  const inFlightClips = inFlightCount - inFlightFrames;
  const inFlightWhat = [inFlightClips ? `${inFlightClips} 镜的视频` : "", inFlightFrames ? `${inFlightFrames} 镜的首帧` : ""]
    .filter(Boolean)
    .join("、");
  const batchCount = batchTargets(shots, busyId).length;
  const toConfirmCount = shots.filter((s) => s.flow === "clip" && !!s.videoUrl).length;
  // 最新一次渲染的分镜：连跑循环、后台轮询回来时读它，不读闭包里那份旧的。
  const shotsRef = React.useRef(shots);
  shotsRef.current = shots;
  const hasDialogue = shots.some((s) => s.voText.trim());
  const title = meta?.title || initial.title || realIdea || (hasTemplate ? fmt.name : "短视频");
  // 类型标签里已经写了「竖屏」（如「电影感 · 竖屏短片」）就别再写一遍。
  const ratioLabel = displayName.includes("竖屏") ? "9:16" : "竖屏 9:16";

  // ── 草稿自动保存（v0.76）──────────────────────────────────────────────────────
  const { status: saveStatusValue, notifyEditing, track } = useSaveStatus();
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = React.useRef<ShortDraftData>(initial);
  dataRef.current = {
    idea: initial.idea ?? null,
    reopen: initial.reopen ?? reopen ?? null,
    fmtKey: resolvedFmtKey,
    // 没套短视频模版时保留草稿原本的 fmtName（如创意套用来的「风格短片」），不被默认模版名覆盖；
    // 都没有就用中性「短视频」，不要落 SHORT_FORMATS[0]（「口播带货」）这个误导性兜底。
    // styleName 为空时回落「风格模板」，与服务端 DramaRecipeService 做同款时的默认风格名一致。
    fmtName: hasTemplate ? fmt.name : initial.fmtName || (hasStyle ? styleName || "风格模板" : "短视频"),
    styleName: styleName || undefined,
    styleRef: styleRef || undefined,
    title: meta?.title || initial.title || title,
    step,
    meta,
    continuityManifest,
    logline,
    characterRef: charRef,
    characterAvatar: charAvatar,
    sceneRef,
    shots,
    chat,
    refs,
    suggestions,
    assembled,
    visualBible,
    promptSource,
    promptNotes,
  };

  const queueSave = React.useCallback(() => {
    notifyEditing();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // 经 draftSync 排队：同一条草稿的整份保存一个接一个发，不会旧的后到把新的盖掉。发的时候再读 dataRef（最新一版）。
      void track(() => draftSync.enqueue(draftId, () => ShortsApi.saveDraft(draftId, dataRef.current, { status: draftStatus }))).catch(() => {});
    }, 1200);
  }, [draftId, draftStatus, notifyEditing, track]);

  const flushSave = React.useCallback(
    async (opts?: { status?: "draft" | "done"; progress?: number }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await track(() => draftSync.enqueue(draftId, () => ShortsApi.saveDraft(draftId, dataRef.current, opts ?? { status: draftStatus })));
    },
    [draftId, draftStatus, track],
  );

  // 持久化态变化即防抖落库（跳过首挂载，避免刚载入就回存一次）。
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    queueSave();
  }, [step, meta, continuityManifest, logline, charRef, charAvatar, sceneRef, shots, chat, refs, suggestions, assembled, visualBible, promptNotes, queueSave]);

  // 新提交了后台任务（出现新的 pendingJob）→ 立刻落库，不等防抖：任务号要是没存下来就关了页面，
  // 下次进来不知道这一镜还在生成，用户再点一次就是第二笔扣费。
  const pendingSig = shots.map((s) => s.pendingJob?.jobId ?? "").join("|");
  const pendingSigRef = React.useRef(pendingSig);
  React.useEffect(() => {
    const prev = new Set(pendingSigRef.current.split("|").filter(Boolean));
    pendingSigRef.current = pendingSig;
    const added = pendingSig.split("|").some((id) => id && !prev.has(id));
    if (added) void flushSave().catch(() => {});
  }, [pendingSig, flushSave]);

  // 卸载（侧栏跳走 / 浏览器后退 / 任何站内导航）：停掉连跑这一轮，并把还没落库的改动立刻存掉。
  // 此前只清防抖计时器，刚提交的任务号可能随之丢失；连跑循环也不知道页面已经没了，会接着提交、接着扣费。
  const draftStatusRef = React.useRef(draftStatus);
  draftStatusRef.current = draftStatus;
  const discardRef = React.useRef(false); // 草稿已删：卸载时不再回存
  React.useEffect(() => {
    aliveRef.current = true;
    // StrictMode 开发态会先模拟卸载再挂载一次：重新挂上时换一个新的开关，别让模拟卸载把它永久关掉。
    runGateRef.current = createRunGate();
    return () => {
      aliveRef.current = false;
      runGateRef.current.dispose();
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        if (!discardRef.current) {
          void draftSync
            .enqueue(draftId, () => ShortsApi.saveDraft(draftId, dataRef.current, { status: draftStatusRef.current }))
            .catch(() => {});
        }
      }
    };
  }, [draftId]);

  /** 离开制作页前 flush 未落库改动 + 刷新工坊列表。 */
  const leaveToStudio = async () => {
    // 连跑中点返回：当前这一镜照常做完（已经提交、已经扣费），后面的不再提交。
    runGateRef.current.stop();
    try {
      await flushSave();
    } catch {
      /* flush 失败不阻塞返回（草稿在内存仍在；beforeunload 已兜底刷新场景） */
    }
    invalidate("/me/drama/shorts");
    router.push("/shorts");
  };

  const deleteCurrentDraft = async () => {
    if (deleting) return;
    const ok = await dramaConfirm({
      title: "删除这条草稿？",
      body: "移到回收站，30 天内可以恢复；这期间它不会出现在「我的短视频」里。",
      confirmLabel: "删除草稿",
      cancelLabel: "先保留",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    discardRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await draftSync.enqueue(draftId, () => ShortsApi.deleteDraft(draftId));
      invalidate("/me/drama/shorts");
      toast.success("草稿已删除");
      router.push("/shorts");
    } catch (e) {
      toast.error(aiErrorMessage(e, "删除草稿失败，请稍后重试"));
      discardRef.current = false;
      setDeleting(false);
    }
  };

  const refreshPreflight = React.useCallback(async (flush = false) => {
    if (preflightBusy) return;
    setPreflightBusy(true);
    setPreflightError(null);
    try {
      if (flush) await flushSave({ status: "draft" });
      setPreflight(await ShortsApi.preflightDraft(draftId));
    } catch (error) {
      setPreflightError(aiErrorMessage(error, "检查没做完，请稍后重试"));
    } finally {
      setPreflightBusy(false);
    }
  }, [draftId, flushSave, preflightBusy]);

  React.useEffect(() => {
    void refreshPreflight(false);
    // 只在打开草稿时读一次；编辑后由界面标为待重检，避免每次输入都打 API。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  const prepareShortAudio = async () => {
    if (audioBusy) return;
    const ok = await dramaConfirm({
      title: "生成配音？",
      body: `用数字人${charAvatar?.name ? `「${charAvatar.name}」` : ""}的声音给每一镜的台词配音。台词没改过的镜头沿用已有配音，不会重复生成。这一步不生成视频，也不花积分。`,
      confirmLabel: "生成配音",
      cancelLabel: "先不生成",
    });
    if (!ok) return;
    setAudioBusy(true);
    setPreflightError(null);
    try {
      await flushSave({ status: "draft" });
      const result = await ShortsApi.prepareAudio(draftId);
      const latest = await ShortsApi.getDraft(draftId);
      setShots(latest.data.shots as ShortShot[]);
      setContinuityManifest(latest.data.continuityManifest);
      setPreflight(await ShortsApi.preflightDraft(draftId));
      toast.success(`配音好了：${result.preparedCount} 镜${result.reusedCount ? `，其中 ${result.reusedCount} 镜沿用上次的` : ""}`);
    } catch (error) {
      const message = aiErrorMessage(error, "配音没生成完，已经配好的镜头会保留，可以直接重试");
      setPreflightError(message);
      toast.error(message);
    } finally {
      setAudioBusy(false);
      notifyWalletChanged();
    }
  };

  const missingAssemblyMedia = shots.filter((shot) => shot.flow !== "done" || !shot.videoUrl);
  const missingAudio = shots.filter((shot) => shot.voText.trim() && !shot.audio?.cdnKey);
  const readyToAssemble = shots.length > 0 && missingAssemblyMedia.length === 0 && missingAudio.length === 0;

  /** 先落最后一次镜头编辑，再由服务端做真实 ffmpeg 总装；成功响应后才进入 done。 */
  const assembleShort = async () => {
    if (assembling || !readyToAssemble) return;
    setAssembling(true);
    setAssembleError(null);
    try {
      await flushSave({ status: "draft", progress: 100 });
      const result = await ShortsApi.assembleDraft(draftId);
      setAssembled(result);
      setDraftStatus("done");
      invalidate("/me/drama/shorts");
      toast.success(`成片合成好了：${result.shotCount} 镜，约 ${result.durationSec} 秒`);
      // 落地「我的短视频」时直接打开这条的成片预览（/shorts 读 ?open=<草稿 id>），不用再去列表里找。
      router.push(`/shorts?open=${encodeURIComponent(draftId)}`);
    } catch (e) {
      const message = aiErrorMessage(e, "成片没合成出来，请稍后重试");
      setDraftStatus("draft");
      setAssembleError(message);
      toast.error(message);
    } finally {
      setAssembling(false);
    }
  };

  /**
   * 提示词直出线的「改一版」= 按原始提示词重新拆解（可带调整要求）。
   * 不走主题式 AI 创作 —— 那会丢掉用户提示词里的人物卡与画面设定。免费，与拆解同一条端点。
   */
  const reparseFromPrompt = async (instruction?: string, aiReply?: string) => {
    const raw = promptSource?.raw?.trim();
    if (!raw) return;
    setPhase("gen");
    try {
      const parsed = await ShortsApi.parsePrompt({ prompt: raw, instruction });
      const patch = parsedToDraft(parsed);
      setMeta(patch.meta);
      setLogline((prev) => patch.logline || prev);
      setVisualBible(patch.visualBible);
      setPromptNotes(patch.notes);
      setShots(patch.shots as ShortShot[]);
      setSuggestions([]);
      setContinuityManifest(undefined); // 依赖图由服务端在下一次保存 / 预检时按新分镜重建
      setAssembled((prev) => (prev ? { ...prev, stale: true } : prev));
      setDraftStatus("draft");
      setAssembleError(null);
      setPreflight(null);
      setPhase("done");
      setPane("board");
      setChat((c) => [
        ...c,
        { who: "ai", text: aiReply ?? `按原文重新拆成了 ${patch.shots.length} 镜（约 ${patch.shots.reduce((a, x) => a + x.dur, 0)} 秒），人物、场景和画面基调也一起更新了。` },
      ]);
      toast.success("重拆好了");
    } catch (e) {
      setPhase(shots.length ? "done" : "idle");
      const msg = aiErrorMessage(e, "重拆没成功，请稍后重试");
      setChat((c) => [...c, { who: "ai", text: `重拆没成功：${msg}` }]);
      flagChatReply();
      toast.error(msg);
    }
  };

  /** 真实 AI 生成口播脚本（DRAMA_SCRIPT_DRAFT）→ 映射为结构化分镜表。 */
  const runScript = async (instruction?: string, aiReply?: string) => {
    if (phase === "gen") return;
    if (fromPrompt) {
      await reparseFromPrompt(instruction, aiReply);
      return;
    }
    setPhase("gen");
    try {
      // 出脚本的「主题」优先用用户真实点子：创意套用而来时 title 可能是创意名（如「韦斯·安德森风格」），
      // 不能当成视频主题，否则会丢掉用户补的主题。创意风格仍由 aiReference（styleRef）单独喂入。
      const subject = realIdea || title;
      const theme = instruction ? `${subject}。要求：${instruction}` : subject;
      const drafts = await ShortDramaApi.aiDraftScripts({
        theme,
        // 聊天页带来的故事：草稿的 fmtName 就是大纲里定的类型（如「都市逆袭」），比「通用短视频」准。
        genre: hasTemplate ? fmt.name : hasStyle ? styleName || fmt.name : storyFromDraft ? initial.fmtName || "通用短视频" : "通用短视频",
        durationSec: total || fmt.dur || 30,
        count: 1,
        reference: aiReference,
      });
      const script = drafts[0];
      if (!script || !script.scenes?.length) throw new Error("AI 这次没写出能用的脚本，换个说法再试试");
      setMeta(script.meta ?? null);
      setContinuityManifest(script.continuity_manifest);
      // 故事大纲（logline）：AI 给了就用新的，没给则保留用户已编辑的（与 meta 同惯例不强制覆盖）。
      setLogline((prev) => (script.logline?.trim() ? script.logline : prev));
      // 后续推荐 action 跟着这一版脚本走：取后端 suggestions（去空 + 去重 + 最多 4 条）。
      setSuggestions(
        Array.isArray(script.suggestions)
          ? Array.from(new Set(script.suggestions.map((s) => (s || "").trim()).filter(Boolean))).slice(0, 4)
          : [],
      );
      setShots(
        script.scenes.map((sc, i) => ({
          id: script.continuity_manifest?.shots[i]?.id ?? "sh" + Date.now() + "_" + i,
          no: i + 1,
          dur: Math.max(2, sc.duration_sec || 4),
          visual: sc.shot || sc.summary || "",
          size: i === 0 ? "中近景" : "中景",
          move: i === 0 ? "推近" : "固定",
          voWho: "口播",
          voText: sc.dialogue ?? "",
          sfx: sc.sfx ?? "",
          bgm: sc.bgm ?? "",
          fx: sc.fx ?? "",
          beat: sc.beat ?? "",
          refs: [],
          sub: true,
          flow: "draft" as ShotFlow,
          engine: "avatar",
          frameIdx: 0,
          sceneId: script.continuity_manifest?.shots[i]?.sceneId,
          parentShotId: script.continuity_manifest?.shots[i]?.parentShotId,
        })),
      );
      setAssembled((prev) => (prev ? { ...prev, stale: true } : prev));
      setDraftStatus("draft");
      setAssembleError(null);
      // 旧的检查结果是按上一版分镜算的（第一次生成时甚至是 0 镜），留着会和新分镜自相矛盾。
      setPreflight(null);
      setPhase("done");
      setPane("board");
      // 生成完成后对话框一定给一条反馈（不只在「改一版」时）。
      const audioBits = script.scenes.some((sc) => sc.sfx || sc.bgm || sc.fx) ? "（带音效、BGM 和特效建议）" : "";
      const voiceHint =
        !charAvatar && script.scenes.some((sc) => (sc.dialogue ?? "").trim())
          ? "\n\n有台词的镜头要配音，配音用数字人的声音，记得在「主角」里绑定一个。"
          : "";
      setChat((c) => [
        ...c,
        {
          who: "ai",
          text:
            aiReply ??
            `口播脚本和分镜写好了，共 ${script.scenes.length} 镜${audioBits}。在分镜表里逐镜改，改好后每一镜先出首帧，满意了再生成视频。${voiceHint}`,
        },
      ]);
      toast.success("脚本和分镜写好了，下一步给每一镜出首帧");
    } catch (e) {
      setPhase(shots.length ? "done" : "idle");
      const msg = aiErrorMessage(e, "脚本没写出来，请稍后重试");
      setChat((c) => [...c, { who: "ai", text: `没写出来：${msg}` }]);
      flagChatReply();
      toast.error(msg);
    }
  };

  /**
   * 重写 / 重拆会整表替换分镜（新镜头 id 全换），表里已生成的首帧、视频、配音就挂不回来了。
   * 有这些产物时先确认，写清会丢什么（§2.6：说后果，不说机制）。always=true 时即使没产物也确认
   * （按原文重拆会替换你手改过的镜头）。
   */
  const confirmReplaceShots = async (always = false): Promise<boolean> => {
    const frames = shots.filter((x) => x.frameUrl || x.frameUrls?.length).length;
    const videos = shots.filter((x) => x.videoUrl).length;
    const audios = shots.filter((x) => x.audio?.cdnKey).length;
    // 还在后台生成的镜：换表之后镜头 id 全变，结果填不回来，但积分照扣。
    const running = shots.filter((x) => x.pendingJob).length;
    if (!frames && !videos && !audios && !running && !always) return true;
    const lost = [frames ? `${frames} 张首帧` : "", videos ? `${videos} 段视频` : "", audios ? `${audios} 镜配音` : ""]
      .filter(Boolean)
      .join("、");
    const runningLine = running ? `还有 ${running} 镜在后台生成，换表之后这些结果也填不回来。` : "";
    return dramaConfirm({
      title: fromPrompt ? "按原文重拆分镜？" : "重写整张分镜表？",
      body: lost
        ? `整张分镜表会换成新的，你手改过的镜头也会被替换。表里已生成的 ${lost}会被移除，已花的积分不退。${runningLine}`
        : `整张分镜表会换成新的，你手改过的镜头也会被替换。${runningLine}`,
      confirmLabel: fromPrompt ? "重拆" : "重写分镜",
      cancelLabel: "先不改",
      tone: "danger",
    });
  };
  const regen = () => {
    // 有镜头正在出片（单镜 busy 或一键连跑）时不许整表替换：旧任务照常扣费，
    // 但产物会因为 shot id 全换而挂不回草稿 —— 等它跑完或停止连跑再重来。
    if (busy || runProgress) {
      toast.error("有镜头正在生成视频，等它做完（或点「停止」）再重写分镜");
      return;
    }
    // 整表替换前确认（有已生成内容时必弹；按原文重拆还会替换手改过的镜，也弹）。免费，故不带积分。
    void (async () => {
      if (await confirmReplaceShots(fromPrompt)) void runScript();
    })();
  };

  // 真带入点子且尚无分镜时,自动跑一次真实生成（不伪造结果；失败会在对话里显示真实错误）。
  const autoGenRef = React.useRef(false);
  React.useEffect(() => {
    if (!autoGenRef.current && realIdea && shots.length === 0) {
      autoGenRef.current = true;
      void runScript();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 快捷修改 chip：只来自 AI 跟当前脚本给出的后续建议（不写死兜底）；没有建议就不显示这排。
  const quickChips = suggestions;
  const sendChat = (text: string) => {
    const t = (text || "").trim();
    if (!t || phase === "gen") return;
    // 与 regen 同一守门：正在出片时不改整张分镜表，避免在途任务白扣费。
    if (busy || runProgress) {
      toast.error("有镜头正在生成视频，等它做完（或点「停止」）再让 AI 改分镜");
      return;
    }
    const firstRun = shots.length === 0;
    void (async () => {
      // 对话和快捷改法都会整表重写：表里已有首帧 / 视频时先确认，取消就把输入原样留着。
      if (!firstRun && !(await confirmReplaceShots())) return;
      setChat((c) => [...c, { who: "me", text: t }]);
      setDraft("");
      // 第一次生成用 runScript 自带的完整说明（下一步做什么），之后的改写只回一句结果。
      void runScript(t, firstRun ? undefined : fromPrompt ? "按原文加上你的要求重拆好了。" : "分镜表已按你的要求重写。");
    })();
  };
  const invalidateAssembly = () => {
    setAssembled((prev) => (prev ? { ...prev, stale: true } : prev));
    setDraftStatus("draft");
    setAssembleError(null);
    setPreflight(null);
  };
  /** 视觉设定编辑：改一处即整体回写（dataRef 已带 visualBible，autosave 自动落库）。 */
  const patchBibleCharacter = (index: number, patch: Partial<{ name: string; visual: string; performance: string }>) => {
    setVisualBible((prev) =>
      prev
        ? { ...prev, characters: prev.characters.map((c, i) => (i === index ? { ...c, ...patch } : c)) }
        : prev,
    );
    invalidateAssembly();
  };
  const addBibleCharacter = () => {
    setVisualBible((prev) => ({
      universal: prev?.universal ?? "",
      scenes: prev?.scenes ?? [],
      characters: [...(prev?.characters ?? []), { name: "", visual: "", performance: "" }],
    }));
    invalidateAssembly();
  };
  /** 删角色同时清掉各镜对他的引用，否则分镜里会留一个指不到人的名字。 */
  const removeBibleCharacter = (index: number) => {
    const gone = visualBible?.characters?.[index]?.name;
    setVisualBible((prev) =>
      prev ? { ...prev, characters: prev.characters.filter((_, i) => i !== index) } : prev,
    );
    if (gone) {
      setShots((arr) =>
        arr.map((shot) =>
          shot.castNames ? { ...shot, castNames: shot.castNames.filter((n) => n !== gone) } : shot,
        ),
      );
    }
    invalidateAssembly();
  };
  const addBibleScene = () => {
    setVisualBible((prev) => ({
      universal: prev?.universal ?? "",
      characters: prev?.characters ?? [],
      scenes: [...(prev?.scenes ?? []), { name: "", visual: "" }],
    }));
    invalidateAssembly();
  };
  const removeBibleScene = (index: number) => {
    const gone = visualBible?.scenes?.[index]?.name;
    setVisualBible((prev) => (prev ? { ...prev, scenes: prev.scenes.filter((_, i) => i !== index) } : prev));
    if (gone) {
      setShots((arr) => arr.map((shot) => (shot.sceneName === gone ? { ...shot, sceneName: undefined } : shot)));
    }
    invalidateAssembly();
  };

  const patchBibleScene = (index: number, patch: Partial<{ name: string; visual: string }>) => {
    setVisualBible((prev) =>
      prev ? { ...prev, scenes: prev.scenes.map((sc, i) => (i === index ? { ...sc, ...patch } : sc)) } : prev,
    );
    invalidateAssembly();
  };

  const updShot = (id: string, patch: Partial<ShortShot>) => {
    const apply = (s: ShortShot): ShortShot => ({ ...s, ...patch, ...(patch.voText !== undefined ? { audio: undefined } : {}) });
    // shotsRef 同步跟上：同一个异步流程里紧接着读它（如刚写下 pendingJob 就去比对任务号）不用等下一次渲染。
    // 下一次渲染会用 state 覆盖它，state 仍是唯一真值。
    shotsRef.current = shotsRef.current.map((s) => (s.id === id ? apply(s) : s));
    setShots((arr) => arr.map((s) => (s.id === id ? apply(s) : s)));
    invalidateAssembly();
  };
  /**
   * 把一条到了终态的后台任务结果落到镜头上。只有这一镜手上的 pendingJob 还是这条任务时才落：
   * 镜头删了、整表换了、或者已经换了一条新任务，旧结果一律丢掉，不能盖掉新的。
   * 首帧结果统一走 freshFramePatch（清掉旧视频 / 尾帧 / 动作描述和它们的任务号），三条路径同一套规则。
   */
  const settleJob = (id: string, pj: PendingJob, job: SettledJob, submitRefs?: ShortShot["appliedRefs"]): "done" | "failed" | "empty" | "stale" => {
    const cur = shotsRef.current.find((s) => s.id === id);
    if (!cur || cur.pendingJob?.jobId !== pj.jobId) return "stale";
    if (job.status === "failed") {
      updShot(id, { pendingJob: undefined });
      return "failed";
    }
    if (pj.kind === "frame") {
      const frames = job.frames ?? job.result?.frames ?? [];
      if (!frames.length) {
        updShot(id, { pendingJob: undefined });
        return "empty";
      }
      updShot(id, freshFramePatch(frames.map((f) => f.url), job.applied_refs ?? job.result?.applied_refs));
      return "done";
    }
    if (!job.video_url) {
      updShot(id, { pendingJob: undefined });
      return "empty";
    }
    updShot(id, clipResultPatch(pj.jobId, job.video_url, job.applied_refs ?? submitRefs));
    return "done";
  };

  /**
   * 后台接着等一条已提交的任务（轮询超时后 / 进页对账发现还在跑 / 点「查看进度」）。
   * 不占 busy：等它的时候别的镜照样能生成。同一镜只等一份。等到了就回填；又超时就保留 pendingJob，
   * 镜头上留一个「查看进度」。**这里绝不重新提交**。
   */
  const watchPending = async (id: string, pj: PendingJob): Promise<void> => {
    if (!aliveRef.current || watchingRef.current.has(id)) return;
    watchingRef.current.add(id);
    setWatching(new Set(watchingRef.current));
    try {
      const done = pj.kind === "frame" ? await shotRender.pollFrame(pj.jobId) : await shotRender.pollClip(pj.jobId);
      if (!aliveRef.current || isPollTimeout(done)) return;
      const no = shotsRef.current.find((s) => s.id === id)?.no;
      const r = settleJob(id, pj, done);
      if (r === "done") toast.success(pj.kind === "frame" ? `镜 ${no} 的首帧好了` : `镜 ${no} 的视频好了，满意就点「就用这版」`);
      else if (r === "failed") toast.error(aiErrorMessage(done.error_message, `镜 ${no} 上次没生成成功，可以重新生成`));
      else if (r === "empty") toast.error(`镜 ${no} 生成完了但没拿到结果，可以重新生成`);
    } catch (e) {
      if (!aliveRef.current) return;
      // 轮询出错：先分清是「服务端说没有这条任务」还是一时没连上。前者才清掉 pendingJob、允许重新生成。
      const peek = await peekJob(pj);
      // 查的这一下里页面可能已经离开了：不再回填、不再弹提示（toast 是全局的，会出现在别的页面上），留给下次进页对账。
      if (!aliveRef.current) return;
      const no = shotsRef.current.find((s) => s.id === id)?.no;
      if (peek.state === "missing") {
        if (settleJob(id, pj, { status: "failed" }) !== "stale") toast(`镜 ${no} 上次的生成没取回结果，需要的话重新生成`);
      } else if (peek.state === "terminal") {
        const r = settleJob(id, pj, peek.job);
        if (r === "done") toast.success(`镜 ${no} 的${pj.kind === "frame" ? "首帧" : "视频"}好了`);
        else if (r === "failed" || r === "empty") toast.error(`镜 ${no} 上次没生成成功，可以重新生成`);
      } else if (peek.state === "unknown") {
        toast.error(aiErrorMessage(e, "没查到这一镜的生成进度，过一会儿再点「查看进度」"));
      }
    } finally {
      watchingRef.current.delete(id);
      if (aliveRef.current) setWatching(new Set(watchingRef.current));
      notifyWalletChanged();
    }
  };

  /**
   * 提交请求发出去之后用户就离开了页面（卸载）：服务端已经受理、已经扣费，但 pendingSig 的即时落库
   * 不会再跑（组件没了）。任务号交给 draftSync 补记：**只补这一镜的 pendingJob**，不整份保存这个旧页面的快照
   * （此前整份存，会盖掉离开后又打开这条草稿做的新编辑）；这条草稿正开着就交给开着的页面，没开着就排队读最新再补。
   */
  const persistIfLeft = (shotId: string, pj: PendingJob) => {
    if (aliveRef.current || discardRef.current) return;
    void draftSync.reportLateJob(draftId, shotId, pj);
  };

  /**
   * 单镜生成：首帧 / 视频走后台任务 + 前台轮询。
   * 结果：done 出来了 / failed 没成（已退款）/ pending 还在后台跑（轮询超时或查不到进度，页面接着在后台等）/
   * stale 结果回来了但没落到镜上（这一镜被删了、或任务号已经被换掉）—— stale 不是 done，批量不能把它算成生成好。
   * 这一镜已经有任务在跑（pendingJob）时**不提交**，改成去查那条任务 —— 服务端每次提交都新建任务、
   * 单独冻结积分，没有按镜头去重，重复提交就是重复扣费。
   */
  const render = async (id: string, to: ShotFlow): Promise<ShotRunResult> => {
    const shot = shotsRef.current.find((s) => s.id === id);
    if (!shot || !aliveRef.current) return "failed";
    if (shot.pendingJob) {
      void watchPending(id, shot.pendingJob);
      return "pending";
    }
    if (busyRef.current) {
      toast("有一镜正在生成，等它做完再点");
      return "failed";
    }
    setBusy({ id, to });
    // 读最新一次渲染的草稿（连跑循环里的这个函数是开跑那一刻的闭包，主角 / 设定可能中途改过）。
    const d = dataRef.current;
    // C-3：主角（数字人 / 参考图）+ 场景参考 → 结构化 ref_slots，服务端按端点 capability 裁剪 + 回报 applied_refs。
    const refSlots = {
      characterRefs: [
        d.characterAvatar?.image ? { url: d.characterAvatar.image } : null,
        d.characterRef ? { cdnKey: d.characterRef.cdnKey, url: d.characterRef.url } : null,
      ].filter((item): item is { url: string; cdnKey?: string } => item !== null),
      sceneRef: d.sceneRef ? { cdnKey: d.sceneRef.cdnKey, url: d.sceneRef.url } : undefined,
    };
    const promptCtx = {
      meta: d.meta ?? null,
      shot,
      styleName: renderStyleName,
      manifest: d.continuityManifest,
      shotId: shot.id,
      visualBible: d.visualBible,
    };
    // 提交受理后才有值：catch 里据它分清「没交上」和「交上了、等结果时出错」。
    let pj: PendingJob | undefined;
    try {
      let submitRefs: ShortShot["appliedRefs"];
      if (to === "frame") {
        const job = await shotRender.submitFrameJob({
          vars: buildShortFrameVars(promptCtx),
          count: 1,
          shotId: id,
          refSlots,
          name: `${displayName} · 镜 ${shot.no} 首帧`,
        });
        pj = { jobId: job.id, kind: "frame" };
        // 任务已提交 → 记进草稿（随即单独落库，见 pendingSig），离开页面后回来可对账恢复。
        updShot(id, { pendingJob: pj });
        persistIfLeft(id, pj);
        if (aliveRef.current) toast.success("首帧已加入后台生成");
      } else {
        const job = await shotRender.renderClip({
          vars: buildShortClipVars(promptCtx),
          name: `${displayName} · 镜 ${shot.no} 视频`,
          durationSec: shot.dur,
          shotId: id,
          frameUrl: shot.frameUrl,
        });
        pj = { jobId: job.id, kind: "clip" };
        submitRefs = job.applied_refs;
        updShot(id, { pendingJob: pj });
        persistIfLeft(id, pj);
      }
      const done = pj.kind === "frame" ? await shotRender.pollFrame(pj.jobId) : await shotRender.pollClip(pj.jobId);
      if (!aliveRef.current) return "pending"; // 页面已经离开：结果留给下次进页对账
      if (isPollTimeout(done)) {
        // 超时 ≠ 失败：任务仍在后台跑，保留 pendingJob，页面接着在后台等（不占 busy）。
        toast(pj.kind === "frame" ? "首帧还在后台生成，好了会自动填回来" : "视频还在后台生成，好了会自动填回来");
        void watchPending(id, pj);
        return "pending";
      }
      const r = settleJob(id, pj, done, submitRefs);
      if (r === "failed") throw new Error(done.error_message || (pj.kind === "frame" ? "首帧没生成出来，请重试" : "视频没生成出来，请重试"));
      if (r === "empty") throw new Error(pj.kind === "frame" ? "首帧生成完了但没拿到图片，请重试" : "视频生成完了但没拿到文件，请重试");
      // stale：等的这段时间里这一镜被删了、或任务号被换掉了，结果没落到镜上。不提示，也**不能返回 done**：
      // 批量的 onShotDone 会把这一镜标成「就用这版」，而它手上没有这条视频。
      if (r === "stale") return "stale";
      toast.success(pj.kind === "frame" ? "首帧好了，满意就点「生成视频」" : "镜头视频好了");
      return "done";
    } catch (e) {
      // 任务已受理、等结果时出错（断网 / 任务查不到）：这一镜手上还是这条任务号，就不是「没生成出来」——
      // 交给后台去等，它会先分清任务还在不在（peekJob），不在才放开重新生成。这里不能报失败让人再点一次。
      const holding = pj && shotsRef.current.find((s) => s.id === id)?.pendingJob?.jobId === pj.jobId;
      if (pj && holding) {
        if (aliveRef.current) void watchPending(id, pj);
        return "pending";
      }
      if (aliveRef.current) toast.error(aiErrorMessage(e, "没生成出来，请稍后重试"));
      return "failed";
    } finally {
      setBusy(null);
      // 提交时扣了积分、失败时会退回：两种情况余额都变了，让顶栏重读一次。
      notifyWalletChanged();
    }
  };

  /**
   * 进页对账：对带 pendingJob 的镜头查一次任务状态 —— 已完成回填、还在跑就在后台接着等、
   * 服务端确认失败 / 没有这条任务才清 pendingJob（这时才允许重新生成）。
   * 快照（listRenderTasks）只含最近几十条：不在快照里的，按任务号再直接查一次，查不准就原样保留。
   * StrictMode 双挂载守卫：reconcileRef 一次性放行（与 autoGenRef 同惯例）。
   */
  const reconcileRef = React.useRef(false);
  // 进页对账还没查完：在途镜头先按「正在查」显示（不给「查看进度」，免得点了跟对账各查一遍）。
  const [reconciling, setReconciling] = React.useState(() => initial.shots.some((s) => (s as ShortShot).pendingJob));
  React.useEffect(() => {
    if (reconcileRef.current) return;
    reconcileRef.current = true;
    const pendings = shots.filter((s) => s.pendingJob);
    if (!pendings.length) return;
    void (async () => {
      try {
        await reconcilePendings(pendings);
      } finally {
        if (aliveRef.current) setReconciling(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 认领离开页面后才拿到的任务号（上一次打开这条草稿时点了生成、没等提交返回就走了）：
  // 这一镜还在、手上没有别的任务、也没有当前视频，才补记上并在后台接着等；补记会触发 pendingSig 立刻落库。
  // 用 ref 转一道：订阅只在挂载时建一次，回调里要用的是最新的 updShot / watchPending。
  const adoptLateJobRef = React.useRef<(shotId: string, pj: PendingJob) => void>(() => {});
  adoptLateJobRef.current = (shotId, pj) => {
    const cur = shotsRef.current.find((s) => s.id === shotId);
    if (!cur || !canAdoptLateJob(cur, pj)) return;
    updShot(shotId, { pendingJob: pj });
    void watchPending(shotId, pj);
  };
  React.useEffect(() => draftSync.subscribe(draftId, (shotId, pj) => adoptLateJobRef.current(shotId, pj)), [draftId]);

  const reconcilePendings = async (pendings: ShortShot[]): Promise<void> => {
    let byId = new Map<string, DramaRenderTask>();
    try {
      const snap = await listRenderTasks(draftId);
      byId = new Map(snap.tasks.map((t) => [t.id, t]));
    } catch {
      /* 快照没拉到：下面逐条按任务号查 */
    }
    for (const shot of pendings) {
      if (!aliveRef.current) return;
      const pj = shot.pendingJob;
      if (!pj) continue;
      const task = byId.get(pj.jobId);
      let terminal: SettledJob | null = null;
      if (task && (task.status === "ready" || task.status === "failed")) {
        terminal = task;
      } else if (!task) {
        const peek = await peekJob(pj);
        if (peek.state === "terminal") terminal = peek.job;
        else if (peek.state === "missing") {
          if (settleJob(shot.id, pj, { status: "failed" }) !== "stale") {
            toast(`镜 ${shot.no} 上次的生成没取回结果，需要的话重新生成`);
          }
          continue;
        } else if (peek.state === "unknown") {
          // 查不准：保留 pendingJob（不能当它没了再提交一次），镜头上留「查看进度」让用户过会儿再点。
          continue;
        }
      }
      if (terminal) {
        const r = settleJob(shot.id, pj, terminal);
        if (r === "failed") toast.error(`镜 ${shot.no} 上次没生成成功，可以重新生成`);
        else if (r === "empty") toast.error(`镜 ${shot.no} 上次生成完了但没拿到结果，可以重新生成`);
      } else {
        // 仍在排队 / 生成中 → 后台接着等（镜头格显示生成中，不占 busy，几镜可以一起等）。
        void watchPending(shot.id, pj);
      }
    }
  };

  /** 这一镜的视频报价：按所选视频模型、这一镜的时长算（按秒计费的模型 × 秒数）。 */
  const clipCostOf = (s: Pick<ShortShot, "dur">) =>
    renderCreditCost({
      models: renderModels.models,
      lane: "video",
      endpointId: renderModels.videoEndpointId,
      fallback: cfg.prices.clip,
      durationSec: s.dur,
    });
  /** 首帧报价：按所选图片模型。 */
  const frameCost = renderCreditCost({
    models: renderModels.models,
    lane: "image",
    endpointId: renderModels.imageEndpointId,
    fallback: cfg.prices.frame,
  });
  /** AI 改图：和出首帧用同一个图片模型（改图弹窗带上 imageEndpointId），价格也就是同一个。 */
  const aiEditCost = frameCost;
  /**
   * 模型和价格还没读到 / 没读到：上面这几个数只能回落全局单价，服务端却按默认模型的价扣（视频还乘秒数），
   * 确认框会报低。这时按模型计价的入口一律停用（单镜的出首帧 / 生成视频 / 重新生成 / AI 改图，和一起生成），
   * 读失败给「重试」。
   */
  const priceBlock = priceBlockReason(renderModels.status);

  /**
   * 一键连跑出片（安全版，v0.94）：一次确认总价，再依次为没有视频的镜头生成视频。
   * ① 报价按每镜时长和所选模型逐镜相加；② 顺序 await，镜头上显示进度；③ 任一镜失败即停，已出的保留；
   * ④ 点停止、点返回、从侧栏跳走（卸载），都在当前这一镜之后停下，不再提交后面的镜。
   * 在途镜头（后台还在跑的）不在这一轮里：它们等后台结果，不重新提交。
   */
  const runAll = async () => {
    if (busyRef.current || runProgress) return;
    if (priceBlock) {
      toast(priceBlock);
      return;
    }
    // 在途镜头先对账：页面没在等的（轮询超时 / 上次没查准）现在去查一次，好了就填回来。只查不交。
    for (const s of shotsRef.current) {
      if (s.pendingJob && !watchingRef.current.has(s.id)) void watchPending(s.id, s.pendingJob);
    }
    // 走到这里 busy 一定是空的，在途只看 pendingJob。
    const targets = batchTargets(shotsRef.current, null);
    const running = shotsRef.current.filter((s) => !hasCurrentVideo(s) && isInFlight(s, null)).length;
    if (!targets.length) {
      toast(
        running
          ? `剩下的 ${running} 镜正在后台生成，好了会自动填回来`
          : toConfirmCount
            ? `每一镜都有视频了，还有 ${toConfirmCount} 镜等你点「就用这版」`
            : "每一镜都有视频了",
      );
      return;
    }
    const noFrame = targets.filter((s) => !s.frameUrl).length;
    const withFrame = targets.length - noFrame;
    const cost = sumCost(targets, clipCostOf);
    const lines = [
      withFrame ? `${withFrame} 镜照已出的首帧生成视频。` : "",
      noFrame ? `${noFrame} 镜还没有首帧，会跳过首帧直接出视频，人物和画面可能和别的镜对不上。` : "",
      // 与下面循环一致：这次在页面上生成好的镜直接标 flow=done。某一镜转到后台时整轮先停在那里，
      // 它回来后是待确认（settleJob 写 flow=clip），这一点由那条 toast 当场说。
      "这次生成好的镜头直接算「就用这版」，不用再一镜一镜点。",
      toConfirmCount ? `另有 ${toConfirmCount} 镜已经有视频、还没点「就用这版」，这次不重新生成。` : "",
      running ? `还有 ${running} 镜正在后台生成，这一轮先跳过、不重复提交，好了会自动填回来。` : "",
      "一次生成一镜，中途可以停。离开或关掉这一页，会停在当前这一镜：它照常生成完，后面的不再生成。",
    ].filter(Boolean);
    const ok = await dramaConfirm({
      title: `剩下 ${targets.length} 镜一起生成视频？`,
      body: (
        <div className="col gap-1">
          {lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ),
      cost,
      confirmLabel: "开始生成",
      cancelLabel: "先不生成",
    });
    // 确认框开着的时候页面可能已经离开了：卸载后 gate 已作废，begin 出来的这一轮一镜都不会提交。
    if (!ok || !aliveRef.current) return;
    const gate = runGateRef.current;
    const token = gate.begin();
    setStopping(false);
    setRunProgress({ done: 0, total: targets.length });
    try {
      const res = await runBatch({
        targets,
        gate,
        token,
        // 提交前再看一眼最新状态：这一镜可能已被后台结果填上、正在跑、或者被删了。
        stillNeeded: (id) => {
          const cur = shotsRef.current.find((s) => s.id === id);
          return !!cur && !hasCurrentVideo(cur) && !isInFlight(cur, busyRef.current?.id);
        },
        renderOne: (s) => render(s.id, "clip"),
        onShotDone: (s, done) => {
          // 只把「这次确实拿到了视频、待确认」的那一镜标成就用这版（同 approvableIds 的口径）：
          // 结果没落到镜上时（stale）runBatch 不会走到这里，这一道是再兜一次。
          const cur = shotsRef.current.find((x) => x.id === s.id);
          if (cur && pickApprovableIds([cur], busyRef.current?.id).length) updShot(s.id, { flow: "done" });
          setRunProgress({ done, total: targets.length });
        },
      });
      if (!aliveRef.current) return;
      if (res.outcome === "stopped") {
        toast(`已停下：做完 ${res.done}/${targets.length} 镜，剩下的随时可以接着生成`);
      } else if (res.outcome === "pending") {
        toast(`镜 ${res.at?.no} 还在后台生成，先停在这里。它好了会自动填回来，满意就点「就用这版」，剩下的再接着生成`);
      } else if (res.outcome === "failed") {
        toast.error(`镜 ${res.at?.no} 没生成成功，已停下。前面做好的都保留了，这一镜可以单独重试`);
      } else {
        // toConfirmCount 是开跑前的数：那几镜这次没动，仍要用户确认。
        toast.success(
          toConfirmCount
            ? `这 ${res.done} 镜生成好了，已算「就用这版」。之前有视频的 ${toConfirmCount} 镜还要你点「就用这版」`
            : hasDialogue
              ? "视频都生成好了，下一步生成配音，再合成成片"
              : "视频都生成好了，可以合成成片",
        );
      }
    } finally {
      if (aliveRef.current) {
        setRunProgress(null);
        setStopping(false);
      }
    }
  };
  /**
   * 生成好、还没点「就用这版」的镜头全部标成就用这版（只改 flow clip→done，不花积分）。
   * 短视频合成要求每一镜都点过「就用这版」（服务端 DramaShortAssembleService.buildPlan），
   * 一镜一镜点太费事。只认 flow=clip：重出过首帧的镜手上那条是旧视频（已作废），不能被重新确认；
   * 正在生成 / 后台还在跑的镜也不算，新视频出来会回到待确认。
   */
  const approvableIds = pickApprovableIds(shots, busyId);
  const approveAllWithVideo = () => {
    const ids = new Set(approvableIds);
    if (!ids.size || draftStatus === "done") return;
    setShots((arr) => arr.map((s) => (ids.has(s.id) ? { ...s, flow: "done" as const } : s)));
    invalidateAssembly();
    toast.success(`${ids.size} 镜已标成「就用这版」。哪一镜不满意，还能单独重新生成视频`);
  };
  const approveAllButton = (className: string, label: React.ReactNode, style: React.CSSProperties = { flex: "none" }) => (
    <button
      type="button"
      className={className}
      style={style}
      onClick={approveAllWithVideo}
      title={`把 ${approvableIds.length} 镜已有的视频都标成「就用这版」，不花积分`}
    >
      <Check size={14} /> {label}
    </button>
  );
  const stopRunAll = () => {
    if (!runProgress || runGateRef.current.stopped) return;
    runGateRef.current.stop();
    setStopping(true);
    toast("好，这一镜做完就停");
  };

  // 主角 / 主场景 参考图上传（→ OSS，存 url+cdnKey），与短剧工坊同一上传端点。
  const uploadRefImage = async (file: File, kind: "char" | "scene") => {
    if (uploading) return;
    setUploading(kind);
    try {
      const r = await DramaAssetsApi.uploadAssetRef(file, kind === "char" ? "人物" : "场景");
      const ref = { url: r.url, cdnKey: r.cdnKey };
      if (kind === "char") setCharRef(ref);
      else setSceneRef(ref);
      toast.success("参考图已上传");
    } catch (e) {
      toast.error(aiErrorMessage(e, "参考图上传失败，请重试"));
    } finally {
      setUploading(null);
    }
  };
  // 分镜表元素：内联与「放大」全屏弹层共用同一份（同一组 handlers）。
  // 说话人：按你的脚本拆出来的片子，台词常常是某个角色说的，下拉里要能选到这些人。
  const speakerOptions = fromPrompt
    ? Array.from(new Set([...(visualBible?.characters ?? []).map((c) => c.name.trim()).filter(Boolean), "旁白", "口播"]))
    : ["口播", "旁白"];
  /** AI 改图回填（见 frameEditPatch）：只按回来那一刻的最新状态判，不按弹窗打开时的。 */
  const applyFrameEdit = (id: string, frameUrl: string) => {
    const cur = shotsRef.current.find((s) => s.id === id);
    if (!cur) return; // 改图的时候这一镜被删了
    const { late, patch } = frameEditPatch(cur, frameUrl, busyRef.current?.id);
    updShot(id, patch);
    if (late) {
      const redoingFrame = (cur.pendingJob?.kind ?? (busyRef.current?.id === id ? busyRef.current.to : null)) === "frame";
      toast(
        redoingFrame
          ? `镜 ${cur.no} 改好的图先换上了。这一镜还在重新出首帧，出来之后用新出的那张`
          : `镜 ${cur.no} 的首帧换成改好的这张了。视频是按原来那张做的，想按新图出就点「重新生成」`,
      );
    }
  };
  // 在途镜头：表格里显示「生成中」、不给生成按钮（单镜入口也不能重复提交）；页面没在等它时给「查看进度」。
  const pendingView: Record<string, { kind: "frame" | "clip"; watching: boolean }> = {};
  for (const s of shots) {
    if (s.pendingJob) pendingView[s.id] = { kind: s.pendingJob.kind, watching: reconciling || watching.has(s.id) || busyId === s.id };
  }
  const storyboardTable = (
    <ShortStoryboardTable
      shots={shots}
      beats={shots.map((s) => s.beat ?? "")}
      speakerOptions={speakerOptions}
      characters={(visualBible?.characters ?? []).map((c) => c.name).filter(Boolean)}
      locked={draftStatus === "done"}
      busy={busy}
      // 报价跟着所选模型走：首帧按图片模型；视频按视频模型 × 这一镜的秒数（按秒计费时）。
      frameCost={frameCost}
      clipCostFor={clipCostOf}
      aiEditCost={aiEditCost}
      imageEndpointId={renderModels.imageEndpointId}
      priceBlock={priceBlock}
      // 一起生成的这一轮里：秒数不能改（总价是按开跑时的秒数报的，服务端按提交时的秒数扣），
      // AI 改图也先不给（这一轮会按「现在这张」首帧出视频，改到一半的图对不上）。
      runLock={runProgress ? "正在一起生成视频，这一轮做完再改" : null}
      pending={pendingView}
      onCheckPending={(id) => {
        const pj = shotsRef.current.find((s) => s.id === id)?.pendingJob;
        if (pj) void watchPending(id, pj);
      }}
      onPatch={(id, patch) => updShot(id, patch)}
      onDelete={(id) => {
        setShots((arr) => arr.filter((x) => x.id !== id).map((x, j) => ({ ...x, no: j + 1 })));
        invalidateAssembly();
      }}
      // 返回 render 的 Promise：表格里的 CreditButton 等它结束再刷新余额（不返回就只能等 1.5 秒兜底）。
      onRender={(id, kind) => render(id, kind === "frame" ? "frame" : "clip")}
      onApprove={(id) => updShot(id, { flow: "done" })}
      // 只重新生成这一镜的视频：沿用当前首帧（render 的 clip 分支带 shot.frameUrl），不动首帧。
      onRedoClip={(id) => render(id, "clip")}
      // AI 改了首帧：正常就是首帧换了，旧视频 / 尾帧一起作废（与重出首帧同一套规则）。
      // 改图结果晚到、这一镜已经在生成视频或有了新视频时，只换首帧，任务号和视频都留着（frameEditPatch）。
      onFrameEdited={applyFrameEdit}
    />
  );

  const needVoiceBinding = hasDialogue && !charAvatar;
  // 只有「没视频、也没在后台生成」的镜才需要一起生成；在途的等后台结果，不算进来。
  const runAllIdle = shots.length > 0 && draftStatus !== "done" && !runProgress && batchCount > 0;
  const runAllButton = (className: string, label: React.ReactNode) => (
    <button
      type="button"
      className={className}
      style={{ flex: "none" }}
      disabled={!!busy || !!priceBlock}
      title={priceBlock ?? (busy ? "有一镜正在生成，等它做完再点" : `给还没有视频的 ${batchCount} 镜一起生成视频`)}
      onClick={() => void runAll()}
    >
      <Zap size={14} /> {label} <CreditMark tone="inherit" size={12} />
    </button>
  );
  const runProgressText = runProgress && (
    <span className="row gap-1 faint" style={{ fontSize: 11.5, alignItems: "center", whiteSpace: "nowrap" }}>
      <Loader2 size={12} style={{ animation: "drama-spin .7s linear infinite" }} />
      正在生成视频 {runProgress.done}/{runProgress.total}
    </span>
  );
  const stopButton = (
    <button
      type="button"
      className="btn btn-line btn-sm"
      style={{ flex: "none" }}
      onClick={stopRunAll}
      disabled={stopping}
      title="正在生成的这一镜会做完（照常扣积分），后面的不再生成"
    >
      <CircleStop size={14} /> {stopping ? "这一镜做完就停" : "停止"}
    </button>
  );
  const runProgressView = runProgress && (
    <span className="row gap-2" style={{ flex: "none", alignItems: "center" }}>
      {runProgressText}
      {stopButton}
    </span>
  );

  return (
    <div className="col ws-flush smk-page" data-pane={pane} style={{ minHeight: 0, background: "var(--bg)", position: "relative" }}>
      {/* 顶栏 */}
      <header
        className="row smk-header"
        style={{ height: 58, padding: "0 24px", borderBottom: "1px solid var(--line)", background: "var(--surface)", gap: 14, flex: "none" }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void leaveToStudio()}
          style={{ flex: "none" }}
          aria-label="返回我的短视频"
          title="返回我的短视频"
        >
          <ChevronLeft size={15} /> <span className="ws-btn-label">我的短视频</span>
        </button>
        <span
          className="smk-swatch"
          style={{ width: 24, height: 32, borderRadius: 6, background: `linear-gradient(135deg,${fmt.from},${fmt.to})`, flex: "none" }}
        />
        <div className="col" style={{ minWidth: 0, gap: 1, flex: "1 1 auto" }}>
          <span
            style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
            title={title}
          >
            {title}
          </span>
          <span className="row gap-1 faint num smk-meta" style={{ fontSize: 11, alignItems: "center", minWidth: 0, overflow: "hidden", whiteSpace: "nowrap" }}>
            <span style={{ maxWidth: 200, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={displayName}>
              {displayName}
            </span>
            <span style={{ flex: "none" }}>· {ratioLabel}{total > 0 ? ` · 约 ${total} 秒` : ""}</span>
            {fromPrompt && (
              <span
                className="tag tag-accent"
                style={{ flex: "none", marginLeft: 4 }}
                title="这条短视频是按你粘贴的原文拆的分镜，人物和画面照原文里的设定画"
              >
                按你的脚本
              </span>
            )}
          </span>
        </div>
        {/* v0.88：单页化（去掉 脚本/工厂 步骤切换）—— 设计稿短视频制作为单页：左口播对话 / 右大纲+分镜表（逐镜内联出片）。 */}
        <SaveStatus status={saveStatusValue} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void deleteCurrentDraft()}
          disabled={deleting}
          aria-busy={deleting}
          aria-label="删除草稿"
          title="删除草稿"
          style={{ flex: "none", color: "var(--danger)", border: "1px solid color-mix(in oklch, var(--danger) 28%, transparent)", background: "color-mix(in oklch, var(--danger) 6%, var(--surface))" }}
        >
          <Trash2 size={14} /> <span className="ws-btn-label">{deleting ? "删除中" : "删除草稿"}</span>
        </button>
      </header>

      {/* ≤1024：对话 / 分镜 一次只显示一栏（桌面上 CSS 藏起来） */}
      <PaneTabs
        className="smk-pane-tabs"
        ariaLabel="切换对话和分镜"
        value={pane}
        onChange={setPane}
        tabs={[
          { key: "chat", label: "对话", dot: chatDot },
          { key: "board", label: shots.length ? `分镜 · ${shots.length} 镜` : "分镜" },
        ]}
      />

      {/* 脚本步:左 AI 对话 / 右 生成脚本 · 工厂步:居中滚动 */}
      {(
        <div className="row grow smk-split" style={{ minHeight: 0, alignItems: "stretch" }}>
          {/* 左:AI 对话（可折叠 → 细边栏；窄屏不折叠，改用页签） */}
          {chatHidden ? (
            <div
              className="col smk-chat-rail"
              style={{ width: 46, flex: "none", borderRight: "1px solid var(--line)", background: "var(--surface)", minHeight: 0, alignItems: "center", paddingTop: 12, gap: 12 }}
            >
              <button
                type="button"
                className="btn btn-icon btn-sm"
                title="展开 AI 助手"
                aria-label="展开 AI 助手"
                onClick={() => setChatCollapsed(false)}
                style={{ flex: "none" }}
              >
                <PanelLeftOpen size={16} />
              </button>
              <div style={{ writingMode: "vertical-rl", fontSize: 12, fontWeight: 700, color: "var(--ink-3)", letterSpacing: ".12em", userSelect: "none" }}>
                AI 脚本助手
              </div>
            </div>
          ) : (
          <div className="col smk-chat" style={{ width: 380, flex: "none", borderRight: "1px solid var(--line)", background: "var(--surface)", minHeight: 0 }}>
            <div className="row gap-2" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)", flex: "none" }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                  color: "#fff",
                }}
              >
                <Sparkles size={14} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 13.5, flex: "none", whiteSpace: "nowrap" }}>AI 脚本助手</span>
              <span className="faint" style={{ fontSize: 11, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fromPrompt ? "说要改哪儿，AI 按原文重拆" : "说一句，AI 写口播和分镜"}
              </span>
              <span className="grow" />
              <button
                type="button"
                className="btn btn-icon btn-sm smk-chat-collapse"
                title="收起对话"
                aria-label="收起对话"
                onClick={() => setChatCollapsed(true)}
                style={{ flex: "none" }}
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
            <div className="scroll grow col gap-3" style={{ minHeight: 0, padding: "14px 16px" }}>
              {chat.map((m, i) => (
                <div key={i} className="row" style={{ justifyContent: m.who === "me" ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      maxWidth: "86%",
                      padding: "9px 12px",
                      borderRadius: 13,
                      fontSize: 13,
                      lineHeight: 1.6,
                      overflowWrap: "anywhere",
                      background: m.who === "me" ? "linear-gradient(135deg,var(--accent),var(--accent-2))" : "var(--surface-2)",
                      color: m.who === "me" ? "#fff" : "var(--ink)",
                      borderBottomRightRadius: m.who === "me" ? 4 : 13,
                      borderBottomLeftRadius: m.who === "me" ? 13 : 4,
                    }}
                  >
                    {m.who === "me" ? m.text : <MarkdownLite text={m.text} />}
                  </div>
                </div>
              ))}
              {phase === "gen" && (
                <div className="row" style={{ justifyContent: "flex-start" }}>
                  <div className="row gap-2" style={{ padding: "9px 12px", borderRadius: 13, background: "var(--surface-2)" }}>
                    <span
                      style={{
                        width: 13,
                        height: 13,
                        border: "2px solid var(--line)",
                        borderTopColor: "var(--accent)",
                        borderRadius: "50%",
                        animation: "drama-spin .7s linear infinite",
                      }}
                    />
                    <span className="faint" style={{ fontSize: 12 }}>
                      {fromPrompt ? "正在按原文重拆…" : shots.length ? "正在重写分镜表…" : "正在写口播脚本和分镜…"}
                    </span>
                  </div>
                </div>
              )}
              {/* 后续推荐 action：跟在最新 AI 回复下面，点一下即作为「继续修改」指令发送。 */}
              {phase !== "gen" && quickChips.length > 0 && (
                <div className="col gap-2" style={{ alignItems: "flex-start" }}>
                  <span className="faint" style={{ fontSize: 11 }}>点一下就照这个改（会重写整张分镜表）：</span>
                  <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                    {quickChips.map((q) => (
                      <button key={q} type="button" className="chip" style={{ fontSize: 11.5 }} onClick={() => sendChat(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="col gap-2" style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--line-soft)", flex: "none" }}>
              <div className="row gap-2" style={{ alignItems: "flex-end" }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat(draft);
                    }
                  }}
                  placeholder={
                    fromPrompt
                      ? "说要改哪儿，AI 按原文重拆一遍分镜"
                      : shots.length
                        ? "说要怎么改，AI 会重写整张分镜表"
                        : "这条片子讲什么？比如：保温杯口播带货"
                  }
                  aria-label="跟 AI 说"
                  rows={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 40,
                    maxHeight: 110,
                    border: "1.5px solid var(--line)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontSize: 13,
                    outline: "none",
                    resize: "none",
                    background: "var(--surface-2)",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  className="btn btn-grad btn-icon"
                  style={{ width: 40, height: 40, flex: "none" }}
                  disabled={phase === "gen" || !draft.trim()}
                  onClick={() => sendChat(draft)}
                  aria-label="发送"
                  title="发送"
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </div>
          )}

          {/* 右:结构化分镜脚本(表单式 · 带时间线) */}
          <div className="scroll grow smk-board-pane" style={{ minHeight: 0, minWidth: 0, background: "var(--bg)" }}>
            {/* 收起 AI 助手 = 把腾出来的宽度真的还给分镜表（桌面上对话栏展开时分镜表进卡片模式，见 shorts-make.css）。 */}
            <div className="smk-board-inner" style={{ maxWidth: chatHidden || narrow ? 1180 : 760, margin: "0 auto", transition: "max-width .18s ease" }}>
              {/* v0.143 按你的脚本：来源原文与全片人物、画面设定（这里的字直接进每一镜的出图与出片提示词） */}
              {fromPrompt && (
                <div className="card col" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
                  <div className="row gap-2" style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-soft)", alignItems: "center" }}>
                    <ClipboardPaste size={16} style={{ color: "var(--accent-2)", flex: "none" }} />
                    <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>人物与画面设定</span>
                      <span className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>
                        {(visualBible?.characters?.length ?? 0)} 位角色 · {(visualBible?.scenes?.length ?? 0)} 个场景 · 每一镜出图都照这里画
                      </span>
                    </div>
                    <button type="button" className="chip" style={{ flex: "none" }} onClick={() => setRawPromptOpen(true)}>
                      <ScrollText size={12} /> 看原文
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      aria-expanded={bibleOpen}
                      aria-label={bibleOpen ? "收起人物与画面设定" : "展开人物与画面设定"}
                      title={bibleOpen ? "收起" : "展开"}
                      onClick={() => setBibleOpen((v) => !v)}
                      style={{ flex: "none" }}
                    >
                      <ChevronDown size={15} style={{ transform: bibleOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                    </button>
                  </div>
                  {promptNotes.length > 0 && (
                    <div className="col gap-1" style={{ padding: "10px 18px", borderBottom: "1px solid var(--line-soft)", background: "var(--surface-2)" }}>
                      {promptNotes.map((n, i) => (
                        <div key={i} className="row gap-1 faint" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
                          <AlertTriangle size={11} style={{ flex: "none", marginTop: 3 }} /> <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{n}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {bibleOpen && (
                    <div className="col" style={{ padding: 18, gap: 14 }}>
                      {(visualBible?.characters ?? []).map((c, i) => (
                        <div key={i} className="col gap-2" style={{ padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line-soft)" }}>
                          <div className="row gap-2" style={{ alignItems: "center" }}>
                            <input
                              value={c.name}
                              onChange={(e) => patchBibleCharacter(i, { name: e.target.value })}
                              placeholder="角色名"
                              aria-label="角色名"
                              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", padding: 0, fontFamily: "inherit" }}
                            />
                            <button
                              type="button"
                              className="btn btn-icon btn-sm"
                              title={`删除角色${c.name ? `「${c.name}」` : ""}`}
                              aria-label={`删除角色${c.name ? `「${c.name}」` : ""}`}
                              onClick={() => removeBibleCharacter(i)}
                              style={{ flex: "none", color: "var(--danger)" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="col gap-1">
                            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--ink-3)" }}>外貌（出图用）</span>
                            <EditableField
                              multiline
                              value={c.visual}
                              onChange={(v) => patchBibleCharacter(i, { visual: v })}
                              placeholder="脸型 / 发型 / 服装 / 道具 / 配色"
                              textStyle={{ fontSize: 12.5, lineHeight: 1.75, color: "var(--ink-2)" }}
                            />
                          </div>
                          <div className="col gap-1">
                            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--ink-3)" }}>性格与表演（不影响画面）</span>
                            <EditableField
                              multiline
                              value={c.performance ?? ""}
                              onChange={(v) => patchBibleCharacter(i, { performance: v })}
                              placeholder="性格 / 情绪 / 表演方式"
                              textStyle={{ fontSize: 12.5, lineHeight: 1.75, color: "var(--ink-3)" }}
                            />
                          </div>
                        </div>
                      ))}
                      {(visualBible?.scenes ?? []).map((sc, i) => (
                        <div key={i} className="col gap-2" style={{ padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line-soft)" }}>
                          <div className="row gap-2" style={{ alignItems: "center" }}>
                            <span className="tag tag-gray" style={{ flex: "none" }}>场景</span>
                            <input
                              value={sc.name}
                              onChange={(e) => patchBibleScene(i, { name: e.target.value })}
                              placeholder="场景名"
                              aria-label="场景名"
                              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", padding: 0, fontFamily: "inherit" }}
                            />
                            <button
                              type="button"
                              className="btn btn-icon btn-sm"
                              title={`删除场景${sc.name ? `「${sc.name}」` : ""}`}
                              aria-label={`删除场景${sc.name ? `「${sc.name}」` : ""}`}
                              onClick={() => removeBibleScene(i)}
                              style={{ flex: "none", color: "var(--danger)" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <EditableField
                            multiline
                            value={sc.visual}
                            onChange={(v) => patchBibleScene(i, { visual: v })}
                            placeholder="环境 / 光线 / 色调 / 空气感"
                            textStyle={{ fontSize: 12.5, lineHeight: 1.75, color: "var(--ink-2)" }}
                          />
                        </div>
                      ))}
                      <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                        <button type="button" className="btn btn-line btn-sm" onClick={addBibleCharacter}>
                          <Plus size={13} /> 加一位角色
                        </button>
                        <button type="button" className="btn btn-line btn-sm" onClick={addBibleScene}>
                          <Plus size={13} /> 加一个场景
                        </button>
                        <span className="faint" style={{ fontSize: 11, alignSelf: "center" }}>没写外貌的角色，出图时没法让他长相保持一致</span>
                      </div>
                      <div className="col gap-1" style={{ padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line-soft)" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--ink-3)" }}>全片画面基调</span>
                        <EditableField
                          multiline
                          value={visualBible?.universal ?? ""}
                          onChange={(v) => setVisualBible((prev) => ({ universal: v, characters: prev?.characters ?? [], scenes: prev?.scenes ?? [] }))}
                          placeholder="镜头语言 / 质感 / 整体调色"
                          textStyle={{ fontSize: 12.5, lineHeight: 1.75, color: "var(--ink-2)" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 短视频大纲：与短剧「故事大纲」面板 1:1 同款设计（header + 新生成 pill /
                  metaLine + 大标题 + 剧情脉络强调块 / • 圆点分区 + 核心人物双列卡），
                  仅把内容换成短视频形态 —— 跨产品零学习成本。 */}
              {meta && (
                <div className="card col" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
                  {/* header —— 同短剧故事大纲 */}
                  <div className="row gap-3" style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-soft)", flex: "none" }}>
                    <ScrollText size={17} style={{ color: "var(--accent)", flex: "none" }} />
                    <span style={{ fontWeight: 800, fontSize: 14, flex: "none", whiteSpace: "nowrap" }}>短视频大纲</span>
                    <span className="faint" style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fromPrompt ? "按你的原文整理" : "根据对话整理"}
                    </span>
                  </div>

                  <div className="col smk-outline-body" style={{ padding: 22, gap: 20 }}>
                    {/* 故事 —— metaLine + 大标题 + 一句话剧情（对应短剧 logline，放标题下） */}
                    <div className="col gap-3">
                      <div className="faint" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {displayName} · {ratioLabel}{total > 0 ? ` · 约 ${total} 秒` : ""}
                      </div>
                      <EditableField
                        wrap
                        value={meta.title ?? ""}
                        onChange={(v) => setMeta({ ...meta, title: v })}
                        placeholder="给这条短视频起个标题…"
                        ariaLabel="标题"
                        className="smk-title-input"
                        textStyle={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}
                      />
                      <EditableField
                        multiline
                        value={logline}
                        onChange={setLogline}
                        placeholder="一句话剧情：这条片子讲什么"
                        ariaLabel="一句话剧情"
                        textStyle={{ fontSize: 14.5, lineHeight: 1.8, color: "var(--ink-2)" }}
                      />
                    </div>

                    <div style={{ height: 1, background: "var(--line-soft)" }} />

                    {/* 主角 —— 折叠；展开后：角色卡 + 参考图 / 数字人 */}
                    <CollapsibleOutlineSection
                      label="主角"
                      hint={needVoiceBinding ? "要配音得先绑定数字人" : "参考图、数字人"}
                      summary={
                        fromPrompt
                          ? charAvatar?.name ?? (charRef ? "已上传参考图" : "还没绑定数字人")
                          : meta.character?.name || charAvatar?.name || "还没设定"
                      }
                      open={charOpen}
                      onToggle={() => setCharOpen((v) => !v)}
                    >
                      <div className="col gap-3" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line-soft)" }}>
                        {fromPrompt ? (
                          // 按你的脚本拆的片子：出图时人物长相只认「人物与画面设定」，这里的名字和描述不会用上，
                          // 放着两处都能填，用户会改错地方。
                          <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
                            人物外貌以「人物与画面设定」为准，这里只放参考图和数字人。
                          </div>
                        ) : (
                          /* 角色卡 */
                          <div className="row gap-2" style={{ alignItems: "center" }}>
                            {charAvatar?.image ? (
                              <div style={{ width: 34, height: 34, borderRadius: "50%", background: `center/cover no-repeat url(${charAvatar.image})`, boxShadow: "inset 0 0 0 1px var(--line)", flex: "none" }} />
                            ) : (
                              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, color-mix(in oklch, var(--accent) 18%, #fff), color-mix(in oklch, var(--accent-2) 18%, #fff))", boxShadow: "inset 0 0 0 1px var(--line)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800, color: "var(--accent-2)", flex: "none" }}>
                                {(meta.character?.name || "主").slice(0, 1)}
                              </div>
                            )}
                            <div className="col" style={{ minWidth: 0, gap: 1, flex: 1 }}>
                              <input
                                value={meta.character?.name ?? ""}
                                onChange={(e) => setMeta({ ...meta, character: { ...(meta.character ?? { name: "", description: "" }), name: e.target.value } })}
                                placeholder="角色名"
                                aria-label="主角名字"
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", padding: 0, fontFamily: "inherit" }}
                              />
                              <input
                                value={meta.character?.description ?? ""}
                                onChange={(e) => setMeta({ ...meta, character: { ...(meta.character ?? { name: "", description: "" }), description: e.target.value } })}
                                placeholder="长相和性格，一句话"
                                aria-label="主角长相和性格"
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 11.5, color: "var(--ink-3)", padding: 0, fontFamily: "inherit" }}
                              />
                            </div>
                          </div>
                        )}

                        {/* 参考图 */}
                        <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                          <span className="faint" style={{ fontSize: 11.5, width: 48, flex: "none" }}>参考图</span>
                          {charRef && (
                            <RefThumb url={charRef.url} onView={() => setLightbox({ src: charRef.url, kind: "image" })} onRemove={() => setCharRef(null)} />
                          )}
                          <UploadButton label="上传参考图" busy={uploading === "char"} disabled={!!uploading} onFile={(f) => void uploadRefImage(f, "char")} />
                        </div>

                        {/* 数字人 */}
                        <div className="col gap-1">
                          <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                            <span className="faint" style={{ fontSize: 11.5, width: 48, flex: "none" }}>数字人</span>
                            {charAvatar ? (
                              <span className="row gap-2" style={{ alignItems: "center", padding: "3px 8px 3px 4px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 12, fontWeight: 700, minWidth: 0, maxWidth: "100%" }}>
                                {charAvatar.image && <span style={{ width: 20, height: 20, borderRadius: "50%", background: `center/cover no-repeat url(${charAvatar.image})`, flex: "none" }} />}
                                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={charAvatar.name}>
                                  {charAvatar.name}
                                </span>
                                <button type="button" aria-label="解绑数字人" title="解绑数字人" onClick={() => setCharAvatar(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--accent)", display: "grid", placeItems: "center", padding: 0, flex: "none" }}>
                                  <X size={13} />
                                </button>
                              </span>
                            ) : (
                              <button type="button" className="btn btn-line btn-sm" onClick={() => setAvatarPickerOpen(true)}>
                                <UserPlus size={13} /> 绑定数字人
                              </button>
                            )}
                          </div>
                          <span className="faint" style={{ fontSize: 11, lineHeight: 1.6 }}>
                            {charAvatar ? "配音用这个数字人的声音。" : "配音要用数字人的声音；不绑定的话，有台词的镜头没法配音。"}
                          </span>
                        </div>
                      </div>
                    </CollapsibleOutlineSection>

                    <div style={{ height: 1, background: "var(--line-soft)" }} />

                    {/* 主场景 —— 折叠；展开后：场景描述 + 参考图 */}
                    <CollapsibleOutlineSection
                      label="主场景"
                      hint={fromPrompt ? "参考图" : "场景描述、参考图"}
                      summary={fromPrompt ? (sceneRef ? "已上传参考图" : "没有参考图") : meta.scene || "还没设定"}
                      open={sceneOpen}
                      onToggle={() => setSceneOpen((v) => !v)}
                    >
                      {fromPrompt ? (
                        <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
                          场景的样子以「人物与画面设定」为准，这里只放参考图。
                        </div>
                      ) : (
                        <EditableField
                          multiline
                          value={meta.scene ?? ""}
                          onChange={(v) => setMeta({ ...meta, scene: v })}
                          placeholder="主场景，一句话"
                          ariaLabel="主场景"
                          textStyle={{ fontSize: 13.5, lineHeight: 1.9, color: "var(--ink-2)" }}
                        />
                      )}
                      <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                        <span className="faint" style={{ fontSize: 11.5, width: 48, flex: "none" }}>参考图</span>
                        {sceneRef && (
                          <RefThumb url={sceneRef.url} onView={() => setLightbox({ src: sceneRef.url, kind: "image" })} onRemove={() => setSceneRef(null)} />
                        )}
                        <UploadButton label="上传参考图" busy={uploading === "scene"} disabled={!!uploading} onFile={(f) => void uploadRefImage(f, "scene")} />
                      </div>
                    </CollapsibleOutlineSection>
                  </div>
                </div>
              )}

              {/* 分镜表 header（设计稿：大纲卡之后，平铺分镜表之前） */}
              {(meta || shots.length > 0) && (
                <div className="row gap-2" style={{ marginBottom: 14, alignItems: "center", flexWrap: "wrap", rowGap: 8 }}>
                  <span className="row gap-2" style={{ alignItems: "center", flex: "none" }}>
                    <Clapperboard size={16} style={{ color: "var(--accent)", flex: "none" }} />
                    <span style={{ fontWeight: 800, fontSize: 16, whiteSpace: "nowrap" }}>分镜表</span>
                    {shots.length > 0 && (
                      <span className="tag tag-accent" style={{ flex: "none" }}>共 {shots.length} 镜 · 约 {total} 秒</span>
                    )}
                  </span>
                  <span className="grow" />
                  <span className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap", rowGap: 8, justifyContent: "flex-end", minWidth: 0 }}>
                    {/* 一起生成的这一轮里模型不能换：总价按开跑时选的模型报，这一轮也一直用它提交。 */}
                    {shots.length > 0 && (
                      <RenderModelSelect lane="image" models={renderModels.models} disabled={!!runProgress}
                        value={renderModels.imageEndpointId} onChange={renderModels.setImageEndpointId} />
                    )}
                    {shots.length > 0 && (
                      <RenderModelSelect lane="video" models={renderModels.models} disabled={!!runProgress}
                        value={renderModels.videoEndpointId} onChange={renderModels.setVideoEndpointId} />
                    )}
                    {shots.length > 0 && renderModels.status === "failed" && (
                      <span className="row gap-1" role="status" style={{ alignItems: "center", minWidth: 0, maxWidth: "100%", fontSize: 11, color: "var(--warn, #d97706)" }}>
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={priceBlock ?? undefined}>
                          没读到模型和价格，生成先停用
                        </span>
                        <button type="button" className="chip smk-retry" style={{ height: 22, fontSize: 10.5, flex: "none" }} onClick={renderModels.retry}>
                          重试
                        </button>
                      </span>
                    )}
                    {shots.length > 0 && (
                      <button type="button" className="chip smk-hide-sm" title="放大分镜表，方便逐镜改" onClick={() => setTableMax(true)}>
                        <Maximize2 size={12} /> 放大
                      </button>
                    )}
                    <button
                      type="button"
                      className="chip"
                      disabled={phase === "gen" || shots.length === 0 || !!busy || !!runProgress}
                      onClick={regen}
                      title={
                        busy || runProgress
                          ? "有镜头正在生成视频，等它做完再重写"
                          : fromPrompt
                            ? "按原文重新拆一遍整张分镜表"
                            : "让 AI 重写整张分镜表"
                      }
                    >
                      <RefreshCw size={12} /> {fromPrompt ? "按原文重拆" : "重写分镜"}
                    </button>
                    {runProgress ? runProgressView : runAllIdle ? runAllButton("btn btn-grad btn-sm", "剩下的镜头一起生成") : null}
                  </span>
                </div>
              )}

              {shots.length > 0 && (
                <section className="card" aria-label="合成前检查" style={{ padding: "12px 14px", marginBottom: 14 }}>
                  <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap", rowGap: 8 }}>
                    <ShieldCheck size={15} style={{ color: "var(--accent)", flex: "none" }} />
                    <strong style={{ fontSize: 13, whiteSpace: "nowrap" }}>合成前检查</strong>
                    {preflight && (
                      <span className="faint" style={{ fontSize: 11.5, minWidth: 0 }}>
                        分镜{preflight.structuralReady ? "没问题" : "有问题"} · 配音 {preflight.audioReadyCount}/{preflight.shotCount} 镜 · 视频已确认 {preflight.completedShotCount}/{preflight.shotCount} 镜
                      </span>
                    )}
                    <span className="grow" />
                    <button type="button" className="btn btn-line btn-sm" onClick={() => void refreshPreflight(true)} disabled={preflightBusy || audioBusy} aria-busy={preflightBusy} title="只看分镜、配音和视频齐不齐，不生成内容、不花积分">
                      {preflightBusy ? <Loader2 size={13} className="spin" /> : <ShieldCheck size={13} />} {preflightBusy ? "检查中…" : "检查一遍"}
                    </button>
                    {needVoiceBinding ? (
                      <button type="button" className="btn btn-sm" onClick={() => setAvatarPickerOpen(true)}>
                        <UserPlus size={13} /> 绑定数字人
                      </button>
                    ) : charAvatar && hasDialogue ? (
                      <button type="button" className="btn btn-sm" onClick={() => void prepareShortAudio()} disabled={audioBusy || preflightBusy} aria-busy={audioBusy} title="只生成配音，不生成视频，不花积分">
                        {audioBusy ? <Loader2 size={13} className="spin" /> : <Volume2 size={13} />} {audioBusy ? "生成配音中…" : "生成配音"}
                      </button>
                    ) : null}
                  </div>
                  {/* 视频这一项按本地分镜表实时算（不等「检查一遍」）：「还没视频」和「有视频、还没点就用这版」
                      是两件事，要做的动作也不一样，分开说。合成要求每一镜都点过「就用这版」（服务端 buildPlan 硬规则）。 */}
                  <div className="col smk-check-video" style={{ marginTop: 9, gap: 6, fontSize: 12 }} aria-live="polite">
                    {noVideoCount === 0 && toConfirmCount === 0 ? (
                      <div className="row gap-1" style={{ alignItems: "center", color: "var(--success)" }}>
                        <Check size={13} style={{ flex: "none" }} /> 每一镜都有视频，也都点过「就用这版」了
                      </div>
                    ) : (
                      <>
                        {noVideoCount > 0 && (
                          <div className="row gap-1" style={{ alignItems: "flex-start", color: "var(--ink-2)" }}>
                            <ImageIcon size={13} style={{ flex: "none", marginTop: 2, color: "var(--ink-3)" }} />
                            <span style={{ minWidth: 0 }}>
                              <strong>{noVideoCount} 镜还没视频。</strong>
                              <span className="faint">
                                {runProgress
                                  ? "正在一起生成，生成好的直接算「就用这版」。"
                                  : inFlightCount && inFlightClips === noVideoCount
                                    ? "视频都在后台生成，好了会自动填回来。"
                                    : inFlightCount
                                      ? `其中 ${inFlightWhat}在后台生成，好了会自动填回来；别的一镜一镜生成，或者点「剩下的镜头一起生成」。`
                                      : "一镜一镜生成，或者点「剩下的镜头一起生成」。"}
                              </span>
                            </span>
                          </div>
                        )}
                        {toConfirmCount > 0 && (
                          <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap", rowGap: 6, color: "var(--ink-2)" }}>
                            <span className="row gap-1" style={{ alignItems: "flex-start", minWidth: 0, flex: "1 1 220px" }}>
                              <Check size={13} style={{ flex: "none", marginTop: 2, color: "var(--ink-3)" }} />
                              <span style={{ minWidth: 0 }}>
                                <strong>{toConfirmCount} 镜有视频，还没点「就用这版」。</strong>
                                <span className="faint">合成成片要每一镜都点过。</span>
                              </span>
                            </span>
                            {approvableIds.length > 0 && draftStatus !== "done" &&
                              approveAllButton("btn btn-line btn-sm", `有视频的镜头全部就用这版（${approvableIds.length} 镜）`)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {needVoiceBinding && (
                    <div className="faint" style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.6 }}>
                      配音用数字人的声音。先绑定一个数字人，才能给台词配音、合成成片。
                    </div>
                  )}
                  {(preflightError || preflight?.issues.length) ? (
                    <div className="col gap-1" style={{ marginTop: 9 }} aria-live="polite">
                      {preflightError && <div role="alert" style={{ color: "var(--danger)", fontSize: 12 }}>{preflightError}</div>}
                      {preflight?.issues.slice(0, 4).map((issue) => (
                        <div key={`${issue.code}-${issue.shotNo ?? "all"}`} className="row gap-1" style={{ color: issue.severity === "error" ? "var(--danger)" : "var(--ink-3)", fontSize: 11.5 }}>
                          <AlertTriangle size={12} style={{ flex: "none", marginTop: 2 }} /> <span style={{ minWidth: 0 }}>{issue.shotNo ? `镜 ${issue.shotNo}：` : ""}{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : preflight ? (
                    <div role="status" style={{ marginTop: 8, color: preflight.structuralReady ? "var(--success)" : "var(--danger)", fontSize: 11.5 }}>
                      {!preflight.structuralReady
                        ? "分镜还有问题，改好再合成。"
                        : preflight.assemblyReady
                          ? "分镜没问题，可以合成成片了。"
                          : "分镜没问题。每一镜的视频都确认过、配音也齐了，就能合成。"}
                    </div>
                  ) : (
                    <div className="faint" style={{ marginTop: 8, fontSize: 11.5 }}>还没检查。点「检查一遍」看看还差什么（不花积分）。</div>
                  )}
                </section>
              )}

              {phase === "gen" ? (
                <div className="card" style={{ padding: 18 }}>
                  <GenSkeleton lines={4} label={fromPrompt ? "正在按原文重拆分镜…" : "正在写口播脚本、拆分镜…"} />
                </div>
              ) : shots.length === 0 ? (
                <div className="card col center" style={{ padding: "48px 24px", textAlign: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
                    <Clapperboard size={26} />
                  </div>
                  <div className="muted" style={{ maxWidth: 340, fontSize: 13.5, lineHeight: 1.7 }}>
                    在对话框里说说这条片子讲什么，AI 会写口播脚本、拆好分镜；之后每一镜先出首帧，再生成视频。
                  </div>
                  <button type="button" className="btn btn-line btn-sm smk-to-chat" onClick={() => setPane("chat")}>
                    去对话框
                  </button>
                </div>
              ) : (
                <div className="col gap-3">
                  {storyboardTable}
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    style={{ alignSelf: "flex-start" }}
                    onClick={() => {
                      setShots((arr) => [
                        ...arr,
                        {
                          id: "add" + Date.now(), no: arr.length + 1, dur: 4, visual: "", size: "中景", move: "固定",
                          voWho: "口播", voText: "", sfx: "", bgm: "", fx: "", refs: [], sub: true,
                          flow: "draft", engine: "fx", frameIdx: 0,
                          // 提示词直出线：新镜默认沿用上一镜的出场人物与场景（可再点 chip 改），
                          // 不留空 —— 留空会被服务端当「未标注」按全员锚定。
                          castNames: arr[arr.length - 1]?.castNames,
                          sceneName: arr[arr.length - 1]?.sceneName,
                        },
                      ]);
                      invalidateAssembly();
                    }}
                  >
                    <Plus size={14} /> 加一镜
                  </button>
                  <div className="row gap-2" style={{ padding: "4px 2px", alignItems: "flex-start" }}>
                    <Edit size={12} style={{ color: "var(--ink-3)", flex: "none", marginTop: 2 }} />
                    <span className="faint" style={{ fontSize: 11.5 }}>点文字就能改。想整张重写，在对话框里跟 AI 说。</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 原文（只读查看 + 复制）—— 溯源：这条片子到底是按什么拆的 */}
      {rawPromptOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="原文"
          className="smk-modal-wrap"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRawPromptOpen(false);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 75, background: "rgba(15,10,30,.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: "5vh 3vw" }}
        >
          <div ref={rawPromptRef} tabIndex={-1} className="col smk-modal" style={{ width: "min(760px, 94vw)", maxHeight: "84vh", background: "var(--bg)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-lg)", border: "1px solid var(--line-soft)", outline: "none" }}>
            <div className="row gap-2" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--surface)", flex: "none", alignItems: "center" }}>
              <ScrollText size={16} style={{ color: "var(--accent-2)", flex: "none" }} />
              <span style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: "nowrap" }}>原文</span>
              <span className="faint num" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{promptSource?.raw?.length ?? 0} 字</span>
              <span className="grow" />
              <button
                type="button"
                className="chip"
                onClick={() => {
                  const raw = promptSource?.raw ?? "";
                  navigator.clipboard
                    ?.writeText(raw)
                    .then(() => toast.success("原文已复制"))
                    .catch(() => toast.error("没复制上，请手动选中复制"));
                }}
              >
                复制
              </button>
              <button type="button" className="btn btn-icon btn-sm" aria-label="关闭" title="关闭" onClick={() => setRawPromptOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="scroll grow" style={{ minHeight: 0, padding: "16px 20px" }}>
              <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 13, lineHeight: 1.85, color: "var(--ink-2)" }}>
                {promptSource?.raw}
              </div>
            </div>
            <div className="row gap-2" style={{ padding: "10px 18px", borderTop: "1px solid var(--line)", background: "var(--surface)", flex: "none" }}>
              <span className="faint" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
                原文在这里只能看。想调整，在对话框里说要改哪儿，AI 会照原文加上你的要求重拆一遍。
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 绑定数字人 / 参考图看大图 */}
      {avatarPickerOpen && (
        <AvatarPickerModal
          onPick={(a) => setCharAvatar(a)}
          onClose={() => setAvatarPickerOpen(false)}
          onOpenAiAvatar={() => void flushSave().catch(() => {})}
        />
      )}
      <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />

      {/* 分镜表放大：全屏弹层（与内联共用同一份表，编辑实时同步） */}
      {tableMax && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="分镜表（放大）"
          className="smk-modal-wrap"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTableMax(false);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(15,10,30,.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: "3vh 2vw" }}
        >
          <div ref={tableMaxRef} tabIndex={-1} className="col smk-modal" style={{ width: "min(1280px, 96vw)", height: "94vh", background: "var(--bg)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-lg)", border: "1px solid var(--line-soft)", outline: "none" }}>
            <div className="row gap-2" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--surface)", flex: "none", alignItems: "center" }}>
              <Clapperboard size={16} style={{ color: "var(--accent)", flex: "none" }} />
              <span style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap" }}>分镜表</span>
              <span className="tag tag-accent" style={{ flex: "none" }}>共 {shots.length} 镜 · 约 {total} 秒</span>
              <span className="grow" />
              <span className="row gap-1 faint" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                <Edit size={12} /> 点文字就能改
              </span>
              <button type="button" className="btn btn-icon btn-sm" title="关闭放大" aria-label="关闭放大" onClick={() => setTableMax(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="scroll grow" style={{ minHeight: 0, padding: "18px 22px 28px" }}>
              {storyboardTable}
            </div>
          </div>
        </div>
      )}

      {/* 悬浮 CTA（≤860 贴底通栏；窄屏只在「分镜」页签出现，不盖住对话框的发送按钮）。
          打开「原文」或「放大」弹层时收起，免得压住弹层底部。 */}
      {!rawPromptOpen && !tableMax && (
      <div
        className="row gap-2 pop-in smk-dock"
        aria-live="polite"
        style={{
          position: "fixed",
          right: "max(12px, env(safe-area-inset-right))",
          bottom: "calc(22px + env(safe-area-inset-bottom))",
          zIndex: 80,
          background: "var(--surface)",
          padding: 10,
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--line-soft)",
          maxWidth: "calc(100vw - 24px)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {assembleError ? (
          <div className="row gap-2" role="alert" style={{ maxWidth: 420, color: "var(--danger)", fontSize: 12.5, lineHeight: 1.45, alignItems: "center" }}>
            <AlertTriangle size={15} style={{ flex: "none" }} />
            <span style={{ overflowWrap: "anywhere", minWidth: 0 }}>{assembleError}</span>
            <button type="button" className="btn btn-sm" style={{ flex: "none" }} onClick={() => void assembleShort()} disabled={assembling}>
              重新合成
            </button>
          </div>
        ) : missingAudio.length > 0 && missingAssemblyMedia.length === 0 ? (
          !charAvatar ? (
            <>
              <span className="row gap-2 smk-dock-note" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", padding: "4px 6px", alignItems: "center" }}>
                <Volume2 size={14} style={{ flex: "none" }} /> 配音要用数字人的声音
              </span>
              <button type="button" className="btn btn-grad" onClick={() => setAvatarPickerOpen(true)}>
                <UserPlus size={15} /> 先绑定数字人
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-grad" onClick={() => void prepareShortAudio()} disabled={audioBusy} aria-busy={audioBusy}>
              {audioBusy ? <Loader2 size={15} className="spin" /> : <Volume2 size={15} />}
              {audioBusy ? "正在生成配音…" : `生成 ${missingAudio.length} 镜配音`}
            </button>
          )
        ) : readyToAssemble ? (
          <button
            type="button"
            className="btn btn-grad"
            onClick={() => void assembleShort()}
            disabled={assembling}
            aria-busy={assembling}
          >
            {assembling ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
            {assembling ? "正在合成成片…" : "合成成片"}
          </button>
        ) : shots.length > 0 && doneCount === shots.length ? (
          <span className="row gap-2" role="status" style={{ fontSize: 12, fontWeight: 650, color: "var(--danger)", padding: "4px 6px", alignItems: "center" }}>
            <AlertTriangle size={14} style={{ flex: "none" }} /> {missingAssemblyMedia.length} 镜的视频找不到了，重新生成这几镜再合成
          </span>
        ) : shots.length === 0 ? (
          <span className="row gap-2" role="status" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", padding: "4px 6px", alignItems: "center" }}>
            <Clapperboard size={14} style={{ flex: "none" }} /> 先在对话框里说说这条片子讲什么
          </span>
        ) : runProgress ? (
          <>
            <span style={{ padding: "4px 6px" }}>{runProgressText}</span>
            {/* 桌面上分镜表表头已有「停止」；窄屏表头可能滚出屏幕，贴底条里再给一个 */}
            <span className="smk-dock-run">{stopButton}</span>
          </>
        ) : (
          <>
            <span className="row gap-2" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", padding: "4px 6px", alignItems: "center" }}>
              <ImageIcon size={14} className="smk-dock-icon" style={{ flex: "none" }} />
              {noVideoCount > 0
                ? `${noVideoCount} 镜还没视频${inFlightCount ? `（${inFlightCount} 镜在后台生成）` : ""}${toConfirmCount ? `，${toConfirmCount} 镜还没点「就用这版」` : ""}`
                : `${toConfirmCount} 镜有视频，还没点「就用这版」`}
            </span>
            {runAllIdle && <span className="smk-dock-run">{runAllButton("btn btn-line btn-sm", "一起生成")}</span>}
            {/* 视频都有了、只差确认：这就是下一步，给主按钮（有没视频的镜时下一步是生成，批量确认留在合成前检查卡里） */}
            {noVideoCount === 0 && approvableIds.length > 0 && draftStatus !== "done" &&
              approveAllButton("btn btn-grad", "全部就用这版", {})}
            {needVoiceBinding && (
              <button type="button" className="btn btn-line btn-sm" onClick={() => setAvatarPickerOpen(true)} title="配音要用数字人的声音">
                <UserPlus size={13} /> 绑定数字人
              </button>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}
