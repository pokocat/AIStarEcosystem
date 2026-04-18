"use client";

import * as React from "react";
import { Gift, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { NFTMarket } from "@/mocks/fan";
import { ARTIST_QUALITY } from "@/constants/status";
import type { NFTItem } from "@/types/fan";
import { formatCompactNumber } from "@/lib/format";

export default function NftMarketPage() {
  const [target, setTarget] = React.useState<{ nft: NFTItem; action: "approve" | "archive" } | null>(null);

  const counts = {
    total: NFTMarket.length,
    legendary: NFTMarket.filter((n) => n.rarity === "legendary").length,
    totalHolders: NFTMarket.reduce((s, n) => s + n.holders, 0),
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="NFT 市场"
        description="粉丝端收藏品上架审核与持有量监控。"
        breadcrumb={[{ label: "分发与变现" }, { label: "NFT 市场" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="上架藏品"   value={counts.total}                        icon={Gift} />
        <StatCard label="传说级"     value={counts.legendary}                    icon={Sparkles}  tone="warning" />
        <StatCard label="累计持有者" value={formatCompactNumber(counts.totalHolders)} icon={Users} tone="success" />
      </section>

      <Card>
        <CardHeader><CardTitle>藏品列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>藏品</TableHead>
                <TableHead>艺人</TableHead>
                <TableHead>稀有度</TableHead>
                <TableHead className="text-right">售价</TableHead>
                <TableHead className="text-right">持有者</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {NFTMarket.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <span className="text-2xl">{n.preview}</span>
                    {n.name}
                  </TableCell>
                  <TableCell className="text-sm">{n.artist}</TableCell>
                  <TableCell><StatusBadge meta={ARTIST_QUALITY[n.rarity]} /></TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{n.price}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatCompactNumber(n.holders)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setTarget({ nft: n, action: "approve" })}>复核</Button>
                      <Button size="sm" variant="outline" onClick={() => setTarget({ nft: n, action: "archive" })}>下架</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={target.action === "approve" ? `藏品复核：${target.nft.name}` : `下架藏品：${target.nft.name}`}
          description={`${target.nft.artist} · ${target.nft.price} · 持有者 ${formatCompactNumber(target.nft.holders)}`}
          tone={target.action === "approve" ? "primary" : "danger"}
          confirmLabel={target.action === "approve" ? "通过复核" : "下架"}
          requireReason
        />
      )}
    </div>
  );
}
