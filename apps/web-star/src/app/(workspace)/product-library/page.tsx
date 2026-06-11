"use client";

// 商品库 — 已审核入库商品的运营视图，达人可带货创作。

import * as React from "react";
import { Database, Package } from "lucide-react";
import type { StarProductLibItem } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { formatDate, formatNumber, formatYuan } from "@/lib/format";
import { EmptyState, InlineError, LoadingList, PageHeader } from "@/components/star/page-kit";

const ACCENT = "#14b8a6";

export default function ProductLibraryPage() {
  const [items, setItems] = React.useState<StarProductLibItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.listProductLibrary()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <PageHeader
        title="商品库"
        sub={items ? `共 ${items.length} 件已审核入库商品，达人可带货创作` : "已审核入库商品的运营视图"}
        right={
          <span className="text-[11px] font-semibold rounded-full px-3 py-1 shrink-0" style={{ color: ACCENT, border: `1px solid ${ACCENT}55`, background: `${ACCENT}0d` }}>
            达人可带货
          </span>
        }
      />
      <InlineError message={error} onDismiss={() => setError(null)} />

      {!items ? (
        <LoadingList />
      ) : items.length === 0 ? (
        <EmptyState icon={Database} title="商品库为空" sub="商品入库流程双路样品验收通过后，商品会自动进入商品库。" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.id} className="star-card star-card-hover p-4">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
                  <Package className="w-6 h-6" style={{ color: "var(--ink-2)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: "var(--ink-0)" }}>{item.productName}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] flex-wrap">
                    <span className="font-black tabular" style={{ color: "var(--star-gold-deep)" }}>{formatYuan(item.priceCents)}</span>
                    <span style={{ color: "var(--ink-1)" }}>{item.brand}</span>
                    <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--bg-2)", color: "var(--ink-1)" }}>{item.category}</span>
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: "var(--ink-2)" }}>
                    {item.mcnName} · 入库：{formatDate(item.approvedAt)}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-2)" }}>
                      <div className="h-full rounded-full" style={{ background: ACCENT, width: `${Math.min((item.salesCount / 3000) * 100, 100)}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold shrink-0 tabular" style={{ color: ACCENT }}>
                      {formatNumber(item.salesCount)} 销量
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
