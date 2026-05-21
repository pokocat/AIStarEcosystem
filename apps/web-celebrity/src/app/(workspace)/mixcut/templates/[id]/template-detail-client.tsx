"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Layers,
  Tag,
  CheckCircle2,
  Lock,
  ChevronRight,
  Pencil,
  Save,
  Copy,
  X,
  Plus,
  Trash2,
  AlertCircle,
  RotateCcw,
  MoreHorizontal,
  Sliders,
  Info,
} from "lucide-react";
import { notFound } from "next/navigation";
import { nanoid } from "nanoid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Input } from "@/components/mixcut-zone/ui/input";
import { Label } from "@/components/mixcut-zone/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";
import { Separator } from "@/components/mixcut-zone/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@ai-star-eco/ui/ui/dropdown-menu";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { MixcutApi } from "@/api";
import { mockTemplates } from "@/mocks/mixcut";
import {
  PROFILE_LABELS,
  PROFILE_DESCRIPTIONS,
  TIER_LABELS,
  LAYER_LABELS,
  FILL_STRATEGY_LABELS,
} from "@/constants/mixcut-ui";
import {
  cn,
  describeRect,
  describeTimeRange,
} from "@/components/mixcut-zone/lib/utils";
import type {
  Template,
  TemplateScene,
  TemplateSlot,
  LayerType,
  FillStrategy,
  SlotPerturbationPolicy,
} from "@/components/mixcut-zone/types";
import { flatSlotsOf, totalDuration } from "@/components/mixcut-zone/lib/scene-helpers";
import { SceneFlowEditor } from "@/components/mixcut-zone/scene-flow-editor";
import { SlotPolicyEditor } from "@/components/mixcut-zone/slot-policy-editor";

// SlotPolicyEditor 在模板编辑里不存在"任务级算子总开关",传 6 个全开占位
const POLICY_NO_KILL: Required<import("@/components/mixcut-zone/types").PerturbationOverrides> = {
  allow_mirror: true,
  allow_speed: true,
  allow_brightness: true,
  allow_saturation: true,
  allow_position_jitter: true,
  allow_scale_jitter: true,
};

const LAYER_OPTIONS: ReadonlyArray<{ value: LayerType; label: string }> = [
  { value: "video", label: "视频" },
  { value: "image", label: "图片" },
  { value: "text", label: "文字" },
  { value: "audio", label: "音频" },
];
const FILL_OPTIONS: ReadonlyArray<{ value: FillStrategy; label: string }> = [
  { value: "fixed", label: "系统固定" },
  { value: "library_select", label: "从素材库选" },
  { value: "user_upload", label: "自己上传" },
  { value: "user_input", label: "手动填写" },
  { value: "api_generated", label: "AI 数字人" },
  { value: "picgen_text", label: "AI 文字图（picgen）" },
  { value: "variable_binding", label: "跟随变量" },
];

// 每种内容类型可以走哪些填充方式 —— UI 用来过滤、自动联动 fill_strategy。
// text 不能走 user_upload / library_select，否则渲染层会出现 "文字"chip + 上传按钮的矛盾 UI。
const FILL_BY_LAYER: Record<LayerType, FillStrategy[]> = {
  video: ["user_upload", "library_select", "api_generated", "fixed"],
  image: ["user_upload", "library_select", "picgen_text", "api_generated", "fixed"],
  text: ["user_input", "picgen_text", "variable_binding", "fixed"],
  audio: ["user_upload", "library_select", "fixed"],
};

function allowedFillsFor(layer: LayerType): FillStrategy[] {
  return FILL_BY_LAYER[layer] ?? FILL_BY_LAYER.image;
}

/** layer 变化时给个合理的默认 fill。已有的 fill 还合法就保留，否则取首选。 */
function reconcileFill(currentFill: FillStrategy, nextLayer: LayerType): FillStrategy {
  const allowed = allowedFillsFor(nextLayer);
  return allowed.includes(currentFill) ? currentFill : allowed[0];
}

/**
 * 校验整个模板的 slot.time_range：
 *   - start ≥ 0
 *   - end > start
 *   - end ≤ 所在 scene 的 duration
 * 返回错误数组（每条带 scene 标签 + slot 名），数组为空即合法。
 * 在保存前 gating 用；按场景遍历，避免某个被改过的 scene duration 把别的场景里的 stale slot 也漏掉。
 */
function validateTimeRanges(tpl: Template): string[] {
  const errors: string[] = [];
  tpl.scenes.forEach((scene) => {
    scene.slots.forEach((s) => {
      const [a, b] = s.time_range;
      const slotName = s.label || s.slot_id;
      if (!(b > a)) {
        errors.push(`场景「${scene.label}」· ${slotName}：结束时间必须大于开始时间`);
      } else if (b > scene.duration + 1e-6) {
        errors.push(
          `场景「${scene.label}」· ${slotName}：结束时间 ${b}s 超过本场景时长 ${scene.duration}s`
        );
      } else if (a < 0) {
        errors.push(`场景「${scene.label}」· ${slotName}：开始时间不能小于 0`);
      }
    });
  });
  return errors;
}

type ConfirmModalState = {
  title: string;
  body: string;
  confirmText?: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => void;
};

// 画布尺寸预设。按"成片画面比例"分类，不按发布平台 —— 因为 9:16 在抖音 / 快手 /
// 视频号 / B 站全部通吃，没必要重复列 4 张同尺寸卡。
// 数值是真实输出像素（ffmpeg 编码分辨率，非 CSS 逻辑像素）。
// 设计删减历史（v0.23）：
//   - drop "iPhone 15/14 Pro" / "iPhone Pro Max" —— 那是设备视口分辨率，无平台接收
//   - drop "Android 主流 1080×2400" —— 与"长竖版"完全同尺寸
//   - drop "标清竖版 720×1280" —— 1080p 是当前事实最低，要降清晰度可用下方自定义
//   - merge "抖音/快手" + "视频号/B站"（都是 1080×1920）成"竖版 9:16"
const CANVAS_PRESETS: { label: string; w: number; h: number; sub: string }[] = [
  { label: "竖版",   w: 1080, h: 1920, sub: "1080×1920 · 9:16  (抖音 / 快手 / 视频号 / B 站)" },
  { label: "长竖版", w: 1080, h: 2400, sub: "1080×2400 · 9:20  (抖音长视频 / Android 全面屏)" },
  { label: "小红书", w: 1080, h: 1350, sub: "1080×1350 · 4:5" },
  { label: "方形",   w: 1080, h: 1080, sub: "1080×1080 · 1:1" },
  { label: "横屏",   w: 1920, h: 1080, sub: "1920×1080 · 16:9" },
];

