"use client";

import * as React from "react";
import { Shirt } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { Section } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listClothing } from "@/api/wardrobe";
import { ARTIST_QUALITY } from "@/constants/status";
import { formatCredits } from "@/lib/format";
import type { ClothingItem } from "@/types/wardrobe";

const CATEGORY_LABEL: Record<string, string> = {
  top: "上衣", bottom: "下装", accessory: "配饰",
  shoes: "鞋子", hair: "发型", outfit: "整套造型",
};

const CATEGORY_OPTIONS = [
  { value: "all", label: "全部品类" },
  ...Object.entries(CATEGORY_LABEL).map(([v, l]) => ({ value: v, label: l })),
];

const RARITY_OPTIONS = [
  { value: "all",       label: "全部稀有度" },
  { value: "common",    label: "普通" },
  { value: "rare",      label: "稀有" },
  { value: "epic",      label: "史诗" },
  { value: "legendary", label: "传说" },
];

export default function WardrobePage() {
  const { data } = useAsyncList(() => listClothing());
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [rarity, setRarity] = React.useState("all");

  const rows = data.filter((c) => {
    if (cat !== "all" && c.category !== cat) return false;
    if (rarity !== "all" && c.rarity !== rarity) return false;
    if (q && !c.name.includes(q) && !c.tags.some((t) => t.includes(q))) return false;
    return true;
  });

  return (
    <>
      <PageHeader title="造型库" description="服装 / 配饰 / 发型资源 · 管理定价、稀有度与上下架" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Shirt} label="造型总数" value={data.length} tone="primary" />
        <StatCard label="传说级" value={data.filter((c) => c.rarity === "legendary").length} tone="amber" />
        <StatCard label="新品" value={data.filter((c) => c.isNew).length} tone="emerald" />
        <StatCard label="已锁定" value={data.filter((c) => c.isLocked).length} tone="rose" />
      </div>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按名称 / 标签搜索" className="mb-3">
        <FilterChip label="品类" value={cat} options={CATEGORY_OPTIONS} onChange={setCat} />
        <FilterChip label="稀有度" value={rarity} options={RARITY_OPTIONS} onChange={setRarity} />
      </Toolbar>

      <Section padding={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-3">
          {rows.map((c) => (
            <ClothingCard key={c.id} item={c} />
          ))}
        </div>
      </Section>
    </>
  );
}

function ClothingCard({ item: c }: { item: ClothingItem }) {
  const r = ARTIST_QUALITY[c.rarity];
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden hover:card-elev-2 transition-shadow">
      <div className="aspect-square bg-muted relative overflow-hidden">
        {c.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={c.imageUrl} alt={c.name} className="h-full w-full object-cover" />
        )}
        {c.isLocked && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs">已锁定</div>
        )}
        {c.isNew && (
          <span className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500 text-white">NEW</span>
        )}
      </div>
      <div className="p-2.5">
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{c.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{CATEGORY_LABEL[c.category]}</div>
          </div>
          {r && <StatusBadge tone={mapTone(r.tone)} label={r.label} dot={false} className="text-[10px] px-1.5 py-0" />}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">售价</span>
          <span className="tabular-nums font-medium">{formatCredits(c.priceCredits ?? c.price)}</span>
        </div>
      </div>
    </div>
  );
}
