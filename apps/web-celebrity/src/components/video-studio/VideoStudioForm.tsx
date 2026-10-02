"use client";

// 「视频生成」左栏：（做同款条）→ 模型 → 生成模式 → 素材 → 提示词（+ 智能优化）→ 规格 → 高级 → 报价 + 按钮。
//
// 选项与限制全部来自模型合同（GET …/models），前端不写死厂商数值；报价与服务端冻结金额
// 同一套数（lib/video-studio.ts 的 quote，§3：我们自己定、后台可配，某格没定价就不许提交）。
// 模型信息没加载成功时不显示报价、不许提交。
// 切模式时已上传的素材留在页面上，提交只带当前模式要的那些（buildJobRequest / buildOptimizationRequest）。
// 提交成功后表单原样保留，方便改一两个参数再出一条。
//
// 智能优化（§9）：提示词下面的「智能优化」默认勾上（记在本机）；勾上时按钮是「优化并继续」，
// 优化结果出来后在提示词下面选「用这版生成」「改用原提示词生成」「先不生成」。
// 做同款（§10）：右栏模板点「做同款」把模式、提示词、规格、种子、模型、素材填进来，
// 素材标「模板素材」、能换能删；顶上一条「正在做同款」，「不做同款了」只清模板素材和模板 id。

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Clapperboard, Copy, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import type {
  VideoStudioJob,
  VideoStudioMediaType,
  VideoStudioModel,
  VideoStudioTemplate,
} from "@ai-star-eco/types/video-studio";
import { formatCredits } from "@ai-star-eco/api-client/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ai-star-eco/ui/ui/select";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { VideoStudioApi } from "@/api";
import { AiErrorNotice, errorMessage } from "@/components/common/ai-error-notice";
import {
  VIDEO_STUDIO_MODE_DESC,
  VIDEO_STUDIO_MODE_LABEL,
  VIDEO_STUDIO_OPTIMIZE_HINT,
  VIDEO_STUDIO_OPTIMIZE_PREF_KEY,
  VIDEO_STUDIO_PROMPT_PLACEHOLDER,
  canvasLabel,
  tierLabel,
} from "@/constants/video-studio-ui";
import { useCelebrityShell } from "@/lib/celebrity-shell-context";
import {
  MEDIA_TYPE_UNIT,
  REFERENCE_MEDIA_ORDER,
  aspectForTier,
  buildJobRequest,
  buildOptimizationRequest,
  countPromptChars,
  defaultSelection,
  findModeSpec,
  findTier,
  formatSizeCeil,
  formatSizeLimit,
  materialFacts,
  materialFromTemplate,
  materialFromUpload,
  newClientRequestId,
  optimizationPrice,
  parseSeedInput,
  perSecondPrice,
  planTemplateApply,
  preflight,
  quote,
  reconcileSelection,
  type VideoStudioDraft,
  type VideoStudioFormMaterial,
  type VideoStudioQuote,
  type VideoStudioSelection,
} from "@/lib/video-studio";
import { EMPTY_FRAME_SLOT, FrameSlot, type FrameSlotState } from "./FrameSlot";
import { OptimizePanel } from "./OptimizePanel";
import {
  EMPTY_REFERENCE_LISTS,
  ReferencePanel,
  referenceCapacity,
  type ReferenceItem,
  type ReferenceLists,
  type ReferenceNotice,
} from "./ReferencePanel";
import { ChoiceButton, FormSection } from "./parts";
import { usePromptOptimization } from "./use-prompt-optimization";
import type { VideoStudioModelsState } from "./use-video-studio-models";

type FrameSide = "first" | "last";

const FRAME_LABEL: Record<FrameSide, string> = { first: "首帧", last: "尾帧" };

/** 右栏点了「做同款」：nonce 每点一次换一个，同一个模板连点两次也会重新填一遍。 */
export interface PendingTemplate {
  template: VideoStudioTemplate;
  nonce: number;
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white shadow-[var(--shadow-soft)]">{children}</div>
  );
}

export function VideoStudioForm({
  models,
  onSubmitted,
  onShowJobs,
  pendingTemplate,
}: {
  models: VideoStudioModelsState;
  onSubmitted: (job: VideoStudioJob) => void;
  /** 提交成功后「去看看」：滚到生成记录（手机上它在表单下面）。 */
  onShowJobs?: () => void;
  /** 右栏模板点了「做同款」（表单还没出来时先存着，出来后再填）。 */
  pendingTemplate: PendingTemplate | null;
}) {
  if (models.models === null) {
    return (
      <FormCard>
        {models.error ? (
          <div className="flex flex-col gap-2 p-4">
            <AiErrorNotice title="视频模型信息没有加载出来" message={models.error} onRetry={models.reload} />
            <p className="text-[11.5px] leading-relaxed text-zinc-500">加载成功之前不显示报价，也不能提交。</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-5 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在读取可用的视频模型…
          </div>
        )}
      </FormCard>
    );
  }
  if (models.models.length === 0) {
    return (
      <FormCard>
        <NoModels loading={models.loading} error={models.error} onRetry={models.reload} />
      </FormCard>
    );
  }
  return (
    <StudioForm
      models={models.models}
      modelsError={models.error}
      modelsLoading={models.loading}
      onRetryModels={models.reload}
      onSubmitted={onSubmitted}
      onShowJobs={onShowJobs}
      pendingTemplate={pendingTemplate}
    />
  );
}