export function TemplateDetailClient({
  id,
  initialEdit = false,
  legacyEditQuery = false,
  mode = "view",
}: {
  id: string;
  /** /edit 路由传 true 自动进入编辑态。?edit=1 旧 query 也兼容。 */
  initialEdit?: boolean;
  legacyEditQuery?: boolean;
  /**
   * v0.21+：mode="new" 时使用内存默认模板，**不调 server**；
   * 第一次保存才会真正落库（避免空模板残留在列表里）。
   */
  mode?: "view" | "new";
}) {
  const router = useRouter();
  const isNewMode = mode === "new";
  // new 模式自动进编辑；view 模式沿用 /edit 路由 / ?edit=1 query
  const wantEdit = isNewMode || initialEdit || legacyEditQuery;
  // new 模式：用内存默认模板（不落库）
  // view 模式：SSR 看工厂模板，client hydration 升级到用户覆盖版本
  const freshTemplate = useMemo<Template | null>(() => {
    if (!isNewMode) return null;
    const newId = `tpl_${nanoid(8)}`;
    return {
      template_id: newId,
      name: "未命名模板",
      version: "0.1",
      canvas: {
        width: 1080,
        height: 1920,
        duration: 15,
        fps: 30,
        background_color: "#000000",
      },
      scenes: [{ id: `scene_${nanoid(6)}`, label: "全片", duration: 15, slots: [] }],
      perturbation_profile: "moderate",
      output_variants_default: 5,
      quality_gate: { min_phash_distance: 10, max_retries: 3 },
      metadata: { category: "未分类", tags: [], required_tier: "basic" },
    };
  }, [isNewMode]);
  const [template, setTemplate] = useState<Template | null>(
    () => freshTemplate ?? mockTemplates.find((t) => t.template_id === id) ?? null,
  );
  const [resolved, setResolved] = useState(isNewMode);
  const [autoEditApplied, setAutoEditApplied] = useState(false); // 防 ?edit=1 重复触发
  const [working, setWorking] = useState<Template | null>(null); // edit-mode working copy
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const [previewVariant, setPreviewVariant] = useState<number | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [hasUserTemplate, setHasUserTemplate] = useState(false);
  // 模板配置面板（画布 + 属性，inline 展开），默认收起
  const [templateMetaOpen, setTemplateMetaOpen] = useState(false);
  // 确认对话框:replace native confirm() (P3 polish)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  useEffect(() => {
    // new 模式跳过 server 取数：直接使用内存默认模板，避免落库
    if (isNewMode) return;
    MixcutApi.getTemplate(id).then((t) => {
      setTemplate(t);
      setHasUserTemplate(t?.is_factory === false || MixcutApi.hasUserTemplate(id));
      setResolved(true);
    });
  }, [id, isNewMode]);

  // ?edit=1 落地:模板取到后立刻进入编辑态,并把 URL 上的 query 清掉(避免刷新再次触发)
  useEffect(() => {
    if (!wantEdit || autoEditApplied || !template) return;
    setWorking(structuredClone(template));
    setEditing(true);
    setAutoEditApplied(true);
    // 旧 ?edit=1 query 才清掉(避免刷新重复触发)。/edit 路由保持 URL 不动,刷新就是编辑态。
    if (!initialEdit && legacyEditQuery) {
      router.replace(`/mixcut/templates/${id}`, { scroll: false });
    }
  }, [wantEdit, autoEditApplied, template, id, router, initialEdit, legacyEditQuery]);

  // useMemo 必须在所有 early-return 之前 —— 避免 Rules of Hooks 违规
  const display: Template | null = editing && working ? working : template;
  const flatSlots = useMemo(() => (display ? flatSlotsOf(display) : []), [display]);
  // 脏检查:working 与 template 的 JSON 是否一致。便宜可靠,适合模板这种小对象。
  const dirty = useMemo(() => {
    if (!editing || !working || !template) return false;
    return JSON.stringify(working) !== JSON.stringify(template);
  }, [editing, working, template]);
  // 时间范围校验：编辑中实时算，保存前 gating 用。
  const timeRangeErrors = useMemo(
    () => (editing && working ? validateTimeRanges(working) : []),
    [editing, working],
  );
  const hasValidationError = timeRangeErrors.length > 0;

  // 内容位 drag-reorder 状态(仅当前场景内有效)
  const [slotDragSrc, setSlotDragSrc] = useState<number | null>(null);
  const [slotDragOverGap, setSlotDragOverGap] = useState<number | null>(null);

  // 退出编辑前(刷新 / 关页 / 返回)若有未保存改动,浏览器原生确认拦截
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (resolved && template === null) notFound();
  if (template === null || display === null) {
    return (
      <div className="px-6 lg:px-8 py-12 max-w-[1600px] mx-auto text-center text-muted-foreground text-sm">
        加载中…
      </div>
    );
  }

  // 当前激活场景 (clamp 到合法范围,防止越界)
  const sceneIdx = Math.min(selectedSceneIdx, Math.max(0, display.scenes.length - 1));
  const currentScene: TemplateScene | undefined = display.scenes[sceneIdx];
  const currentSceneSlots = currentScene?.slots ?? [];
  const slot = flatSlots.find((s) => s.slot_id === selectedSlot);
  const editableSlots = flatSlots.filter((s) => s.user_editable);
  const requiredSlots = editableSlots.filter((s) => s.required);
  const hasFactoryBase = MixcutApi.isFactoryTemplate(template.template_id);
  const isFactory = template.is_factory ?? hasFactoryBase;
  const canDeleteTemplate = !isFactory || hasUserTemplate;
  const deleteRestoresFactoryBase = hasFactoryBase && !isFactory;

  const enterEdit = () => {
    setWorking(structuredClone(template));
    setEditing(true);
  };

  const cancelEdit = () => {
    const reallyExit = () => {
      setWorking(null);
      setEditing(false);
      setSelectedSlot(null);
      setSaveError(null);
      // new 模式或 /edit 路由都走「返回模板列表」；草稿不保留任何痕迹
      if (isNewMode) {
        router.push("/mixcut/templates");
      } else if (initialEdit) {
        router.push(`/mixcut/templates/${id}`);
      }
    };
    // new 模式从空白起：working 与 template 完全相同（structuredClone 的），
    // 但只要场景/槽位/名字被改过就视为脏
    const isDirty =
      editing && working && template
        ? JSON.stringify(working) !== JSON.stringify(template)
        : false;
    if (isDirty) {
      setConfirmModal({
        title: isNewMode ? "放弃新建?" : "退出编辑?",
        body: isNewMode
          ? "当前还没保存，离开后输入会丢失。"
          : "你有未保存的修改,退出后会丢失。",
        onConfirm: reallyExit,
      });
    } else {
      reallyExit();
    }
  };

  const resetWorking = () => {
    setConfirmModal({
      title: "放弃当前修改?",
      body: "未保存的改动会丢失,恢复为已保存版本。",
      onConfirm: () => {
        if (template) setWorking(structuredClone(template));
      },
    });
  };

  const handleSave = async () => {
    if (!working) return;
    if (hasValidationError) {
      setSaveError(timeRangeErrors[0]);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await MixcutApi.saveTemplate(working);
      setTemplate(updated);
      setWorking(structuredClone(updated));
      setHasUserTemplate(true);
      setSavedAt(Date.now());
      // new 模式：保存成功后跳到真实详情页（沿用编辑态，让用户能继续完善）
      if (isNewMode) {
        router.replace(`/mixcut/templates/${updated.template_id}/edit`);
      }
    } catch (e: any) {
      setSaveError(e?.message ?? "保存失败,请检查网络或重试");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAs = async () => {
    if (!working) return;
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const newId = `tpl_${nanoid(8)}`;
      const clone: Template = {
        ...working,
        template_id: newId,
        name,
        // 版本号简单递增:基础版 v1.0
        version: "1.0",
      };
      await MixcutApi.saveTemplate(clone);
      router.push(`/mixcut/templates/${newId}`);
    } finally {
      setSaving(false);
      setSaveAsOpen(false);
      setNewName("");
    }
  };

  const handleDeleteTemplate = async () => {
    if (!template || !canDeleteTemplate) return;
    const targetId = template.template_id;
    const targetRestoresFactoryBase = MixcutApi.isFactoryTemplate(targetId);
    setSaving(true);
    setSaveError(null);
    try {
      const deleted = await MixcutApi.deleteTemplate(targetId);
      if (!deleted) {
        setHasUserTemplate(MixcutApi.hasUserTemplate(targetId));
        setSaveError(targetRestoresFactoryBase ? "当前没有可删除的我的版本" : "删除失败,模板可能已被删除");
        return;
      }

      if (targetRestoresFactoryBase) {
        const restored = await MixcutApi.getTemplate(targetId);
        if (restored) {
          setTemplate(restored);
        }
        setHasUserTemplate(false);
        setWorking(null);
        setEditing(false);
        setSelectedSlot(null);
        setSavedAt(null);
        if (initialEdit) router.push(`/mixcut/templates/${targetId}`);
        return;
      }

      router.push("/mixcut/templates");
    } catch (e: any) {
      setSaveError(e?.message ?? "删除失败,请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteTemplate = () => {
    if (!template || !canDeleteTemplate) return;
    setConfirmModal({
      title: deleteRestoresFactoryBase ? "删除我的版本?" : "删除此模板?",
      body: deleteRestoresFactoryBase
        ? "只会删除你保存的本地版本,之后恢复显示工厂模板原版。当前未保存修改也会丢失。"
        : "删除后无法恢复。历史生成任务不会被删除,但之后不能再用这个模板创建新任务。",
      confirmText: "删除",
      confirmVariant: "destructive",
      onConfirm: () => {
        void handleDeleteTemplate();
      },
    });
  };

  // ── 编辑器内的 mutator 工具 ────────────────────────────────────────────────
  const updateWorking = (patch: Partial<Template>) => {
    setWorking((w) => (w ? { ...w, ...patch } : w));
  };
  const updateCanvas = (patch: Partial<Template["canvas"]>) => {
    setWorking((w) => (w ? { ...w, canvas: { ...w.canvas, ...patch } } : w));
  };
  // 在当前激活场景上 map slots,其余场景原样
  const mapCurrentScene = (mapper: (s: TemplateSlot) => TemplateSlot) =>
    setWorking((w) =>
      w
        ? {
            ...w,
            scenes: w.scenes.map((sc, i) => (i === sceneIdx ? { ...sc, slots: sc.slots.map(mapper) } : sc)),
          }
        : w
    );
  const updateSlot = (slotId: string, patch: Partial<TemplateSlot>) => {
    mapCurrentScene((s) => (s.slot_id === slotId ? { ...s, ...patch } : s));
  };
  const updateSlotRect = (slotId: string, patch: Partial<NonNullable<TemplateSlot["rect"]>>) => {
    mapCurrentScene((s) =>
      s.slot_id === slotId
        ? { ...s, rect: { ...(s.rect ?? { x: 0, y: 0, w: 1, h: 1 }), ...patch } }
        : s
    );
  };
  /** SlotPolicyEditor 发"完整 override 对象",我们整段替换;空对象 → 删字段回到 layer 默认。 */
  const updateSlotPolicy = (slotId: string, fullOverride: Partial<SlotPerturbationPolicy>) => {
    mapCurrentScene((s) =>
      s.slot_id === slotId
        ? {
            ...s,
            perturbation_policy: Object.keys(fullOverride).length === 0 ? undefined : fullOverride,
          }
        : s
    );
  };
  const addSlot = () => {
    const nextId = `slot_${nanoid(6)}`;
    const sceneDur = working?.scenes[sceneIdx]?.duration ?? display.canvas.duration;
    const newSlot: TemplateSlot = {
      slot_id: nextId,
      layer_type: "image",
      z_index: Math.max(0, ...(working?.scenes[sceneIdx]?.slots.map((s) => s.z_index) ?? [0])) + 1,
      rect: { x: 0.3, y: 0.4, w: 0.4, h: 0.2 },
      time_range: [0, sceneDur],
      fill_strategy: "user_upload",
      user_editable: true,
      required: false,
      label: "新内容位",
    };
    setWorking((w) =>
      w
        ? {
            ...w,
            scenes: w.scenes.map((sc, i) => (i === sceneIdx ? { ...sc, slots: [...sc.slots, newSlot] } : sc)),
          }
        : w
    );
    setSelectedSlot(nextId);
  };
  const removeSlot = (slotId: string) => {
    setConfirmModal({
      title: "删除此内容位?",
      body: "删除后无法恢复,需要重新添加。",
      onConfirm: () => {
        setWorking((w) =>
          w
            ? {
                ...w,
                scenes: w.scenes.map((sc, i) =>
                  i === sceneIdx ? { ...sc, slots: sc.slots.filter((s) => s.slot_id !== slotId) } : sc
                ),
              }
            : w
        );
        if (selectedSlot === slotId) setSelectedSlot(null);
      },
    });
  };

  // 场景级 mutator
  /** 在指定位置插入新场景。targetIdx 省略 = 追加到末尾。 */
  const addSceneAt = (targetIdx?: number) => {
    setWorking((w) => {
      if (!w) return w;
      const id = `scene_${nanoid(6)}`;
      const newScene: TemplateScene = {
        id,
        label: `场景 ${w.scenes.length + 1}`,
        duration: 5,
        slots: [],
      };
      const idx = targetIdx ?? w.scenes.length;
      const next = w.scenes.slice();
      next.splice(idx, 0, newScene);
      return { ...w, scenes: next };
    });
    setSelectedSceneIdx(targetIdx ?? (working?.scenes.length ?? 0));
    setSelectedSlot(null);
  };
  const addScene = () => addSceneAt();
  const removeScene = (idx: number) => {
    if (!working) return;
    if (working.scenes.length <= 1) {
      setSaveError("至少保留 1 个场景");
      setTimeout(() => setSaveError(null), 2500);
      return;
    }
    const label = working.scenes[idx]?.label;
    setConfirmModal({
      title: `删除场景"${label}"?`,
      body: `本场景的 ${working.scenes[idx]?.slots.length ?? 0} 个内容位也会一并删除。`,
      onConfirm: () => {
        setWorking((w) => (w ? { ...w, scenes: w.scenes.filter((_, i) => i !== idx) } : w));
        if (sceneIdx >= idx) setSelectedSceneIdx(Math.max(0, sceneIdx - 1));
        setSelectedSlot(null);
      },
    });
  };
  const updateScene = (idx: number, patch: Partial<TemplateScene>) => {
    setWorking((w) => (w ? { ...w, scenes: w.scenes.map((sc, i) => (i === idx ? { ...sc, ...patch } : sc)) } : w));
  };
  const moveScene = (idx: number, dir: -1 | 1) => {
    setWorking((w) => {
      if (!w) return w;
      const next = w.scenes.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return w;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...w, scenes: next };
    });
    setSelectedSceneIdx((cur) => (cur === idx ? idx + dir : cur));
  };
  /** 把当前场景里第 from 个 slot 移到 to 位置(gap 语义)。 */
  const moveSlotTo = (from: number, to: number) => {
    setWorking((w) => {
      if (!w) return w;
      if (from === to || from === to - 1) return w;
      const sc = w.scenes[sceneIdx];
      if (!sc) return w;
      const next = sc.slots.slice();
      const [item] = next.splice(from, 1);
      const adj = from < to ? to - 1 : to;
      next.splice(adj, 0, item);
      return {
        ...w,
        scenes: w.scenes.map((s, i) => (i === sceneIdx ? { ...s, slots: next } : s)),
      };
    });
  };
  /** 把 from 位置的场景移动到 to 位置(targetGap 语义:to=0 表示移到最前,to=N 表示移到末尾)。 */
  const moveSceneTo = (from: number, to: number) => {
    setWorking((w) => {
      if (!w) return w;
      if (from === to || from === to - 1) return w;
      const next = w.scenes.slice();
      const [item] = next.splice(from, 1);
      // 若 from < to,删除后 to 索引会自动前移 1 位
      const adj = from < to ? to - 1 : to;
      next.splice(adj, 0, item);
      return { ...w, scenes: next };
    });
    setSelectedSceneIdx(from < to ? to - 1 : to);
  };

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">
      <ConfirmModal modal={confirmModal} onClose={() => setConfirmModal(null)} />
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/mixcut/templates">
            <ArrowLeft className="size-4" /> 返回模板库
          </Link>
        </Button>
        {editing ? (
          <div className="flex items-center gap-3 flex-wrap">
            {/* 次群 1：状态徽 */}
            <div className="flex items-center min-h-[1.5rem]">
              {hasValidationError ? (
                <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                  <AlertCircle className="size-3" /> 有 {timeRangeErrors.length} 处时间问题待修
                </span>
              ) : saveError ? (
                <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                  <AlertCircle className="size-3" /> {saveError}
                </span>
              ) : dirty ? (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <span className="size-1.5 rounded-full bg-amber-500" /> 未保存修改
                </span>
              ) : savedAt ? (
                <span className="text-xs text-emerald-600">
                  已保存 · {new Date(savedAt).toLocaleTimeString("zh-CN", { hour12: false })}
                </span>
              ) : null}
            </div>

            {/* 次群 2：撤销 + 退出 —— ghost 按钮，视觉退到背景 */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={resetWorking} disabled={!dirty}>
                <RotateCcw className="size-3.5" /> 撤销修改
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelEdit}>
                <X className="size-3.5" /> {isNewMode ? "放弃新建" : "退出编辑"}
              </Button>
            </div>

            {/* 主群：overflow（删除 / 另存）+ 保存。中间留一道竖线视觉分隔。 */}
            <div className="flex items-center gap-2 pl-3 border-l border-border">
              {!isNewMode && (canDeleteTemplate || true) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" title="更多操作">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    <DropdownMenuItem onClick={() => setSaveAsOpen(true)}>
                      <Copy className="size-3.5" /> 另存为新模板
                    </DropdownMenuItem>
                    {canDeleteTemplate && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={requestDeleteTemplate}
                          disabled={saving}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 className="size-3.5" /> {deleteRestoresFactoryBase ? "删除我的版本" : "删除模板"}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={saving || hasValidationError || (!isNewMode && !dirty)}
                title={hasValidationError ? timeRangeErrors[0] : undefined}
              >
                <Save className="size-3.5" /> {isNewMode ? "保存新模板" : isFactory ? "保存为我的版本" : "保存"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/mixcut/templates/${id}/edit`}>
                <Pencil className="size-3.5" /> 编辑模板
              </Link>
            </Button>
            {editableSlots.length === 0 ? (
              <Button
                variant="default"
                size="sm"
                disabled
                title="该模板暂无内容位，请先点「编辑模板」添加"
              >
                使用此模板
              </Button>
            ) : (
              <Button variant="default" size="sm" asChild>
                <Link href={`/mixcut/create/${display.template_id}`}>
                  使用此模板
                  <ChevronRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 模式提示：draft / factory 互斥，最多展示一条；单行无 Card chrome */}
      {(isNewMode || (isFactory && editing)) && (
        <ModeNotice
          tone={isNewMode ? "draft" : "factory"}
          deleteRestores={deleteRestoresFactoryBase}
          className="mb-5"
        />
      )}

      {saveAsOpen && (
        <div className="mb-5 rounded-md border border-violet-500/40 bg-violet-500/[0.03] px-3 py-2 flex items-center gap-3 flex-wrap">
          <Label htmlFor="newname" className="text-xs text-muted-foreground shrink-0">新模板名</Label>
          <Input
            id="newname"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例如：玻璃水带货 · 节庆款"
            className="flex-1 min-w-[200px] h-8"
          />
          <Button variant="default" size="sm" onClick={handleSaveAs} disabled={!newName.trim() || saving}>
            <Save className="size-3.5" /> 创建
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setSaveAsOpen(false); setNewName(""); }}>
            取消
          </Button>
        </div>
      )}

      <section>
        {/* 场景流程独占一行,贯穿 section 宽度。编辑态横向时间轴需要尽可能宽,
            原来塞在左栏 340px 子列里又挤又难拖。view 态也保留同一位置,信息层级一致。*/}
        <div className="mb-3">
          <SceneFlowEditor
            scenes={display.scenes}
            canvas={display.canvas}
            currentIdx={sceneIdx}
            editing={editing}
            onSelect={(i) => { setSelectedSceneIdx(i); setSelectedSlot(null); }}
            onAddAt={addSceneAt}
            onRemove={removeScene}
            onChange={updateScene}
            onMoveTo={moveSceneTo}
          />
        </div>

        {/* 编辑提示条：紧贴在场景流之后，作为操作提示的延伸 */}
        {editing && <EditingTipsBar className="mb-3" />}

        {/* 模板配置条：策略摘要 chip（默认）+ inline 展开完整配置面板（点击 chip 后）。
            画布与模板属性都在 same 面板内,告别"按钮按了没反应/找不到目标"的旧版症状。
            与下方主区段间留更大间距（mb-8）以分隔"模板顶层信息"与"在编辑的内容"。*/}
        <TemplateConfigBar
          template={display}
          editing={editing}
          open={templateMetaOpen}
          onToggle={() => setTemplateMetaOpen((o) => !o)}
          onChangeCanvas={updateCanvas}
          onChangeTemplate={updateWorking}
          className="mb-8"
        />

      <div className={cn("grid grid-cols-1 gap-8", !editing && "lg:grid-cols-[1fr_400px]")}>
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="muted" className="text-[10px]">{display.metadata.category}</Badge>
                <Badge variant="brand" className="text-[10px]">
                  <Lock className="size-2.5" /> {TIER_LABELS[display.metadata.required_tier]}
                </Badge>
                {!isFactory && <Badge variant="success" className="text-[10px]">我的模板</Badge>}
              </div>
              {editing && working ? (
                <Input
                  value={working.name}
                  onChange={(e) => updateWorking({ name: e.target.value })}
                  className="text-xl font-semibold h-10 max-w-md"
                  placeholder="模板名"
                />
              ) : (
                <h1 className="text-2xl font-semibold tracking-tight">{display.name}</h1>
              )}
              <p className="mt-1 text-xs text-muted-foreground font-mono">
                v{display.version} · {display.canvas.width}×{display.canvas.height} · {totalDuration(display)}秒 · {display.scenes.length} 场景
              </p>
            </div>
          </div>

          <div className={cn("grid grid-cols-1 gap-6", editing ? "md:grid-cols-[340px_1fr]" : "md:grid-cols-[300px_1fr]")}>
            <div className={cn(editing && "md:sticky md:top-20 md:self-start space-y-3")}>
              <TemplatePreview
                template={{
                  ...display,
                  canvas: { ...display.canvas, duration: currentScene?.duration ?? display.canvas.duration },
                  scenes: currentScene ? [currentScene] : display.scenes,
                }}
                selectedSlotId={selectedSlot}
                onSelectSlot={setSelectedSlot}
                frameStyle="blueprint"
                variantSeed={previewVariant}
                editable={editing}
                onChangeSlotRect={(slotId, next) => updateSlotRect(slotId, next)}
              />
              <div className={editing ? "" : "mt-3"}>
                <div className="text-xs text-muted-foreground mb-2">效果预览:每条版本的内容位置会有小幅变化</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setPreviewVariant(undefined)}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs border transition-colors",
                      previewVariant == null
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                    )}
                  >
                    原版
                  </button>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPreviewVariant(i)}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs border transition-colors",
                        previewVariant === i
                          ? "bg-foreground text-background border-foreground"
                          : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                      )}
                    >
                      第 {i + 1} 条
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
                  {previewVariant == null
                    ? "原版无扰动应用。"
                    : `本预览只演示位置抖动;实际渲染时还会按扰动强度随机叠加镜像、变速、亮度、饱和度。`}
                </p>
              </div>

              {/* "高级"块已并入顶部 TemplateConfigBar 的 inline 展开面板;左栏只保留 Preview + 变体快速预览 */}
            </div>

            <div className="min-w-0">
              {/* 主舞台：slot 列表是 edit 模式的工作核心，不再嵌入 Card chrome。
                  view 模式同样去 Card，让信息密度服务于"看清此场景在干什么"。*/}
              <div className="mb-3 flex items-center justify-between gap-3 pb-2 border-b border-border/60">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="size-4 text-violet-500" />
                  <span>{currentScene?.label || "场景"}</span>
                  <span className="text-muted-foreground font-normal">
                    · 内容位 {currentSceneSlots.length}
                  </span>
                </h2>
                {editing && (
                  <Button variant="ghost" size="sm" onClick={addSlot}>
                    <Plus className="size-3.5" /> 添加一个
                  </Button>
                )}
              </div>
              <div className="space-y-0">
                  {currentSceneSlots.length === 0 ? (
                    <SlotEmptyState editing={editing} onAdd={addSlot} />
                  ) : (
                    <>
                      {currentSceneSlots.map((s, idx) => {
                        const isSelected = selectedSlot === s.slot_id;
                        return (
                          <Fragment key={s.slot_id}>
                            {editing && (
                              <SlotDropZone
                                gapIdx={idx}
                                active={slotDragOverGap === idx}
                                dragActive={slotDragSrc != null}
                                onDragOver={() => setSlotDragOverGap(idx)}
                                onDragLeave={() => setSlotDragOverGap((g) => (g === idx ? null : g))}
                                onDrop={() => {
                                  if (slotDragSrc != null) moveSlotTo(slotDragSrc, idx);
                                  setSlotDragSrc(null);
                                  setSlotDragOverGap(null);
                                }}
                              />
                            )}
                            <div
                              draggable={editing}
                              onDragStart={(e) => {
                                if (!editing) return;
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", String(idx));
                                setSlotDragSrc(idx);
                              }}
                              onDragEnd={() => {
                                setSlotDragSrc(null);
                                setSlotDragOverGap(null);
                              }}
                              className={cn(
                                editing && "cursor-move",
                                slotDragSrc === idx && "opacity-40"
                              )}
                            >
                              <SlotCard
                                slot={s}
                                canvas={display.canvas}
                                sceneDuration={currentScene?.duration ?? display.canvas.duration}
                                selected={isSelected}
                                editing={editing}
                                onSelect={() => setSelectedSlot(isSelected ? null : s.slot_id)}
                                onChange={(patch) => updateSlot(s.slot_id, patch)}
                                onChangePolicy={(patch) => updateSlotPolicy(s.slot_id, patch)}
                                onRemove={() => removeSlot(s.slot_id)}
                              />
                            </div>
                          </Fragment>
                        );
                      })}
                      {editing && (
                        <SlotDropZone
                          gapIdx={currentSceneSlots.length}
                          active={slotDragOverGap === currentSceneSlots.length}
                          dragActive={slotDragSrc != null}
                          onDragOver={() => setSlotDragOverGap(currentSceneSlots.length)}
                          onDragLeave={() => setSlotDragOverGap((g) => (g === currentSceneSlots.length ? null : g))}
                          onDrop={() => {
                            if (slotDragSrc != null) moveSlotTo(slotDragSrc, currentSceneSlots.length);
                            setSlotDragSrc(null);
                            setSlotDragOverGap(null);
                          }}
                        />
                      )}
                    </>
                  )}
              </div>
            </div>
          </div>
        </div>

        {!editing && (
        <aside className="space-y-4 lg:sticky lg:top-20 self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">模板说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="品类" value={display.metadata.category || "未分类"} />
                <Stat label="适用档位" value={TIER_LABELS[display.metadata.required_tier]} />
                <Stat label="版本" value={`v${display.version}`} />
                <Stat
                  label="成片尺寸"
                  value={`${display.canvas.width}×${display.canvas.height}`}
                  hint={orientationLabel(display.canvas.width, display.canvas.height)}
                />
                <Stat label="成片时长" value={`${display.canvas.duration} 秒`} />
                <Stat label="帧率" value={`${display.canvas.fps} fps`} />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="可编辑内容位" value={`${flatSlots.length} 个`} />
                <Stat label="其中必填" value={`${requiredSlots.length} 项`} />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">差异化策略</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="brand" className="capitalize">
                    {PROFILE_LABELS[display.perturbation_profile]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">默认一次出 {display.output_variants_default} 条不同版本</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {PROFILE_DESCRIPTIONS[display.perturbation_profile]}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">去重保护</div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div>每条与原片差异度 ≥ {display.quality_gate.min_phash_distance} 分</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      差异不达标会自动重试,最多 {display.quality_gate.max_retries} 次,确保平台不会判定为重复视频
                    </div>
                  </div>
                </div>
              </div>

              {display.metadata.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Tag className="size-3" /> 标签
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {display.metadata.tags.map((tag) => (
                        <Badge key={tag} variant="muted" className="text-[10px]">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        </aside>
        )}
      </div>
      </section>
    </div>
  );
}

// ── Canvas 编辑器 ───────────────────────────────────────────────────────────

// 注:本组件返回 bare content (不带 Card 外壳);由 TemplateConfigBar 展开面板内嵌使用
function CanvasEditor({
  canvas,
  onChange,
}: {
  canvas: Template["canvas"];
  onChange: (patch: Partial<Template["canvas"]>) => void;
}) {
  // 当前画布是否匹配某个预设；匹配则高亮，否则视作自定义（仅下方数值生效）
  const matched = CANVAS_PRESETS.find((p) => p.w === canvas.width && p.h === canvas.height);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          常用尺寸
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {CANVAS_PRESETS.map((p) => {
            const on = matched?.label === p.label;
            return (
              <button
                key={p.label}
                onClick={() => onChange({ width: p.w, height: p.h })}
                className={cn(
                  "px-2 py-1.5 rounded-md border text-left transition-colors leading-tight",
                  on
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                )}
              >
                <div className="text-xs font-medium">{p.label}</div>
                <div className={cn("text-[10px] font-mono mt-0.5", on ? "opacity-80" : "opacity-60")}>
                  {p.sub}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <NumField
          label="宽度 (px)"
          value={canvas.width}
          min={120} max={3840}
          onChange={(v) => onChange({ width: v })}
        />
        <NumField
          label="高度 (px)"
          value={canvas.height}
          min={120} max={3840}
          onChange={(v) => onChange({ height: v })}
        />
        <NumField
          label="帧率 (fps)"
          value={canvas.fps}
          min={15} max={60}
          onChange={(v) => onChange({ fps: v })}
        />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        {matched
          ? "选好预设后总时长由场景累加而来；如需非常规尺寸，直接改下方宽高。"
          : "当前为自定义尺寸；所有内容位按此自动缩放。"}
      </p>
    </div>
  );
}

// ── 内容位卡片(只读 / 编辑两态) ──────────────────────────────────────────────

function SlotCard({
  slot,
  canvas,
  sceneDuration,
  selected,
  editing,
  onSelect,
  onChange,
  onChangePolicy,
  onRemove,
}: {
  slot: TemplateSlot;
  canvas: Template["canvas"];
  /** 所在场景的总时长。time_range 的 clamp 上限。 */
  sceneDuration: number;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TemplateSlot>) => void;
  onChangePolicy: (patch: Partial<SlotPerturbationPolicy>) => void;
  onRemove: () => void;
}) {
  const pixelRect = slot.rect ? rectToPixels(slot.rect, canvas) : null;
  const [tStart, tEnd] = slot.time_range;
  // 单 slot 自己的校验（用于在 NumField 边上画 inline 提示）
  const localTimeError =
    !(tEnd > tStart)
      ? "结束必须大于开始"
      : tEnd > sceneDuration + 1e-6
      ? `超过本场景 ${sceneDuration}s`
      : tStart < 0
      ? "开始不能小于 0"
      : null;

  if (!editing || !selected) {
    // 只读视图:所有英文 / 工程话术翻译成运营能读的中文
    return (
      <button
        onClick={onSelect}
        className={cn(
          "w-full text-left p-3 rounded-lg border transition-colors",
          selected
            ? "border-violet-500/60 bg-violet-500/5"
            : "border-border hover:bg-secondary/50"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="muted" className="text-[10px] shrink-0">
              {LAYER_LABELS[slot.layer_type]}
            </Badge>
            <span className="text-sm font-medium truncate">{slot.label || slot.slot_id}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {slot.required && <Badge variant="danger" className="text-[10px]">必填</Badge>}
            {!slot.user_editable && <Badge variant="muted" className="text-[10px]">系统填</Badge>}
          </div>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-x-3 gap-y-0.5 flex-wrap">
          {slot.layer_type !== "audio" && <span>{describeRect(slot.rect)}</span>}
          <span>{describeTimeRange(slot.time_range)}</span>
          <span>· {FILL_STRATEGY_LABELS[slot.fill_strategy]}</span>
        </div>
      </button>
    );
  }

  // 编辑视图:展开表单
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-3",
        selected ? "border-violet-500/60 bg-violet-500/5" : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onSelect}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <Badge variant="muted" className="text-[10px] shrink-0">{LAYER_LABELS[slot.layer_type]}</Badge>
          <Input
            value={slot.label ?? ""}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="给这个位置起个名字"
            className="h-7 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onRemove}
          title="删除此位"
        >
          <Trash2 className="size-3.5 text-red-500" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SelectField
          label="内容类型"
          value={slot.layer_type}
          options={LAYER_OPTIONS}
          onChange={(v) => {
            const nextLayer = v as LayerType;
            // 联动：切类型时把 fill_strategy 也 reconcile，避免出现 "文字 + 自己上传" 这种
            // UI 与渲染层冲突的状态。已有 fill 仍合法就保留。
            const nextFill = reconcileFill(slot.fill_strategy, nextLayer);
            onChange(
              nextFill === slot.fill_strategy
                ? { layer_type: nextLayer }
                : { layer_type: nextLayer, fill_strategy: nextFill }
            );
          }}
        />
        <SelectField
          label="谁来填"
          value={slot.fill_strategy}
          // 仅显示与当前 layer 兼容的策略；与上面联动一起防止脏数据
          options={FILL_OPTIONS.filter((o) => allowedFillsFor(slot.layer_type).includes(o.value))}
          onChange={(v) => onChange({ fill_strategy: v as FillStrategy })}
        />
        <NumField
          label="叠加层级"
          value={slot.z_index}
          min={0}
          max={100}
          onChange={(v) => onChange({ z_index: v })}
        />
      </div>

      {slot.layer_type !== "audio" && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
            画面位置与大小
            {slot.rect && <span className="text-foreground"> · {describeRect(slot.rect)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PixelStat
              label="素材尺寸"
              value={pixelRect ? `${pixelRect.w} × ${pixelRect.h} px` : `${canvas.width} × ${canvas.height} px`}
            />
            <PixelStat
              label="左上角坐标"
              value={pixelRect ? `(${pixelRect.x}, ${pixelRect.y})` : "(0, 0)"}
            />
          </div>
        </div>
      )}

      {(slot.layer_type === "video" || slot.layer_type === "image") && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
            填充方式
            <span className="ml-1 text-muted-foreground/70">
              · 素材尺寸与画面位置不一致时怎么处理
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { v: "cover", label: "填满", hint: "边缘自动裁切" },
                { v: "contain", label: "完整显示", hint: "边缘模糊背景填充" },
              ] as const
            ).map((opt) => {
              const current = slot.fit ?? "cover";
              const active = current === opt.v;
              return (
                <button
                  key={opt.v}
                  onClick={() => onChange({ fit: opt.v })}
                  className={cn(
                    "px-2 py-1.5 rounded-md border text-left transition-colors leading-tight",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                  )}
                >
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className={cn("text-[10px] mt-0.5", active ? "opacity-80" : "opacity-60")}>
                    {opt.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="开始 (秒)"
            value={tStart}
            min={0}
            max={Math.max(0, sceneDuration - 0.5)}
            step={0.5}
            onChange={(v) => {
              // clamp 到 [0, sceneDuration - 0.5]，且不得 ≥ 当前 end
              const clamped = Math.max(0, Math.min(v, sceneDuration - 0.5, tEnd - 0.5));
              onChange({ time_range: [clamped, tEnd] });
            }}
          />
          <NumField
            label="结束 (秒)"
            value={tEnd}
            min={Math.min(sceneDuration, tStart + 0.5)}
            max={sceneDuration}
            step={0.5}
            onChange={(v) => {
              // clamp 到 [start + 0.5, sceneDuration]
              const clamped = Math.max(tStart + 0.5, Math.min(v, sceneDuration));
              onChange({ time_range: [tStart, clamped] });
            }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] leading-tight">
          {localTimeError ? (
            <span className="inline-flex items-center gap-1 text-red-600">
              <AlertCircle className="size-3" />
              {localTimeError}
            </span>
          ) : (
            <span className="text-muted-foreground">
              本场景 0 – {sceneDuration}s
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Toggle
          label="必填项"
          checked={slot.required}
          onChange={(v) => onChange({ required: v })}
        />
        <Toggle
          label="允许用户改"
          checked={slot.user_editable}
          onChange={(v) => onChange({ user_editable: v })}
        />
      </div>

      <SlotPolicyEditor
        slot={{ ...slot, perturbation_policy: undefined }}
        override={slot.perturbation_policy}
        onChange={onChangePolicy}
        globalOverrides={POLICY_NO_KILL}
      />
    </div>
  );
}

// ── 复用控件 ───────────────────────────────────────────────────────────────

function NumField({
  label, value, min, max, step = 1, onChange,
}: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="h-8 text-sm"
      />
    </div>
  );
}

function SelectField({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  /** 可以传字符串数组(value === label),或 {value,label} 对象数组。 */
  options: ReadonlyArray<string | { value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        {/* `--input` token 在共享 ui 主题里是 transparent（shadcn 用 fill 而非
            stroke 暗示输入区）。这里给个明确的 zinc-300 边框 + 白底，跟模板编辑
            器其它 Input / NumField 视觉一致。 */}
        <SelectTrigger className="w-full h-8 rounded-md border border-zinc-300 bg-white text-sm focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const v = typeof o === "string" ? o : o.value;
            const l = typeof o === "string" ? o : o.label;
            return (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "px-2.5 py-1 rounded-md text-xs border transition-colors flex items-center gap-1.5",
        checked
          ? "bg-foreground text-background border-foreground"
          : "bg-transparent border-border text-muted-foreground hover:border-foreground"
      )}
    >
      <span>{checked ? "✓" : "—"}</span>
      {label}
    </button>
  );
}


function rectToPixels(rect: NonNullable<TemplateSlot["rect"]>, canvas: Template["canvas"]) {
  return {
    x: Math.round(rect.x * canvas.width),
    y: Math.round(rect.y * canvas.height),
    w: Math.round(rect.w * canvas.width),
    h: Math.round(rect.h * canvas.height),
  };
}

function PixelStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/70 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function orientationLabel(w: number, h: number): string {
  if (h > w * 1.1) return "竖屏 · 适合抖音/小红书";
  if (w > h * 1.1) return "横屏 · 适合 B 站/视频号";
  return "方形 · 适合 Feed 流";
}

// ── 内容位空状态(本场景一个 slot 都没有) ──────────────────────────────────

function SlotEmptyState({ editing, onAdd }: { editing: boolean; onAdd: () => void }) {
  return (
    <div className="py-8 text-center space-y-2">
      <Layers className="size-8 mx-auto text-muted-foreground/40" />
      <div className="text-sm text-muted-foreground">本场景还没有内容位</div>
      {editing && (
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" /> 添加第一个内容位
        </Button>
      )}
    </div>
  );
}

// ── 内容位之间的拖拽 drop zone(细长 hover/拖动时撑高) ──────────────────────

function SlotDropZone({
  active,
  dragActive,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  gapIdx: number;
  active: boolean;
  dragActive: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className={cn(
        "transition-all rounded",
        active ? "h-10 my-1 bg-violet-500/15 ring-1 ring-violet-500/40" : dragActive ? "h-3 my-0.5" : "h-1"
      )}
    />
  );
}

// ── 模式提示:draft / factory 互斥,单行,无 Card chrome ────────────────────────

function ModeNotice({
  tone,
  deleteRestores: _deleteRestores,
  className,
}: {
  tone: "draft" | "factory";
  /** 暂留未用：factory 态描述会因是否已有"我的版本"而稍异；当前文案统一处理 */
  deleteRestores?: boolean;
  className?: string;
}) {
  const isDraft = tone === "draft";
  const Icon = isDraft ? Sparkles : AlertCircle;
  return (
    <div
      className={cn(
        "rounded-md px-3 py-2 flex items-start gap-2 border text-xs leading-relaxed",
        isDraft
          ? "border-violet-500/30 bg-violet-500/[0.04] text-muted-foreground"
          : "border-amber-500/30 bg-amber-500/[0.04] text-muted-foreground",
        className,
      )}
    >
      <Icon
        className={cn(
          "size-3.5 shrink-0 mt-0.5",
          isDraft ? "text-violet-600" : "text-amber-600",
        )}
      />
      {isDraft ? (
        <span>
          草稿状态：填写名称、添加场景与内容位，点
          <span className="font-medium text-foreground"> 保存新模板 </span>
          后才会出现在模板库；直接关闭则不会保存。
        </span>
      ) : (
        <span>
          工厂模板：保存会在本地生成
          <span className="font-medium text-foreground"> 我的版本 </span>
          覆盖显示，可在「我的模板」列表中单独管理。想保留原版同时新增一份请用「另存为新模板」。
        </span>
      )}
    </div>
  );
}

// ── 模板配置条:策略摘要 (折叠) + 画布 / 模板属性 (展开,inline 同位) ────────
// view 态：只读摘要 chip。
// edit 态：点击 chip 直接 inline 展开"画布 + 模板属性"完整编辑面板,不再跳转左栏。
// pHash 用"差异阈值"并加 Info hover 解释,避免术语外漏。

function TemplateConfigBar({
  template,
  editing,
  open,
  onToggle,
  onChangeCanvas,
  onChangeTemplate,
  className,
}: {
  template: Template;
  editing: boolean;
  /** 展开状态。view 态 ignored。 */
  open: boolean;
  onToggle: () => void;
  onChangeCanvas: (patch: Partial<Template["canvas"]>) => void;
  onChangeTemplate: (patch: Partial<Template>) => void;
  className?: string;
}) {
  const profileLabel = PROFILE_LABELS[template.perturbation_profile];
  const variants = template.output_variants_default;
  const threshold = template.quality_gate.min_phash_distance;
  const expanded = editing && open;

  const summary = (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Sliders className="size-3.5" />
        <span>差异化策略</span>
      </span>
      <Badge variant="brand" className="capitalize">{profileLabel}</Badge>
      <Separator orientation="vertical" className="h-3" />
      <span className="text-muted-foreground">默认</span>
      <span className="font-medium text-foreground">{variants} 条</span>
      <span className="text-muted-foreground">/ 次</span>
      <Separator orientation="vertical" className="h-3" />
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <span>差异阈值</span>
        <span
          className="cursor-help inline-flex"
          title="与原片越像分越低，越不像分越高。低于此阈值会自动重试以避免平台判重。"
        >
          <Info className="size-3 opacity-60" />
        </span>
      </span>
      <span className="font-medium text-foreground">{threshold}</span>
      <Separator orientation="vertical" className="h-3" />
      <span className="text-muted-foreground">画布</span>
      <span className="font-mono font-medium text-foreground">
        {template.canvas.width}×{template.canvas.height}
      </span>
      <span className="text-muted-foreground/70 font-mono">· {template.canvas.fps}fps</span>
    </div>
  );

  if (!editing) {
    return (
      <div className={cn("rounded-md border border-border bg-background/60 px-3 py-2", className)}>
        {summary}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "w-full text-left border border-border bg-background/60 px-3 py-2 transition-colors flex items-center justify-between gap-3",
          expanded
            ? "rounded-t-md border-b-foreground/15"
            : "rounded-md hover:border-foreground/30 hover:bg-secondary/40",
        )}
      >
        {/* v0.23: 展开时下面的表单已经把所有字段亮出来了；header 不再重复列数据，仅保留"模板配置"标签
           + 收起 hint。收起态下 summary 仍是关键索引信息 → 保留完整一行。 */}
        {expanded ? (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Sliders className="size-3.5" />
            <span className="font-medium text-foreground">模板配置</span>
            <span className="text-muted-foreground/70">画布与时长 · 模板属性</span>
          </span>
        ) : (
          summary
        )}
        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 shrink-0">
          {expanded ? "收起" : "修改"}
          <ChevronRight
            className={cn("size-3 transition-transform", expanded && "rotate-90")}
          />
        </span>
      </button>

      {expanded && (
        <div className="rounded-b-md border border-t-0 border-border bg-background/50 p-4 md:p-5 grid gap-6 md:gap-8 md:grid-cols-2">
          <section>
            <h3 className="text-sm font-medium mb-3">画布与时长</h3>
            <CanvasEditor canvas={template.canvas} onChange={onChangeCanvas} />
          </section>
          <section>
            <h3 className="text-sm font-medium mb-3">模板属性</h3>
            <TemplateMetaFields template={template} onChange={onChangeTemplate} />
          </section>
        </div>
      )}
    </div>
  );
}

// ── 编辑模式 hint bar:四条核心操作,localStorage 记住 dismiss ─────────────────
// 显示位置:页面顶部"编辑中" badge 右侧,平铺 4 个手势提示,点 ✕ 永久隐藏。
// 不抢主视觉,首次进入编辑就能看到该怎么操作。

const TIPS_DISMISS_KEY = "mixcut.template-editor.tips-dismissed.v1";

function EditingTipsBar({ className }: { className?: string }) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissed(window.localStorage.getItem(TIPS_DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed !== false) return null;

  const dismiss = () => {
    try { window.localStorage.setItem(TIPS_DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-x-4 gap-y-1 flex-wrap px-3 py-1.5 rounded-md bg-foreground/[0.04] border border-border text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-foreground/40" />
        点节点切换场景
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-foreground/40" />
        拖动节点重排
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-foreground/40" />
        点 + 插入新场景
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-foreground/40" />
        选中槽位后画布上拖拽改位置
      </span>
      <button
        onClick={dismiss}
        className="size-4 grid place-items-center rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-secondary transition-colors"
        title="不再提示"
        aria-label="不再提示"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

// ── 模板属性表单 body:品类 / 档位 / 标签 / 差异化策略 / 默认变体 / 去重保护 ───
// 不带外壳,由 TemplateConfigBar 展开面板内嵌使用。

const TIER_EDIT_OPTIONS: Template["metadata"]["required_tier"][] = [
  "basic",
  "standard",
  "professional",
];

const PROFILE_EDIT_OPTIONS: Template["perturbation_profile"][] = [
  "light",
  "moderate",
  "aggressive",
];

function TemplateMetaFields({
  template,
  onChange,
}: {
  template: Template;
  onChange: (patch: Partial<Template>) => void;
}) {
  const updateMeta = (patch: Partial<Template["metadata"]>) =>
    onChange({ metadata: { ...template.metadata, ...patch } });
  const updateQg = (patch: Partial<Template["quality_gate"]>) =>
    onChange({ quality_gate: { ...template.quality_gate, ...patch } });

  // v0.23: 去重保护折到"高级"。差异化策略选好后，min_phash / max_retries 沿用合理默认；
  // 只在用户主动展开时显示这两个数值微调，避免把内部算法参数推到首屏。
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">品类</Label>
        <Input
          value={template.metadata.category}
          onChange={(e) => updateMeta({ category: e.target.value })}
          placeholder="（可选）汽车用品 / 美妆个护 / 食饮…"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">标签（可选，逗号分隔）</Label>
        <Input
          value={template.metadata.tags.join(", ")}
          onChange={(e) =>
            updateMeta({
              tags: e.target.value
                .split(/[,，]/)
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          placeholder="新品、促销、夏季…"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">适用档位</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {TIER_EDIT_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => updateMeta({ required_tier: t })}
              className={cn(
                "px-2 py-1.5 rounded-md border text-xs transition-colors",
                template.metadata.required_tier === t
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent border-border text-muted-foreground hover:border-foreground"
              )}
            >
              {TIER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <Separator className="my-1" />

      <div className="space-y-1.5">
        <Label className="text-xs">差异化策略</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {PROFILE_EDIT_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => onChange({ perturbation_profile: p })}
              className={cn(
                "px-2 py-1.5 rounded-md border text-xs transition-colors",
                template.perturbation_profile === p
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent border-border text-muted-foreground hover:border-foreground"
              )}
            >
              {PROFILE_LABELS[p]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {PROFILE_DESCRIPTIONS[template.perturbation_profile]}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="默认变体数"
          value={template.output_variants_default}
          min={1}
          max={20}
          onChange={(v) => onChange({ output_variants_default: v })}
        />
      </div>

      {/* 高级：去重保护的两个数值微调。默认沿用差异化策略隐含的合理阈值；运营不点开就看不见。 */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn("size-3 transition-transform", showAdvanced && "rotate-90")}
          />
          高级：去重阈值微调
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-1.5 rounded-md border border-dashed border-border bg-secondary/30 p-3">
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="最小差异度"
                value={template.quality_gate.min_phash_distance}
                min={0}
                max={64}
                onChange={(v) => updateQg({ min_phash_distance: v })}
              />
              <NumField
                label="最大重试次数"
                value={template.quality_gate.max_retries}
                min={0}
                max={10}
                onChange={(v) => updateQg({ max_retries: v })}
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              生成时若与原片相似度过高（差异度低于阈值）将自动重试，避免平台判定为重复视频。
              一般保持差异化策略的默认值即可；除非有特殊画风诉求再调。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 自写 AlertDialog(避免引 radix dialog 依赖) ─────────────────────────────

function ConfirmModal({
  modal,
  onClose,
}: {
  modal: ConfirmModalState | null;
  onClose: () => void;
}) {
  if (!modal) return null;
  const handleConfirm = () => {
    modal.onConfirm();
    onClose();
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-background border border-border rounded-lg shadow-xl max-w-md mx-4 w-full"
      >
        <div className="p-5">
          <h3 className="text-base font-semibold">{modal.title}</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{modal.body}</p>
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-secondary/30 rounded-b-lg">
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button variant={modal.confirmVariant ?? "default"} size="sm" onClick={handleConfirm}>
            {modal.confirmText ?? "确定"}
          </Button>
        </div>
      </div>
    </div>
  );
}
