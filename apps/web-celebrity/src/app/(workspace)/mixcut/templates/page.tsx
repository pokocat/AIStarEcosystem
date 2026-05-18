"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search, Flame, Crown, Star, TrendingUp, ArrowUpRight, Filter } from "lucide-react";
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
  const [category, setCategory] = useState("全部");
  const [tier, setTier] = useState<"all" | Tier>("all");
  const [search, setSearch] = useState("");
  // 包含用户「另存为」/「保存为我的版本」生成的模板
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);

  useEffect(() => {
    MixcutApi.listTemplates().then(setTemplates);
  }, []);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (category !== "全部" && t.metadata.category !== category) return false;
      if (tier !== "all" && t.metadata.required_tier !== tier) return false;
      if (search && !t.name.includes(search) && !t.metadata.tags.some((tag) => tag.includes(search))) return false;
      return true;
    });
  }, [templates, category, tier, search]);

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">模板库</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            分区式模板 · 选个模板填入素材,5 分钟出 N 个抗去重版本
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted" className="gap-1">
            <Flame className="size-3 text-orange-500" />
            {templates.length} 个可用
          </Badge>
          <Badge variant="muted" className="gap-1">
            <Crown className="size-3 text-amber-500" />
            数字人专区
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索模板名称、标签、品类…"
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="default">
              <Filter className="size-4" />
              高级筛选
            </Button>
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
            <span className="text-xs text-muted-foreground shrink-0">套餐 tier</span>
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

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map((t) => (
          <Link key={t.template_id} href={`/mixcut/templates/${t.template_id}`} className="group">
            <div className="relative">
              <TemplatePreview template={t} showSlotChrome={false} />
              {/* z-20 必须 > 模板内最高 z_index (mocks 里到 20),否则贴图 / 底部品牌条会盖住 badge 和 CTA */}
              <div className="absolute top-2 left-2 z-30 flex flex-col gap-1">
                {t.metadata.required_tier === "professional" && (
                  <Badge variant="brand" className="gap-1 text-[10px] backdrop-blur">
                    <Crown className="size-2.5" /> 专业版
                  </Badge>
                )}
                {(t.metadata.hit_rate ?? 0) > 90 && (
                  <Badge variant="success" className="gap-1 text-[10px] backdrop-blur">
                    <Star className="size-2.5" /> 高存活率
                  </Badge>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 z-30 p-3 bg-gradient-to-t from-black via-black/70 to-transparent rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="gradient" size="sm" className="w-full">
                  立即使用 <ArrowUpRight className="size-3" />
                </Button>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm leading-tight line-clamp-1">{t.name}</div>
                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{t.canvas.duration}s</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="muted" className="text-[10px]">{t.metadata.category}</Badge>
                {t.metadata.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                ))}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="size-2.5" />
                  日产 {formatNumber(t.metadata.daily_creation_count ?? 0)}
                </span>
                <span>· 命中率 {t.metadata.hit_rate}%</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-muted-foreground">没有匹配的模板,试试调整筛选条件</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