/** 后台一个视频生成模型都没配：整块不可用，说清楚找谁配。 */
function NoModels({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
        <Clapperboard className="h-5 w-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-zinc-800">视频模型暂未开通</h2>
        <p className="text-xs leading-relaxed text-zinc-500">
          需要运营在管理后台的「AI 模型与 Key」里给视频生成配好模型，配好之后这里才能用。
        </p>
      </div>
      {error ? <AiErrorNotice message={error} /> : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className="mobile-touch-target inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-[12.5px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          重新检查
        </button>
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-zinc-200 px-4 py-1.5 text-[12.5px] font-medium text-zinc-400"
        >
          <Sparkles className="h-3.5 w-3.5" />
          生成
        </button>
      </div>
    </div>
  );
}

function defaultModelOf(models: VideoStudioModel[]): VideoStudioModel {
  return models.find((m) => m.isDefault) ?? models[0];
}

/** 下拉框的取值：Radix Select 不接受空串，合成的默认项可能没有 endpointId。 */
function modelKey(m: VideoStudioModel, index: number): string {
  return m.endpointId || `__default-${index}`;
}

let localIdSeq = 0;
function newLocalId(): string {
  localIdSeq += 1;
  return `vs-${Date.now().toString(36)}-${localIdSeq}`;
}

function shortName(name: string): string {
  const chars = Array.from(name || "未命名文件");
  return chars.length > 24 ? `${chars.slice(0, 22).join("")}…` : chars.join("");
}

function isPaymentRequired(e: unknown): boolean {
  const x = e as { status?: unknown; code?: unknown } | null;
  return !!x && (x.status === 402 || x.code === "PAYMENT_REQUIRED");
}

function withList(prev: ReferenceLists, mediaType: VideoStudioMediaType, list: ReferenceItem[]): ReferenceLists {
  const next: ReferenceLists = { ...prev };
  next[mediaType] = list;
  return next;
}

/** 「智能优化」勾选框记在本机：读写都包 try/catch（隐私模式 / 禁用存储时只是记不住，不影响使用）。 */
function readOptimizePref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(VIDEO_STUDIO_OPTIMIZE_PREF_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

function writeOptimizePref(on: boolean) {
  try {
    window.localStorage.setItem(VIDEO_STUDIO_OPTIMIZE_PREF_KEY, on ? "1" : "0");
  } catch {
    /* 存不了就算了：下次进来回到默认勾上 */
  }
}

/** 模型那一行下面的小字：当前模式各档每秒价 + 时长范围。 */
function pricingSummary(model: VideoStudioModel, mode: VideoStudioSelection["mode"]): string {
  const { pricing, contract } = model;
  const range =
    contract.minSeconds === contract.maxSeconds
      ? `${contract.minSeconds} 秒`
      : `${contract.minSeconds}–${contract.maxSeconds} 秒`;
  const tiers = contract.tiers.map((t) => {
    const p = perSecondPrice(pricing, mode, t.tier);
    return p === null ? `${tierLabel(t.tier)} 暂未定价` : `${tierLabel(t.tier)} ${formatCredits(p)} 积分/秒`;
  });
  return [...tiers, range].join(" · ");
}

interface SubmitErrorState {
  message: string;
  topUp: boolean;
  /** 从哪儿点的：错误就显示在哪儿（优化那一块 / 页面底部）。 */
  source: "footer" | "panel";
}

interface TemplateState {
  id: string;
  title: string;
  /** 原作的模型现在不能用了，已换成默认模型。 */
  modelUnavailable: boolean;
}

function StudioForm({
  models,
  modelsError,
  modelsLoading,
  onRetryModels,
  onSubmitted,
  onShowJobs,
  pendingTemplate,
}: {
  models: VideoStudioModel[];
  modelsError: string | null;
  modelsLoading: boolean;
  onRetryModels: () => void;
  onSubmitted: (job: VideoStudioJob) => void;
  onShowJobs?: () => void;
  pendingTemplate: PendingTemplate | null;
}) {
  const { wallet, refreshWallet } = useCelebrityShell();
  const seedInputId = React.useId();
  const formTopRef = React.useRef<HTMLDivElement>(null);

  // ── 模型与规格 ──
  const [modelChoice, setModelChoice] = React.useState<string>(() => {
    const d = defaultModelOf(models);
    return modelKey(d, models.indexOf(d));
  });
  const chosen = models.find((m, i) => modelKey(m, i) === modelChoice);
  const model = chosen ?? defaultModelOf(models);
  // 下拉框、报价、提交都认这一个值：刷新模型列表后选中的那个不在了，三处必须一起换到默认模型，
  // 不能下拉框还显示旧模型、报价和提交却已经悄悄用了另一个
  const effectiveChoice = modelKey(model, models.indexOf(model));
  const [modelGoneNote, setModelGoneNote] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (chosen || modelChoice === effectiveChoice) return;
    setModelChoice(effectiveChoice);
    setModelGoneNote(`之前选的模型暂时不能用了，已换成「${model.name}」，报价按它来算`);
  }, [chosen, modelChoice, effectiveChoice, model.name]);
  const contract = model.contract;
  // 用户选过的规格原样存着，渲染时按当前模型的合同对齐（换模型不用再写一遍联动）
  const [selectionState, setSelection] = React.useState<VideoStudioSelection>(() => defaultSelection(contract));
  const sel = React.useMemo(() => reconcileSelection(contract, selectionState), [contract, selectionState]);
  const update = (patch: Partial<VideoStudioSelection>) => setSelection({ ...sel, ...patch });

  // ── 内容 ──
  const [prompt, setPrompt] = React.useState("");
  const [seedText, setSeedText] = React.useState("");
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  // 只在浏览器里渲染（模型列表是进页面后才拉的），这里直接读本机记住的选择
  const [optimizeOn, setOptimizeOn] = React.useState<boolean>(readOptimizePref);

  // ── 素材 ──
  const [frames, setFrames] = React.useState<Record<FrameSide, FrameSlotState>>({
    first: EMPTY_FRAME_SLOT,
    last: EMPTY_FRAME_SLOT,
  });
  // 每个上传位的序号：换图 / 删除 / 做同款之后，还没回来的旧上传结果作废
  const frameSeq = React.useRef<Record<FrameSide, number>>({ first: 0, last: 0 });
  const [refLists, setRefLists] = React.useState<ReferenceLists>(EMPTY_REFERENCE_LISTS);
  const [refTab, setRefTab] = React.useState<VideoStudioMediaType>("image");
  const [refNotices, setRefNotices] = React.useState<ReferenceNotice[]>([]);
  const removedRefIds = React.useRef(new Set<string>());

  // ── 做同款 ──
  const [templateState, setTemplateState] = React.useState<TemplateState | null>(null);
  const appliedNonce = React.useRef<number | null>(null);

  // ── 提交 ──
  const [submitting, setSubmitting] = React.useState(false);
  const submittingRef = React.useRef(false);
  const [submitError, setSubmitError] = React.useState<SubmitErrorState | null>(null);
  const [submitNote, setSubmitNote] = React.useState<string | null>(null);
  const [attempted, setAttempted] = React.useState(false);

  const creditsChanged = React.useCallback(() => void refreshWallet(), [refreshWallet]);
  const optimization = usePromptOptimization(creditsChanged);
  const optView = optimization.view;
  const panelOpen = optView.phase !== "idle";

  React.useEffect(() => {
    if (!submitNote) return;
    const timer = window.setTimeout(() => setSubmitNote(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [submitNote]);

  // ── 派生 ──
  const modeSpec = findModeSpec(contract, sel.mode);
  const frameLimit = modeSpec?.frameImage ?? contract.modes.find((m) => m.frameImage)?.frameImage ?? null;
  const refRules = modeSpec?.references ?? null;
  const tier = findTier(contract, sel.resolutionTier);
  const orderedRefs: ReferenceItem[] = [...refLists.image, ...refLists.video, ...refLists.audio];
  const refMaterials = orderedRefs.flatMap((r) => (r.material ? [r.material] : []));
  // 只看当前模式要用的位置：别的模式里还没传完的素材不发出去，也就不该挡住这次提交
  // （例：全能参考里在传一段大视频，切到文生视频，「生成」不能一直灰着）
  const uploadsInFlight =
    (!!modeSpec?.needsFirstFrame && frames.first.uploading) ||
    (!!modeSpec?.needsLastFrame && frames.last.uploading) ||
    (!!refRules && orderedRefs.some((r) => r.uploading));
  const seed = parseSeedInput(seedText);
  const seedInvalid = seed !== null && (!Number.isInteger(seed) || seed < 0 || seed > contract.seedMax);

  const preflightFor = (promptText: string) =>
    preflight(contract, {
      ...sel,
      prompt: promptText,
      seed,
      firstFrame: frames.first.material ? materialFacts(frames.first.material) : null,
      lastFrame: frames.last.material ? materialFacts(frames.last.material) : null,
      references: refMaterials.map(materialFacts),
    });
  const problems = preflightFor(prompt);
  const shownProblems = problems.filter((p) => attempted || p.kind === "invalid");
  const price = modelsError ? null : quote(model.pricing, sel.resolutionTier, sel.seconds, sel.mode, refLists.image.length);
  const optPrice = optimizationPrice(model.pricing);
  // 生成本身能不能提交（不管是从底部按钮还是从优化那一块点的）
  const generationBlocked = modelsError
    ? "模型信息没有加载成功，暂时不能提交"
    : !price
      ? "这个规格还没定价，暂时不能提交"
      : uploadsInFlight
        ? "素材还在上传，传完才能提交"
        : null;
  const blocked =
    generationBlocked ??
    (optimizeOn && optPrice === null
      ? "智能优化暂时没有报价，可以先取消勾选直接生成"
      : panelOpen
        ? optView.phase === "starting" || optView.phase === "running"
          ? "正在优化提示词，结果出来后在提示词下面选怎么生成"
          : "先在提示词下面选好用哪一版"
        : null);
  const promptChars = countPromptChars(prompt);
  const promptOver = promptChars > contract.promptMaxChars;

  const draftWith = (promptText: string, optimizationId: string | null): VideoStudioDraft => ({
    ...sel,
    prompt: promptText,
    seed,
    firstFrameKey: frames.first.material?.key ?? null,
    lastFrameKey: frames.last.material?.key ?? null,
    references: refMaterials.map((m) => ({ mediaType: m.mediaType, key: m.key })),
    templateId: templateState?.id ?? null,
    optimizationId,
  });

  // ── 首帧 / 尾帧 ──
  const setFrame = (side: FrameSide, fn: (s: FrameSlotState) => FrameSlotState) =>
    setFrames((prev) => ({ ...prev, [side]: fn(prev[side]) }));

  const pickFrame = async (side: FrameSide, file: File) => {
    const label = FRAME_LABEL[side];
    if (file.size === 0) {
      setFrame(side, (s) => ({ ...s, error: "这个文件是空的，换一个再试" }));
      return;
    }
    if (frameLimit && file.size > frameLimit.maxBytes) {
      setFrame(side, (s) => ({
        ...s,
        error: `${label}图不能超过 ${formatSizeLimit(frameLimit.maxBytes)}（这张 ${formatSizeCeil(file.size)}），换一张小一点的`,
      }));
      return;
    }
    frameSeq.current[side] += 1;
    const mine = frameSeq.current[side];
    setFrame(side, (s) => ({ ...s, uploading: true, uploadingName: file.name, error: null }));
    try {
      const upload = await VideoStudioApi.upload(file, "image");
      if (frameSeq.current[side] !== mine) return;
      setFrame(side, () => ({ material: materialFromUpload(upload), uploading: false, uploadingName: null, error: null }));
    } catch (e) {
      if (frameSeq.current[side] !== mine) return;
      setFrame(side, (s) => ({ ...s, uploading: false, uploadingName: null, error: errorMessage(e, "上传失败，请重试") }));
    }
  };

  const removeFrame = (side: FrameSide) => {
    frameSeq.current[side] += 1;
    setFrame(side, () => EMPTY_FRAME_SLOT);
  };

  // ── 参考素材 ──
  const pushNotices = (texts: string[]) => {
    if (texts.length === 0) return;
    setRefNotices((prev) => [...prev, ...texts.map((text) => ({ id: newLocalId(), text }))].slice(-4));
  };

  const setRefMaterial = (mediaType: VideoStudioMediaType, id: string, material: VideoStudioFormMaterial | null) =>
    setRefLists((prev) =>
      withList(
        prev,
        mediaType,
        prev[mediaType].map((r) => (r.id === id ? { ...r, material: material ?? r.material, uploading: false } : r)),
      ),
    );

  const addReferences = (mediaType: VideoStudioMediaType, files: File[]) => {
    if (!refRules) return;
    const limit = refRules[mediaType];
    const capacity = referenceCapacity(refRules, refLists, mediaType);
    const notes: string[] = [];
    const accepted: File[] = [];
    let skipped = 0;
    for (const f of files) {
      if (f.size === 0) {
        notes.push(`「${shortName(f.name)}」是空文件，没有加进来`);
      } else if (f.size > limit.maxBytes) {
        notes.push(`「${shortName(f.name)}」超过 ${formatSizeLimit(limit.maxBytes)}，没有加进来`);
      } else if (accepted.length >= capacity.remaining) {
        skipped += 1;
      } else {
        accepted.push(f);
      }
    }
    if (skipped > 0) notes.push(`${capacity.limit}，有 ${skipped} ${MEDIA_TYPE_UNIT[mediaType]}没有加进来`);
    pushNotices(notes);
    if (accepted.length === 0) return;

    const items: ReferenceItem[] = accepted.map((f) => ({
      id: newLocalId(),
      mediaType,
      name: f.name || "未命名文件",
      material: null,
      uploading: true,
    }));
    setRefLists((prev) => withList(prev, mediaType, [...prev[mediaType], ...items]));
    items.forEach((item, i) => {
      VideoStudioApi.upload(accepted[i], mediaType)
        .then((upload) => setRefMaterial(mediaType, item.id, materialFromUpload(upload)))
        .catch((e) => {
          if (removedRefIds.current.has(item.id)) return;
          setRefLists((prev) => withList(prev, mediaType, prev[mediaType].filter((r) => r.id !== item.id)));
          pushNotices([`「${shortName(item.name)}」上传失败：${errorMessage(e, "请重试")}`]);
        });
    });
  };

  /** 换一个：位置和编号不变；传失败就保留原来那个。 */
  const replaceReference = (mediaType: VideoStudioMediaType, id: string, file: File) => {
    if (!refRules) return;
    const limit = refRules[mediaType];
    if (file.size === 0) {
      pushNotices([`「${shortName(file.name)}」是空文件，没有换上`]);
      return;
    }
    if (file.size > limit.maxBytes) {
      pushNotices([`「${shortName(file.name)}」超过 ${formatSizeLimit(limit.maxBytes)}，没有换上`]);
      return;
    }
    setRefLists((prev) =>
      withList(prev, mediaType, prev[mediaType].map((r) => (r.id === id ? { ...r, uploading: true } : r))),
    );
    VideoStudioApi.upload(file, mediaType)
      .then((upload) => {
        if (removedRefIds.current.has(id)) return;
        setRefLists((prev) =>
          withList(
            prev,
            mediaType,
            prev[mediaType].map((r) =>
              r.id === id ? { ...r, name: upload.name, material: materialFromUpload(upload), uploading: false } : r,
            ),
          ),
        );
      })
      .catch((e) => {
        if (removedRefIds.current.has(id)) return;
        // 有原来的素材就退回原来的；原来那个已经被清掉了（换的时候点了「不做同款了」）就整条拿掉
        setRefLists((prev) =>
          withList(
            prev,
            mediaType,
            prev[mediaType].flatMap((r) => (r.id !== id ? [r] : r.material ? [{ ...r, uploading: false }] : [])),
          ),
        );
        pushNotices([`「${shortName(file.name)}」没有换上：${errorMessage(e, "上传失败，请重试")}`]);
      });
  };

  const moveReference = (mediaType: VideoStudioMediaType, index: number, delta: -1 | 1) =>
    setRefLists((prev) => {
      const list = [...prev[mediaType]];
      const j = index + delta;
      if (j < 0 || j >= list.length) return prev;
      [list[index], list[j]] = [list[j], list[index]];
      return withList(prev, mediaType, list);
    });

  const removeReference = (mediaType: VideoStudioMediaType, id: string) => {
    removedRefIds.current.add(id);
    setRefLists((prev) => withList(prev, mediaType, prev[mediaType].filter((r) => r.id !== id)));
  };

  // ── 做同款 ──
  const applyTemplate = (template: VideoStudioTemplate) => {
    const plan = planTemplateApply(template, models);
    const index = plan.endpointId ? models.findIndex((m) => m.endpointId === plan.endpointId) : -1;
    const target = index >= 0 ? models[index] : defaultModelOf(models);
    setModelChoice(modelKey(target, models.indexOf(target)));
    setModelGoneNote(null);
    setSelection(plan.selection);
    setPrompt(plan.prompt);
    setSeedText(plan.seedText);
    if (plan.seedText) setAdvancedOpen(true);

    // 原来的素材整体换成模板的；还没传完的上传结果作废
    frameSeq.current.first += 1;
    frameSeq.current.last += 1;
    setFrames({
      first: plan.firstFrame ? { ...EMPTY_FRAME_SLOT, material: materialFromTemplate(plan.firstFrame) } : EMPTY_FRAME_SLOT,
      last: plan.lastFrame ? { ...EMPTY_FRAME_SLOT, material: materialFromTemplate(plan.lastFrame) } : EMPTY_FRAME_SLOT,
    });
    orderedRefs.forEach((r) => removedRefIds.current.add(r.id));
    const lists: ReferenceLists = { image: [], video: [], audio: [] };
    for (const m of plan.references) {
      lists[m.mediaType].push({
        id: newLocalId(),
        mediaType: m.mediaType,
        name: m.label,
        material: materialFromTemplate(m),
        uploading: false,
      });
    }
    setRefLists(lists);
    setRefNotices([]);
    const firstTab = REFERENCE_MEDIA_ORDER.find((t) => lists[t].length > 0);
    if (firstTab) setRefTab(firstTab);

    setTemplateState({ id: template.id, title: template.title, modelUnavailable: plan.modelUnavailable });
    optimization.dismiss();
    setSubmitError(null);
    setSubmitNote(null);
    setAttempted(false);
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 右栏点了「做同款」：每个 nonce 只填一次（表单这时才出来的话，出来就填）
  React.useEffect(() => {
    if (!pendingTemplate || appliedNonce.current === pendingTemplate.nonce) return;
    appliedNonce.current = pendingTemplate.nonce;
    applyTemplate(pendingTemplate.template);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只响应「又点了一次做同款」，填表用的是这一刻的状态
  }, [pendingTemplate]);

  /**
   * 不做同款了：清掉模板 id 和模板素材，其它（提示词、规格、自己传的素材）都留着。
   * 正在把某个模板素材换成自己的那一位：只清模板素材，等自己的传完接着用。
   */
  const exitTemplate = () => {
    setTemplateState(null);
    (["first", "last"] as const).forEach((side) => {
      if (!frames[side].material?.fromTemplate) return;
      if (frames[side].uploading) {
        setFrame(side, (s) => ({ ...s, material: null }));
      } else {
        frameSeq.current[side] += 1;
        setFrame(side, () => EMPTY_FRAME_SLOT);
      }
    });
    orderedRefs
      .filter((r) => r.material?.fromTemplate && !r.uploading)
      .forEach((r) => removedRefIds.current.add(r.id));
    setRefLists((prev) => {
      const next: ReferenceLists = { image: [], video: [], audio: [] };
      for (const t of REFERENCE_MEDIA_ORDER) {
        next[t] = prev[t].flatMap((r) => {
          if (!r.material?.fromTemplate) return [r];
          return r.uploading ? [{ ...r, material: null }] : [];
        });
      }
      return next;
    });
  };

  // ── 提交 ──
  const toggleOptimize = (on: boolean) => {
    setOptimizeOn(on);
    writeOptimizePref(on);
  };

  /** 发起智能优化。重试时如果上一次的结果不明（断网 / 5xx），沿用同一个 clientRequestId，免得扣两次。 */
  const startOptimization = (reuseRequestId: string | null) => {
    setSubmitError(null);
    setSubmitNote(null);
    const request = buildOptimizationRequest(model, draftWith(prompt, null), reuseRequestId ?? newClientRequestId());
    optimization.start(request);
  };

  const submitGeneration = async (promptText: string, optimizationId: string | null, source: SubmitErrorState["source"]) => {
    if (submittingRef.current || generationBlocked) return;
    if (preflightFor(promptText).length > 0) {
      setAttempted(true);
      if (seedInvalid) setAdvancedOpen(true);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitNote(null);
    try {
      const request = buildJobRequest(model, draftWith(promptText, optimizationId));
      const job = await VideoStudioApi.submitJob(request);
      onSubmitted(job);
      setAttempted(false);
      if (source === "panel") optimization.dismiss();
      setSubmitNote("已提交，进度会显示在生成记录里");
      void refreshWallet();
    } catch (e) {
      setSubmitError({ message: errorMessage(e, "提交失败，请稍后重试"), topUp: isPaymentRequired(e), source });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  /** 底部的主按钮：勾了智能优化就先优化（「优化并继续」），没勾直接生成。 */
  const handlePrimary = () => {
    if (submittingRef.current || blocked) return;
    if (problems.length > 0) {
      setAttempted(true);
      if (seedInvalid) setAdvancedOpen(true);
      return;
    }
    if (optimizeOn) startOptimization(null);
    else void submitGeneration(prompt, null, "footer");
  };

  const retryOptimization = () => {
    if (generationBlocked || optPrice === null) return;
    if (problems.length > 0) {
      setAttempted(true);
      if (seedInvalid) setAdvancedOpen(true);
      return;
    }
    startOptimization(optView.phase === "failed" ? optView.reuseRequestId : null);
  };

  const needsFrames = !!modeSpec && (modeSpec.needsFirstFrame || modeSpec.needsLastFrame);
  const walletNeed = (price?.total ?? 0) + (optimizeOn && optPrice ? optPrice : 0);
  const panelSubmitError = submitError?.source === "panel" ? submitError : null;
  const footerSubmitError = submitError?.source === "footer" ? submitError : null;

  return (
    <FormCard>
      <div ref={formTopRef} className="scroll-mt-4" />
      {/* 做同款 */}
      {templateState ? (
        <div className="flex min-w-0 flex-col gap-1 rounded-t-[15px] bg-violet-50 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Copy className="h-3.5 w-3.5 shrink-0 text-violet-600" />
            <span
              className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-violet-700"
              title={`正在做同款：${templateState.title}`}
            >
              正在做同款：{templateState.title}
            </span>
            <button
              type="button"
              onClick={exitTemplate}
              className="mobile-touch-target shrink-0 rounded-full px-2 py-0.5 text-[12px] text-violet-700 underline underline-offset-2 hover:bg-violet-100"
            >
              不做同款了
            </button>
          </div>
          {templateState.modelUnavailable ? (
            <p className="text-[11.5px] leading-relaxed text-violet-700/80">
              原作用的模型现在用不了，已换成「{model.name}」，报价按它来算
            </p>
          ) : null}
        </div>
      ) : null}

      {/* 模型 */}
      <FormSection
        title="模型"
        extra={modelsLoading ? <Loader2 className="h-3 w-3 animate-spin text-zinc-400" aria-label="正在刷新模型信息" /> : null}
      >
        {models.length > 1 ? (
          <Select
            value={effectiveChoice}
            onValueChange={(v) => {
              setModelChoice(v);
              setModelGoneNote(null);
            }}
          >
            <SelectTrigger
              aria-label="选择模型"
              className="h-9 w-full min-w-0 rounded-[10px] border-zinc-300 bg-zinc-100 text-[13px] text-zinc-800 focus:border-violet-500 focus:ring-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m, i) => (
                <SelectItem key={modelKey(m, i)} value={modelKey(m, i)}>
                  {m.name}
                  {m.isDefault ? "（默认）" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="truncate text-[14px] font-semibold text-zinc-900" title={model.name}>
            {model.name}
          </div>
        )}
        <div className="truncate font-mono text-[11px] tabular-nums text-zinc-500" title={pricingSummary(model, sel.mode)}>
          {pricingSummary(model, sel.mode)}
        </div>
        {modelGoneNote ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-amber-700">
            {modelGoneNote}
          </p>
        ) : null}
        {modelsError ? <AiErrorNotice title="模型信息刷新失败" message={modelsError} onRetry={onRetryModels} /> : null}
      </FormSection>

      {/* 生成模式 */}
      <FormSection title="生成模式">
        <div className="grid grid-cols-2 gap-2">
          {contract.modes.map((m) => {
            const selected = m.mode === sel.mode;
            const label = VIDEO_STUDIO_MODE_LABEL[m.mode] ?? "其他模式";
            const desc = VIDEO_STUDIO_MODE_DESC[m.mode] ?? "";
            return (
              <ChoiceButton
                key={m.mode}
                selected={selected}
                onClick={() => update({ mode: m.mode })}
                title={desc ? `${label}：${desc}` : label}
              >
                <span className="block truncate text-[13px] font-semibold">{label}</span>
                {desc ? (
                  <span
                    className={cn(
                      "mt-0.5 line-clamp-2 text-[11px] leading-snug",
                      selected ? "text-violet-600" : "text-zinc-500",
                    )}
                  >
                    {desc}
                  </span>
                ) : null}
              </ChoiceButton>
            );
          })}
        </div>
      </FormSection>

      {/* 素材：首帧 / 尾帧 */}
      {needsFrames && modeSpec ? (
        <FormSection title="素材">
          <div className="grid grid-cols-2 gap-3">
            {modeSpec.needsFirstFrame ? (
              <FrameSlot
                label={FRAME_LABEL.first}
                state={frames.first}
                limit={frameLimit}
                targetAspect={sel.aspectRatio}
                onPick={(f) => void pickFrame("first", f)}
                onRemove={() => removeFrame("first")}
              />
            ) : null}
            {modeSpec.needsLastFrame ? (
              <FrameSlot
                label={FRAME_LABEL.last}
                state={frames.last}
                limit={frameLimit}
                targetAspect={sel.aspectRatio}
                onPick={(f) => void pickFrame("last", f)}
                onRemove={() => removeFrame("last")}
              />
            ) : (
              <p className="self-center text-[11.5px] leading-relaxed text-zinc-500">
                首帧就是视频的第一个画面，之后画面怎么动，写在提示词里。
              </p>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400">图片比例和下面选的画面比例一致时，效果最好。</p>
        </FormSection>
      ) : null}

      {/* 素材：全能参考 */}
      {refRules ? (
        <FormSection title="参考素材">
          <ReferencePanel
            rules={refRules}
            lists={refLists}
            tab={refTab}
            pricing={model.pricing}
            notices={refNotices}
            onTabChange={setRefTab}
            onAdd={addReferences}
            onMove={moveReference}
            onReplace={replaceReference}
            onRemove={removeReference}
            onDismissNotice={(id) => setRefNotices((prev) => prev.filter((n) => n.id !== id))}
          />
        </FormSection>
      ) : null}

      {/* 提示词 + 智能优化 */}
      <FormSection title="提示词">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            readOnly={panelOpen}
            rows={5}
            aria-label="提示词"
            aria-invalid={promptOver}
            title={panelOpen ? "智能优化进行中，提示词先锁住；在下面选好用哪一版之后就能改" : undefined}
            placeholder={VIDEO_STUDIO_PROMPT_PLACEHOLDER[sel.mode] ?? "描述想要的画面"}
            className={cn(
              "block min-h-[120px] w-full resize-y rounded-[10px] border bg-zinc-100 px-3 pb-7 pt-2.5 text-[13.5px] leading-relaxed text-zinc-900 outline-none",
              "transition-[border-color,box-shadow,background-color] placeholder:text-zinc-400 focus:bg-white focus:shadow-[0_0_0_3px_var(--accent-soft)]",
              promptOver ? "border-rose-400 focus:border-rose-400" : "border-zinc-300 focus:border-violet-500",
              panelOpen && "cursor-default text-zinc-500 focus:bg-zinc-100 focus:shadow-none",
            )}
          />
          <span
            className={cn(
              "pointer-events-none absolute bottom-2 right-3 font-mono text-[11px] tabular-nums",
              promptOver ? "text-rose-600" : "text-zinc-400",
            )}
          >
            {promptChars} / {contract.promptMaxChars}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400">
            {panelOpen ? "智能优化进行中，提示词先锁住" : ""}
          </span>
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12.5px] text-zinc-700" title={VIDEO_STUDIO_OPTIMIZE_HINT}>
            <input
              type="checkbox"
              checked={optimizeOn}
              onChange={(e) => toggleOptimize(e.target.checked)}
              className="h-4 w-4 accent-violet-500"
            />
            <Wand2 className="h-3.5 w-3.5 text-violet-600" />
            智能优化
          </label>
        </div>
        <OptimizePanel
          view={optView}
          promptMaxChars={contract.promptMaxChars}
          submitting={submitting}
          submitError={panelSubmitError}
          problems={panelOpen ? shownProblems.map((p) => p.message) : []}
          onDraftChange={optimization.setDraft}
          onToggleOriginal={optimization.toggleOriginal}
          onUseOptimized={() => {
            if (optView.phase === "succeeded") void submitGeneration(optView.draft, optView.optimization.id, "panel");
          }}
          onUseOriginal={() => void submitGeneration(prompt, null, "panel")}
          onRetry={retryOptimization}
          onDismiss={optimization.dismiss}
          blockedReason={generationBlocked}
        />
      </FormSection>

      {/* 规格 */}
      <FormSection title="规格">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-zinc-700">清晰度</span>
          <div className="grid auto-cols-fr grid-flow-col gap-2">
            {contract.tiers.map((t) => {
              const perSecond = perSecondPrice(model.pricing, sel.mode, t.tier);
              const selected = t.tier === sel.resolutionTier;
              return (
                <ChoiceButton
                  key={t.tier}
                  selected={selected}
                  onClick={() =>
                    update({ resolutionTier: t.tier, aspectRatio: aspectForTier(contract, t.tier, sel.aspectRatio) })
                  }
                  className="text-center"
                >
                  <span className="block font-mono text-[13px] font-semibold">{tierLabel(t.tier)}</span>
                  <span
                    className={cn(
                      "block font-mono text-[10.5px] tabular-nums",
                      perSecond === null ? "text-zinc-400" : selected ? "text-violet-600" : "text-zinc-500",
                    )}
                  >
                    {perSecond === null ? "暂未定价" : `${formatCredits(perSecond)} 积分/秒`}
                  </span>
                </ChoiceButton>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-zinc-700">画面比例</span>
          <div className="grid grid-cols-2 gap-2">
            {(tier?.canvases ?? []).map((c) => (
              <ChoiceButton
                key={c.aspectRatio}
                selected={c.aspectRatio === sel.aspectRatio}
                onClick={() => update({ aspectRatio: c.aspectRatio })}
                title={canvasLabel(c)}
                className="flex items-center gap-2 px-2.5"
              >
                <AspectGlyph width={c.width} height={c.height} />
                <span className="min-w-0 truncate font-mono text-[12px] tabular-nums">{canvasLabel(c)}</span>
              </ChoiceButton>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center">
            <span className="text-[12px] font-medium text-zinc-700">时长</span>
            <span className="ml-auto font-mono text-[13px] font-semibold tabular-nums text-zinc-900">{sel.seconds} 秒</span>
          </div>
          <input
            type="range"
            min={contract.minSeconds}
            max={contract.maxSeconds}
            step={1}
            value={sel.seconds}
            onChange={(e) => update({ seconds: Number(e.target.value) })}
            disabled={contract.minSeconds >= contract.maxSeconds}
            aria-label="时长（秒）"
            className="h-6 w-full cursor-pointer accent-violet-500 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between font-mono text-[10.5px] tabular-nums text-zinc-400">
            <span>{contract.minSeconds} 秒</span>
            <span>{contract.maxSeconds} 秒</span>
          </div>
        </div>
      </FormSection>

      {/* 高级 */}
      <section className="border-t border-zinc-200 px-4 py-3">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          className="flex w-full min-w-0 items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        >
          <span className="eyebrow">高级</span>
          {!advancedOpen && seed !== null ? (
            <span
              className={cn("min-w-0 truncate font-mono text-[11px]", seedInvalid ? "text-rose-600" : "text-zinc-500")}
              title={`随机种子 ${seedText.trim()}`}
            >
              种子 {seedText.trim()}
            </span>
          ) : null}
          <ChevronDown
            className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform", advancedOpen && "rotate-180")}
          />
        </button>
        {advancedOpen ? (
          <div className="mt-3 flex flex-col gap-1.5">
            <label htmlFor={seedInputId} className="text-[12px] font-medium text-zinc-700">
              随机种子
            </label>
            <input
              id={seedInputId}
              inputMode="numeric"
              autoComplete="off"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              placeholder="留空就是随机"
              aria-invalid={seedInvalid}
              className={cn(
                "h-9 w-full rounded-[10px] border bg-zinc-100 px-3 font-mono text-[13px] tabular-nums text-zinc-900 outline-none",
                "transition-[border-color,box-shadow,background-color] placeholder:font-sans placeholder:text-zinc-400 focus:bg-white focus:shadow-[0_0_0_3px_var(--accent-soft)]",
                seedInvalid ? "border-rose-400 focus:border-rose-400" : "border-zinc-300 focus:border-violet-500",
              )}
            />
            <p className="text-[11px] leading-relaxed text-zinc-500">
              填 0 到 {contract.seedMax} 之间的整数。其他参数不变、种子相同，出来的画面会更接近。
            </p>
          </div>
        ) : null}
      </section>

      {/* 报价 + 按钮 */}
      <div className="flex flex-col gap-2.5 rounded-b-[15px] border-t border-zinc-200 bg-zinc-50 px-4 py-4">
        <QuoteLine price={price} unavailable={!!modelsError} optimizeOn={optimizeOn} optPrice={optPrice} />
        {price && wallet && walletNeed > wallet.totalBalance ? (
          <p className="text-[11.5px] leading-relaxed text-amber-700">
            当前可用 {formatCredits(wallet.totalBalance)} 积分，不够这一条。
            <Link href="/wallet" className="ml-1 font-medium underline underline-offset-2">
              去充值
            </Link>
          </p>
        ) : null}

        {shownProblems.length > 0 && !panelOpen ? (
          <ul
            role="alert"
            className="flex flex-col gap-1 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[12px] leading-relaxed text-rose-600"
          >
            {shownProblems.map((p, i) => (
              <li key={`${p.code}-${i}`} className="break-words">
                {p.message}
              </li>
            ))}
          </ul>
        ) : null}

        {footerSubmitError ? (
          <div className="flex flex-col gap-1.5">
            <AiErrorNotice title="没有提交成功" message={footerSubmitError.message} />
            {footerSubmitError.topUp ? (
              <Link href="/wallet" className="self-start text-[12px] font-medium text-violet-600 hover:text-violet-700">
                去积分钱包充值
              </Link>
            ) : null}
          </div>
        ) : null}

        {submitNote ? (
          <div
            role="status"
            className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-600"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{submitNote}</span>
            {onShowJobs ? (
              <button type="button" onClick={onShowJobs} className="shrink-0 font-medium underline underline-offset-2">
                去看看
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handlePrimary}
          disabled={submitting || !!blocked}
          title={blocked ?? undefined}
          className={cn(
            "mobile-touch-target inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border-b border-violet-600 bg-violet-500 px-5 text-[14px] font-medium text-white transition-colors",
            "hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500",
            "disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-400",
          )}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : optimizeOn ? (
            <Wand2 className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {submitting ? "提交中…" : uploadsInFlight ? "素材上传中…" : optimizeOn ? "优化并继续" : "生成"}
        </button>
        {blocked && !uploadsInFlight ? <p className="text-center text-[11px] text-zinc-500">{blocked}</p> : null}
      </div>
    </FormCard>
  );
}

/**
 * 报价：「预计 200 积分（40 积分/秒 × 5 秒）」；勾了智能优化写成
 * 「智能优化 2 积分 · 生成预计 200 积分」（优化不收费就写「智能优化不收费」）；全能参考图多了再加一行加价说明。
 */
function QuoteLine({
  price,
  unavailable,
  optimizeOn,
  optPrice,
}: {
  price: VideoStudioQuote | null;
  unavailable: boolean;
  optimizeOn: boolean;
  optPrice: number | null;
}) {
  if (unavailable) {
    return <p className="text-[12px] text-zinc-500">模型信息加载成功后显示报价</p>;
  }
  if (!price) {
    return <p className="text-[12px] text-rose-600">这个规格还没定价，暂时不能生成，可以换个清晰度或模式试试</p>;
  }
  const optText = !optimizeOn
    ? null
    : optPrice === null
      ? "智能优化暂时没有报价"
      : optPrice === 0
        ? "智能优化不收费"
        : `智能优化 ${formatCredits(optPrice)} 积分`;
  const extraLine =
    price.extraImages > 0
      ? price.freeRefImages > 0
        ? `第 ${price.freeRefImages + 1} 张图起每张 +${formatCredits(price.extraPerImagePerSecond)} 积分/秒，这次多了 ${price.extraImages} 张`
        : `每张图 +${formatCredits(price.extraPerImagePerSecond)} 积分/秒，这次 ${price.extraImages} 张`
      : null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[13px] text-zinc-700">
        {optText ? (
          <>
            {optText}
            <span className="text-zinc-300"> · </span>生成预计{" "}
          </>
        ) : (
          "预计 "
        )}
        <strong className="font-mono text-[16px] font-semibold tabular-nums text-zinc-900">{formatCredits(price.total)}</strong>{" "}
        积分
        <span className="text-zinc-500">
          （{formatCredits(price.perSecond)} 积分/秒 × {price.seconds} 秒）
        </span>
      </p>
      {extraLine ? <p className="text-[11.5px] text-zinc-500">{extraLine}</p> : null}
      <p className="text-[11px] text-zinc-400">
        {optimizeOn && optPrice ? "智能优化和生成分开扣。" : ""}提交时先冻结，成功才扣，失败全部退回。
      </p>
    </div>
  );
}

/** 画面比例按钮左边的小方框，按比例画。 */
function AspectGlyph({ width, height }: { width: number; height: number }) {
  const max = 14;
  const r = width > 0 && height > 0 ? width / height : 1;
  const w = r >= 1 ? max : Math.max(4, Math.round(max * r));
  const h = r >= 1 ? Math.max(4, Math.round(max / r)) : max;
  return (
    <span aria-hidden className="flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="rounded-[2px] border-[1.5px] border-current" style={{ width: w, height: h }} />
    </span>
  );
}
