"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, notFound, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Wand2,
  Zap,
  Info,
  Crown,
  AlertTriangle,
  Plus,
  Minus,
  ChevronRight,
  ChevronDown,
  Film,
  ShoppingBag,
  Package,
  ExternalLink,
  CheckCircle2,
  Lock,
  X as XIcon,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@ai-star-eco/ui/ui/collapsible";
import { nanoid } from "nanoid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Separator } from "@/components/mixcut-zone/ui/separator";
import { Slider } from "@/components/mixcut-zone/ui/slider";
import { RadioGroup, RadioGroupItem } from "@ai-star-eco/ui/ui/radio-group";
import { Checkbox } from "@ai-star-eco/ui/ui/checkbox";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { SceneFlowEditor } from "@/components/mixcut-zone/scene-flow-editor";
import { SlotInput } from "@/components/mixcut-zone/slot-input";
import { StickerPoolPicker } from "@/components/mixcut-zone/sticker-pool-picker";
import { ProductPickerDialog } from "@/components/celebrity-zone/ProductPickerDialog";
import type { Product } from "@ai-star-eco/types/product";
import { mockTemplates } from "@/mocks/mixcut";
import { MixcutApi, ProductsApi } from "@/api";
import type {
  SlotBinding,
  PerturbationProfile,
  RenderJob,
  RenderOutput,
  PerturbationOverrides,
  SlotSnapshot,
  SceneSnapshot,
  SlotPerturbationPolicy,
  StickerPoolBinding,
  Template,
  MixcutAsset,
  TemplateSlot,
} from "@/components/mixcut-zone/types";
import { PROFILE_LABELS, PROFILE_DESCRIPTIONS, TIER_LABELS } from "@/constants/mixcut-ui";
import { cn, formatNumber } from "@/components/mixcut-zone/lib/utils";
import { resolvePolicy } from "@/components/mixcut-zone/lib/perturbation-defaults";
import { flatSlotsOf, flatSlotsAbsolute, orientationLabel, totalDuration } from "@/components/mixcut-zone/lib/scene-helpers";
import { useConfirm } from "@/components/common/confirm-dialog";
import { useCelebrityShell } from "@/lib/celebrity-shell-context";
import { formatCredits } from "@ai-star-eco/api-client/format";

/**
 * v0.33+: 单变体积分价（与 server MixcutJobService.MIXCUT_PER_VARIANT_COST_DEFAULT 同步）。
 * 真值在 server PlatformConfig key=mixcut.credit-per-variant；admin 修改后前端常量需同步更新。
 * 实际 hold 由 server 计算，前端展示与 server 不一致时 server 会按真值扣（前端值仅用于 UI 预估）。
 */
const MIXCUT_CREDIT_PER_VARIANT = 30;

// ─── v0.26+ 商品启发式 slot 绑定 ──────────────────────────────────────────────
//
// 当用户从商品库点「生成视频」进入 create 页（URL ?product_id=X）时，
// 按以下规则自动填 slot bindings（**仅覆盖** prev 中未绑或绑 fixed 的 slot，
// 用户已经改过的 user_input default / library / upload 一律不动）：
//
//   layer_type=image + slot 标签命中 product|商品|图|cover|poster
//     → { source: "upload", file_url: assets[0]?.file_url }（无素材则跳过）
//   fill_strategy=picgen_text
//     → { source: "picgen", title: product.name, subtitle: shorten(sellingPoints), tag: category }
//   layer_type=text + fill_strategy=user_input + 命中 title|标题|name
//     → { source: "input", text: product.name }
//   layer_type=text + fill_strategy=user_input + 命中 point|卖点|desc|描述|subtitle
//     → { source: "input", text: product.sellingPoints || product.name }
//
// 启发式命中纯靠 slot_id / label 的子串匹配；模板命名规范越好，命中率越高。
// 不命中的 slot 保持空，用户照常手动填。

