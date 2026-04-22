"use client";

import * as React from "react";
import { Gift, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listDigitalIps } from "@/api/digital-ips";
import { ARTIST_QUALITY } from "@/constants/status";
import { formatCredits, formatCompactNumber } from "@/lib/format";

/**
 * NFT 市场页 — MVP 视图。
 * 目前数字藏品尚未接入独立后端，这里以艺人的"商业价值 + 品质"作为近似展示。
 * TODO: 接入 /admin/nft 端点后替换为真实 NFT 条目。
 */
export default function NftMarketPage() {
  const { data } = useAsyncList(() => listDigitalIps(0, 500));
  const drops = data.filter((a) => a.commercialValue > 500_000);

  return (
    <>
      <PageHeader
        title="数字藏品"
        description="收藏品上架与复核 · MVP 版以艺人形象 / 商业估值为 drop 候选"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> 创建 Drop
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Gift} label="候选 Drop" value={drops.length} tone="primary" hint="商业价值 ≥ 50w" />
        <StatCard label="已上架" value={0} tone="emerald" hint="MVP 阶段待联调" />
        <StatCard label="候选总估值" value={formatCredits(drops.reduce((s, a) => s + a.commercialValue, 0))} tone="violet" />
        <StatCard label="预计总销量" value={formatCompactNumber(drops.reduce((s, a) => s + Math.floor(a.stats.fans * 0.02), 0))} tone="amber" hint="按铁粉 2% 模型估算" />
      </div>

      <Section title="候选 Drop" description="按商业价值降序" padding={false}>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
          {drops.slice().sort((a, b) => b.commercialValue - a.commercialValue).map((a) => {
            const q = ARTIST_QUALITY[a.quality];
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card overflow-hidden card-elev-1 hover:card-elev-2 transition-shadow">
                <div className="aspect-square bg-muted overflow-hidden relative">
                  {a.avatar && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={a.avatar} alt={a.name} className="h-full w-full object-cover" />
                  )}
                  {q && (
                    <span className="absolute top-2 left-2">
                      <StatusBadge tone={mapTone(q.tone)} label={q.label} dot={false} />
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.studioName ?? a.studioId}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
                    <div>
                      <div className="text-muted-foreground">估值</div>
                      <div className="mt-0.5 tabular-nums font-medium">{formatCredits(a.commercialValue)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">粉丝</div>
                      <div className="mt-0.5 tabular-nums font-medium">{formatCompactNumber(a.stats.fans)}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
