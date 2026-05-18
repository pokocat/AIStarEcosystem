"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { Search, Crown, ShieldCheck, TrendingUp, Plus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Input } from "@/components/mixcut-zone/ui/input";
import { Separator } from "@/components/mixcut-zone/ui/separator";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { mockTemplates } from "@/mocks/mixcut";
import { MixcutApi } from "@/api";
import type { Tier, Template } from "@/components/mixcut-zone/types";
import { cn, formatNumber } from "@/components/mixcut-zone/lib/utils";

const CATEGORIES = [
  "全部",
  "汽车用品",
  "美妆个护",
  "食品饮料",
  "家居日用",
  "服饰鞋包",
  "数码",
  "AI 高级",
];

const TIERS: { value: "all" | Tier; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "basic", label: "基础" },
  { value: "standard", label: "标准" },
  { value: "professional", label: "专业" },
];

export default function MixcutTemplatesPage() {
  const router = useRouter();
  const [category, setCategory] = useState("全部");
  const [tier, setTier] = useState<"all" | Tier>("all");
  const [search, setSearch] = useState("");
  // 包含用户「另存为」/「保存为我的版本」生成的模板
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    MixcutApi.listTemplates().then(setTemplates);
  }, []);

  // 默认空模板:1080×1920 竖屏 / 15 秒 / 1 个空场景 / 无槽位。
  // 用户落地详情页后,通过编辑模式增加槽位、调整画布。
  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    const id = `tpl_${nanoid(8)}`;
    const fresh: Template = {
      template_id: id,
      name: "未命名模板",
      version: "0.1",
      canvas: {
        width: 1080,
        height: 1920,
        duration: 15,
        fps: 30,
        background_color: "#000000",
      },
      scenes: [
        { id: `scene_${nanoid(6)}`, label: "全片", duration: 15, slots: [] },
      ],
      perturbation_profile: "moderate",
      output_variants_default: 5,
      quality_gate: { min_phash_distance: 10, max_retries: 3 },
      metadata: {
        category: "未分类",
        tags: [],
        required_tier: "basic",
      },
    };
    try {
      await MixcutApi.saveTemplate(fresh);
      // ?edit=1 → 详情页落地后自动进入编辑态(由 template-detail-client 的 useEffect 处理,
      // 并在进入后把 query 从 URL 上清掉,避免刷新重复触发)
      router.push(`/mixcut/templates/${id}?edit=1`);
    } catch {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (category !== "全部" && t.metadata.category !== category) return false;
      if (tier !== "all" && t.metadata.required_tier !== tier) return false;
      if (search && !t.name.includes(search) && !t.metadata.tags.some((tag) => tag.includes(search))) return false;
      return true;
    });
  }, [templates, category, tier, search]);

  const isFiltering = search !== "" || category !== "全部" || tier !== "all";

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">模板库</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            选个模板,填进素材,一次生成多条差异化短视频
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          新建模板
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模板名称、标签、品类…"
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">品类</span>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs transition-colors border",
                  category === c
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <Separator />

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground shrink-0">套餐档位</span>
            {TIERS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTier(t.value)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs transition-colors border",
                  tier === t.value
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {isFiltering
            ? `匹配 ${filtered.length} / 共 ${templates.length} 个模板`
            : `共 ${templates.length} 个模板`}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map((t) => (
          <Link
            key={t.template_id}
            href={`/mixcut/templates/${t.template_id}`}
            className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="relative">
              <TemplatePreview template={t} showSlotChrome={false} />
              {/* z-30 必须 > 模板内最高 z_index (mocks 里到 20),否则贴图 / 底部品牌条会盖住 badge */}
              <div className="absolute top-2 left-2 z-30 flex flex-col gap-1">
                {t.metadata.required_tier === "professional" && (
                  <Badge variant="brand" className="gap-1 text-[10px] backdrop-blur">
                    <Crown className="size-2.5" /> 专业版
                  </Badge>
                )}
                {(t.metadata.hit_rate ?? 0) > 90 && (
                  <Badge variant="success" className="gap-1 text-[10px] backdrop-blur">
                    <ShieldCheck className="size-2.5" /> 不易判重
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm leading-tight line-clamp-1 group-hover:underline underline-offset-2">
                  {t.name}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{t.canvas.duration}s</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="muted" className="text-[10px]">{t.metadata.category}</Badge>
                {t.metadata.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                ))}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <TrendingUp className="size-2.5" />
                今日 {formatNumber(t.metadata.daily_creation_count ?? 0)} 条生成
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          没有匹配的模板,试试调整筛选条件
        </div>
      )}
    </div>
  );
}
