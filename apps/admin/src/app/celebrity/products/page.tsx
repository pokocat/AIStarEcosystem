"use client";

import * as React from "react";
import { Image as ImageIcon, Link2, Loader2, Package, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductsApi } from "@/api";
import type { Product, ProductCategory, ProductInput } from "@/types/product";
import { PRODUCT_CATEGORIES } from "@/types/product";
import { formatDateCN } from "@/lib/utils";
import { formatCompactNumber } from "@/lib/format";
import { useConfirm, useToast } from "@/components/feedback";

export default function AdminProductsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<ProductCategory | "all">("all");

  // 抖音链接建档 dialog
  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  // 手动新建 / 编辑 dialog
  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  // 刷新图片 in-flight 集合
  const [refreshing, setRefreshing] = React.useState<Set<string>>(new Set());

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await ProductsApi.listProducts({
        category: category === "all" ? "全部" : category,
        q: q.trim() || undefined,
      });
      setProducts(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [category, q]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const handleDelete = async (p: Product) => {
    const res = await confirm({
      title: "删除商品",
      tone: "danger",
      confirmLabel: "确认删除",
      description: "删除后将从公共商品池移除，已挂载该商品的混剪任务不受影响。无法撤销。",
      affected: (
        <div className="space-y-1">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground">
            分类：{p.category} · 商品编号 <span className="font-mono">{p.id}</span>
          </div>
        </div>
      ),
    });
    if (!res.ok) return;
    try {
      await ProductsApi.deleteProduct(p.id);
      await reload();
      toast.success({ title: "商品已删除" });
    } catch (err) {
      toast.danger({
        title: "删除失败",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleRefreshImages = async (p: Product) => {
    if (!p.link) return;
    setRefreshing((s) => new Set(s).add(p.id));
    try {
      const n = await ProductsApi.refreshImages(p.id);
      await reload();
      if (n === 0) {
        toast.warning({
          title: "未抓到新图片",
          description: "原链接可能已失效，或商品页 DOM 结构变化。",
        });
      } else {
        toast.success({ title: `已更新 ${n} 张图片` });
      }
    } catch (err) {
      toast.danger({
        title: "刷新图片失败",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRefreshing((s) => {
        const next = new Set(s);
        next.delete(p.id);
        return next;
      });
    }
  };

  const handleNew = () => {
    setEditing(null);
    setFormDialogOpen(true);
  };
  const handleEdit = (p: Product) => {
    setEditing(p);
    setFormDialogOpen(true);
  };

  const totalUsage = products.reduce((s, p) => s + p.usageCount, 0);
  const autoCount = products.filter((p) => p.source === "auto-from-generation").length;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="商品库"
        description="AI 明星专区生成视频引用的公共商品池。普通用户只读；CRUD / 抖音链接建档 / 刷新图片仅运营可操作。"
        breadcrumb={[{ label: "明星带货" }, { label: "商品库" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLinkDialogOpen(true)}>
              <Link2 className="h-4 w-4 mr-1.5" /> 从抖音链接建档
            </Button>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-1.5" /> 新建商品
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="商品总数" value={products.length} icon={Package} />
        <StatCard
          label="累计被引用次数"
          value={formatCompactNumber(totalUsage)}
          hint="生成视频复用次数累计"
          icon={Package}
          tone="success"
        />
        <StatCard
          label="自动落库"
          value={autoCount}
          hint="历史 v0.28- 生成时由系统补建"
          icon={Package}
        />
        <StatCard
          label="覆盖品类"
          value={new Set(products.map((p) => p.category)).size}
          icon={Package}
        />
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">商品清单</CardTitle>
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="按名称 / 卖点搜索"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory | "all")}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部品类</SelectItem>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loadError && (
            <div className="px-4 py-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
              加载失败：{loadError}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类目</TableHead>
                <TableHead>来源</TableHead>
                <TableHead className="text-right">引用</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                </TableRow>
              )}
              {!loading && products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {p.images[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium">{p.name}</span>
                        {p.link && (
                          <a
                            href={p.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary truncate max-w-[260px]"
                          >
                            {p.link}
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><span className="rounded-md border px-2 py-0.5 text-xs">{p.category}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.source === "manual" ? "手动录入" : "自动落库"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.usageCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateCN(p.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {p.link && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRefreshImages(p)}
                          disabled={refreshing.has(p.id)}
                          title="从链接重新抓取商品图（追加，不覆盖旧素材）"
                        >
                          {refreshing.has(p.id)
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(p)} title="编辑">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(p)} title="删除">
                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">暂无商品</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FromLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        onCreated={() => {
          setLinkDialogOpen(false);
          void reload();
        }}
      />
      <ProductFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        initial={editing}
        onSaved={() => {
          setFormDialogOpen(false);
          void reload();
        }}
      />
    </div>
  );
}

// ── 抖音链接建档 dialog ────────────────────────────────────────────────────
function FromLinkDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setUrl("");
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await ProductsApi.fromLink(trimmed);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败，请改用「新建商品」手动填写。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> 从抖音链接建档
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          支持「分享长链」和「PC 选品库短链」两种形态；后端会自动抽取商品名 / 图片 / 价格。
        </p>
        <Textarea
          className="min-h-[88px]"
          placeholder="粘贴抖音商城链接，例如 https://haohuo.jinritemai.com/...?id=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
        />
        {error && <div className="text-xs text-rose-600">{error}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={busy || !url.trim()}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 解析中…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1.5" /> 解析并建档
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 手动新建 / 编辑 dialog ────────────────────────────────────────────────
function ProductFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Product | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<ProductCategory>("日用百货");
  const [link, setLink] = React.useState("");
  const [sellingPoints, setSellingPoints] = React.useState("");
  const [imagesText, setImagesText] = React.useState("");
  const [priceYuan, setPriceYuan] = React.useState("");
  const [commission, setCommission] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [extracting, setExtracting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setExtracting(false);
    if (initial) {
      setName(initial.name);
      setCategory(initial.category);
      setLink(initial.link ?? "");
      setSellingPoints(initial.sellingPoints);
      setImagesText(initial.images.join("\n"));
      setPriceYuan(initial.priceCents != null ? (initial.priceCents / 100).toString() : "");
      setCommission(initial.commissionRate != null ? initial.commissionRate.toString() : "");
    } else {
      setName("");
      setCategory("日用百货");
      setLink("");
      setSellingPoints("");
      setImagesText("");
      setPriceYuan("");
      setCommission("");
    }
  }, [open, initial]);

  const handleExtract = async () => {
    if (!name.trim() || !link.trim()) return;
    setExtracting(true);
    try {
      const r = await ProductsApi.extractSellingPoints({ name: name.trim(), link: link.trim() });
      setSellingPoints(r.sellingPoints);
      toast.success({ title: "已抽取卖点" });
    } catch (e) {
      toast.danger({
        title: "AI 抽取失败",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("商品名称不能为空");
      return;
    }
    const images = imagesText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedPrice = priceYuan.trim() ? Math.round(parseFloat(priceYuan) * 100) : undefined;
    const parsedCommission = commission.trim() ? Number(commission) : undefined;
    const input: ProductInput = {
      name: trimmedName,
      category,
      link: link.trim() || undefined,
      images,
      sellingPoints: sellingPoints.trim(),
      priceCents: Number.isFinite(parsedPrice) ? parsedPrice : undefined,
      commissionRate: Number.isFinite(parsedCommission) ? parsedCommission : undefined,
    };
    setBusy(true);
    setError(null);
    try {
      if (initial) {
        await ProductsApi.updateProduct(initial.id, input);
      } else {
        await ProductsApi.createProduct(input);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const canExtract = !!(name.trim() && link.trim()) && !extracting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑商品" : "新建商品"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">商品名称</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：xxx 焕亮精华液 30ml" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">类目</label>
            <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">商品链接（可选）</label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">售价（元，可选）</label>
            <Input value={priceYuan} onChange={(e) => setPriceYuan(e.target.value)} placeholder="例如 99 或 99.90" inputMode="decimal" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">佣金率 %（可选）</label>
            <Input value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="例如 18" inputMode="numeric" />
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">卖点描述</label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExtract}
                disabled={!canExtract}
                title={!canExtract ? "请先填写名称和链接" : "调用 AI 抽取卖点"}
              >
                {extracting
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> AI 抽取中…</>
                  : <><Sparkles className="h-3.5 w-3.5 mr-1" /> AI 提取卖点</>}
              </Button>
            </div>
            <Textarea
              className="min-h-[88px]"
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              placeholder="多个卖点用换行分隔。"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">商品图片 URL（每行一条）</label>
            <Textarea
              className="min-h-[72px] font-mono text-xs"
              value={imagesText}
              onChange={(e) => setImagesText(e.target.value)}
              placeholder="https://..."
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              提示：使用「从抖音链接建档」可自动抓取图片并登记为 MixcutAsset；这里仅适合手动维护少量备选图。
            </p>
          </div>
        </div>

        {error && <div className="text-xs text-rose-600">{error}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 保存中…</> : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

