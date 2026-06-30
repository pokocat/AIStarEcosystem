"use client";

export const dynamic = "force-dynamic";

// 短视频制作 — 设计真源 v4 screens-shorts-v4.jsx `ShortMaker` + `ShortShotCard`:
// 单屏两步:① AI 对话 + 口播脚本表 → ② 视频工厂逐镜出片 → 合成成片。
// v0.76:整页编辑态由后端短视频草稿（/me/drama/shorts）持久化 —— 进页即建/读草稿（id 进 URL），
// 编辑防抖自动保存，刷新 / 返回 / 换设备都能接着做（此前纯内存态，刷新即丢）。
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
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
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { CreditButton, GenSkeleton, Thumb } from "@/components/drama-ui";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { type FormShot, type ShotFlow } from "@/components/drama-workshop/shot-form";
import { ShortStoryboardTable } from "@/components/drama-workshop/short-storyboard-table";
import { SaveStatus } from "@/components/drama-workshop/save-status";
import { MediaLightbox, type LightboxMedia } from "@/components/drama-workshop/media-lightbox";
import { MarkdownLite } from "@/lib/markdown-lite";
import { SHORT_FORMATS, type Material, type ShortFormat } from "@/mocks/drama-workshop";
import { DapAvatarsApi, DramaAssetsApi, RenderApi, ShortDramaApi, ShortsApi } from "@/api";
import type { DapAvatarLite } from "@/api/dap-avatars";
import type { ScriptMeta } from "@/api/short-drama";
import type { ShortDraftData } from "@/api/shorts";
import { aiErrorMessage } from "@/lib/ai-error";
import { useSaveStatus } from "@/lib/use-save-status";
import { invalidate } from "@/lib/drama-query";

/** 把「整体短视频说明」拼成注入每镜提示词的前缀，统一全片风格 / 场景 / 主角。 */
function metaPromptPrefix(meta: ScriptMeta | null): string {
  if (!meta) return "";
  const parts = [
    meta.title?.trim() || "",
    meta.style?.length ? `风格：${meta.style.join("、")}` : "",
    meta.scene?.trim() ? `场景：${meta.scene.trim()}` : "",
    meta.character?.name?.trim()
      ? `主角：${meta.character.name.trim()}${meta.character.description?.trim() ? `（${meta.character.description.trim()}）` : ""}`
      : "",
  ].filter(Boolean);
  return parts.length ? `【整体设定】${parts.join("｜")}。` : "";
}

// 单镜各路径积分消耗(仅用于确认弹窗展示,真实计费在后台)
const SHORT_FRAME_COST = 2;
const SHORT_DIRECT_COST = 9;
const SHORT_CLIP_COST = 7;