function shortenText(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

function isProductImageSlot(s: TemplateSlot): boolean {
  if (s.layer_type !== "image") return false;
  const haystack = `${s.slot_id} ${s.label ?? ""}`.toLowerCase();
  return /product|商品|图|cover|poster|main|hero/.test(haystack);
}

function isTitleSlot(s: TemplateSlot): boolean {
  const haystack = `${s.slot_id} ${s.label ?? ""}`.toLowerCase();
  return /title|标题|name|名称/.test(haystack);
}

function isSellingPointsSlot(s: TemplateSlot): boolean {
  const haystack = `${s.slot_id} ${s.label ?? ""}`.toLowerCase();
  return /point|卖点|desc|描述|subtitle|副标题|文案/.test(haystack);
}

function applyProductHeuristics(
  prev: Record<string, SlotBinding>,
  template: Template,
  product: Product,
  assets: MixcutAsset[],
): Record<string, SlotBinding> {
  const next: Record<string, SlotBinding> = { ...prev };
  const flatSlots: TemplateSlot[] = template.scenes.flatMap((sc) => sc.slots);

  // 收集产品图素材（subkind=product-photo 或 kind=image 且 related_product_id 命中）
  const productImages = assets.filter((a) => a.kind === "image");

  for (const slot of flatSlots) {
    const existing = next[slot.slot_id];
    // 只覆盖未绑或绑 fixed 的 slot
    if (existing && existing.source !== "fixed") continue;

    // 1) 商品图槽位
    if (isProductImageSlot(slot)) {
      const asset = productImages[0];
      if (asset) {
        next[slot.slot_id] = {
          source: "library",
          asset_id: asset.id,
          preview_url: asset.file_url,
        };
        continue;
      }
      // 没素材时回退到 product.images[0]（外网 URL 直接作 file_url）
      if (product.images.length > 0) {
        next[slot.slot_id] = {
          source: "upload",
          file_url: product.images[0],
        };
      }
      continue;
    }

    // 2) picgen 文字转图 slot —— 强类型语义：title + subtitle + tag 一起塞
    if (slot.fill_strategy === "picgen_text") {
      next[slot.slot_id] = {
        source: "picgen",
        title: product.name,
        subtitle: shortenText(product.sellingPoints, 30),
        tag: product.category,
      };
      continue;
    }

    // 3) user_input 文本 slot：按 label 启发命中标题 / 卖点
    if (slot.layer_type === "text" && slot.fill_strategy === "user_input") {
      if (isTitleSlot(slot)) {
        next[slot.slot_id] = { source: "input", text: product.name };
        continue;
      }
      if (isSellingPointsSlot(slot)) {
        next[slot.slot_id] = {
          source: "input",
          text: product.sellingPoints || product.name,
        };
        continue;
      }
    }
  }
  return next;
}

export function CreateClient({ id }: { id: string }) {
  const router = useRouter();
  const code = MixcutApi.mockActivationCode;
  // SSR 没有 localStorage,只能看工厂模板;client hydration 后异步补一次,把用户编辑覆盖回来
  const [template, setTemplate] = useState(
    () => mockTemplates.find((t) => t.template_id === id) ?? null
  );
  const [resolved, setResolved] = useState(false);

  // 所有 hook 必须在 early-return 之前(Rules of Hooks)
  const [bindings, setBindings] = useState<Record<string, SlotBinding>>(() => {
    if (!template) return {};
    const initial: Record<string, SlotBinding> = {};
    flatSlotsOf(template).forEach((s) => {
      if (s.fill_strategy === "user_input" && s.default_value) {
        initial[s.slot_id] = { source: "input", text: s.default_value };
      } else if (s.fill_strategy === "fixed") {
        initial[s.slot_id] = { source: "fixed" };
      }
    });
    return initial;
  });
  const [focusedSlot, setFocusedSlot] = useState<string | null>(null);
  const [profile, setProfile] = useState<PerturbationProfile>(
    () => template?.perturbation_profile ?? "moderate"
  );
  const [variants, setVariants] = useState(() => template?.output_variants_default ?? 5);
  // v0.28+ polish C: 变体预览 Card 已移除（左栏画布已经是主视觉，不再单独叠 v1/v2/v3 缩略行）
  const [submitting, setSubmitting] = useState(false);
  const [overrides, setOverrides] = useState<Required<PerturbationOverrides>>({
    allow_mirror: true,
    allow_speed: true,
    allow_brightness: true,
    allow_saturation: true,
    allow_position_jitter: true,
    allow_scale_jitter: true,
  });
  const [slotPolicies, setSlotPolicies] = useState<Record<string, Partial<SlotPerturbationPolicy>>>({});
  /** v0.13+: 全局扰动贴图池绑定（写到 sticker_pool["_global"]）。MVP 不做 slot 级 UI。 */
  const [stickerPool, setStickerPool] = useState<StickerPoolBinding | undefined>(undefined);
  /**
   * v0.24+: 关联商品（showcase MVP）—— 纯展示，不绑定到 RenderJob，不自动填充任何 slot。
   * 用户挑一条商品作为本次混剪的参考资料，方便照着填到标题/描述等素材槽里。
   * 提交后 state 自然丢弃。未来若要绑定到任务侧落库，需要在 RenderJob / MixcutRenderJob 加 productId 列。
   */
  const [linkedProduct, setLinkedProduct] = useState<Product | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  /**
   * v0.26+: 从商品库点「生成视频」进入时（URL ?product_id=X），异步拉取的关联素材列表。
   * 用于自动 slot 绑定（applyProductHeuristics）+ 顶部 chip 展示「素材 N 张」+
   * SlotInput library mode 顶部「本商品」过滤 chip（未来）。
   */
  const [productAssets, setProductAssets] = useState<MixcutAsset[]>([]);
  /**
   * v0.26+: 当前正在画布上预览的场景索引。
   * - 用户点上方场景 tab 直接切；点中列某个 slot input 时也会自动跳到该 slot 所属场景。
   * - 单场景模板（scenes.length === 1）下永远是 0，tab 条不渲染，行为与旧版一致。
   */
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const initFromTemplateRef = useRef(false);
  const productAutoFillRef = useRef(false);
  const { confirm, ConfirmHost } = useConfirm();

  // v0.26+: 从商品库「生成视频」入口带过来的 product_id（可空）
  const searchParams = useSearchParams();
  const productIdFromUrl = searchParams?.get("product_id") ?? null;

  useEffect(() => {
    MixcutApi.getTemplate(id).then((t) => {
      if (t) setTemplate(t);
      setResolved(true);
    });
  }, [id]);

  // 当 template 首次变为非空(localStorage 覆盖加载到)时,把 bindings / profile / variants
  // 重新用模板里的默认值 seed 一次。只跑一次,之后用户改了的就不再覆盖。
  //
  // ⚠ 声明顺序：此 effect 必须在下面的「商品自动填」effect 之前，因为后者依赖
  // `initFromTemplateRef.current === true`。React 按声明顺序运行 effect；同一 commit
  // 里两个 effect 都被 template 触发，若顺序反过来，商品 effect 会先看到 ref=false 而提前 return，
  // 之后 ref 翻 true 也不会重新触发它（ref 不在 deps 里、template 也没再变），自动填永远不发生。
  useEffect(() => {
    if (!template || initFromTemplateRef.current) return;
    initFromTemplateRef.current = true;
    const initial: Record<string, SlotBinding> = {};
    flatSlotsOf(template).forEach((s) => {
      if (s.fill_strategy === "user_input" && s.default_value) {
        initial[s.slot_id] = { source: "input", text: s.default_value };
      } else if (s.fill_strategy === "fixed") {
        initial[s.slot_id] = { source: "fixed" };
      }
    });
    setBindings(initial);
    setProfile(template.perturbation_profile);
    setVariants(template.output_variants_default);
  }, [template]);

  /**
   * v0.26+: 当 product_id 在 URL 中 + 模板已加载 + 模板默认绑定也已就位时，
   * 并发拉取 product + 关联素材，按启发式规则把 slot bindings 自动填上。
   * 仅运行一次（productAutoFillRef 守卫），用户清除后不重跑。
   */
  useEffect(() => {
    if (!productIdFromUrl || !template || productAutoFillRef.current) return;
    // 等 initFromTemplateRef 跑过（拿到模板默认 bindings 后再覆盖）
    if (!initFromTemplateRef.current) return;
    productAutoFillRef.current = true;
    Promise.all([
      ProductsApi.getProduct(productIdFromUrl),
      MixcutApi.listAssets({ relatedProductId: productIdFromUrl }),
    ])
      .then(([p, assets]) => {
        if (!p) return;
        setLinkedProduct(p);
        setProductAssets(assets ?? []);
        setBindings((prev) => applyProductHeuristics(prev, template, p, assets ?? []));
      })
      .catch(() => {
        // 失败静默，用户仍可手动填
      });
  }, [productIdFromUrl, template]);

  // v0.26+: 用户在中列点开某个 slot 的 input → 画布自动跳到该 slot 所在场景。
  // 让"我在填的内容"和"画布上正在显示的画面"始终对齐，避免用户编辑 scene 3 的标题
  // 但画布锁在 scene 1 看不到效果。
  useEffect(() => {
    if (!focusedSlot || !template) return;
    const idx = template.scenes.findIndex((sc) =>
      sc.slots.some((s) => s.slot_id === focusedSlot),
    );
    if (idx >= 0 && idx !== activeSceneIdx) setActiveSceneIdx(idx);
    // activeSceneIdx 不进依赖 —— 我们只在 focusedSlot 改变时主动跳；
    // 用户点 tab 主动切场景时不应被这个 effect 反推回去。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedSlot, template]);

  if (resolved && !template) notFound();
  if (!template) {
    return (
      <div className="px-6 lg:px-8 py-12 max-w-[1600px] mx-auto text-center text-muted-foreground text-sm">
        加载中…
      </div>
    );
  }

  const handlePolicyChange = (slotId: string, next: Partial<SlotPerturbationPolicy>) => {
    setSlotPolicies((prev) => {
      const out = { ...prev };
      if (Object.keys(next).length === 0) delete out[slotId];
      else out[slotId] = next;
      return out;
    });
  };

  const allSlots = flatSlotsOf(template);
  const editableSlots = allSlots.filter((s) => s.user_editable);
  const requiredSlots = editableSlots.filter((s) => s.required);

  // v0.26+: 画布预览专用 —— 把模板收窄到「仅当前选中场景」，避免多场景 slot rect 全部叠加在
  // 同一画框里。clamp activeSceneIdx 防止模板异步加载完后越界。
  const safeSceneIdx = Math.min(activeSceneIdx, Math.max(0, template.scenes.length - 1));
  const activeScene = template.scenes[safeSceneIdx];
  const sceneStartOffset = template.scenes.slice(0, safeSceneIdx).reduce((acc, s) => acc + s.duration, 0);
  const previewTemplate = activeScene
    ? {
        ...template,
        canvas: { ...template.canvas, duration: activeScene.duration },
        scenes: [activeScene],
      }
    : template;
  const handleSelectScene = (idx: number) => {
    setActiveSceneIdx(idx);
    setFocusedSlot(null);
    // 同步把中列对应场景块滚到视口顶部，方便用户在 input 区直接看到对应场景的素材位
    const target = template.scenes[idx];
    if (target && typeof document !== "undefined") {
      const el = document.getElementById(`scene-block-${target.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const isBound = (slotId: string) => {
    const b = bindings[slotId];
    return b && ((b.source === "input" && b.text.trim()) || b.source === "library" || b.source === "upload");
  };
  const filledRequired = requiredSlots.filter((s) => isBound(s.slot_id));
  const allRequiredFilled = filledRequired.length === requiredSlots.length;

  // v0.27+: 每个场景的必填进度 —— 给场景 tab 显示 dot（done / partial / empty / none）。
  // 仅按必填项计算；optional 没填不影响"该段已就绪"语义。
  const sceneProgress = template.scenes.map((sc) => {
    const sceneRequired = sc.slots.filter((s) => s.user_editable && s.required);
    const sceneFilled = sceneRequired.filter((s) => isBound(s.slot_id));
    return {
      total: sceneRequired.length,
      filled: sceneFilled.length,
      state:
        sceneRequired.length === 0
          ? ("none" as const)
          : sceneFilled.length === sceneRequired.length
            ? ("done" as const)
            : sceneFilled.length > 0
              ? ("partial" as const)
              : ("empty" as const),
    };
  });

  // v0.23: 没绑视频会触发后端 demo-fallback（用 showreel-*.mp4 兜底），用户会以为
  // "没用我的视频"。在提交前明确给一次确认，模板里所有 layer_type=video 的 user_editable
  // 槽位（不管 required 标）只要为空就提醒。
  const unboundVideoSlots = allSlots.filter(
    (s) => s.layer_type === "video" && s.user_editable && !isBound(s.slot_id),
  );

  const handleSlotChange = (slotId: string, b: SlotBinding | undefined) => {
    setBindings((prev) => {
      const next = { ...prev };
      if (b) next[slotId] = b;
      else delete next[slotId];
      return next;
    });
  };

  const quotaRemaining = code.monthly_quota - code.quota_used_this_period;
  const overQuota = variants > quotaRemaining;
  // v0.33+: 真扣费预估 + 余额预检
  const { wallet: walletBalance } = useCelebrityShell();
  const creditCost = variants * MIXCUT_CREDIT_PER_VARIANT;
  const available = walletBalance?.totalBalance ?? 0;
  const insufficientCredits = walletBalance != null && available < creditCost;

  const handleSubmit = async () => {
    if (!allRequiredFilled || overQuota || insufficientCredits) return;

    // v0.23: 视频位空 → 后端会用 demo 兜底；给一次明确确认避免"为啥用的不是我的视频"。
    if (unboundVideoSlots.length > 0) {
      const names = unboundVideoSlots.map((s) => s.label || s.slot_id).join("、");
      const ok = await confirm({
        title: `还有 ${unboundVideoSlots.length} 个视频位未上传`,
        description: (
          <>
            <p>未上传素材的视频位：<b>{names}</b>。</p>
            <p className="mt-1 text-rose-600">
              继续生成会用演示视频替代这些位置，最终成片不是你自己的视频。
            </p>
          </>
        ),
        confirmText: "仍然生成",
        cancelText: "回去补上传",
      });
      if (!ok) return;
    }

    setSubmitting(true);
    const jobId = `job_${nanoid(8)}`;

    // 模板快照:flat 化 scenes,time_range 转为绝对秒数,后端按 flat list 渲染
    const slotsSnapshot: SlotSnapshot[] = flatSlotsAbsolute(template).map((s) => {
      const userOverride = slotPolicies[s.slot_id];
      // layer_type 默认 ∪ 模板覆盖 ∪ 用户覆盖(最高优先级)
      const merged: Partial<SlotPerturbationPolicy> = {
        ...(s.perturbation_policy ?? {}),
        ...(userOverride ?? {}),
      };
      return {
        slot_id: s.slot_id,
        layer_type: s.layer_type,
        rect: s.rect,
        z_index: s.z_index,
        perturbation_policy: resolvePolicy(s.layer_type, merged),
        fit: s.fit ?? "cover",
        // v0.25+: 携带绝对 time_range，让渲染器把 overlay 限制在对应场景时段
        time_range: s.time_range,
      };
    });

    // v0.25+: 场景快照（按顺序）。渲染器据此按 scenes.length 拼接、按 scene.duration_sec 切段。
    const scenesSnapshot: SceneSnapshot[] = template.scenes.map((sc) => ({
      id: sc.id,
      label: sc.label,
      duration_sec: sc.duration,
      slot_ids: sc.slots.map((s) => s.slot_id),
    }));

    const job: RenderJob = {
      id: jobId,
      user_id: "u1",
      template_id: template.template_id,
      template_name: template.name,
      template_thumbnail: template.metadata.thumbnail_url,
      slot_bindings: bindings,
      perturbation_profile: profile,
      output_variants: variants,
      status: "queued",
      progress: 0,
      created_at: new Date().toISOString(),
      canvas_snapshot: {
        width: template.canvas.width,
        height: template.canvas.height,
        fps: template.canvas.fps,
      },
      slots_snapshot: slotsSnapshot,
      scenes_snapshot: scenesSnapshot,
      perturbation_overrides: overrides,
      sticker_pool: stickerPool ? { _global: stickerPool } : undefined,
      // v0.26+: 把商品关联透传到 RenderJob，让分发抽屉能反查 product 自动填挂载字段
      product_id: linkedProduct?.id,
    };
    await MixcutApi.createJob(job);

    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);

    // mock 模式才跑前端模拟器；REAL_BACKEND 下进度由真后端 ffmpeg worker 写库，
    // 详情页轮询拿到真实状态。若两边同时跑，前端 PATCH 会覆盖真后端进度，
    // 导致「卡在 90%」+ 真后端已 failed 但前端仍显示 running。
    if (MixcutApi.isMockMode()) {
      let p = 0;
      const timer = setInterval(() => {
        p = Math.min(100, p + Math.floor(Math.random() * 12 + 6));
        if (p < 100) {
          MixcutApi.updateJobProgress(jobId, p, "running");
        } else {
          clearInterval(timer);
          const outputs: RenderOutput[] = Array.from({ length: variants }).map((_, i) => ({
            id: `out_${jobId}_${i}`,
            job_id: jobId,
            variant_index: i,
            file_url: "",
            thumbnail_url: "",
            file_size: 1_400_000 + i * 87_000,
            duration: template.canvas.duration,
            phash_signature: `mock_${i}`,
            phash_distance_to_source: 10 + Math.floor(Math.random() * 8),
            applied_transforms: {
              mirror: i % 2 === 1,
              speed: 1 + ((i % 3) - 1) * 0.05,
              brightness: ((i % 3) - 1) * 0.04,
              saturation: 1 + ((i % 3) - 1) * 0.06,
              variant: i + 1,
            },
            watermark_token: `wm_${jobId}_${i}`,
            created_at: new Date().toISOString(),
          }));
          MixcutApi.completeJobInMock(jobId, outputs);
        }
      }, 700);
    }

    router.push(`/mixcut/jobs/${jobId}`);
  };

  /** v0.26+: 清除商品关联，重置 bindings 到模板默认。 */
  const clearLinkedProduct = () => {
    setLinkedProduct(null);
    setProductAssets([]);
    // 重置 bindings 到模板默认（与 init effect 同逻辑）
    if (template) {
      const initial: Record<string, SlotBinding> = {};
      flatSlotsOf(template).forEach((s) => {
        if (s.fill_strategy === "user_input" && s.default_value) {
          initial[s.slot_id] = { source: "input", text: s.default_value };
        } else if (s.fill_strategy === "fixed") {
          initial[s.slot_id] = { source: "fixed" };
        }
      });
      setBindings(initial);
    }
    // 允许下次重新带入（用户主动清除后，按钮可再次工作）
    productAutoFillRef.current = false;
  };

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/mixcut/templates/${template.template_id}`}>
            <ArrowLeft className="size-4" /> 返回模板详情
          </Link>
        </Button>
      </div>

      {/*
        v0.30+ polish: 页面 hero —— 任务名称 / 描述 / 模板规格 chips 全部抬到顶部，
        符合「正常任务页」结构。原本它落在右栏顶部，与中列 slot 编辑区视觉上分离，
        scroll 时立刻被推走；放到顶部、sticky toolbar 之上后变成长存的"我在做什么"上下文。
      */}
      <header className="mb-5">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>新建生成任务</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{template.metadata.category}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="inline-flex items-center gap-0.5 normal-case tracking-normal">
            <Lock className="size-3" />
            {TIER_LABELS[template.metadata.required_tier]}
          </span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-[26px] font-semibold tracking-tight leading-tight">
              {template.name}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              按提示填好各段素材，一次出 {variants} 条差异化视频
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] tabular-nums">
            <span className="rounded-md border border-border bg-card px-2 py-1 text-muted-foreground">
              {orientationLabel(template.canvas.width, template.canvas.height).split(" · ")[0]}
            </span>
            <span className="rounded-md border border-border bg-card px-2 py-1 text-muted-foreground">
              {template.canvas.width}×{template.canvas.height}
            </span>
            <span className="rounded-md border border-border bg-card px-2 py-1 text-muted-foreground">
              {totalDuration(template)} 秒
            </span>
            {template.scenes.length > 1 && (
              <span className="rounded-md border border-border bg-card px-2 py-1 text-muted-foreground">
                {template.scenes.length} 段
              </span>
            )}
            <span className="rounded-md border border-violet-400/40 bg-violet-500/[0.07] px-2 py-1 text-violet-700">
              <span className="font-semibold">{editableSlots.length}</span> 处可填
            </span>
          </div>
        </div>
      </header>

      {/*
        v0.28+ polish C: 整页顶部 sticky toolbar —— 把原右栏 ②「设置并生成」整张卡片
        ((数量 / 差异度 / 消耗 / CTA) 压平到一条横向工具栏，永远可见。释放右栏 340px，
        中列「填素材」操作区域因此扩到 1fr。
        - 进度 chip / 数量 stepper + presets / 差异度 / 消耗 / CTA：单行扫读
        - overQuota 时下方挂一条 amber 警告条
      */}
      <div className="sticky top-0 z-20 -mx-6 lg:-mx-8 mb-5 border-y border-border bg-background/92 backdrop-blur-md">
        <div className="px-6 lg:px-8 py-2.5 flex items-center gap-3 flex-wrap">
          {requiredSlots.length > 0 && (
            <div
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium tabular-nums flex items-center gap-1.5 border shrink-0",
                allRequiredFilled
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-700",
              )}
            >
              {allRequiredFilled ? (
                <>
                  <CheckCircle2 className="size-3" />
                  必填都填完
                </>
              ) : (
                <>
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  还差 {requiredSlots.length - filledRequired.length} 项必填
                </>
              )}
            </div>
          )}

          <div className="h-5 w-px bg-border/60 hidden md:block" />

          {/* 数量 stepper（紧凑横向）*/}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">生成</span>
            <Button
              variant="outline"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => setVariants((v) => Math.max(1, v - 1))}
            >
              <Minus className="size-3" />
            </Button>
            <span className="text-base font-semibold tabular-nums w-7 text-center">{variants}</span>
            <Button
              variant="outline"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => setVariants((v) => Math.min(20, v + 1))}
            >
              <Plus className="size-3" />
            </Button>
            <span className="text-[11px] text-muted-foreground">条</span>
            {/* preset 快捷选 */}
            <div className="hidden md:flex items-center gap-0.5 ml-1.5">
              {[3, 5, 10, 20].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariants(v)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] tabular-nums transition-colors",
                    variants === v
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="h-5 w-px bg-border/60 hidden md:block" />

          {/* 差异度 segmented control */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">差异度</span>
            <div className="flex items-center rounded-md border border-border bg-card p-0.5">
              {(["light", "moderate", "aggressive"] as PerturbationProfile[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProfile(p)}
                  title={PROFILE_DESCRIPTIONS[p]}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap",
                    profile === p
                      ? "bg-foreground text-background font-medium"
                      : "text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  {PROFILE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* 消耗 / 出片预估 —— 中宽度起显示 */}
          <div className="hidden xl:flex items-center gap-3 text-[11px] tabular-nums ml-1">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">将消耗</span>
              <span
                className={cn(
                  "font-mono font-medium",
                  insufficientCredits ? "text-rose-600" : "text-foreground",
                )}
                title={`${variants} × ${MIXCUT_CREDIT_PER_VARIANT} 积分/条`}
              >
                {creditCost}
              </span>
              <span className="text-muted-foreground">积分</span>
            </div>
            <span className="text-muted-foreground/60">·</span>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>余额</span>
              <span className={cn("font-mono", insufficientCredits && "text-rose-600 font-semibold")}>
                {walletBalance ? formatCredits(available) : "—"}
              </span>
            </div>
            <span className="text-muted-foreground/60">·</span>
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>出片 ≈</span>
              <span className="font-mono">{Math.ceil((variants * 25) / 60)}</span>
              <span>分钟</span>
            </div>
            <span className="text-muted-foreground/60">·</span>
            <div className={cn("font-mono", overQuota && "text-rose-600 font-semibold")}>
              月余 {formatNumber(quotaRemaining)}
            </div>
          </div>

          {/* 主 CTA：贴最右 */}
          <Button
            variant="gradient"
            size="default"
            className="ml-auto h-9 px-5 shrink-0"
            disabled={!allRequiredFilled || overQuota || insufficientCredits || submitting}
            onClick={handleSubmit}
            title={insufficientCredits ? `积分不足：需要 ${creditCost}，当前可用 ${available}` : undefined}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                提交中…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                生成 {variants} 条视频
              </>
            )}
          </Button>
        </div>

        {overQuota && (
          <div className="px-6 lg:px-8 py-1.5 bg-rose-500/10 border-t border-rose-500/20 flex items-center gap-2 text-[11px] text-rose-700">
            <AlertTriangle className="size-3 shrink-0" />
            本月剩余额度 {formatNumber(quotaRemaining)} 不够生成 {variants} 条，请减少数量或升级套餐
          </div>
        )}
        {insufficientCredits && !overQuota && (
          <div className="px-6 lg:px-8 py-1.5 bg-rose-500/10 border-t border-rose-500/20 flex items-center gap-2 text-[11px] text-rose-700">
            <AlertTriangle className="size-3 shrink-0" />
            积分不足：本次需 {creditCost} 积分，当前余额 {formatCredits(available)}。
            <Link href="/wallet" className="ml-1 underline">前往充值</Link>
          </div>
        )}
      </div>

      {/* v0.26+: 从商品库带入时顶部 chip 给可见反馈 + 一键清除 */}
      {linkedProduct && productIdFromUrl && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/[0.04] px-3 py-2 text-xs">
          <Package className="h-3.5 w-3.5 text-violet-600 shrink-0" />
          <span className="text-zinc-700">已从商品库带入：</span>
          <span className="font-medium text-zinc-900">{linkedProduct.name}</span>
          {linkedProduct.priceCents != null && (
            <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-zinc-600 tabular-nums">
              ¥{(linkedProduct.priceCents / 100).toFixed(2).replace(/\.00$/, "")}
            </span>
          )}
          {linkedProduct.commissionRate != null && (
            <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700">
              佣金 {linkedProduct.commissionRate}%
            </span>
          )}
          {productAssets.length > 0 && (
            <span className="text-[11px] text-zinc-500">· 关联素材 {productAssets.length} 张</span>
          )}
          <button
            type="button"
            onClick={clearLinkedProduct}
            className="ml-auto inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-600 hover:border-pink-400/40 hover:text-pink-600"
          >
            <XIcon className="h-3 w-3" /> 清除并重置
          </button>
        </div>
      )}

      {/*
        v0.30+ polish: 场景流程独占一行，贯穿全宽（不再塞在画布上方 440px 子列里被挤成一半）。
        这条与 templates/[id] 详情页一致 —— 场景流程是横向时间轴，宽度越大越能读出"哪段占多长"。
        canvas 仍按竖屏占左栏 440px，与场景流程上下解耦，互不挤压。
      */}
      {template.scenes.length > 1 && (
        <div className="mb-5">
          <SceneFlowEditor
            scenes={template.scenes}
            canvas={template.canvas}
            currentIdx={safeSceneIdx}
            editing={false}
            progress={sceneProgress}
            onSelect={handleSelectScene}
            onAddAt={() => {}}
            onRemove={() => {}}
            onChange={() => {}}
            onMoveTo={() => {}}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-6">
        {/*
          v0.28+ polish C 左栏：画布焦点化
          - 场景流程已上移到全宽行（见上方），左栏只剩画布主视觉
          - TemplatePreview 加重外框（ring-2 violet/20 + 阴影），强化主视觉
          - 底部 meta bar 显示当前段时间窗 + 必填进度
          - sticky top 改 68 给顶部 toolbar 让位
        */}
        <div className="lg:sticky lg:top-[68px] self-start space-y-3">
          {/* 画布主视觉：加重外框 + 底部 meta bar 一体 */}
          <div className="rounded-xl border-2 border-violet-500/20 overflow-hidden bg-card shadow-md">
            <TemplatePreview
              template={previewTemplate}
              bindings={bindings}
              selectedSlotId={focusedSlot}
              onSelectSlot={setFocusedSlot}
              frameStyle="blueprint"
              focusDim
            />
            {activeScene && (
              <div className="px-3.5 py-2 border-t bg-secondary/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      sceneProgress[safeSceneIdx].state === "done"
                        ? "bg-emerald-500"
                        : sceneProgress[safeSceneIdx].state === "partial"
                          ? "bg-amber-400 animate-pulse"
                          : sceneProgress[safeSceneIdx].state === "empty"
                            ? "bg-rose-400/80"
                            : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="text-[11px] text-foreground/80 truncate">
                    {template.scenes.length > 1 ? `第 ${safeSceneIdx + 1} 段 · ${activeScene.label}` : activeScene.label}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
                  {sceneStartOffset.toFixed(0)}s ~ {(sceneStartOffset + activeScene.duration).toFixed(0)}s
                  {sceneProgress[safeSceneIdx].total > 0 && (
                    <span
                      className={cn(
                        "ml-2",
                        sceneProgress[safeSceneIdx].state === "done"
                          ? "text-emerald-600"
                          : sceneProgress[safeSceneIdx].state === "partial"
                            ? "text-amber-600"
                            : "text-rose-600",
                      )}
                    >
                      · 必填 {sceneProgress[safeSceneIdx].filled}/{sceneProgress[safeSceneIdx].total}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
            点击画布上的素材位 → 中列对应输入框聚焦；切换场景 → 画布同步显示该段
          </p>
        </div>

        <div className="space-y-4 min-w-0">
          {/* slim header 已上移到页面顶层（hero 区域）— v0.30 起作为页面长存的"我在做什么"上下文。*/}

          {/*
            v0.22+: 多场景模板按 scene 分组渲染。
            旧实现 `editableSlots.map(...)` 把所有场景的 slot 平铺成一个列表，用户无法分辨
            "第 1 段标题" vs "第 2 段标题"（尤其当 slot.label 相同时），是致命的 UX bug。
            修复：遍历 template.scenes，每个 scene 出一个 header（label / 时长 / 偏移 / 编号），
            scene 内才铺它自己的 editable slots。
            React key 用 `${scene.id}::${slot_id}` 避免 slot_id 在场景间撞 key 时 React 复用错节点。
          */}
          {(() => {
            let offset = 0;
            const blocks: React.ReactNode[] = [];
            const multiScene = template.scenes.length > 1;
            template.scenes.forEach((scene, sceneIdx) => {
              const sceneEditable = scene.slots.filter((s) => s.user_editable);
              const sceneFixedCount = scene.slots.length - sceneEditable.length;
              const startOffset = offset;
              offset += scene.duration;
              if (sceneEditable.length === 0 && sceneFixedCount === 0) return;
              const isActiveScene = multiScene && sceneIdx === safeSceneIdx;
              blocks.push(
                <div
                  key={scene.id}
                  id={`scene-block-${scene.id}`}
                  className={cn(
                    "space-y-3 scroll-mt-24",
                    // v0.26+: 当前正在画布上预览的场景在中列加一道紫色描边 + 浅色底，
                    // 让"我在填的内容"和"画布显示的内容"视觉上对齐
                    isActiveScene && "rounded-lg ring-1 ring-violet-500/40 bg-violet-500/[0.03] p-3 -mx-3",
                  )}
                >
                  {multiScene && (
                    <button
                      type="button"
                      onClick={() => handleSelectScene(sceneIdx)}
                      className="flex items-center gap-2 pt-2 first:pt-0 w-full text-left hover:opacity-80 transition-opacity"
                    >
                      <div
                        className={cn(
                          "size-7 rounded-md grid place-items-center shrink-0",
                          isActiveScene ? "bg-violet-500 text-white" : "bg-violet-500/10 text-violet-500",
                        )}
                      >
                        <Film className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold tracking-tight truncate">
                          第 {sceneIdx + 1} 段 · {scene.label}
                          {isActiveScene && (
                            <span className="ml-2 text-[10px] font-normal text-violet-500">画布正在显示</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {startOffset.toFixed(0)}s ~ {offset.toFixed(0)}s · 时长 {scene.duration}s
                          {sceneEditable.length > 0 && ` · ${sceneEditable.length} 个素材位`}
                          {sceneFixedCount > 0 && ` · ${sceneFixedCount} 处固定内容`}
                        </div>
                      </div>
                    </button>
                  )}
                  {sceneEditable.map((s) => (
                    <div key={`${scene.id}::${s.slot_id}`} id={`slot-${s.slot_id}`}>
                      <SlotInput
                        slot={s}
                        binding={bindings[s.slot_id]}
                        onChange={(b) => handleSlotChange(s.slot_id, b)}
                        focused={focusedSlot === s.slot_id}
                        onFocus={() => setFocusedSlot(s.slot_id)}
                        policyOverride={slotPolicies[s.slot_id]}
                        onPolicyChange={(next) => handlePolicyChange(s.slot_id, next)}
                        globalOverrides={overrides}
                        canvasWidth={template.canvas.width}
                        canvasHeight={template.canvas.height}
                        productId={productIdFromUrl ?? undefined}
                      />
                    </div>
                  ))}
                  {sceneEditable.length === 0 && multiScene && sceneFixedCount > 0 && (
                    <div className="text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 py-2 border border-dashed border-border">
                      本段全部为固定内容（如品牌条），系统自动填，你不用管。
                    </div>
                  )}
                </div>
              );
            });
            return blocks;
          })()}

          {/* slot_id 在多场景间唯一性自检：撞 id 会导致 bindings 共用同一 key，
              用户填 A 段标题就把 B 段标题也覆盖掉。模板编辑器用 nanoid 生成新 slot_id，
              但老模板 / 复制场景 / 手编 JSON 可能出现重复，这里给个显式 warning。 */}
          {(() => {
            const ids = allSlots.map((s) => s.slot_id);
            const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
            if (dups.length === 0) return null;
            const unique = Array.from(new Set(dups));
            return (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-3 flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 leading-relaxed">
                    检测到 {unique.length} 个 slot_id 在多个场景里重复（{unique.slice(0, 3).join(" / ")}
                    {unique.length > 3 ? ` 等` : ""}），同名 slot 的素材会互相覆盖。
                    请回到模板编辑页改成唯一 id。
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {template.scenes.length === 1 && allSlots.some((s) => !s.user_editable) && (
            <Card className="bg-secondary/30 border-dashed">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Info className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    本模板还有 {allSlots.filter((s) => !s.user_editable).length} 处固定内容(如品牌条),系统会自动填,你不用管。
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/*
            v0.28+ polish C: 右栏整段移除，「高级处理 / 关联商品 / Pro 加速」迁回中列底部
            （3 张 collapsible/banner，整体收起时仅占 ~150px 高，展开时不挤压必填编辑区）。
            数量 / 差异度 / CTA / 消耗 全部进入顶部 sticky toolbar，不再有 ② 大卡。
          */}
          <div className="pt-5 mt-3 border-t border-border/50 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
                进阶配置
              </div>
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-[10px] text-muted-foreground/60">可选 · 默认收起</span>
            </div>

            {/* ─── 折叠卡：高级处理（默认收起；变更时摘要里反映状态）─── */}
          <Collapsible>
            <div className="rounded-lg border bg-card overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-secondary/30 transition-colors group">
                <div className="flex items-center gap-2 min-w-0">
                  <Wand2 className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium">高级处理</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums truncate">
                    画面 {Object.values(overrides).filter(Boolean).length}/6
                    {stickerPool && " · 贴图池已启用"}
                  </span>
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t">
                  {/* —— 整段画面 —— */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      整段画面 · 对全片生效
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {([
                        { key: "allow_mirror", label: "左右翻转", hint: "整段画面镜像翻转，提升差异度" },
                        { key: "allow_speed", label: "微调速度", hint: "随机加速/减速 ±20%，听感几乎察觉不到" },
                        { key: "allow_brightness", label: "亮度微调", hint: "轻微变亮/变暗，视觉无感" },
                        { key: "allow_saturation", label: "色彩微调", hint: "颜色饱和度小幅起伏" },
                      ] as const).map((it) => (
                        <label
                          key={it.key}
                          title={it.hint}
                          className={cn(
                            "flex items-center justify-between gap-2 px-2 py-1.5 rounded border cursor-pointer select-none transition-colors text-xs",
                            "border-transparent text-foreground hover:bg-secondary/40",
                            "has-[[data-state=checked]]:border-border has-[[data-state=checked]]:bg-secondary/30",
                          )}
                        >
                          <span>{it.label}</span>
                          <Checkbox
                            checked={overrides[it.key]}
                            onCheckedChange={(v) =>
                              setOverrides((p) => ({ ...p, [it.key]: v === true }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* —— 逐素材抖动 —— */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      逐素材抖动 · 每个素材独立微动
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {([
                        { key: "allow_position_jitter", label: "位置抖动", hint: "每个素材在画面里位置小幅漂移" },
                        { key: "allow_scale_jitter", label: "缩放抖动", hint: "每个素材尺寸 ±5% 起伏" },
                      ] as const).map((it) => (
                        <label
                          key={it.key}
                          title={it.hint}
                          className={cn(
                            "flex items-center justify-between gap-2 px-2 py-1.5 rounded border cursor-pointer select-none transition-colors text-xs",
                            "border-transparent text-foreground hover:bg-secondary/40",
                            "has-[[data-state=checked]]:border-border has-[[data-state=checked]]:bg-secondary/30",
                          )}
                        >
                          <span>{it.label}</span>
                          <Checkbox
                            checked={overrides[it.key]}
                            onCheckedChange={(v) =>
                              setOverrides((p) => ({ ...p, [it.key]: v === true }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    关闭后这一批不会做对应处理。文字 / 贴图 / 商品图按模板规则保留正向与原尺寸，不会被翻转或抖动。
                  </p>

                  <Separator />

                  {/* —— 动态贴图（迁自中列）—— */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        动态贴图
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        每条视频随机选择
                      </span>
                    </div>
                    <StickerPoolPicker
                      value={stickerPool}
                      onChange={setStickerPool}
                      label="选择贴图"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* ─── 折叠卡：关联商品（选填，迁自中列）─── */}
          <Collapsible defaultOpen={!!linkedProduct}>
            <div className="rounded-lg border bg-card overflow-hidden">
              <CollapsibleTrigger className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-secondary/30 transition-colors group">
                <div className="flex items-center gap-2 min-w-0">
                  <ShoppingBag className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium">关联商品</span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {linkedProduct ? linkedProduct.name : "选填 · 仅做参考"}
                  </span>
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                <div className="px-3.5 pb-3.5 pt-2 border-t">
                  {linkedProduct ? (
                    <div className="space-y-2">
                      <div className="flex gap-2.5">
                        <div className="size-16 shrink-0 overflow-hidden rounded-md border border-border bg-secondary/30">
                          {linkedProduct.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={linkedProduct.images[0]}
                              alt={linkedProduct.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                              {linkedProduct.category}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="text-xs font-medium truncate">{linkedProduct.name}</div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="muted" className="text-[9px] h-4 px-1.5">
                              {linkedProduct.category}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              已引用 {linkedProduct.usageCount} 次
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                            {linkedProduct.sellingPoints || "（暂无卖点描述）"}
                          </p>
                          {linkedProduct.link ? (
                            <a
                              href={linkedProduct.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-violet-600 hover:underline"
                            >
                              <ExternalLink className="size-2.5" />
                              查看商品页
                            </a>
                          ) : (
                            <p className="text-[10px] text-amber-600">该商品未填链接</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px] flex-1"
                          onClick={() => setProductPickerOpen(true)}
                        >
                          更换
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] text-muted-foreground"
                          onClick={() => setLinkedProduct(null)}
                        >
                          <XIcon className="size-3" />
                          清除
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setProductPickerOpen(true)}
                      className="w-full rounded-md border border-dashed border-border bg-secondary/20 px-3 py-3 text-left transition-colors hover:border-violet-400 hover:bg-violet-500/5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-md bg-violet-500/10 text-violet-500 grid place-items-center shrink-0">
                          <Package className="size-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium">从商品库选择</div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                            挑一个商品作为参考，名称 / 卖点会显示在这里，方便填到标题、描述里
                          </p>
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

            {/* ─── Pro 速度（最低优先级，仍保留作为升级提示）─── */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-50/30 px-3 py-2 flex items-center gap-2 text-[11px]">
              <Zap className="size-3.5 text-amber-600 shrink-0" />
              <span className="text-foreground/80">渲染加速 · 队列优先 ≥60%</span>
              <Badge variant="brand" className="text-[9px] h-4 px-1.5 ml-auto shrink-0">
                <Crown className="size-2.5" /> Pro
              </Badge>
            </div>
          </div>
        </div>
      </div>
      <ConfirmHost />
      <ProductPickerDialog
        open={productPickerOpen}
        onOpenChange={setProductPickerOpen}
        onPick={(p) => setLinkedProduct(p)}
      />
    </div>
  );
}
