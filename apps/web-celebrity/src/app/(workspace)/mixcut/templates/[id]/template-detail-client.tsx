"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Layers,
  Tag,
  Flame,
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
} from "lucide-react";
import { notFound } from "next/navigation";
import { nanoid } from "nanoid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Input } from "@/components/mixcut-zone/ui/input";
import { Label } from "@/components/mixcut-zone/ui/label";
import { Separator } from "@/components/mixcut-zone/ui/separator";
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
  formatNumber,
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
import { resolvePolicy } from "@/components/mixcut-zone/lib/perturbation-defaults";
import { flatSlotsOf, totalDuration } from "@/components/mixcut-zone/lib/scene-helpers";
import { SceneFlowEditor } from "@/components/mixcut-zone/scene-flow-editor";

const LAYER_OPTIONS: ReadonlyArray<{ value: LayerType; label: string }> = [
  { value: "video", label: "视频" },
  { value: "image", label: "图片" },
  { value: "sticker", label: "贴图" },
  { value: "text", label: "文字" },
  { value: "audio", label: "音乐" },
  { value: "digital_human", label: "数字人" },
];
const FILL_OPTIONS: ReadonlyArray<{ value: FillStrategy; label: string }> = [
  { value: "fixed", label: "系统固定" },
  { value: "library_select", label: "从素材库选" },
  { value: "user_upload", label: "自己上传" },
  { value: "user_input", label: "手动填写" },
  { value: "api_generated", label: "AI 生成" },
  { value: "variable_binding", label: "跟随变量" },
];

// 画布尺寸预设。每条带平台 / 机型语义,方便创作者按发布平台选。
// 数值是真实输出像素 (ffmpeg 编码分辨率,非 CSS 逻辑像素)。
const CANVAS_PRESETS: { label: string; w: number; h: number; sub: string; group: "短视频" | "手机原生" | "其他" }[] = [
  // —— 短视频平台 ——
  { label: "抖音 / 快手",      w: 1080, h: 1920, sub: "1080×1920 · 9:16",   group: "短视频" },
  { label: "抖音长竖版",       w: 1080, h: 2400, sub: "1080×2400 · 9:20",   group: "短视频" },
  { label: "小红书竖版",       w: 1080, h: 1350, sub: "1080×1350 · 4:5",    group: "短视频" },
  { label: "视频号 / B 站",    w: 1080, h: 1920, sub: "1080×1920 · 9:16",   group: "短视频" },
  // —— 手机原生分辨率 ——
  { label: "iPhone 15/14 Pro", w: 1179, h: 2556, sub: "1179×2556 · ~9:19.5", group: "手机原生" },
  { label: "iPhone Pro Max",   w: 1290, h: 2796, sub: "1290×2796 · ~9:21.6", group: "手机原生" },
  { label: "Android 主流",      w: 1080, h: 2400, sub: "1080×2400 · 9:20",    group: "手机原生" },
  // —— 其他 ——
  { label: "方形",             w: 1080, h: 1080, sub: "1080×1080 · 1:1",    group: "其他" },
  { label: "横屏",             w: 1920, h: 1080, sub: "1920×1080 · 16:9",   group: "其他" },
  { label: "标清竖版",          w: 720,  h: 1280, sub: "720×1280 · 9:16",    group: "其他" },
];

