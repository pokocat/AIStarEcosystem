"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck, TrendingUp, Plus, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Input } from "@/components/mixcut-zone/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { MixcutApi } from "@/api";
import type { Template } from "@/components/mixcut-zone/types";
import { cn, formatNumber } from "@/components/mixcut-zone/lib/utils";
import { flatSlotsOf, firstScenePreviewTemplate } from "@/components/mixcut-zone/lib/scene-helpers";
import { canUseOperatorTools } from "@/lib/operator-role";
import { useConfirm } from "@/components/common/confirm-dialog";

const SLOT_SUMMARY_LABELS = {
  video: "视频",
  image: "图片",
  text: "文字",
  audio: "音频",
} as const;

const SLOT_SUMMARY_ORDER = ["video", "image", "text", "audio"] as const;

function templateStructureSummary(template: Template): string {
  const counts = flatSlotsOf(template).reduce<Record<string, number>>((acc, slot) => {
    acc[slot.layer_type] = (acc[slot.layer_type] ?? 0) + 1;
    return acc;
  }, {});

  const summary = SLOT_SUMMARY_ORDER
    .filter((layerType) => counts[layerType])
    .map((layerType) => `${counts[layerType]} ${SLOT_SUMMARY_LABELS[layerType]}`)
    .join(" · ");

  return summary || "空模板";
}

export default function MixcutTemplatesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canManageTemplates = canUseOperatorTools(user?.operatorRole);
  const { confirm, ConfirmHost } = useConfirm();
  const [category, setCategory] = useState("全部");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 包含用户「另存为」/「保存为我的版本」生成的模板
  const [templates, setTemplates] = useState<Template[]>([]);

  const loadTemplates = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoadingTemplates(true);
    setLoadError(null);
    try {
      const next = await MixcutApi.listTemplates();
      setTemplates(next);
    } catch (e: any) {
      setTemplates([]);
      setLoadError(e?.message ?? "模板加载失败,请稍后重试");
    } finally {
      if (!silent) setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(
        templates
          .map((t) => t.metadata.category?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b, "zh-CN"));
    return ["全部", ...values];
  }, [templates]);

  // 新建走 /new 路由：进入编辑器后**不立即落库**，用户点保存才会真正创建模板。
  // 这样取消 / 关页不会在「我的模板」里留下空模板（v0.21+ 修复）。
  const handleCreate = () => {
    if (!canManageTemplates) return;
    router.push("/mixcut/templates/new");
  };

  const handleDelete = async (template: Template) => {
    if (!canManageTemplates || deletingId) return;
    const isFactory = template.is_factory ?? MixcutApi.isFactoryTemplate(template.template_id);
    const ok = await confirm({
      title: isFactory ? "删除工厂模板?" : "删除模板?",
      description: (
        <span>
          {isFactory
            ? "该模板会从全局公共模板库隐藏，所有用户之后都不能再用它创建新任务。历史生成任务不会被删除。"
            : "删除后无法恢复。历史生成任务不会被删除，但之后不能再用这个模板创建新任务。"}
        </span>
      ),
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(template.template_id);
    try {
      const deleted = isFactory
        ? await MixcutApi.deleteFactoryTemplate(template.template_id)
        : await MixcutApi.deleteTemplate(template.template_id);
      if (deleted) {
        await loadTemplates({ silent: true });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim();
    return templates.filter((t) => {
      if (category !== "全部" && t.metadata.category !== category) return false;
      if (
        q &&
        !t.name.includes(q) &&
        !t.metadata.category.includes(q) &&
        !t.metadata.tags.some((tag) => tag.includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [templates, category, search]);

  const isFiltering = search.trim() !== "" || category !== "全部";
  const summaryText = loadingTemplates
    ? "正在加载模板"
    : isFiltering
      ? `匹配 ${filtered.length} / 共 ${templates.length} 个模板`
      : `共 ${templates.length} 个模板`;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">模板库</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            选模板，填素材，生成可分发的短视频
          </p>
        </div>
        {canManageTemplates && (
          <Button onClick={handleCreate}>
            <Plus className="size-4" />
            新建模板
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_116px] gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索模板、标签、品类"
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-10 rounded-md">
                <SelectValue placeholder="全部品类" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "全部" ? "全部品类" : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 原品类单选条改成搜索框右侧下拉：手机首屏不再被筛选占满。 */}
          <div className="sr-only" aria-live="polite">
            当前筛选：{category === "全部" ? "全部品类" : category}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{summaryText}</span>
      </div>

      {loadingTemplates ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5" aria-busy="true" aria-label="模板加载中">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="space-y-3">
              <div className="aspect-[9/16] rounded-xl bg-secondary/70 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-secondary/70 animate-pulse" />
              <div className="flex gap-2">
                <div className="h-5 w-14 rounded bg-secondary/60 animate-pulse" />
                <div className="h-5 w-20 rounded bg-secondary/60 animate-pulse" />
              </div>
              <div className="h-3 w-2/3 rounded bg-secondary/50 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((t) => (
          <div key={t.template_id} className="group rounded-xl">
            <Link
              href={`/mixcut/templates/${t.template_id}`}
              className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <TemplatePreview template={firstScenePreviewTemplate(t)} mode="blueprint" />
            </Link>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/mixcut/templates/${t.template_id}`}
                  className="min-w-0 flex-1 rounded-sm font-medium text-sm leading-tight line-clamp-1 hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                >
                  {t.name}
                </Link>
                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{t.canvas.duration}s</span>
                {canManageTemplates && (
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    disabled={deletingId === t.template_id}
                    title="删除模板"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === t.template_id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </button>
                )}
              </div>
              <Link
                href={`/mixcut/templates/${t.template_id}`}
                className="block rounded-sm space-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="muted" className="text-[10px]">{t.metadata.category}</Badge>
                  {(t.metadata.hit_rate ?? 0) > 90 && (
                    <Badge variant="success" className="gap-1 text-[10px]">
                      <ShieldCheck className="size-2.5" /> 独特性高
                    </Badge>
                  )}
                  {t.metadata.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                  ))}
                </div>
                <div className="line-clamp-1 text-[10px] text-muted-foreground">
                  {templateStructureSummary(t)}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <TrendingUp className="size-2.5" />
                  今日 {formatNumber(t.metadata.daily_creation_count ?? 0)} 条生成
                </div>
              </Link>
            </div>
          </div>
          ))}
        </div>
      )}

      {loadError && !loadingTemplates && (
        <div className="py-12 text-center text-sm text-red-500">
          {loadError}
        </div>
      )}

      {!loadError && !loadingTemplates && filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          没有匹配的模板,试试调整筛选条件
        </div>
      )}
      <ConfirmHost />
    </div>
  );
}
