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
  Film,
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
import { CreditButton, GenSkeleton, Thumb } from "@/components/drama-ui";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { type FormShot, type ShotFlow } from "@/components/drama-workshop/shot-form";
import { ShortStoryboardTable } from "@/components/drama-workshop/short-storyboard-table";
import { RenderModelSelect } from "@/components/drama-workshop/render-model-select";
import { useShotRender } from "@/lib/use-shot-render";
import { listRenderTasks, POLL_TIMEOUT_MESSAGE, type DramaRenderTask } from "@/api/render";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { SaveStatus } from "@/components/drama-workshop/save-status";
import { MediaLightbox, type LightboxMedia } from "@/components/drama-workshop/media-lightbox";
import { MarkdownLite } from "@/lib/markdown-lite";
import { SHORT_FORMATS, type Material, type ShortFormat } from "@/mocks/drama-workshop";
import { DapAvatarsApi, DramaAssetsApi, ShortDramaApi, ShortsApi } from "@/api";
import type { DapAvatarLite } from "@/api/dap-avatars";
import type { ScriptMeta, ShortContinuityManifest } from "@/api/short-drama";
import type { ShortDraftData, ShortPreflight, ShortPromptSource, ShortVisualBible } from "@/api/shorts";
import { parsedToDraft } from "@/lib/short-prompt-draft";
import { aiErrorMessage } from "@/lib/ai-error";
import { useSaveStatus } from "@/lib/use-save-status";
import { useDramaConfig } from "@/lib/use-drama-config";
import { invalidate } from "@/lib/drama-query";
import { buildShortClipVars, buildShortFrameVars } from "@/lib/short-render-prompt";

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
  pendingJob?: { jobId: string; kind: "frame" | "clip" };
  sceneId?: string;
  parentShotId?: string;
  /** v0.143 提示词直出：本镜出场人物名 / 场景名 / 原时间码（服务端据前两者挂一致性锚点）。 */
  castNames?: string[];
  sceneName?: string;
  timecode?: string;
  audio?: { cdnKey: string; url?: string; durationSec: number; textFingerprint: string; providerTaskId?: string; at?: string };
}

/**
 * 轮询是否因超时返回（任务其实仍在后台跑，不能当失败丢弃）。
 * 与 POLL_TIMEOUT_MESSAGE 做**全等**比较 —— 上游真实失败文案里恰好含「超时」时不会被误判为超时。
 */
function isPollTimeout(job: { status?: string; error_message?: string | null }): boolean {
  return job.status === "failed" && job.error_message === POLL_TIMEOUT_MESSAGE;
}