export function TemplateDetailClient({ id }: { id: string }) {
  const router = useRouter();
  // SSR 时只能看工厂模板,client hydration 再 upgrade 到用户保存的覆盖版本
  const [template, setTemplate] = useState<Template | null>(
    () => mockTemplates.find((t) => t.template_id === id) ?? null
  );
  const [resolved, setResolved] = useState(false);
  const [working, setWorking] = useState<Template | null>(null); // edit-mode working copy
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const [previewVariant, setPreviewVariant] = useState<number | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    MixcutApi.getTemplate(id).then((t) => {
      setTemplate(t);
      setResolved(true);
    });
  }, [id]);

  // useMemo 必须在所有 early-return 之前 —— 避免 Rules of Hooks 违规
  const display: Template | null = editing && working ? working : template;
  const flatSlots = useMemo(() => (display ? flatSlotsOf(display) : []), [display]);

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
  const isFactory = MixcutApi.isFactoryTemplate(template.template_id);

  const enterEdit = () => {
    setWorking(structuredClone(template));
    setEditing(true);
  };

  const cancelEdit = () => {
    setWorking(null);
    setEditing(false);
    setSelectedSlot(null);
  };

  const resetWorking = () => {
    if (!confirm("放弃当前修改,恢复为已保存版本?")) return;
    setWorking(structuredClone(template));
  };

  const handleSave = async () => {
    if (!working) return;
    setSaving(true);
    try {
      const updated = await MixcutApi.saveTemplate(working);
      setTemplate(updated);
      setWorking(structuredClone(updated));
      setSavedAt(Date.now());
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
  const updateSlotPolicy = (slotId: string, patch: Partial<SlotPerturbationPolicy>) => {
    mapCurrentScene((s) =>
      s.slot_id === slotId
        ? { ...s, perturbation_policy: { ...(s.perturbation_policy ?? {}), ...patch } }
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
    if (!confirm(`确定删除此内容位?`)) return;
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
      alert("至少保留 1 个场景");
      return;
    }
    if (!confirm(`删除场景"${working.scenes[idx]?.label}"及其全部内容位?`)) return;
    setWorking((w) => (w ? { ...w, scenes: w.scenes.filter((_, i) => i !== idx) } : w));
    if (sceneIdx >= idx) setSelectedSceneIdx(Math.max(0, sceneIdx - 1));
    setSelectedSlot(null);
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
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/mixcut/templates">
            <ArrowLeft className="size-4" /> 返回模板库
          </Link>
        </Button>
        {editing ? (
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="text-[10px] text-emerald-600">
                已保存 · {new Date(savedAt).toLocaleTimeString("zh-CN", { hour12: false })}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={resetWorking}>
              <RotateCcw className="size-3.5" /> 撤销修改
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="size-3.5" /> 退出编辑
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSaveAsOpen(true)}>
              <Copy className="size-3.5" /> 另存为新模板
            </Button>
            <Button variant="gradient" size="sm" onClick={handleSave} disabled={saving}>
              <Save className="size-3.5" /> {isFactory ? "保存为我的版本" : "保存"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={enterEdit}>
            <Pencil className="size-3.5" /> 编辑模板
          </Button>
        )}
      </div>

      {isFactory && editing && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/[0.04]">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              这是工厂模板,保存会在本地生成一份「我的版本」覆盖显示;
              <span className="text-foreground"> 在「我的模板」列表中可单独管理 </span>。
              想保留原版的同时新增一份,请用「另存为新模板」。
            </div>
          </CardContent>
        </Card>
      )}

      {saveAsOpen && (
        <Card className="mb-4 border-brand-500/40">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <Label htmlFor="newname" className="text-sm shrink-0">新模板名</Label>
            <Input
              id="newname"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如:玻璃水带货 · 节庆款"
              className="flex-1 min-w-[200px]"
            />
            <Button variant="gradient" size="sm" onClick={handleSaveAs} disabled={!newName.trim() || saving}>
              <Save className="size-3.5" /> 创建
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setSaveAsOpen(false); setNewName(""); }}>
              取消
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
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
                  className="text-2xl font-semibold h-12 max-w-xl"
                />
              ) : (
                <h1 className="text-2xl font-semibold tracking-tight">{display.name}</h1>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                v{display.version} · {display.canvas.width}×{display.canvas.height} · {totalDuration(display)}秒 · {display.scenes.length} 场景
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
            <div>
              <TemplatePreview
                template={{
                  ...display,
                  canvas: { ...display.canvas, duration: currentScene?.duration ?? display.canvas.duration },
                  scenes: currentScene ? [currentScene] : display.scenes,
                }}
                selectedSlotId={selectedSlot}
                onSelectSlot={setSelectedSlot}
                variantSeed={previewVariant}
                editable={editing}
                onChangeSlotRect={(slotId, next) => updateSlotRect(slotId, next)}
              />
              <div className="mt-3">
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
              </div>
            </div>

            <div className="space-y-4">
              {editing && working && (
                <CanvasEditor canvas={working.canvas} onChange={updateCanvas} />
              )}

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

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="size-4 text-brand-500" />
                    {currentScene?.label || "场景"} · 内容位 ({currentSceneSlots.length})
                  </CardTitle>
                  {editing && (
                    <Button variant="ghost" size="sm" onClick={addSlot}>
                      <Plus className="size-3.5" /> 添加一个
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {currentSceneSlots.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      本场景还没有内容位{editing ? ',点上方"+ 添加一个"来加' : ''}
                    </div>
                  )}
                  {currentSceneSlots.map((s) => {
                    const isSelected = selectedSlot === s.slot_id;
                    return (
                      <SlotCard
                        key={s.slot_id}
                        slot={s}
                        selected={isSelected}
                        editing={editing}
                        onSelect={() => setSelectedSlot(isSelected ? null : s.slot_id)}
                        onChange={(patch) => updateSlot(s.slot_id, patch)}
                        onChangeRect={(patch) => updateSlotRect(s.slot_id, patch)}
                        onChangePolicy={(patch) => updateSlotPolicy(s.slot_id, patch)}
                        onRemove={() => removeSlot(s.slot_id)}
                      />
                    );
                  })}
                </CardContent>
              </Card>

            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">模板说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat
                  label="成片尺寸"
                  value={`${display.canvas.width}×${display.canvas.height}`}
                  hint={orientationLabel(display.canvas.width, display.canvas.height)}
                />
                <Stat label="成片时长" value={`${display.canvas.duration} 秒`} />
                <Stat label="可编辑内容位" value={`${flatSlots.length} 个`} />
                <Stat label="其中必填" value={`${requiredSlots.length} 项`} />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">差异化策略</div>
                <div className="flex items-center gap-2">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">使用数据</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="size-3 text-orange-500" /> 日生产量</span>
                <span className="text-sm font-semibold">{formatNumber(display.metadata.daily_creation_count ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="size-3 text-emerald-500" /> 平台存活率</span>
                <span className="text-sm font-semibold">{display.metadata.hit_rate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="size-3" /> 标签</span>
                <div className="flex gap-1">
                  {display.metadata.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {!editing && (
            <>
              <Button variant="gradient" size="xl" className="w-full" asChild>
                <Link href={`/mixcut/create/${display.template_id}`}>
                  <Sparkles className="size-4" />
                  使用此模板创建
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
              <div className="text-[10px] text-center text-muted-foreground">
                创建后系统将自动嵌入追溯水印
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Canvas 编辑器 ───────────────────────────────────────────────────────────

function CanvasEditor({
  canvas,
  onChange,
}: {
  canvas: Template["canvas"];
  onChange: (patch: Partial<Template["canvas"]>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">画布与时长</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(["短视频", "手机原生", "其他"] as const).map((group) => {
          const items = CANVAS_PRESETS.filter((p) => p.group === group);
          return (
            <div key={group} className="space-y-1.5">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {group}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {items.map((p) => {
                  const on = canvas.width === p.w && canvas.height === p.h;
                  return (
                    <button
                      key={p.label + p.w + p.h}
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
          );
        })}
        <div className="grid grid-cols-2 gap-3">
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
          这是成片的画面尺寸,所有内容位的位置和大小都按这个画面比例自动缩放。总时长由下方场景时长累加而来。
        </p>
      </CardContent>
    </Card>
  );
}

// ── 内容位卡片(只读 / 编辑两态) ──────────────────────────────────────────────

function SlotCard({
  slot,
  selected,
  editing,
  onSelect,
  onChange,
  onChangeRect,
  onChangePolicy,
  onRemove,
}: {
  slot: TemplateSlot;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TemplateSlot>) => void;
  onChangeRect: (patch: Partial<NonNullable<TemplateSlot["rect"]>>) => void;
  onChangePolicy: (patch: Partial<SlotPerturbationPolicy>) => void;
  onRemove: () => void;
}) {
  const resolvedPolicy = useMemo(
    () => resolvePolicy(slot.layer_type, slot.perturbation_policy),
    [slot.layer_type, slot.perturbation_policy]
  );

  if (!editing) {
    // 只读视图:所有英文 / 工程话术翻译成运营能读的中文
    return (
      <button
        onClick={onSelect}
        className={cn(
          "w-full text-left p-3 rounded-lg border transition-colors",
          selected
            ? "border-brand-500/60 bg-brand-500/5"
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
        selected ? "border-brand-500/60 bg-brand-500/5" : "border-border"
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
          onChange={(v) => onChange({ layer_type: v as LayerType })}
        />
        <SelectField
          label="谁来填"
          value={slot.fill_strategy}
          options={FILL_OPTIONS}
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

      <div>
        <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
          画面位置与大小 · <span className="text-foreground">{describeRect(slot.rect)}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <NumField
            label="左 (0~1)"
            value={slot.rect?.x ?? 0}
            min={0} max={1} step={0.01}
            onChange={(v) => onChangeRect({ x: clamp01(v) })}
          />
          <NumField
            label="上 (0~1)"
            value={slot.rect?.y ?? 0}
            min={0} max={1} step={0.01}
            onChange={(v) => onChangeRect({ y: clamp01(v) })}
          />
          <NumField
            label="宽 (0~1)"
            value={slot.rect?.w ?? 1}
            min={0.01} max={1} step={0.01}
            onChange={(v) => onChangeRect({ w: clamp01(v) })}
          />
          <NumField
            label="高 (0~1)"
            value={slot.rect?.h ?? 1}
            min={0.01} max={1} step={0.01}
            onChange={(v) => onChangeRect({ h: clamp01(v) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumField
          label="开始 (秒)"
          value={slot.time_range[0]}
          min={0} max={120} step={0.5}
          onChange={(v) => onChange({ time_range: [v, slot.time_range[1]] })}
        />
        <NumField
          label="结束 (秒)"
          value={slot.time_range[1]}
          min={0} max={120} step={0.5}
          onChange={(v) => onChange({ time_range: [slot.time_range[0], v] })}
        />
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

      <div>
        <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
          差异化处理(默认按「{LAYER_LABELS[slot.layer_type]}」类型走)
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <PolicyToggle
            label="左右翻转"
            current={slot.perturbation_policy?.allow_mirror}
            fallback={resolvedPolicy.allow_mirror}
            onChange={(v) => onChangePolicy({ allow_mirror: v })}
          />
          <PolicyToggle
            label="位置微移"
            current={slot.perturbation_policy?.allow_position_jitter}
            fallback={resolvedPolicy.allow_position_jitter}
            onChange={(v) => onChangePolicy({ allow_position_jitter: v })}
          />
          <PolicyToggle
            label="缩放抖动"
            current={slot.perturbation_policy?.allow_scale_jitter}
            fallback={resolvedPolicy.allow_scale_jitter}
            onChange={(v) => onChangePolicy({ allow_scale_jitter: v })}
          />
          <PolicyToggle
            label="速度微调"
            current={slot.perturbation_policy?.allow_speed_jitter}
            fallback={resolvedPolicy.allow_speed_jitter}
            onChange={(v) => onChangePolicy({ allow_speed_jitter: v })}
          />
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground">编号:{slot.slot_id}</div>
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v}>{l}</option>
          );
        })}
      </select>
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

/**
 * 三态 toggle:override (true / false) vs fallback (来自 layer 默认)。
 * - undefined: 沿用 layer 默认值
 * - true / false: 显式覆盖
 * 点击循环:default → true → false → default
 */
function PolicyToggle({
  label, current, fallback, onChange,
}: {
  label: string;
  current: boolean | undefined;
  fallback: boolean;
  onChange: (v: boolean | undefined) => void;
}) {
  const effective = current ?? fallback;
  const isOverride = current !== undefined;
  const cycle = () => {
    if (current === undefined) onChange(true);
    else if (current === true) onChange(false);
    else onChange(undefined);
  };
  return (
    <button
      onClick={cycle}
      title={isOverride ? "显式覆盖,再点恢复默认" : "沿用 layer 默认"}
      className={cn(
        "px-2 py-1.5 rounded-md text-xs border transition-colors text-left",
        effective
          ? "bg-foreground text-background border-foreground"
          : "bg-secondary/40 border-border text-muted-foreground",
        isOverride && "ring-2 ring-brand-500/40"
      )}
    >
      <div className="font-medium flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px]">
          {effective ? "✓" : "—"}{isOverride ? "*" : ""}
        </span>
      </div>
    </button>
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

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function orientationLabel(w: number, h: number): string {
  if (h > w * 1.1) return "竖屏 · 适合抖音/小红书";
  if (w > h * 1.1) return "横屏 · 适合 B 站/视频号";
  return "方形 · 适合 Feed 流";
}