/** 短视频分镜 = 结构化表单分镜 + 出镜引擎 */
interface ShortShot extends FormShot {
  engine: string;
  frameIdx: number;
  /** v0.97：本镜节拍语义标签（痛点开场 / 反转 / 强 CTA 收尾…），来自 AI 逐镜生成，缺省回落「镜 N」。 */
  beat?: string;
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
      <div className="col" onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 94vw)", maxHeight: "80vh", background: "var(--surface)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
        <div className="row gap-2" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", flex: "none", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>绑定数字人</span>
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
              <div className="muted" style={{ fontSize: 13, maxWidth: 320 }}>你还没有数字人。去 AiAvatar 创建数字人后，即可在这里绑定为主角形象。</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 12 }}>
              {list.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onPick({ id: a.id, name: a.name, image: a.imageUrl ?? "" });
                    onClose();
                  }}
                  className="col"
                  style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--surface-2)", cursor: "pointer", padding: 0, textAlign: "left", gap: 0 }}
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
  const displayName = hasTemplate ? fmt.name : hasStyle ? styleName || "风格创意" : "短视频";

  // 套模版上下文：仅当确实选了模版，才把模版节拍作为 AI 生成参考。
  const templateRef = hasTemplate && fmt.beats?.length
    ? `「${fmt.name}」模版（${fmt.beats.length} 镜 · 约 ${fmt.dur}s）：` +
      fmt.beats.map((b, i) => `镜${i + 1}(${b.dur}s) 画面:${b.visual} 口播:${b.vo}`).join("；")
    : "";
  // 创意风格参考：把创意名 + 风格说明喂给出脚本 AI，让成片照这个风格走（不直接复述说明）。
  const styleRefLine = hasStyle ? `参考创意风格【${styleName || "风格短片"}】：${styleRef}` : "";
  const aiReference = [templateRef, styleRefLine].filter(Boolean).join(" ");
  const tplIntro = initial.reopen
    ? "继续修改这条短视频：说明要怎么调整，AI 将重写口播与分镜。"
    : hasStyle
      ? `已套用【${styleName || "风格创意"}】创意风格：描述你的主题或产品，AI 将按此风格撰写口播与分镜。`
      : hasTemplate && fmt.beats?.length
        ? `已套用【${fmt.name}】模板：AI 将按其节拍（${fmt.beats.length} 镜 · 约 ${fmt.dur}s）拆解，描述你的主题或产品即可。`
        : "描述这条短视频想表达什么，AI 将撰写口播脚本并拆好分镜。";

  // v0.88：单页化后不再切步骤；step 仍随草稿保存（兼容旧字段）。
  const [step] = React.useState<"script" | "factory">(initial.step ?? "script");
  const [phase, setPhase] = React.useState<"idle" | "gen" | "done">(initial.shots.length ? "done" : "idle");
  const [shots, setShots] = React.useState<ShortShot[]>(() => (initial.shots as ShortShot[]) ?? []);
  // 整体短视频说明（标题 / 风格 / 场景 / 主角）—— AI 先定调，统领分镜与逐镜出片。
  const [meta, setMeta] = React.useState<ScriptMeta | null>(initial.meta ?? null);
  // 一句话故事大纲（AI logline）—— 展示在标题下，可直接改。
  const [logline, setLogline] = React.useState<string>(() => initial.logline ?? "");
  const [busy, setBusy] = React.useState<{ id: string; to: ShotFlow } | null>(null);
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
  const [deleting, setDeleting] = React.useState(false);
  // 后续推荐 action：AI 每生成 / 改写一版脚本就刷新（来自后端 suggestions），并随草稿持久化、重开恢复。
  const [suggestions, setSuggestions] = React.useState<string[]>(() => initial.suggestions ?? []);
  // 左侧 AI 对话可折叠（收起成细边栏，给右侧大纲 / 分镜更多空间）。
  const [chatCollapsed, setChatCollapsed] = React.useState(false);
  // 分镜表放大：全屏弹层展示，方便逐镜编辑。
  const [tableMax, setTableMax] = React.useState(false);
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
    logline,
    characterRef: charRef,
    characterAvatar: charAvatar,
    sceneRef,
    shots,
    chat,
    refs,
    suggestions,
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
  }, [step, meta, logline, charRef, charAvatar, sceneRef, shots, chat, refs, suggestions, queueSave]);
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
      title: "删除这条草稿?",
      body: "删除后会从短视频工坊移除，当前脚本、分镜和已生成镜头都不会再出现在这条草稿里。",
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

  /** 真实 AI 生成口播脚本（DRAMA_SCRIPT_DRAFT）→ 映射为结构化分镜表。 */
  const runScript = async (instruction?: string, aiReply?: string) => {
    if (phase === "gen") return;
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
          id: "sh" + Date.now() + "_" + i,
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
        })),
      );
      setPhase("done");
      // 生成完成后对话框一定给一条反馈（不只在「改一版」时）。
      const audioBits = script.scenes.some((sc) => sc.sfx || sc.bgm || sc.fx) ? "（含音效 / BGM / 特效建议）" : "";
      setChat((c) => [
        ...c,
        { who: "ai", text: aiReply ?? `脚本和分镜已生成 ✓ 共 ${script.scenes.length} 个分镜${audioBits}。右侧可逐镜改，满意就去「视频工厂」出片。` },
      ]);
      toast.success("口播脚本和分镜已生成,改满意就去出片");
    } catch (e) {
      setPhase(shots.length ? "done" : "idle");
      const msg = aiErrorMessage(e, "脚本生成失败，请稍后重试");
      setChat((c) => [...c, { who: "ai", text: `生成失败：${msg}` }]);
      toast.error(msg);
    }
  };
  const regen = () => void runScript();

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
    setChat((c) => [...c, { who: "me", text: t }]);
    setDraft("");
    void runScript(t, "改好了——右侧脚本已更新,你再看看还哪里要调?");
  };
  const updShot = (id: string, patch: Partial<ShortShot>) =>
    setShots((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  /** 单镜生成：文字同步等待；首帧 / 视频走后台任务 + 前台轮询。 */
  const render = async (id: string, to: ShotFlow, _cost: number): Promise<boolean> => {
    const shot = shots.find((s) => s.id === id);
    if (!shot || busy) return false;
    setBusy({ id, to });
    // 把「整体短视频说明」注入每镜提示词，保证风格 / 场景 / 主角跨镜一致 —— 出片更准确。
    const metaCtx = metaPromptPrefix(meta);
    // 主角绑定的数字人 / 参考图 / 场景参考图 → 出首帧时作参考图，锁定形象。
    const shortRefImages = [charAvatar?.image, charRef?.url, sceneRef?.url].filter((u): u is string => !!u);
    try {
      if (to === "frame") {
        const job = await RenderApi.submitFrameJob({
          kind: "short",
          vars: { metaPrefix: metaCtx, visual: shot.visual, styleSuffix: `竖屏短视频画面，${fmt.name}风格。` },
          refImages: shortRefImages,
          ratio: "9:16",
          count: 1,
          projectId: draftId,
          shotId: id,
          name: `${displayName} 镜${shot.no} 首帧`,
        });
        toast.success("首帧已加入后台生成");
        const done = await RenderApi.pollFrameJob(job.id, { timeoutMs: 240_000 });
        if (done.status === "failed") throw new Error(done.error_message || "首帧生成失败，请重试");
        const frames = done.frames ?? done.result?.frames ?? [];
        if (!frames.length) throw new Error("首帧生成完成但没有返回图片，请重试");
        updShot(id, { flow: "frame", frameUrls: frames.map((f) => f.url), frameUrl: frames[0]?.url });
        toast.success("首帧已生成，确认后再生成视频");
      } else {
        const job = await RenderApi.renderClip({
          kind: "short",
          vars: {
            metaPrefix: metaCtx, visual: shot.visual,
            lineClause: shot.voText ? `口播：${shot.voText}` : "", styleSuffix: `竖屏短视频，${fmt.name}风格。`,
          },
          name: `${fmt.name} 镜${shot.no}`,
          durationSec: shot.dur,
          ratio: "9:16",
          projectId: draftId,
          shotId: id,
          frameUrl: shot.frameUrl,
        });
        const done = await RenderApi.pollClipJob(job.id, { timeoutMs: 240_000 });
        if (done.status === "failed") throw new Error(done.error_message || "视频生成失败，请重试");
        updShot(id, { flow: "clip", videoUrl: done.video_url ?? undefined, jobId: job.id });
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
   * 一键连跑出片（安全版，v0.94）：一次确认总价，再依次为未完成镜头生成视频。
   * 与 v0.66 下线的旧「连跑」不同：① 单次 dramaConfirm 展示预计总消耗；② 顺序 await，
   * 期间镜头上显示进度；③ 任一镜失败即停，已出的保留。各镜真实计费仍在后台。
   */
  const runAll = async () => {
    if (busy) return;
    const pending = shots.filter((s) => s.flow !== "done");
    if (!pending.length) {
      toast("所有镜头都已出片，可直接合成成片");
      return;
    }
    const cost = pending.reduce((a, s) => a + (s.flow === "frame" ? SHORT_CLIP_COST : SHORT_DIRECT_COST), 0);
    const ok = await dramaConfirm({
      title: "一键连跑出片",
      body: `将为 ${pending.length} 个未完成镜头依次生成视频，预计消耗约 ${cost} 积分（按各镜实际计费）。生成期间可在镜头上看到进度，可随时离开。`,
      confirmLabel: "开始出片",
      cancelLabel: "取消",
    });
    if (!ok) return;
    for (const s of pending) {
      const done = await render(s.id, "clip", s.flow === "frame" ? SHORT_CLIP_COST : SHORT_DIRECT_COST);
      if (!done) {
        toast.error("出片中断，已完成的镜头已保留，可稍后重试");
        return;
      }
      updShot(s.id, { flow: "done" });
    }
    toast.success("全部镜头已出片，可合成成片");
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
      locked={draftStatus === "done"}
      busy={busy}
      onPatch={(id, patch) => updShot(id, patch)}
      onDelete={(id) => setShots((arr) => arr.filter((x) => x.id !== id).map((x, j) => ({ ...x, no: j + 1 })))}
      onRender={(id, kind) => render(id, kind === "frame" ? "frame" : "clip", kind === "frame" ? 2 : kind === "direct" ? 9 : 7)}
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
          <span className="faint num" style={{ fontSize: 11 }}>{displayName} · 竖屏 9:16 · 约 {total}s</span>
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
          style={{ flex: "none", color: "#dc2626", border: "1px solid #fecaca", background: "#fff7f7" }}
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
              <span className="faint" style={{ fontSize: 11 }}>聊出你要的脚本</span>
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
                  placeholder="告诉 AI 怎么改…"
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
                      根据对话整理出的短视频大纲
                    </span>
                    <span style={{ flex: "none", fontSize: 10.5, fontWeight: 700, color: "var(--ink-3)", background: "var(--surface-2)", padding: "2px 9px", borderRadius: 999 }}>新生成</span>
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
                    <button type="button" className="chip" title="放大分镜表，方便编辑" onClick={() => setTableMax(true)}>
                      <Maximize2 size={12} /> 放大
                    </button>
                  )}
                  <button type="button" className="chip" disabled={phase === "gen" || shots.length === 0} onClick={regen}>
                    <RefreshCw size={12} /> 重新生成
                  </button>
                  {shots.length > 0 && draftStatus !== "done" && (
                    <button
                      type="button"
                      className="btn btn-grad btn-sm"
                      style={{ flex: "none" }}
                      disabled={!!busy || doneCount === shots.length}
                      onClick={() => void runAll()}
                    >
                      <Zap size={14} /> 一键连跑出片
                    </button>
                  )}
                </div>
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
                    在左侧向 AI 描述你的想法，它会撰写口播脚本并拆好分镜，确认满意后再生成成片。
                  </div>
                </div>
              ) : (
                <div className="col gap-3">
                  {storyboardTable}
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    style={{ alignSelf: "flex-start" }}
                    onClick={() =>
                      setShots((arr) => [
                        ...arr,
                        { id: "add" + Date.now(), no: arr.length + 1, dur: 4, visual: "", size: "中景", move: "固定", voWho: "口播", voText: "", sfx: "", bgm: "", fx: "", refs: [], sub: true, flow: "draft", engine: "fx", frameIdx: 0 },
                      ])
                    }
                  >
                    <Plus size={14} /> 加一镜
                  </button>
                  <div className="row gap-2" style={{ padding: "4px 2px" }}>
                    <Edit size={12} style={{ color: "var(--ink-3)" }} />
                    <span className="faint" style={{ fontSize: 11.5 }}>所有字段点击即可改 · 画面里输入 @ 引用素材 · 也可让左侧 AI 整体重写</span>
                  </div>
                </div>
              )}
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
          style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(15,10,30,.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: "3vh 2vw" }}
        >
          <div className="col" style={{ width: "min(1280px, 96vw)", height: "94vh", background: "var(--bg)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-lg)", border: "1px solid var(--line-soft)" }}>
            <div className="row gap-2" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "var(--surface)", flex: "none", alignItems: "center" }}>
              <Clapperboard size={16} style={{ color: "var(--accent)" }} />
              <span style={{ fontWeight: 800, fontSize: 15 }}>分镜表</span>
              <span className="tag tag-accent" style={{ flex: "none" }}>共 {shots.length} 镜 · 约 {total} 秒</span>
              <span className="grow" />
              <span className="row gap-1 faint" style={{ fontSize: 11.5 }}>
                <Edit size={12} /> 所有字段点击即可改
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
        style={{
          position: "fixed",
          right: 26,
          bottom: "calc(22px + env(safe-area-inset-bottom))",
          zIndex: 80,
          background: "var(--surface)",
          padding: 10,
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--line-soft)",
        }}
      >
        {shots.length > 0 && doneCount === shots.length ? (
          <button
            type="button"
            className="btn btn-grad"
            onClick={async () => {
              try {
                setDraftStatus("done");
                await flushSave({ status: "done", progress: 100 });
              } catch (e) {
                /* flush 失败：草稿仍是 draft 态，用户可重试，不误报完成 */
                setDraftStatus("draft");
                toast.error(aiErrorMessage(e, "合成完成状态保存失败，请稍后重试"));
                return;
              }
              invalidate("/me/drama/shorts");
              toast.success("短视频已合成,可在「我的短视频」查看");
              router.push("/shorts");
            }}
          >
            <Check size={15} /> 合成成片 · 完成
          </button>
        ) : (
          <span className="row gap-2" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", padding: "4px 6px" }}>
            <ImageIcon size={14} /> 把 {shots.length - doneCount} 个镜头出完即可合成
          </span>
        )}
      </div>
    </div>
  );
}
