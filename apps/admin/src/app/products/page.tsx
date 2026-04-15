"use client";

import { useEffect, useState } from "react";
import { Package, RefreshCw } from "lucide-react";
import { apiFetch, normalizeListResponse } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Product, Plan } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function normalizeProduct(item: Partial<Product>): Product {
  return {
    id: item.id ?? "",
    code: item.code ?? "未命名编码",
    name: item.name ?? "未命名产品",
    description: item.description ?? null,
    enabled: Boolean(item.enabled),
    createdAt: item.createdAt ?? "",
  };
}

function normalizePlan(item: Partial<Plan>): Plan {
  return {
    id: item.id ?? "",
    productId: item.productId ?? "",
    code: item.code ?? "未命名套餐",
    name: item.name ?? "未命名套餐",
    monthlyPriceCents: Number(item.monthlyPriceCents ?? 0),
    annualPriceCents: Number(item.annualPriceCents ?? 0),
    enabled: Boolean(item.enabled),
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const [productsData, plansData] = await Promise.all([
        apiFetch<unknown>("/api/admin/products"),
        apiFetch<unknown>("/api/admin/plans"),
      ]);

      setProducts(normalizeListResponse<Partial<Product>>(productsData, ["products", "content"]).map(normalizeProduct));
      setPlans(normalizeListResponse<Partial<Plan>>(plansData, ["plans", "content"]).map(normalizePlan));
    } catch {
      setError("加载产品目录或套餐配置失败，当前展示为空列表。");
      setProducts([]);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function plansForProduct(productId: string) {
    return plans.filter((plan) => plan.productId === productId);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">产品与套餐</h2>
          <p className="text-sm text-muted-foreground">维护平台商品目录、套餐价格与启用状态。</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      {error && (
        <Alert variant="warning">
          <AlertTitle>目录数据暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">产品卡片</h3>
            <p className="text-sm text-muted-foreground">快速查看每个产品对应的套餐数量与启用情况。</p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border/80">
                <CardHeader className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card className="border-dashed border-border/80">
            <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              当前没有可展示的产品数据。
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const productPlans = plansForProduct(product.id);
              return (
                <Card key={product.id} className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
                          <Package className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{product.name}</CardTitle>
                          <CardDescription className="mt-1 font-mono text-xs">{product.code}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={product.enabled ? "success" : "secondary"}>
                        {product.enabled ? "启用中" : "已停用"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {product.description ?? "暂无产品说明，建议补充业务定位和适用场景。"}
                    </p>
                    <div className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                      关联套餐：<span className="font-medium text-slate-900">{productPlans.length}</span> 个
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">套餐价格表</h3>
          <p className="text-sm text-muted-foreground">适合运营同学做价格核查、启停确认与产品归属查看。</p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>套餐名称</TableHead>
                  <TableHead>编码</TableHead>
                  <TableHead>所属产品</TableHead>
                  <TableHead className="text-right">月付</TableHead>
                  <TableHead className="text-right">年付</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      当前没有可展示的套餐数据。
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => {
                    const product = products.find((item) => item.id === plan.productId);
                    return (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium text-slate-900">{plan.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{plan.code}</TableCell>
                        <TableCell className="text-muted-foreground">{product?.name ?? "未匹配产品"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(plan.monthlyPriceCents)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(plan.annualPriceCents)}</TableCell>
                        <TableCell>
                          <Badge variant={plan.enabled ? "success" : "secondary"}>
                            {plan.enabled ? "启用中" : "已停用"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
