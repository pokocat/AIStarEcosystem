"use client";

import * as React from "react";
import { FileJson, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { MixcutTemplatesApi } from "@/api";
import type {
  MixcutPerturbationProfile,
  MixcutTemplate,
  MixcutTemplatePayload,
  MixcutTier,
} from "@/api/mixcut-templates";
import { formatDateCN } from "@/lib/utils";
import { useConfirm, useToast } from "@/components/feedback";

const TIER_OPTIONS: { value: MixcutTier; label: string }[] = [
  { value: "trial", label: "试用" },
  { value: "basic", label: "基础" },
  { value: "standard", label: "标准" },
  { value: "professional", label: "专业" },
  { value: "annual_pro", label: "年费专业" },
  { value: "city_agent", label: "城市代理" },
];

const PROFILE_OPTIONS: { value: MixcutPerturbationProfile; label: string }[] = [
  { value: "light", label: "轻度" },
  { value: "moderate", label: "中度" },
  { value: "aggressive", label: "强扰动" },
];

const DEFAULT_CANVAS = {
  width: 1080,
  height: 1920,
  duration: 15,
  fps: 30,
  background_color: "#111827",
};

const DEFAULT_SCENES = [
  {
    id: "scene-1",
    label: "主画面",
    duration: 15,
    slots: [],
  },
];

export default function AdminMixcutTemplatesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = React.useState<MixcutTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [tierFilter, setTierFilter] = React.useState<"all" | MixcutTier>("all");
  const [editing, setEditing] = React.useState<MixcutTemplate | null>(null);
  const [creating, setCreating] = React.useState(false);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await MixcutTemplatesApi.listFactoryTemplates();
      setTemplates(Array.isArray(list) ? list : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = templates.filter((t) => {
    const query = q.trim().toLowerCase();
    if (query) {
      const haystack = [
        t.template_id,
        t.name,
        t.metadata?.category,
        ...(t.metadata?.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (tierFilter !== "all" && t.metadata?.required_tier !== tierFilter) return false;
    return true;
  });

  const categoryCount = new Set(templates.map((t) => t.metadata?.category).filter(Boolean)).size;
  const slotCount = templates.reduce((sum, t) => sum + countSlots(t), 0);

  async function handleDelete(t: MixcutTemplate) {
    const res = await confirm({
      title: "删除混剪工厂模板",
      tone: "danger",
      confirmLabel: "确认删除",
      description: "删除后用户端不再展示这条公共模板；已有用户私有副本不会被删除。",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">{t.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{t.template_id}</div>
        </div>
      ),
    });
    if (!res.ok) return;
    try {
      await MixcutTemplatesApi.deleteFactoryTemplate(t.template_id);
      await reload();
      toast.success({ title: "工厂模板已删除" });
    } catch (err) {
      toast.danger({
        title: "删除失败",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="混剪模板"
        description="维护混剪专区全局可见的工厂模板。用户保存的个人版本仍由用户端管理。"
        breadcrumb={[{ label: "明星带货" }, { label: "混剪模板" }]}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> 新增工厂模板
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="工厂模板" value={templates.length} icon={Sparkles} tone="success" />
        <StatCard label="分类数" value={categoryCount} icon={Sparkles} />
        <StatCard label="总场景" value={templates.reduce((sum, t) => sum + t.scenes.length, 0)} icon={FileJson} />
        <StatCard label="总槽位" value={slotCount} icon={FileJson} />
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">工厂模板清单</CardTitle>
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索模板名 / ID / 分类 / 标签"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as "all" | MixcutTier)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部档位</SelectItem>
              {TIER_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loadError && (
            <div className="px-4 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
              加载失败：{loadError}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模板</TableHead>
                <TableHead>分类 / 标签</TableHead>
                <TableHead>档位</TableHead>
                <TableHead>扰动</TableHead>
                <TableHead>场景 / 槽位</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    没有匹配的工厂模板
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.template_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {t.metadata.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.metadata.thumbnail_url}
                            alt=""
                            className="size-11 rounded-md border object-cover bg-secondary"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="size-11 rounded-md bg-secondary grid place-items-center">
                            <Sparkles className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate max-w-[280px]">{t.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{t.template_id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{t.metadata.category || "未分类"}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-[240px]">
                        {(t.metadata.tags ?? []).join(" / ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell>{tierLabel(t.metadata.required_tier)}</TableCell>
                    <TableCell>{profileLabel(t.perturbation_profile)}</TableCell>
                    <TableCell className="text-sm">
                      {t.scenes.length} / {countSlots(t)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.updated_at ? formatDateCN(t.updated_at) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void handleDelete(t)}>
                          <Trash2 className="size-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(creating || editing) && (
        <TemplateFormDialog
          template={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function TemplateFormDialog({
  template,
  onClose,
  onSaved,
}: {
  template: MixcutTemplate | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!template;
  const [templateId, setTemplateId] = React.useState(template?.template_id ?? "");
  const [name, setName] = React.useState(template?.name ?? "");
  const [version, setVersion] = React.useState(template?.version ?? "1.0");
  const [category, setCategory] = React.useState(template?.metadata.category ?? "通用");
  const [requiredTier, setRequiredTier] = React.useState<MixcutTier>(
    template?.metadata.required_tier ?? "basic",
  );
  const [tags, setTags] = React.useState((template?.metadata.tags ?? []).join(","));
  const [thumbnailUrl, setThumbnailUrl] = React.useState(template?.metadata.thumbnail_url ?? "");
  const [coverVideoUrl, setCoverVideoUrl] = React.useState(template?.metadata.cover_video_url ?? "");
  const [profile, setProfile] = React.useState<MixcutPerturbationProfile>(
    template?.perturbation_profile ?? "moderate",
  );
  const [variants, setVariants] = React.useState(String(template?.output_variants_default ?? 3));
  const [canvasWidth, setCanvasWidth] = React.useState(String(numberProp(template?.canvas, "width", DEFAULT_CANVAS.width)));
  const [canvasHeight, setCanvasHeight] = React.useState(String(numberProp(template?.canvas, "height", DEFAULT_CANVAS.height)));
  const [duration, setDuration] = React.useState(String(numberProp(template?.canvas, "duration", DEFAULT_CANVAS.duration)));
  const [fps, setFps] = React.useState(String(numberProp(template?.canvas, "fps", DEFAULT_CANVAS.fps)));
  const [backgroundColor, setBackgroundColor] = React.useState(
    stringProp(template?.canvas, "background_color", DEFAULT_CANVAS.background_color),
  );
  const [minPhashDistance, setMinPhashDistance] = React.useState(
    String(numberProp(template?.quality_gate, "min_phash_distance", 10)),
  );
  const [maxRetries, setMaxRetries] = React.useState(
    String(numberProp(template?.quality_gate, "max_retries", 3)),
  );
  const [scenesJson, setScenesJson] = React.useState(
    JSON.stringify(template?.scenes?.length ? template.scenes : DEFAULT_SCENES, null, 2),
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanId = templateId.trim();
    if (!cleanId) {
      setError("模板 ID 必填");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) {
      setError("模板 ID 只能包含字母、数字、下划线和连字符");
      return;
    }
    if (!name.trim()) {
      setError("模板名称必填");
      return;
    }

    let scenes: unknown[];
    try {
      const parsed = JSON.parse(scenesJson) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setError("scenes 必须是至少包含 1 个场景的 JSON 数组");
        return;
      }
      scenes = parsed;
    } catch (err) {
      setError(`scenes JSON 格式错误：${err instanceof Error ? err.message : "无法解析"}`);
      return;
    }

    const payload: MixcutTemplatePayload = {
      template_id: cleanId,
      name: name.trim(),
      version: version.trim() || "1.0",
      canvas: {
        width: positiveInt(canvasWidth, DEFAULT_CANVAS.width),
        height: positiveInt(canvasHeight, DEFAULT_CANVAS.height),
        duration: positiveNumber(duration, DEFAULT_CANVAS.duration),
        fps: positiveInt(fps, DEFAULT_CANVAS.fps),
        background_color: backgroundColor.trim() || DEFAULT_CANVAS.background_color,
      },
      scenes,
      perturbation_profile: profile,
      output_variants_default: positiveInt(variants, 3),
      quality_gate: {
        min_phash_distance: positiveInt(minPhashDistance, 10),
        max_retries: positiveInt(maxRetries, 3),
      },
      metadata: {
        category: category.trim() || "通用",
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        thumbnail_url: thumbnailUrl.trim() || undefined,
        required_tier: requiredTier,
        cover_video_url: coverVideoUrl.trim() || undefined,
      },
    };

    setSaving(true);
    try {
      if (isEdit && template) {
        await MixcutTemplatesApi.updateFactoryTemplate(template.template_id, {
          ...payload,
          template_id: template.template_id,
        });
      } else {
        await MixcutTemplatesApi.createFactoryTemplate(payload);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `编辑混剪模板：${template?.name}` : "新增混剪工厂模板"}</DialogTitle>
          <DialogDescription>
            保存后写入 ownerScope=factory 的公共模板；用户私有副本不会被覆盖或删除。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="grid grid-cols-2 gap-4">
            <Field label="模板 ID">
              <Input
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={isEdit}
                placeholder="tpl_product_showcase_v1"
              />
            </Field>
            <Field label="模板名称">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="商品展示 · 标准版" />
            </Field>
            <Field label="版本">
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0" />
            </Field>
            <Field label="分类">
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="美妆 / 食品 / 通用" />
            </Field>
            <Field label="开放档位">
              <Select value={requiredTier} onValueChange={(v) => setRequiredTier(v as MixcutTier)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="扰动强度">
              <Select value={profile} onValueChange={(v) => setProfile(v as MixcutPerturbationProfile)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROFILE_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="默认变体数">
              <Input value={variants} onChange={(e) => setVariants(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="标签">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="逗号分隔，如 美妆,新品" />
            </Field>
            <Field label="缩略图 URL">
              <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="/thumbs/example.svg" />
            </Field>
            <Field label="预览视频 URL">
              <Input value={coverVideoUrl} onChange={(e) => setCoverVideoUrl(e.target.value)} placeholder="https://..." />
            </Field>
          </section>

          <section>
            <div className="mb-2 text-sm font-medium">画布</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Field label="宽">
                <Input value={canvasWidth} onChange={(e) => setCanvasWidth(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="高">
                <Input value={canvasHeight} onChange={(e) => setCanvasHeight(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="时长秒">
                <Input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="FPS">
                <Input value={fps} onChange={(e) => setFps(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="背景色">
                <Input value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
              </Field>
            </div>
          </section>

          <section>
            <div className="mb-2 text-sm font-medium">质量门</div>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <Field label="最小 pHash 距离">
                <Input value={minPhashDistance} onChange={(e) => setMinPhashDistance(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="最大重试">
                <Input value={maxRetries} onChange={(e) => setMaxRetries(e.target.value)} inputMode="numeric" />
              </Field>
            </div>
          </section>

          <Field label="scenes JSON">
            <Textarea
              value={scenesJson}
              onChange={(e) => setScenesJson(e.target.value)}
              rows={16}
              className="font-mono text-xs"
              spellCheck={false}
            />
          </Field>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function numberProp(source: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringProp(source: Record<string, unknown> | undefined, key: string, fallback: string): string {
  const value = source?.[key];
  return typeof value === "string" ? value : fallback;
}

function positiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(raw: string, fallback: number): number {
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function countSlots(t: MixcutTemplate): number {
  return t.scenes.reduce<number>((sum, scene) => {
    if (!scene || typeof scene !== "object") return sum;
    const slots = (scene as { slots?: unknown }).slots;
    return sum + (Array.isArray(slots) ? slots.length : 0);
  }, 0);
}

function tierLabel(tier: MixcutTier): string {
  return TIER_OPTIONS.find((t) => t.value === tier)?.label ?? tier;
}

function profileLabel(profile: MixcutPerturbationProfile): string {
  return PROFILE_OPTIONS.find((p) => p.value === profile)?.label ?? profile;
}
