"use client";

import * as React from "react";
import Image from "next/image";
import { Shirt, Sparkles, Lock, TrendingUp, Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { ARTIST_QUALITY } from "@/constants/status";
import type { ClothingCategory, ClothingItem, SaleStatus } from "@/types/wardrobe";
import { WardrobeApi, StoreApi } from "@/api";

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

const SALE_LABEL: Record<SaleStatus, string> = {
  FREE: "免费",
  PAID: "付费",
  LOCKED: "未上架",
};

const SALE_TONE: Record<SaleStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  FREE: "info",
  PAID: "success",
  LOCKED: "neutral",
};

export default function WardrobePage() {
  const [cat, setCat] = React.useState<ClothingCategory | "all">("all");
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<ClothingItem[]>([]);
  const [editing, setEditing] = React.useState<ClothingItem | null>(null);
  const [editPrice, setEditPrice] = React.useState<string>("0");
  const [editStatus, setEditStatus] = React.useState<SaleStatus>("FREE");
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ type: "ok" | "err"; msg: string } | null>(null);

  React.useEffect(() => {
    WardrobeApi.listClothing()
      .then((list) => setItems(list ?? []))
      .catch(() => { /* ignore */ });
  }, []);

  const list = items.filter((c) => {
    if (cat !== "all" && c.category !== cat) return false;
    if (query && !c.name.includes(query) && !c.tags.join(" ").toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const paid = items.filter((c) => c.saleStatus === "PAID").length;
  const locked = items.filter((c) => c.saleStatus === "LOCKED" || c.isLocked).length;
  const free = items.filter((c) => !c.saleStatus || c.saleStatus === "FREE").length;

  const openEdit = (item: ClothingItem) => {
    setEditing(item);
    setEditPrice(String(item.priceCredits ?? 0));
    setEditStatus(item.saleStatus ?? "FREE");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const price = Number(editPrice);
    if (!Number.isFinite(price) || price < 0) {
      setToast({ type: "err", msg: "价格必须是非负整数" });
      return;
    }
    setSaving(true);
    try {
      await StoreApi.updatePricing("WARDROBE", editing.id, {
        priceCredits: price,
        saleStatus: editStatus,
      });
      setItems((prev) => prev.map((it) => it.id === editing.id
        ? { ...it, priceCredits: price, saleStatus: editStatus }
        : it));
      setToast({ type: "ok", msg: `已更新：${editing.name}` });
      setEditing(null);
    } catch (e: any) {
      setToast({ type: "err", msg: typeof e?.message === "string" ? e.message : "保存失败" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="造型库"
        description="服装 / 配饰 / 发型等虚拟物品的上架、稀有度与积分定价管理"
        breadcrumb={[{ label: "运营基础数据" }, { label: "造型库" }]}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> 上架物品
          </Button>
        }
      />

      {toast && (
        <div className={`mb-4 rounded-md px-3 py-2 text-sm ${toast.type === "ok"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
          {toast.msg}
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="物品总数" value={items.length} icon={Shirt} />
        <StatCard label="免费" value={free} icon={Sparkles} />
        <StatCard label="付费" value={paid} icon={TrendingUp} tone="success" />
        <StatCard label="未上架" value={locked} icon={Lock} />
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
                {list.map((c) => {
                  const status: SaleStatus = c.saleStatus ?? "FREE";
                  const hasImg = Boolean(c.imageUrl);
                  return (
                    <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
                      <div className="aspect-square relative bg-surface-muted">
                        {hasImg ? (
                          <Image src={c.imageUrl} alt={c.name} fill sizes="200px" className="object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">无预览</div>
                        )}
                        <div className="absolute top-1.5 left-1.5 flex gap-1">
                          {c.isNew && <Badge tone="success">新</Badge>}
                          {c.isTrending && <Badge tone="warning">热</Badge>}
                          <Badge tone={SALE_TONE[status]}>{SALE_LABEL[status]}</Badge>
                        </div>
                        <div className="absolute top-1.5 right-1.5">
                          <StatusBadge meta={ARTIST_QUALITY[c.rarity]} />
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="font-medium text-sm truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{CATEGORY_LABEL[c.category]}</div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-sm tabular-nums font-medium">
                            {status === "PAID" ? `${c.priceCredits ?? 0}⭐` : SALE_LABEL[status]}
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(c)}>
                            <Pencil className="h-3 w-3 mr-1" /> 定价
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {list.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">未找到匹配物品</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>定价：{editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-muted-foreground">销售状态</label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as SaleStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">免费（默认可用）</SelectItem>
                  <SelectItem value="PAID">付费（扣积分购买）</SelectItem>
                  <SelectItem value="LOCKED">未上架（商店不显示）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">积分价格 (priceCredits)</label>
              <Input
                type="number"
                min={0}
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                disabled={editStatus !== "PAID"}
                placeholder="0 表示免费"
              />
              <p className="text-xs text-muted-foreground mt-1">仅当销售状态为「付费」时生效。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>取消</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
