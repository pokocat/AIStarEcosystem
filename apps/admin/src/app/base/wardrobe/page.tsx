"use client";

import * as React from "react";
import Image from "next/image";
import { Shirt, Sparkles, Lock, TrendingUp, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { ARTIST_QUALITY } from "@/constants/status";
import { CLOTHING_DATABASE } from "@/mocks/wardrobe";
import type { ClothingCategory } from "@/types/wardrobe";

const CATEGORY_LABEL: Record<ClothingCategory, string> = {
  top: "上衣",
  bottom: "下装",
  accessory: "配饰",
  shoes: "鞋履",
  hair: "发型",
  outfit: "整套搭配",
};

const CATEGORIES: { value: ClothingCategory | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "top", label: "上衣" },
  { value: "bottom", label: "下装" },
  { value: "accessory", label: "配饰" },
  { value: "shoes", label: "鞋履" },
  { value: "hair", label: "发型" },
];

export default function WardrobePage() {
  const [cat, setCat] = React.useState<ClothingCategory | "all">("all");
  const [query, setQuery] = React.useState("");

  const list = CLOTHING_DATABASE.filter((c) => {
    if (cat !== "all" && c.category !== cat) return false;
    if (query && !c.name.includes(query) && !c.tags.join(" ").toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const locked = CLOTHING_DATABASE.filter((c) => c.isLocked).length;
  const trending = CLOTHING_DATABASE.filter((c) => c.isTrending).length;
  const newCount = CLOTHING_DATABASE.filter((c) => c.isNew).length;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="造型库"
        description="服装 / 配饰 / 发型等虚拟物品的上架、稀有度与解锁状态管理"
        breadcrumb={[{ label: "运营基础数据" }, { label: "造型库" }]}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> 上架物品
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="物品总数" value={CLOTHING_DATABASE.length} icon={Shirt} />
        <StatCard label="新品" value={newCount} icon={Sparkles} tone="success" />
        <StatCard label="热门" value={trending} icon={TrendingUp} tone="warning" />
        <StatCard label="锁定中" value={locked} icon={Lock} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>物品清单</CardTitle>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索名称 / 标签"
              className="w-60"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={cat} onValueChange={(v) => setCat(v as ClothingCategory | "all")}>
            <TabsList>
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.value} value={c.value}>
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={cat}>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {list.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
                    <div className="aspect-square relative bg-surface-muted">
                      <Image src={c.imageUrl} alt={c.name} fill sizes="200px" className="object-cover" />
                      <div className="absolute top-1.5 left-1.5 flex gap-1">
                        {c.isNew && <Badge tone="success">新</Badge>}
                        {c.isTrending && <Badge tone="warning">热</Badge>}
                        {c.isLocked && <Badge tone="neutral">🔒</Badge>}
                      </div>
                      <div className="absolute top-1.5 right-1.5">
                        <StatusBadge meta={ARTIST_QUALITY[c.rarity]} />
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="font-medium text-sm truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{CATEGORY_LABEL[c.category]}</div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-sm tabular-nums font-medium">¥{c.price}</div>
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          编辑
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {list.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">未找到匹配物品</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
