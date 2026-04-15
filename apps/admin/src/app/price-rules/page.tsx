"use client";

import { useEffect, useState } from "react";
import { Gauge, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

type CreditsConfig = Record<string, number>;
type PlanLimits = Record<string, Record<string, number>>;

export default function PriceRulesPage() {
  const [credits, setCredits] = useState<[string, number][]>([]);
  const [limits, setLimits] = useState<PlanLimits>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const [creditsData, limitsData] = await Promise.all([
        apiFetch<CreditsConfig>("/api/config/frontend/credits"),
        apiFetch<PlanLimits>("/api/config/plan-limits"),
      ]);
      setCredits(Object.entries(creditsData));
      setLimits(limitsData);
    } catch {
      setCredits([]);
      setLimits({});
      setError("加载价格规则失败，当前回退为空视图。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">价格规则</h2>
          <p className="text-sm text-muted-foreground">
            一期暂以 `credits.*` 和套餐限额配置映射展示 Phase 1 的计量规则。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">计量概览</CardTitle>
          <CardDescription>展示当前公开的 AI 能力积分消耗项</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end justify-between">
          <div className="text-3xl font-semibold tracking-tight text-slate-950">
            {loading ? "..." : credits.length}
          </div>
          <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
            <Gauge className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="warning">
          <AlertTitle>价格规则暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>计量项</TableHead>
                  <TableHead className="text-right">积分</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credits.map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs text-slate-900">{key}</TableCell>
                    <TableCell className="text-right font-mono">{value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>套餐限额项</TableHead>
                  <TableHead>free</TableHead>
                  <TableHead>pro</TableHead>
                  <TableHead>enterprise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(limits).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs text-slate-900">{key}</TableCell>
                    <TableCell>{value.free ?? "-"}</TableCell>
                    <TableCell>{value.pro ?? "-"}</TableCell>
                    <TableCell>{value.enterprise ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
