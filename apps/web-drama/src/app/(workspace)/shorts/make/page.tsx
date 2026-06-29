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
  ChevronLeft,
  Clapperboard,
  Edit,
  Film,
  Image as ImageIcon,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { CreditButton, GenSkeleton, Thumb } from "@/components/drama-ui";
import { dramaConfirm } from "@/components/drama-ui/confirm-dialog";
import { ShotFormCard, type FormShot, type ShotFlow } from "@/components/drama-workshop/shot-form";
import { SaveStatus } from "@/components/drama-workshop/save-status";
import { SHORT_FORMATS, type Material, type ShortFormat } from "@/mocks/drama-workshop";
import { RenderApi, ShortDramaApi, ShortsApi } from "@/api";
import type { ScriptMeta } from "@/api/short-drama";
import type { ShortDraftData } from "@/api/shorts";
import { aiErrorMessage } from "@/lib/ai-error";
import { useSaveStatus } from "@/lib/use-save-status";
import { invalidate } from "@/lib/drama-query";

// 整体短视频说明（meta）卡片里输入框/文本域的统一样式。
const META_INPUT: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13,
  lineHeight: 1.5,
  background: "var(--surface-2)",
  color: "var(--ink)",
  outline: "none",
  fontFamily: "inherit",
};

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
}

interface ChatMsg {
  who: "ai" | "me";
  text: string;
}

