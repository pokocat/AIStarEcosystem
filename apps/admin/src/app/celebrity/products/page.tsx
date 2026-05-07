"use client";

import * as React from "react";
import { Package, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ProductsApi } from "@/api";
import type { Product, ProductCategory } from "@/types/product";
import { PRODUCT_CATEGORIES } from "@/types/product";
import { formatDateCN } from "@/lib/utils";
import { formatCompactNumber } from "@/lib/format";

export default function AdminProductsPage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<ProductCategory | "all">("all");

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

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除该商品？此操作不可撤销。")) return;
    try {
      await ProductsApi.deleteProduct(id);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  const totalUsage = products.reduce((s, p) => s + p.usageCount, 0);
  const autoCount = products.filter((p) => p.source === "auto-from-generation").length;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="商品库"
        description="AI 明星专区生成视频引用的商品档案。supports 用户手动录入与生成时自动落库（来自 /admin/products）。"
        breadcrumb={[{ label: "明星带货" }, { label: "商品库" }]}
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
          hint="生成时由系统补建"
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
                      {p.images[0] && (
                        <img src={p.images[0]} alt={p.name} className="h-8 w-8 rounded object-cover" />
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
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
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
    </div>
  );
}