interface ChatMsg {
  who: "ai" | "me";
  text: string;
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
  rows,
  textStyle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  textStyle?: React.CSSProperties;
}) {
  const [hover, setHover] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const active = hover || focus;
  const fieldStyle: React.CSSProperties = {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    fontFamily: "inherit",
    color: "var(--ink)",
    ...(multiline ? { resize: "none" as const } : null),
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
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          rows={rows ?? 2}
          style={fieldStyle}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          style={fieldStyle}
        />
      )}
      {/* hover 提示：文末铅笔（聚焦编辑时隐藏，避免遮挡） */}
      {active && !focus && (
        <Pencil
          size={12}
          style={{
            position: "absolute",
            top: multiline ? 9 : "50%",
            right: 8,
            transform: multiline ? "none" : "translateY(-50%)",
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
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ink-3)" }}>{label}</span>
        {hint && <span className="faint" style={{ fontSize: 11 }}>{hint}</span>}
        <span className="grow" />
        {!open && summary && (
          <span className="faint" style={{ fontSize: 12, maxWidth: "55%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>
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
}: {
  onPick: (a: { id: string; name: string; image: string }) => void;
  onClose: () => void;
}) {
  const [list, setList] = React.useState<DapAvatarLite[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  useModalA11y(panelRef, onClose);
  React.useEffect(() => {
    let alive = true;
    DapAvatarsApi.listMyDapAvatars()
      .then((r) => alive && setList(r))
      .catch((e) => alive && setErr(aiErrorMessage(e, "数字人列表加载失败，请稍后重试")));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 95 }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
        tabIndex={-1}
        className="col"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 94vw)", maxHeight: "80vh", background: "var(--surface)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-lg)", outline: "none" }}
      >
        <div className="row gap-2" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", flex: "none", alignItems: "center" }}>
          <span id="avatar-picker-title" style={{ fontWeight: 800, fontSize: 15 }}>绑定数字人</span>
          <span className="faint" style={{ fontSize: 11.5 }}>选一个「我的数字人」作为主角形象</span>
          <span className="grow" />
          <button type="button" className="btn btn-icon btn-sm" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="scroll" style={{ padding: 18, minHeight: 0 }}>
          {err ? (
            <div className="muted" style={{ fontSize: 13 }}>{err}</div>
          ) : !list ? (
            <div className="row gap-2 faint" style={{ fontSize: 13 }}>
              <Loader2 size={14} className="spin" /> 加载中…
            </div>
          ) : list.length === 0 ? (
            <div className="col center" style={{ padding: "30px 10px", gap: 8, textAlign: "center" }}>
              <div className="muted" style={{ fontSize: 13, maxWidth: 320 }}>你还没有数字人。在 AiAvatar 创建一个，就能在这里绑成主角形象。</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 12 }}>
              {list.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={!a.imageUrl}
                  onClick={() => {
                    if (!a.imageUrl) return;
                    onPick({ id: a.id, name: a.name, image: a.imageUrl });
                    onClose();
                  }}
                  className="col"
                  style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--surface-2)", cursor: a.imageUrl ? "pointer" : "not-allowed", opacity: a.imageUrl ? 1 : 0.5, padding: 0, textAlign: "left", gap: 0 }}
                >
                  <div style={{ width: "100%", aspectRatio: "3/4", background: a.imageUrl ? `center/cover no-repeat url(${a.imageUrl})` : "linear-gradient(135deg,var(--surface-3),var(--surface-2))" }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, padding: "5px 8px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                </button>
              ))}
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
          const detail = await ShortsApi.getDraft(draftIdParam);
          if (!alive) return;
          const data = detail.data;
          // 从创意市场「试试同款」套用而来的草稿（idea 空、尚无分镜）：若用户在对话框
          // 又补了一句自由主题（经 sessionStorage 带入），注入它 —— 工厂据「创意风格 + 你的主题」起草。
          if (ideaRef.current && !data.idea && !(data.shots && data.shots.length)) {
            data.idea = ideaRef.current;
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
        setDraftId(detail.meta.id);
        setInitial(detail.data);
        setInitialStatus(detail.meta.status === "done" ? "done" : "draft");
        invalidate("/me/drama/shorts");
        const params = new URLSearchParams();
        params.set("draft", detail.meta.id);
        if (fmtKey) params.set("fmt", fmtKey);
        router.replace(`/shorts/make?${params.toString()}`);
      } catch (e) {
        if (alive) setErr(aiErrorMessage(e, "打开短视频草稿失败，请返回工坊重试"));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftIdParam]);

  if (err) return <ShortMakerError msg={err} onBack={() => router.push("/shorts")} />;
  if (!draftId || !initial) return <ShortMakerLoading />;
  return <ShortMakerInner key={draftId} draftId={draftId} fmtKey={fmtKey} reopen={reopenParam} initial={initial} initialStatus={initialStatus} />;
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
        <ChevronLeft size={16} /> 返回短视频工坊
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
}: {
  draftId: string;
  fmtKey: string | null;
  reopen: string | null;
  initial: ShortDraftData;
  initialStatus: "draft" | "done";
}) {
  const router = useRouter();
  const resolvedFmtKey = fmtKey ?? initial.fmtKey ?? null;
  const hasTemplate = !!resolvedFmtKey;
  // fmt 仅作 genre / 时长默认兜底（始终非空）；是否「套了模版」看 hasTemplate。
  const fmt = SHORT_FORMATS.find((f) => f.key === resolvedFmtKey) ?? SHORT_FORMATS[0];
  const realIdea = initial.idea || initial.reopen || reopen; // 仅当真带入点子时非空

  // v0.77：由创意市场「单集创意」套用而来 —— 不套短视频模版，而是按创意风格出脚本。
  const styleName = initial.styleName ?? "";
  const styleRef = initial.styleRef ?? "";
  const hasStyle = !hasTemplate && !!styleRef;
  // 显示用的「类型」标签：套了模版才用模版名；套了创意风格用风格名；都没有就中性「短视频」，
  // 不要回落到 SHORT_FORMATS[0]（「口播带货」）—— 那只是 fmt 的兜底，拿来展示会误导。
  // 提示词直出线用拆解出的风格标签（= initial.fmtName）当类型标签，比中性「短视频」更有信息量。
  const displayName = hasTemplate
    ? fmt.name
    : hasStyle
      ? styleName || "风格创意"
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
    ? "继续改这条短视频：说要怎么调，AI 重写口播和分镜。"
    : hasStyle
      ? `已套用【${styleName || "风格创意"}】创意风格。说说你的主题或产品，AI 按这个风格写口播和分镜。`
      : hasTemplate && fmt.beats?.length
        ? `已套用【${fmt.name}】模板（${fmt.beats.length} 镜 · 约 ${fmt.dur}s）。说说你的主题或产品，AI 按它的节拍拆分镜。`
        : "说说这条短视频想表达什么，AI 来写口播脚本、拆好分镜。";

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
  const [busy, setBusy] = React.useState<{ id: string; to: ShotFlow } | null>(null);
  // 一键连跑态：进度（已完成/总数）+ 停止标志位（镜间检查，停止=当前镜头完成后不再继续）。
  const [runProgress, setRunProgress] = React.useState<{ done: number; total: number } | null>(null);
  // stopRunRef 供连跑循环内即时读取（不触发重渲染）；stopping state 与之同步置位，
  // 仅用于按钮的禁用态 + 文案（点一下即禁用，避免重复点「停止」）。runAll 结束时双双复位。
  const stopRunRef = React.useRef(false);
  const [stopping, setStopping] = React.useState(false);
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
  const title = meta?.title || initial.title || realIdea || (hasTemplate ? fmt.name : "短视频");

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
    fmtName: hasTemplate ? fmt.name : initial.fmtName || (hasStyle ? styleName || "风格创意" : "短视频"),
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
      void track(() => ShortsApi.saveDraft(draftId, dataRef.current, { status: draftStatus })).catch(() => {});
    }, 1200);
  }, [draftId, draftStatus, notifyEditing, track]);

  const flushSave = React.useCallback(
    async (opts?: { status?: "draft" | "done"; progress?: number }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await track(() => ShortsApi.saveDraft(draftId, dataRef.current, opts ?? { status: draftStatus }));
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
  React.useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  /** 离开制作页前 flush 未落库改动 + 刷新工坊列表。 */
  const leaveToStudio = async () => {
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
      body: "移到回收站，30 天内可以恢复；期间不会出现在短视频工坊列表里。",
      confirmLabel: "删除草稿",
      cancelLabel: "先保留",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await ShortsApi.deleteDraft(draftId);
      invalidate("/me/drama/shorts");
      toast.success("草稿已删除");
      router.push("/shorts");
    } catch (e) {
      toast.error(aiErrorMessage(e, "删除草稿失败，请稍后重试"));
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
      setPreflightError(aiErrorMessage(error, "预检失败，请稍后重试"));
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
      title: "生成逐镜配音？",
      body: "用当前数字人的声音逐镜合成台词。台词没改过的镜头直接复用已有配音，不重复生成；这一步不出视频。",
      confirmLabel: "生成配音",
      cancelLabel: "暂不生成",
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
      toast.success(`配音已准备 · ${result.preparedCount} 镜${result.reusedCount ? `（复用 ${result.reusedCount} 镜）` : ""}`);
    } catch (error) {
      const message = aiErrorMessage(error, "配音生成失败，已成功的镜头会保留，可直接重试");
      setPreflightError(message);
      toast.error(message);
    } finally {
      setAudioBusy(false);
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
      toast.success(`完整短片已合成 · ${result.shotCount} 镜 · 约 ${result.durationSec} 秒`);
      router.push("/shorts");
    } catch (e) {
      const message = aiErrorMessage(e, "短视频合成失败，请稍后重试");
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
      setChat((c) => [
        ...c,
        { who: "ai", text: aiReply ?? `已按你的提示词重新拆成 ${patch.shots.length} 镜（约 ${patch.shots.reduce((a, x) => a + x.dur, 0)} 秒），人物设定与画面基调同步刷新。` },
      ]);
      toast.success("已按提示词重新拆解");
    } catch (e) {
      setPhase(shots.length ? "done" : "idle");
      const msg = aiErrorMessage(e, "重新拆解失败，请稍后重试");
      setChat((c) => [...c, { who: "ai", text: `重新拆解失败：${msg}` }]);
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
        genre: hasTemplate ? fmt.name : hasStyle ? styleName || fmt.name : "通用短视频",
        durationSec: total || fmt.dur || 30,
        count: 1,
        reference: aiReference,
      });
      const script = drafts[0];
      if (!script || !script.scenes?.length) throw new Error("AI 没有产出可用脚本，请换个说法重试");
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
      setPhase("done");
      // 生成完成后对话框一定给一条反馈（不只在「改一版」时）。
      const audioBits = script.scenes.some((sc) => sc.sfx || sc.bgm || sc.fx) ? "（含音效 / BGM / 特效建议）" : "";
      setChat((c) => [
        ...c,
        { who: "ai", text: aiReply ?? `口播脚本和分镜已生成，共 ${script.scenes.length} 镜${audioBits}。右侧可以逐镜改，改完在分镜表里出片。` },
      ]);
      toast.success("口播脚本和分镜已生成，改完就能逐镜出片");
    } catch (e) {
      setPhase(shots.length ? "done" : "idle");
      const msg = aiErrorMessage(e, "脚本生成失败，请稍后重试");
      setChat((c) => [...c, { who: "ai", text: `生成失败：${msg}` }]);
      toast.error(msg);
    }
  };
  const regen = () => {
    // 有镜头正在出片（单镜 busy 或一键连跑）时不许整表替换：旧任务照常扣费，
    // 但产物会因为 shot id 全换而挂不回草稿 —— 等它跑完或停止连跑再重来。
    if (busy || runProgress) {
      toast.error("有镜头正在出片，等它完成或停止连跑后再重新生成分镜");
      return;
    }
    if (!fromPrompt) {
      void runScript();
      return;
    }
    // 重新拆解会整表替换（含你手改过的镜），覆盖前先确认。免费，故不带积分。
    void (async () => {
      const ok = await dramaConfirm({
        title: "按提示词重新拆解？",
        body: "用原始提示词重新生成整张分镜表，你手改过的镜头会被替换。已出的首帧和视频不会被删，但新分镜要重新出片。",
        confirmLabel: "重新拆解",
        tone: "danger",
      });
      if (ok) void runScript();
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
      toast.error("有镜头正在出片，等它完成或停止连跑后再让 AI 改分镜");
      return;
    }
    setChat((c) => [...c, { who: "me", text: t }]);
    setDraft("");
    void runScript(t, "右侧脚本已更新。");
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
    setShots((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch, ...(patch.voText !== undefined ? { audio: undefined } : {}) } : s)));
    invalidateAssembly();
  };
  /** 单镜生成：文字同步等待；首帧 / 视频走后台任务 + 前台轮询。 */
  const render = async (id: string, to: ShotFlow, _cost: number): Promise<boolean> => {
    const shot = shots.find((s) => s.id === id);
    if (!shot || busy) return false;
    setBusy({ id, to });
    // C-3：主角（数字人 / 参考图）+ 场景参考 → 结构化 ref_slots，服务端按端点 capability 裁剪 + 回报 applied_refs。
    const refSlots = {
      characterRefs: [
        charAvatar?.image ? { url: charAvatar.image } : null,
        charRef ? { cdnKey: charRef.cdnKey, url: charRef.url } : null,
      ].filter((item): item is { url: string; cdnKey?: string } => item !== null),
      sceneRef: sceneRef ? { cdnKey: sceneRef.cdnKey, url: sceneRef.url } : undefined,
    };
    try {
      if (to === "frame") {
        const job = await shotRender.submitFrameJob({
          vars: buildShortFrameVars({ meta, shot, styleName: renderStyleName, manifest: continuityManifest, shotId: shot.id, visualBible }),
          count: 1,
          shotId: id,
          refSlots,
          name: `${displayName} 镜${shot.no} 首帧`,
        });
        // 任务已提交 → 记进草稿（随 autosave 落库），离开页面后回来可对账恢复。
        updShot(id, { pendingJob: { jobId: job.id, kind: "frame" } });
        toast.success("首帧已加入后台生成");
        const done = await shotRender.pollFrame(job.id);
        if (isPollTimeout(done)) {
          // 超时 ≠ 失败：任务仍在后台跑，保留 pendingJob，稍后回来对账恢复。
          toast("首帧仍在后台生成，稍后回到本页即可查看");
          return false;
        }
        if (done.status === "failed") {
          updShot(id, { pendingJob: undefined });
          throw new Error(done.error_message || "首帧生成失败，请重试");
        }
        const frames = done.frames ?? done.result?.frames ?? [];
        if (!frames.length) {
          updShot(id, { pendingJob: undefined });
          throw new Error("首帧生成完成但没有返回图片，请重试");
        }
        updShot(id, { flow: "frame", frameUrls: frames.map((f) => f.url), frameUrl: frames[0]?.url, appliedRefs: done.applied_refs ?? done.result?.applied_refs, pendingJob: undefined });
        toast.success("首帧已生成，确认后再生成视频");
      } else {
        const job = await shotRender.renderClip({
          vars: {
            ...buildShortClipVars({ meta, shot, styleName: renderStyleName, manifest: continuityManifest, shotId: shot.id, visualBible }),
          },
          name: `${displayName} 镜${shot.no}`,
          durationSec: shot.dur,
          shotId: id,
          frameUrl: shot.frameUrl,
        });
        updShot(id, { pendingJob: { jobId: job.id, kind: "clip" }, jobId: job.id });
        const done = await shotRender.pollClip(job.id);
        if (isPollTimeout(done)) {
          toast("镜头视频仍在后台生成，稍后回到本页即可查看");
          return false;
        }
        if (done.status === "failed") {
          updShot(id, { pendingJob: undefined });
          throw new Error(done.error_message || "视频生成失败，请重试");
        }
        updShot(id, { flow: "clip", videoUrl: done.video_url ?? undefined, jobId: job.id, appliedRefs: job.applied_refs, pendingJob: undefined });
        toast.success("镜头视频已生成");
      }
      return true;
    } catch (e) {
      toast.error(aiErrorMessage(e, "生成失败，请稍后重试"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  /**
   * 恢复一条进行中的后台任务（对账用）：续轮询到终态。
   * 出结果 → 回填 + 清 pendingJob；确认失败 → 清 pendingJob（用户可重新生成）；
   * 超时 → 保留 pendingJob（任务仍在后台，下次回来再对账）。
   */
  const resumePendingJob = async (id: string, pj: { jobId: string; kind: "frame" | "clip" }): Promise<void> => {
    setBusy({ id, to: pj.kind });
    try {
      if (pj.kind === "frame") {
        const done = await shotRender.pollFrame(pj.jobId);
        if (isPollTimeout(done)) return;
        if (done.status === "failed") {
          updShot(id, { pendingJob: undefined });
          toast.error(aiErrorMessage(done.error_message, "上次首帧未生成成功，可重新生成"));
          return;
        }
        const frames = done.frames ?? done.result?.frames ?? [];
        if (!frames.length) {
          updShot(id, { pendingJob: undefined });
          return;
        }
        updShot(id, { flow: "frame", frameUrls: frames.map((f) => f.url), frameUrl: frames[0]?.url, appliedRefs: done.applied_refs ?? done.result?.applied_refs, pendingJob: undefined });
        toast.success("首帧已生成");
      } else {
        const done = await shotRender.pollClip(pj.jobId);
        if (isPollTimeout(done)) return;
        if (done.status === "failed") {
          updShot(id, { pendingJob: undefined });
          toast.error(aiErrorMessage(done.error_message, "上次视频未生成成功，可重新生成"));
          return;
        }
        updShot(id, { flow: "clip", videoUrl: done.video_url ?? undefined, jobId: pj.jobId, appliedRefs: done.applied_refs, pendingJob: undefined });
        toast.success("镜头视频已生成");
      }
    } catch (e) {
      toast.error(aiErrorMessage(e, "恢复上次任务失败，可重新生成"));
    } finally {
      setBusy(null);
    }
  };

  /** 应用一条已完成任务的产物（对账命中 ready 时用，无需再轮询）。 */
  const applyReconciledTask = (id: string, kind: "frame" | "clip", task: DramaRenderTask): void => {
    if (kind === "frame") {
      const frames = task.frames ?? task.result?.frames ?? [];
      if (!frames.length) {
        updShot(id, { pendingJob: undefined });
        return;
      }
      updShot(id, { flow: "frame", frameUrls: frames.map((f) => f.url), frameUrl: frames[0]?.url, appliedRefs: task.applied_refs ?? task.result?.applied_refs, pendingJob: undefined });
    } else {
      if (!task.video_url) {
        updShot(id, { pendingJob: undefined });
        return;
      }
      updShot(id, { flow: "clip", videoUrl: task.video_url ?? undefined, jobId: task.id, appliedRefs: task.applied_refs, pendingJob: undefined });
    }
  };

  /**
   * 进页对账：对带 pendingJob 的镜头查一次任务状态 —— 已完成回填、进行中续轮询、
   * 确认失效/失败清 pending 并可重试。只用既有 API（listRenderTasks + poll{Frame,Clip}），不新增端点。
   * StrictMode 双挂载守卫：reconcileRef 一次性放行（与 autoGenRef 同惯例）。
   */
  const reconcileRef = React.useRef(false);
  React.useEffect(() => {
    if (reconcileRef.current) return;
    reconcileRef.current = true;
    const pendings = shots.filter((s) => s.pendingJob);
    if (!pendings.length) return;
    void (async () => {
      let tasks: DramaRenderTask[];
      try {
        const snap = await listRenderTasks(draftId);
        tasks = snap.tasks;
      } catch {
        // 对账拉取失败：保留所有 pendingJob，不误清、不误恢复，下次进页再对账。
        return;
      }
      const byId = new Map(tasks.map((t) => [t.id, t]));
      for (const shot of pendings) {
        const pj = shot.pendingJob;
        if (!pj) continue;
        const task = byId.get(pj.jobId);
        if (!task) {
          // 快照里已无此任务（已过期 / 已清理）→ 清 pending，让用户可重新生成。
          updShot(shot.id, { pendingJob: undefined });
          toast(`「镜${shot.no}」上次的出片任务已结束，如需可重新生成`);
          continue;
        }
        if (task.status === "ready") {
          applyReconciledTask(shot.id, pj.kind, task);
        } else if (task.status === "failed") {
          updShot(shot.id, { pendingJob: undefined });
          toast.error(`「镜${shot.no}」上次出片未成功，可重新生成`);
        } else {
          // 仍在排队 / 生成中 → 续轮询（镜头格显示 busy 出片中态）。逐个 await，避免 busy 单槽争用。
          await resumePendingJob(shot.id, pj);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 一键连跑出片（安全版，v0.94）：一次确认总价，再依次为未完成镜头生成视频。
   * 与 v0.66 下线的旧「连跑」不同：① 单次 dramaConfirm 展示预计总消耗；② 顺序 await，
   * 期间镜头上显示进度；③ 任一镜失败即停，已出的保留。各镜真实计费仍在后台。
   */
  const runAll = async () => {
    if (busy || runProgress) return;
    const pending = shots.filter((s) => s.flow !== "done");
    if (!pending.length) {
      toast("所有镜头都出片了，可以直接合成成片");
      return;
    }
    const cost = pending.length * cfg.prices.clip;
    const ok = await dramaConfirm({
      title: "一键连跑出片",
      body: `为 ${pending.length} 个未完成镜头依次出片，预计 ${cost} 积分（按各镜实际计费）。中途可以停，也可以离开页面。`,
      confirmLabel: "开始出片",
      cancelLabel: "取消",
    });
    if (!ok) return;
    stopRunRef.current = false;
    setStopping(false);
    setRunProgress({ done: 0, total: pending.length });
    let done = 0;
    try {
      for (const s of pending) {
        // 镜间检查停止标志：停止 = 当前镜头完成后不再继续（不中断已提交任务）。
        if (stopRunRef.current) {
          toast(`已停止连跑，已完成 ${done}/${pending.length} 个镜头，其余可随时继续`);
          return;
        }
        const ok2 = await render(s.id, "clip", cfg.prices.clip);
        if (!ok2) {
          toast.error(`连跑已暂停在第 ${done + 1} 个镜头，已完成的镜头已保留，可稍后继续`);
          return;
        }
        updShot(s.id, { flow: "done" });
        done += 1;
        setRunProgress({ done, total: pending.length });
      }
      toast.success("全部镜头已出片，可合成成片");
    } finally {
      setRunProgress(null);
      stopRunRef.current = false;
      setStopping(false);
    }
  };
  const stopRunAll = () => {
    if (!runProgress || stopRunRef.current) return;
    stopRunRef.current = true;
    setStopping(true);
    toast("当前镜头完成后停止");
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
  // 上传素材 → 追加到 refs（数字人参考图、道具图等，供逐镜 @ 引用）。
  const uploadMaterial = async (file: File) => {
    if (uploading) return;
    setUploading("mat");
    try {
      const r = await DramaAssetsApi.uploadAssetRef(file, "其他");
      const mat: Material = {
        id: "mat_" + r.cdnKey,
        name: r.name || file.name,
        cat: "其他",
        kind: "image",
        from: "#f97316",
        to: "#e11d48",
        url: r.url,
        cdnKey: r.cdnKey,
      };
      setRefs((arr) => (arr.some((x) => x.cdnKey === mat.cdnKey) ? arr : [...arr, mat]));
      toast.success("素材已上传");
    } catch (e) {
      toast.error(aiErrorMessage(e, "素材上传失败，请重试"));
    } finally {
      setUploading(null);
    }
  };

  // 分镜表元素：内联与「放大」全屏弹层共用同一份（同一组 handlers）。
  const storyboardTable = (
    <ShortStoryboardTable
      shots={shots}
      beats={shots.map((s) => s.beat ?? "")}
      speakerOptions={["口播", "旁白"]}
      characters={(visualBible?.characters ?? []).map((c) => c.name).filter(Boolean)}
      locked={draftStatus === "done"}
      busy={busy}
      frameCost={cfg.prices.frame}
      clipCost={cfg.prices.clip}
      onPatch={(id, patch) => updShot(id, patch)}
      onDelete={(id) => {
        setShots((arr) => arr.filter((x) => x.id !== id).map((x, j) => ({ ...x, no: j + 1 })));
        invalidateAssembly();
      }}
      onRender={(id, kind) => render(id, kind === "frame" ? "frame" : "clip", kind === "frame" ? cfg.prices.frame : cfg.prices.clip)}
      onApprove={(id) => updShot(id, { flow: "done" })}
      onFrameEdited={(id, frameUrl) => updShot(id, { flow: "frame", frameUrl, frameUrls: [frameUrl] })}
    />
  );

  return (
    <div className="col ws-flush" style={{ minHeight: 0, background: "var(--bg)", position: "relative" }}>
      {/* 顶栏 */}
      <header
        className="row"
        style={{ height: 58, padding: "0 24px", borderBottom: "1px solid var(--line)", background: "var(--surface)", gap: 14, flex: "none" }}
      >
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void leaveToStudio()} style={{ flex: "none" }}>
          <ChevronLeft size={15} /> 工坊
        </button>
        <span
          style={{ width: 24, height: 32, borderRadius: 6, background: `linear-gradient(135deg,${fmt.from},${fmt.to})`, flex: "none" }}
        />
        <div className="col" style={{ minWidth: 0, gap: 1 }}>
          <span style={{ fontWeight: 800, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }}>
            {title}
          </span>
          <span className="row gap-1 faint num" style={{ fontSize: 11, alignItems: "center" }}>
            <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={displayName}>
              {displayName}
            </span>
            · 竖屏 9:16 · 约 {total}s
            {fromPrompt && (
              <span
                className="tag tag-accent"
                style={{ flex: "none", marginLeft: 4 }}
                title="这条短视频按你写的提示词拆的，人物和画面设定跟着提示词走"
              >
                提示词直出
              </span>
            )}
          </span>
        </div>
        {/* v0.88：单页化（去掉 脚本/工厂 步骤切换）—— 设计稿短视频制作为单页：左口播对话 / 右大纲+分镜表（逐镜内联出片）。 */}
        <span className="grow" />
        <SaveStatus status={saveStatusValue} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void deleteCurrentDraft()}
          disabled={deleting}
          aria-busy={deleting}
          title="删除草稿"
          style={{ flex: "none", color: "var(--danger)", border: "1px solid color-mix(in oklch, var(--danger) 28%, transparent)", background: "color-mix(in oklch, var(--danger) 6%, var(--surface))" }}
        >
          <Trash2 size={14} /> {deleting ? "删除中" : "删除草稿"}
        </button>
      </header>

      {/* 脚本步:左 AI 对话 / 右 生成脚本 · 工厂步:居中滚动 */}
      {(
        <div className="row grow" style={{ minHeight: 0, alignItems: "stretch" }}>
          {/* 左:AI 对话（可折叠 → 细边栏） */}
          {chatCollapsed ? (
            <div
              className="col"
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
          <div className="col" style={{ width: 380, flex: "none", borderRight: "1px solid var(--line)", background: "var(--surface)", minHeight: 0 }}>
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
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>AI 脚本助手</span>
              <span className="faint" style={{ fontSize: 11 }}>
                {fromPrompt ? "按你的提示词重拆" : "聊出你要的脚本"}
              </span>
              <span className="grow" />
              <button
                type="button"
                className="btn btn-icon btn-sm"
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
                    <span className="faint" style={{ fontSize: 12 }}>正在重写脚本…</span>
                  </div>
                </div>
              )}
              {/* 后续推荐 action：跟在最新 AI 回复下面，点一下即作为「继续修改」指令发送。 */}
              {phase !== "gen" && quickChips.length > 0 && (
                <div className="col gap-2" style={{ alignItems: "flex-start" }}>
                  <span className="faint" style={{ fontSize: 11 }}>试试这样改：</span>
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
                  placeholder={fromPrompt ? "说要怎么调整，按原提示词重新拆解…" : "告诉 AI 怎么改…"}
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
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </div>
          )}

          {/* 右:结构化分镜脚本(表单式 · 带时间线) */}
          <div className="scroll grow" style={{ minHeight: 0, background: "var(--bg)" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "22px 28px 110px" }}>
              {/* v0.143 提示词直出：来源提示词与全片视觉设定（这里的字直接进每一镜的出图与出片提示词） */}
              {fromPrompt && (
                <div className="card col" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
                  <div className="row gap-2" style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-soft)", alignItems: "center", flexWrap: "wrap" }}>
                    <ClipboardPaste size={16} style={{ color: "var(--accent-2)", flex: "none" }} />
                    <span style={{ fontWeight: 800, fontSize: 14, flex: "none" }}>提示词设定</span>
                    <span
                      className="faint"
                      style={{ fontSize: 11, flex: 1, minWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {(visualBible?.characters?.length ?? 0)} 位角色 · {(visualBible?.scenes?.length ?? 0)} 个场景 · 每镜出图按这里锁外观
                    </span>
                    <button type="button" className="chip" style={{ flex: "none" }} onClick={() => setRawPromptOpen(true)}>
                      <ScrollText size={12} /> 原始提示词
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      aria-expanded={bibleOpen}
                      aria-label={bibleOpen ? "收起提示词设定" : "展开提示词设定"}
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
                          <AlertTriangle size={11} style={{ flex: "none", marginTop: 3 }} /> <span>{n}</span>
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
                            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--ink-3)" }}>外观（进画面）</span>
                            <EditableField
                              multiline
                              value={c.visual}
                              onChange={(v) => patchBibleCharacter(i, { visual: v })}
                              placeholder="脸型 / 发型 / 服装 / 道具 / 配色"
                              textStyle={{ fontSize: 12.5, lineHeight: 1.75, color: "var(--ink-2)" }}
                            />
                          </div>
                          <div className="col gap-1">
                            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--ink-3)" }}>表演（不进画面）</span>
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
                        <span className="faint" style={{ fontSize: 11, alignSelf: "center" }}>不填外观的角色，出图时不会用来锁长相</span>
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
                      {fromPrompt ? "按你的提示词整理的大纲" : "根据对话整理的大纲"}
                    </span>
                  </div>

                  <div className="col" style={{ padding: 22, gap: 20 }}>
                    {/* 故事 —— metaLine + 大标题 + 一句话故事大纲（对应短剧 logline，放标题下） */}
                    <div className="col gap-3">
                      <div className="faint" style={{ fontSize: 12 }}>{displayName} · 单片 · 竖屏 9:16 · 约 {total} 秒</div>
                      <EditableField
                        value={meta.title ?? ""}
                        onChange={(v) => setMeta({ ...meta, title: v })}
                        placeholder="给这条短视频起个标题…"
                        textStyle={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.2 }}
                      />
                      <EditableField
                        multiline
                        value={logline}
                        onChange={setLogline}
                        placeholder="一句话故事大纲…"
                        textStyle={{ fontSize: 14.5, lineHeight: 1.8, color: "var(--ink-2)" }}
                      />
                    </div>

                    <div style={{ height: 1, background: "var(--line-soft)" }} />

                    {/* 主角 —— 折叠；展开后：角色卡 + 参考图 / 数字人 / 素材设置 */}
                    <CollapsibleOutlineSection
                      label="主角"
                      hint="点击展开设置"
                      summary={meta.character?.name || (charAvatar?.name ?? "未设定")}
                      open={charOpen}
                      onToggle={() => setCharOpen((v) => !v)}
                    >
                      <div className="col gap-3" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px var(--line-soft)" }}>
                        {/* 角色卡 */}
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
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", padding: 0, fontFamily: "inherit" }}
                            />
                            <input
                              value={meta.character?.description ?? ""}
                              onChange={(e) => setMeta({ ...meta, character: { ...(meta.character ?? { name: "", description: "" }), description: e.target.value } })}
                              placeholder="形象与性格一句话"
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 11.5, color: "var(--ink-3)", padding: 0, fontFamily: "inherit" }}
                            />
                          </div>
                        </div>

                        {/* 参考图 */}
                        <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                          <span className="faint" style={{ fontSize: 11.5, width: 48, flex: "none" }}>参考图</span>
                          {charRef && (
                            <RefThumb url={charRef.url} onView={() => setLightbox({ src: charRef.url, kind: "image" })} onRemove={() => setCharRef(null)} />
                          )}
                          <UploadButton label="上传参考图" busy={uploading === "char"} disabled={!!uploading} onFile={(f) => void uploadRefImage(f, "char")} />
                        </div>

                        {/* 数字人 */}
                        <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                          <span className="faint" style={{ fontSize: 11.5, width: 48, flex: "none" }}>数字人</span>
                          {charAvatar ? (
                            <span className="row gap-2" style={{ alignItems: "center", padding: "3px 8px 3px 4px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 12, fontWeight: 700 }}>
                              {charAvatar.image && <span style={{ width: 20, height: 20, borderRadius: "50%", background: `center/cover no-repeat url(${charAvatar.image})`, flex: "none" }} />}
                              {charAvatar.name}
                              <button type="button" aria-label="解绑数字人" onClick={() => setCharAvatar(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--accent)", display: "grid", placeItems: "center", padding: 0 }}>
                                <X size={13} />
                              </button>
                            </span>
                          ) : (
                            <button type="button" className="btn btn-line btn-sm" onClick={() => setAvatarPickerOpen(true)}>
                              <UserPlus size={13} /> 绑定数字人
                            </button>
                          )}
                        </div>

                        {/* 素材 */}
                        <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                          <span className="faint" style={{ fontSize: 11.5, width: 48, flex: "none" }}>素材</span>
                          {refs.map((m) => (
                            <RefThumb
                              key={m.id}
                              url={m.url ?? ""}
                              from={m.from}
                              to={m.to}
                              onView={() => m.url && setLightbox({ src: m.url, kind: "image" })}
                              onRemove={() => setRefs((arr) => arr.filter((x) => x.id !== m.id))}
                            />
                          ))}
                          <UploadButton label="上传素材" busy={uploading === "mat"} disabled={!!uploading} onFile={(f) => void uploadMaterial(f)} />
                        </div>
                      </div>
                    </CollapsibleOutlineSection>

                    <div style={{ height: 1, background: "var(--line-soft)" }} />

                    {/* 主场景 —— 折叠；展开后：场景描述 + 参考图 */}
                    <CollapsibleOutlineSection
                      label="主场景"
                      hint="点击展开设置"
                      summary={meta.scene || "未设定"}
                      open={sceneOpen}
                      onToggle={() => setSceneOpen((v) => !v)}
                    >
                      <EditableField
                        multiline
                        value={meta.scene ?? ""}
                        onChange={(v) => setMeta({ ...meta, scene: v })}
                        placeholder="主场景一句话描述"
                        textStyle={{ fontSize: 13.5, lineHeight: 1.9, color: "var(--ink-2)" }}
                      />
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
                <div className="row gap-2" style={{ marginBottom: 14, alignItems: "center" }}>
                  <Clapperboard size={16} style={{ color: "var(--accent)" }} />
                  <span style={{ fontWeight: 800, fontSize: 16 }}>分镜表</span>
                  {shots.length > 0 && (
                    <span className="tag tag-accent" style={{ flex: "none" }}>共 {shots.length} 镜 · 约 {total} 秒</span>
                  )}
                  <span className="grow" />
                  {shots.length > 0 && (
                    <span className="row gap-1 faint" style={{ fontSize: 11.5, flex: "none" }}>
                      <Edit size={12} /> 文字可直接改
                    </span>
                  )}
                  {shots.length > 0 && (
                    <RenderModelSelect lane="image" models={renderModels.models}
                      value={renderModels.imageEndpointId} onChange={renderModels.setImageEndpointId} />
                  )}
                  {shots.length > 0 && (
                    <RenderModelSelect lane="video" models={renderModels.models}
                      value={renderModels.videoEndpointId} onChange={renderModels.setVideoEndpointId} />
                  )}
                  {shots.length > 0 && (
                    <button type="button" className="chip" title="放大分镜表，方便编辑" onClick={() => setTableMax(true)}>
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
                        ? "有镜头正在出片，等它完成或停止连跑后再重新生成"
                        : fromPrompt
                          ? "用原始提示词重新生成整张分镜表"
                          : "让 AI 重写一版口播脚本与分镜"
                    }
                  >
                    <RefreshCw size={12} /> {fromPrompt ? "按提示词重拆" : "重新生成"}
                  </button>
                  {shots.length > 0 && draftStatus !== "done" && (
                    runProgress ? (
                      <span className="row gap-2" style={{ flex: "none", alignItems: "center" }}>
                        <span className="row gap-1 faint" style={{ fontSize: 11.5, alignItems: "center", whiteSpace: "nowrap" }}>
                          <Loader2 size={12} style={{ animation: "drama-spin .7s linear infinite" }} />
                          出片中 {runProgress.done}/{runProgress.total}
                        </span>
                        <button
                          type="button"
                          className="btn btn-line btn-sm"
                          style={{ flex: "none" }}
                          onClick={stopRunAll}
                          disabled={stopping}
                          title="完成当前镜头后停止，不会中断已提交的任务"
                        >
                          <CircleStop size={14} /> {stopping ? "将在本镜完成后停止" : "停止连跑"}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-grad btn-sm"
                        style={{ flex: "none" }}
                        disabled={!!busy || doneCount === shots.length}
                        onClick={() => void runAll()}
                      >
                        <Zap size={14} /> 一键连跑出片
                      </button>
                    )
                  )}
                </div>
              )}

              {shots.length > 0 && (
                <section className="card" aria-label="出片前检查" style={{ padding: "12px 14px", marginBottom: 14 }}>
                  <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
                    <ShieldCheck size={15} style={{ color: "var(--accent)" }} />
                    <strong style={{ fontSize: 13 }}>出片前检查</strong>
                    {preflight && (
                      <span className="faint" style={{ fontSize: 11.5 }}>
                        分镜 {preflight.structuralReady ? "通过" : "待修复"} · 配音 {preflight.audioReadyCount}/{preflight.shotCount} 镜 · 镜头视频 {preflight.completedShotCount}/{preflight.shotCount} 镜
                      </span>
                    )}
                    <span className="grow" />
                    <button type="button" className="btn btn-line btn-sm" onClick={() => void refreshPreflight(true)} disabled={preflightBusy || audioBusy} aria-busy={preflightBusy} title="只检查分镜、配音和镜头视频齐不齐，不生成内容、不扣积分">
                      {preflightBusy ? <Loader2 size={13} className="spin" /> : <ShieldCheck size={13} />} {preflightBusy ? "检查中…" : "检查一遍"}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => void prepareShortAudio()} disabled={audioBusy || preflightBusy || !charAvatar} aria-busy={audioBusy} title={!charAvatar ? "先绑定一位已关联声音的数字人" : "只生成配音，不提交视频任务"}>
                      {audioBusy ? <Loader2 size={13} className="spin" /> : <Volume2 size={13} />} {audioBusy ? "生成配音中…" : "准备逐镜配音"}
                    </button>
                  </div>
                  {(preflightError || preflight?.issues.length) ? (
                    <div className="col gap-1" style={{ marginTop: 9 }} aria-live="polite">
                      {preflightError && <div role="alert" style={{ color: "var(--danger)", fontSize: 12 }}>{preflightError}</div>}
                      {preflight?.issues.slice(0, 4).map((issue) => (
                        <div key={`${issue.code}-${issue.shotNo ?? "all"}`} className="row gap-1" style={{ color: issue.severity === "error" ? "var(--danger)" : "var(--ink-3)", fontSize: 11.5 }}>
                          <AlertTriangle size={12} /> {issue.shotNo ? `镜 ${issue.shotNo}：` : ""}{issue.message}
                        </div>
                      ))}
                    </div>
                  ) : preflight ? (
                    <div role="status" style={{ marginTop: 8, color: "var(--success)", fontSize: 11.5 }}>
                      分镜检查通过；{preflight.assemblyReady ? "可以合成成片了。" : "补齐配音和镜头视频后就能合成。"}
                    </div>
                  ) : (
                    <div className="faint" style={{ marginTop: 8, fontSize: 11.5 }}>分镜改过了，合成前建议检查一遍；检查不扣积分。</div>
                  )}
                </section>
              )}

              {phase === "gen" ? (
                <div className="card" style={{ padding: 18 }}>
                  <GenSkeleton lines={4} label="正在写口播稿并拆分镜…" />
                </div>
              ) : shots.length === 0 ? (
                <div className="card col center" style={{ padding: "48px 24px", textAlign: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
                    <Clapperboard size={26} />
                  </div>
                  <div className="muted" style={{ maxWidth: 340, fontSize: 13.5 }}>
                    在左侧告诉 AI 这条片子讲什么，它会写口播脚本并拆好分镜，之后再逐镜出片。
                  </div>
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
                  <div className="row gap-2" style={{ padding: "4px 2px" }}>
                    <Edit size={12} style={{ color: "var(--ink-3)" }} />
                    <span className="faint" style={{ fontSize: 11.5 }}>所有字段点一下就能改 · 画面里输入 @ 引用素材 · 也可以让左侧 AI 整体重写</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 原始提示词（只读查看 + 复制）—— 溯源：这条片子到底是按什么拆的 */}
      {rawPromptOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="原始提示词"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRawPromptOpen(false);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 75, background: "rgba(15,10,30,.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: "5vh 3vw" }}
        >
          <div ref={rawPromptRef} tabIndex={-1} className="col" style={{ width: "min(760px, 94vw)", maxHeight: "84vh", background: "var(--bg)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-lg)", border: "1px solid var(--line-soft)", outline: "none" }}>
            <div className="row gap-2" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--surface)", flex: "none", alignItems: "center" }}>
              <ScrollText size={16} style={{ color: "var(--accent-2)" }} />
              <span style={{ fontWeight: 800, fontSize: 14.5 }}>原始提示词</span>
              <span className="faint num" style={{ fontSize: 11 }}>{promptSource?.raw?.length ?? 0} 字</span>
              <span className="grow" />
              <button
                type="button"
                className="chip"
                onClick={() => {
                  const raw = promptSource?.raw ?? "";
                  navigator.clipboard
                    ?.writeText(raw)
                    .then(() => toast.success("已复制原始提示词"))
                    .catch(() => toast.error("复制失败，请手动选中复制"));
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
              <span className="faint" style={{ fontSize: 11.5 }}>想改提示词本身：在左侧说要调什么，或用分镜表的「按提示词重拆」。</span>
            </div>
          </div>
        </div>
      )}

      {/* 绑定数字人 / 参考图看大图 */}
      {avatarPickerOpen && <AvatarPickerModal onPick={(a) => setCharAvatar(a)} onClose={() => setAvatarPickerOpen(false)} />}
      <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />

      {/* 分镜表放大：全屏弹层（与内联共用同一份表，编辑实时同步） */}
      {tableMax && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="分镜表（放大）"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTableMax(false);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(15,10,30,.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: "3vh 2vw" }}
        >
          <div ref={tableMaxRef} tabIndex={-1} className="col" style={{ width: "min(1280px, 96vw)", height: "94vh", background: "var(--bg)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-lg)", border: "1px solid var(--line-soft)", outline: "none" }}>
            <div className="row gap-2" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--surface)", flex: "none", alignItems: "center" }}>
              <Clapperboard size={16} style={{ color: "var(--accent)" }} />
              <span style={{ fontWeight: 800, fontSize: 15 }}>分镜表</span>
              <span className="tag tag-accent" style={{ flex: "none" }}>共 {shots.length} 镜 · 约 {total} 秒</span>
              <span className="grow" />
              <span className="row gap-1 faint" style={{ fontSize: 11.5 }}>
                <Edit size={12} /> 所有字段点一下就能改
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

      {/* 悬浮 CTA */}
      <div
        className="row gap-2 pop-in"
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
        }}
      >
        {assembleError ? (
          <div className="row gap-2" role="alert" style={{ maxWidth: 420, color: "var(--danger)", fontSize: 12.5, lineHeight: 1.45 }}>
            <AlertTriangle size={15} style={{ flex: "none" }} />
            <span style={{ overflowWrap: "anywhere" }}>{assembleError}</span>
            <button type="button" className="btn btn-sm" onClick={() => void assembleShort()} disabled={assembling}>
              重试合成
            </button>
          </div>
        ) : missingAudio.length > 0 && missingAssemblyMedia.length === 0 ? (
          <button type="button" className="btn btn-grad" onClick={() => void prepareShortAudio()} disabled={audioBusy || !charAvatar} aria-busy={audioBusy} title={!charAvatar ? "请先绑定数字人" : undefined}>
            {audioBusy ? <Loader2 size={15} className="spin" /> : <Volume2 size={15} />}
            {audioBusy ? "正在准备配音…" : `先生成 ${missingAudio.length} 镜配音`}
          </button>
        ) : readyToAssemble ? (
          <button
            type="button"
            className="btn btn-grad"
            onClick={() => void assembleShort()}
            disabled={assembling}
            aria-busy={assembling}
          >
            {assembling ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
            {assembling ? "正在拼接并上传…" : "合成完整短片"}
          </button>
        ) : shots.length > 0 && doneCount === shots.length ? (
          <span className="row gap-2" role="status" style={{ fontSize: 12, fontWeight: 650, color: "var(--danger)", padding: "4px 6px" }}>
            <AlertTriangle size={14} /> {missingAssemblyMedia.length} 镜缺少视频文件，无法合成；请重新生成或恢复任务
          </span>
        ) : shots.length === 0 ? (
          <span className="row gap-2" role="status" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", padding: "4px 6px" }}>
            <Clapperboard size={14} /> 先在左侧生成脚本和分镜
          </span>
        ) : (
          <span className="row gap-2" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", padding: "4px 6px" }}>
            <ImageIcon size={14} /> 还有 {shots.length - doneCount} 个镜头没出片
          </span>
        )}
      </div>
    </div>
  );
}
