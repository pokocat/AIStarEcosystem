"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Product, Plan } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Package } from "lucide-react";

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
        apiFetch<Product[]>("/api/admin/products"),
        apiFetch<Plan[]>("/api/admin/plans"),
      ]);
      setProducts(productsData);
      setPlans(plansData);
    } catch {
      setError("Failed to load products or plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function plansForProduct(productId: string) {
    return plans.filter((p) => p.productId === productId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products &amp; Plans</h2>
          <p className="text-muted-foreground">
            Manage product catalog and subscription plans
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-600/30 bg-red-600/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Products grid */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Products</h3>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-lg border bg-card" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-36 items-center justify-center rounded-lg border bg-card text-muted-foreground">
            No products found.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const productPlans = plansForProduct(product.id);
              return (
                <Card key={product.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-400" />
                        <CardTitle className="text-base">{product.name}</CardTitle>
                      </div>
                      <Badge variant={product.enabled ? "success" : "secondary"}>
                        {product.enabled ? "active" : "disabled"}
                      </Badge>
                    </div>
                    <CardDescription className="font-mono text-xs">
                      {product.code}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {product.description && (
                      <p className="mb-2 text-sm text-muted-foreground">
                        {product.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {productPlans.length} plan{productPlans.length !== 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Plans table */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">Plans</h3>
        <div className="rounded-lg border bg-card">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="text-right">Annual</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No plans found.
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => {
                    const product = products.find((p) => p.id === plan.productId);
                    return (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {plan.code}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {product?.name ?? plan.productId}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(plan.monthlyPriceCents)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(plan.annualPriceCents)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={plan.enabled ? "success" : "secondary"}>
                            {plan.enabled ? "active" : "disabled"}
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
      </div>
    </div>
  );
}
