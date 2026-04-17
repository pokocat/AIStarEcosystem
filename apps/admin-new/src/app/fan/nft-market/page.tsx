"use client";

import * as React from "react";
import { Gem, Sparkles, Shield, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionDialog } from "@/components/ActionDialog";
import { NFTMarket } from "@/mocks/fan";
import type { NFTItem } from "@/types/fan";
import type { Rarity } from "@/types/_shared";

const RARITY_META: Record<Rarity, { label: string; tone: "neutral" | "info" | "primary" | "warning" }> = {
  common: { label: "普通", tone: "neutral" },
  rare: { label: "稀有", tone: "info" },
  epic: { label: "史诗", tone: "primary" },
  legendary: { label: "传说", tone: "warning" },
};

function parsePrice(p: string): number {
  const m = /([\d.]+)\s*ETH/.exec(p);
  return m ? Number(m[1]) : 0;
}

export default function NFTMarketPage() {
  const [rarity, setRarity] = React.useState<Rarity | "all">("all");
  const [target, setTarget] = React.useState<{ nft: NFTItem; action: "approve" | "reject" | "offshelf" } | null>(null);

  const list = NFTMarket.filter((n) => rarity === "all" || n.rarity === rarity);

  const totalHolders = NFTMarket.reduce((s, n) => s + n.holders, 0);
  const legendaryCount = NFTMarket.filter((n) => n.rarity === "legendary").length;
  const gmv = NFTMarket.reduce((s, n) => s + parsePrice(n.price) * n.holders, 0);
  const avgPrice = NFTMarket.reduce((s, n) => s + parsePrice(n.price), 0) / (NFTMarket.length || 1);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="NFT 市场"
        description="数字收藏品上架审核、稀有度标定与二级市场监控"
        breadcrumb={[{ label: "社群与粉丝" }, { label: "NFT 市场" }]}
        actions={<Button size="sm">新建上架申请</Button>}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="在售藏品" value={NFTMarket.length} icon={Gem} />
        <StatCard label="持有人合计" value={totalHolders.toLocaleString("zh-CN")} icon={TrendingUp} tone="success" />
        <StatCard label="成交额估算" value={`${gmv.toFixed(2)} ETH`} hint={`均价 ${avgPrice.toFixed(3)} ETH`} icon={TrendingUp} />
        <StatCard label="传说稀有" value={legendaryCount} icon={Sparkles} tone="warning" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>藏品清单</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={rarity} onValueChange={(v) => setRarity(v as Rarity | "all")}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="legendary">传说</TabsTrigger>
              <TabsTrigger value="epic">史诗</TabsTrigger>
              <TabsTrigger value="rare">稀有</TabsTrigger>
              <TabsTrigger value="common">普通</TabsTrigger>
            </TabsList>

            <TabsContent value={rarity}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {list.map((n) => {
                  const meta = RARITY_META[n.rarity];
                  const gmvItem = parsePrice(n.price) * n.holders;
                  return (
                    <div key={n.id} className="rounded-xl border border-border bg-card p-4 card-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 text-2xl">
                          {n.preview}
                        </div>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <div className="font-medium text-sm truncate">{n.name}</div>
                      <div className="text-xs text-muted-foreground mb-3 truncate">{n.artist}</div>
                      <dl className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div>
                          <dt className="text-muted-foreground">挂牌价</dt>
                          <dd className="tabular-nums font-medium">{n.price}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">持有人</dt>
                          <dd className="tabular-nums font-medium">{n.holders.toLocaleString("zh-CN")}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-muted-foreground">GMV 估算</dt>
                          <dd className="tabular-nums font-medium">{gmvItem.toFixed(2)} ETH</dd>
                        </div>
                      </dl>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setTarget({ nft: n, action: "approve" })}>
                          <Shield className="h-3.5 w-3.5" /> 复核
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setTarget({ nft: n, action: "offshelf" })}>
                          下架
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {list.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">该稀有度下暂无藏品</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={
            target.action === "approve"
              ? `复核藏品：${target.nft.name}`
              : target.action === "reject"
              ? `驳回上架：${target.nft.name}`
              : `下架：${target.nft.name}`
          }
          description={`${target.nft.artist} · ${target.nft.price} · ${RARITY_META[target.nft.rarity].label}`}
          tone={target.action === "offshelf" || target.action === "reject" ? "danger" : "success"}
          confirmLabel={target.action === "approve" ? "核验通过" : target.action === "offshelf" ? "确认下架" : "驳回"}
          requireReason={target.action !== "approve"}
        />
      )}
    </div>
  );
}
