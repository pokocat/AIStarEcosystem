"use client";

import * as React from "react";
import { ArrowDownAZ, Flame, Filter } from "lucide-react";
import { CelebrityStarCard } from "./CelebrityStarCard";
import { CATEGORY_FILTERS } from "@/constants/celebrity-zone-ui";
import type {
  CelebrityCategory,
  CelebrityStar,
} from "@/types/celebrity-zone";
import { cn } from "@/components/ui/utils";

interface Props {
  stars: CelebrityStar[];
}

type SortKey = "hot" | "price-asc" | "price-desc";
const SORT_LABEL: Record<SortKey, string> = {
  hot: "热度优先",
  "price-asc": "价格从低到高",
  "price-desc": "价格从高到低",
};

/** P1 主体：类目 Tab + 排序 + 4 列明星网格 */
export function CelebrityMarket({ stars }: Props) {
  const [category, setCategory] = React.useState<"全部" | CelebrityCategory>("全部");
  const [sort, setSort] = React.useState<SortKey>("hot");

  const filtered = React.useMemo(() => {
    let s = stars;
    if (category !== "全部") {
      s = s.filter(
        (x) => x.category === category || x.subCategories?.includes(category),
      );
    }
    s = [...s];
    if (sort === "hot") {
      s.sort((a, b) => Number(b.isHot) - Number(a.isHot));
    } else {
      const parse = (p: string) => parseInt(p.replace(/[^\d]/g, ""), 10) || 0;
      s.sort((a, b) =>
        sort === "price-asc"
          ? parse(a.startingPrice) - parse(b.startingPrice)
          : parse(b.startingPrice) - parse(a.startingPrice),
      );
    }
    return s;
  }, [stars, category, sort]);

  return (
    <div className="flex flex-col gap-5">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5">
        <div className="flex flex-wrap gap-1">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition",
                category === c
                  ? "text-cyan-300"
                  : "text-white/45 hover:text-white/80",
              )}
            >
              {c}
              {category === c && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t bg-gradient-to-r from-cyan-400 to-cyan-300" />
              )}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-white/35" />
          <SortMenu sort={sort} onChange={setSort} />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-white/40">
          暂无符合该筛选条件的明星
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <CelebrityStarCard key={s.id} star={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function SortMenu({
  sort,
  onChange,
}: {
  sort: SortKey;
  onChange: (next: SortKey) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/55 transition hover:border-white/30 hover:text-white"
      >
        {sort === "hot" ? (
          <Flame className="h-3 w-3" />
        ) : (
          <ArrowDownAZ className="h-3 w-3" />
        )}
        {SORT_LABEL[sort]}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] overflow-hidden rounded-md border border-white/10 bg-[#0f0f1a] shadow-lg">
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
              className={cn(
                "block w-full px-3 py-2 text-left text-xs transition hover:bg-white/[0.06]",
                sort === k ? "text-cyan-300" : "text-white/65",
              )}
            >
              {SORT_LABEL[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