/* 单镜出片卡(竖屏) */
// v0.88：短视频大纲 / 分镜 beat 语义标签（设计稿口播种草 13s 模型）。
const SHORT_BEATS = ["痛点开场", "卖点演示", "强 CTA 收尾"];

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
  const displayName = hasStyle ? styleName || "风格创意" : fmt.name;

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
    // 没套短视频模版时保留草稿原本的 fmtName（如创意套用来的「风格短片」），不被默认模版名覆盖。
    fmtName: hasTemplate ? fmt.name : initial.fmtName || fmt.name,
    styleName: styleName || undefined,
    styleRef: styleRef || undefined,
    title: meta?.title || initial.title || title,
    step,
    meta,
    shots,
    chat,
    refs,
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
  }, [step, meta, shots, chat, refs, queueSave]);
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

  const QUICK = ["口吻再口语一点", "开头加个更狠的钩子", "缩到 20 秒内", "多一点产品特写"];
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
  const render = async (id: string, to: ShotFlow, _cost: number) => {
    const shot = shots.find((s) => s.id === id);
    if (!shot || busy) return;
    setBusy({ id, to });
    // 把「整体短视频说明」注入每镜提示词，保证风格 / 场景 / 主角跨镜一致 —— 出片更准确。
    const metaCtx = metaPromptPrefix(meta);
    try {
      if (to === "frame") {
        const job = await RenderApi.submitFrameJob({
          kind: "short",
          vars: { metaPrefix: metaCtx, visual: shot.visual, styleSuffix: `竖屏短视频画面，${fmt.name}风格。` },
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
    } catch (e) {
      toast.error(aiErrorMessage(e, "生成失败，请稍后重试"));
    } finally {
      setBusy(null);
    }
  };

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
          {/* 左:AI 对话 */}
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
                    {m.text}
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
            </div>
            <div className="col gap-2" style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--line-soft)", flex: "none" }}>
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                {QUICK.map((q) => (
                  <button key={q} type="button" className="chip" style={{ fontSize: 11.5 }} disabled={phase === "gen"} onClick={() => sendChat(q)}>
                    {q}
                  </button>
                ))}
              </div>
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

          {/* 右:结构化分镜脚本(表单式 · 带时间线) */}
          <div className="scroll grow" style={{ minHeight: 0, background: "var(--bg)" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "22px 28px 110px" }}>
              <div className="row gap-2" style={{ marginBottom: 14 }}>
                <Clapperboard size={16} style={{ color: "var(--accent)" }} />
                <span style={{ fontWeight: 800, fontSize: 16 }}>分镜脚本</span>
                <span className="faint num" style={{ fontSize: 12 }}>{shots.length} 镜 · 约 {total}s · 时间线自动累计</span>
                <span className="grow" />
                <button type="button" className="chip" disabled={phase === "gen" || shots.length === 0} onClick={regen}>
                  <RefreshCw size={12} /> 重新生成
                </button>
              </div>

              {/* 整体短视频说明：AI 先定调，统领分镜与逐镜出片，可直接改 */}
              {meta && (
                <div className="card col gap-3" style={{ padding: 16, marginBottom: 16 }}>
                  <div className="row gap-2" style={{ alignItems: "center" }}>
                    <Sparkles size={15} style={{ color: "var(--accent)" }} />
                    <span style={{ fontWeight: 800, fontSize: 14 }}>短视频大纲</span>
                    <span className="tag tag-gray" style={{ flex: "none" }}>口播种草 · 单片 · 竖屏 9:16</span>
                    <span className="faint" style={{ fontSize: 11 }}>AI 先定调 · 分镜与出片都据此保持一致，可直接改</span>
                  </div>
                  {/* v0.88：短视频大纲 beat 流（设计稿口播种草模型）。 */}
                  <div className="row" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    {SHORT_BEATS.map((b, i) => (
                      <React.Fragment key={b}>
                        <span className="chip static" style={{ height: 26, background: "var(--accent-soft)", color: "var(--accent)" }}>{b}</span>
                        {i < SHORT_BEATS.length - 1 && <ArrowRight size={13} style={{ color: "var(--ink-3)" }} />}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="col gap-1">
                    <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>标题</span>
                    <input
                      value={meta.title ?? ""}
                      onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                      placeholder="一句话标题"
                      style={META_INPUT}
                    />
                  </div>
                  <div className="col gap-1">
                    <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>风格</span>
                    {/* v0.88：风格可编辑（用、或逗号分隔；落库随草稿自动保存） */}
                    <input
                      value={(meta.style ?? []).join("、")}
                      onChange={(e) => setMeta({ ...meta, style: e.target.value.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) })}
                      placeholder="风格关键词，用、或逗号分隔（如 口播种草、强钩子、暖色）"
                      style={META_INPUT}
                    />
                    {meta.style?.length ? (
                      <div className="row gap-2" style={{ flexWrap: "wrap", marginTop: 4 }}>
                        {meta.style.map((s, i) => (
                          <span key={i} className="chip static" style={{ height: 24, fontSize: 11.5, background: "var(--accent-soft)", color: "var(--accent)" }}>{s}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="col gap-1">
                    <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>主场景</span>
                    <textarea
                      value={meta.scene ?? ""}
                      onChange={(e) => setMeta({ ...meta, scene: e.target.value })}
                      placeholder="主场景一句话描述"
                      rows={2}
                      style={{ ...META_INPUT, resize: "none" }}
                    />
                  </div>
                  <div className="col gap-1">
                    <span className="faint" style={{ fontSize: 11, fontWeight: 600 }}>主角</span>
                    <input
                      value={meta.character?.name ?? ""}
                      onChange={(e) => setMeta({ ...meta, character: { ...(meta.character ?? { name: "", description: "" }), name: e.target.value } })}
                      placeholder="角色名"
                      style={META_INPUT}
                    />
                    <textarea
                      value={meta.character?.description ?? ""}
                      onChange={(e) => setMeta({ ...meta, character: { ...(meta.character ?? { name: "", description: "" }), description: e.target.value } })}
                      placeholder="形象与性格一句话"
                      rows={2}
                      style={{ ...META_INPUT, resize: "none" }}
                    />
                  </div>
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
                  {shots.map((s2, i) => (
                    <div key={s2.id} className="col gap-1">
                      {/* v0.88：每镜 beat 语义标签（设计稿 shortBeat） */}
                      <span className="tag tag-accent" style={{ alignSelf: "flex-start" }}>
                        {SHORT_BEATS[i] ?? `镜 ${i + 1}`}
                      </span>
                    <ShotFormCard
                      s={s2}
                      start={shots.slice(0, i).reduce((a, x) => a + (x.dur || 0), 0)}
                      colors={s2.flow === "draft" ? { from: "#cbd5e1", to: "#94a3b8" } : { from: fmt.from, to: fmt.to }}
                      speakerOptions={["口播", "旁白"]}
                      busy={busy && busy.id === s2.id ? busy.to : null}
                      onPatch={(patch) => updShot(s2.id, patch)}
                      onDelete={() => setShots((arr) => arr.filter((x) => x.id !== s2.id).map((x, j) => ({ ...x, no: j + 1 })))}
                      onRenderFrame={() => render(s2.id, "frame", 2)}
                      onRenderDirect={() => render(s2.id, "clip", 9)}
                      onRenderClip={() => render(s2.id, "clip", 7)}
                      onApprove={() => updShot(s2.id, { flow: "done" })}
                    />
                    </div>
                  ))}
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
