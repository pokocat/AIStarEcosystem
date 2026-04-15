"use client";

import { useEffect, useState } from "react";
import { Flag, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
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

type FeatureFlags = Record<string, boolean>;

export default function FeaturesPage() {
  const [flags, setFlags] = useState<[string, boolean][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchFlags() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<FeatureFlags>("/api/config/frontend/feature");
      setFlags(Object.entries(data));
    } catch {
      setFlags([]);
      setError("加载功能开关失败，当前回退为空列表。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchFlags();
  }, []);

  const enabledCount = flags.filter(([, enabled]) => enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">功能开关</h2>
          <p className="text-sm text-muted-foreground">
            对应 spec 中 `feature.*` 配置，供运营查看当前开放状态。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFlags} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">启用中的功能</CardTitle>
            <CardDescription>当前被打开的功能模块数量</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : enabledCount}
            </div>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <Flag className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">总开关数</CardTitle>
            <CardDescription>已向前端公开的 feature flag 数量</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tracking-tight text-slate-950">
            {loading ? "..." : flags.length}
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Alert variant="warning">
          <AlertTitle>功能开关暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>配置 Key</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                    当前没有可展示的功能开关。
                  </TableCell>
                </TableRow>
              ) : (
                flags.map(([key, enabled]) => (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs text-slate-900">{key}</TableCell>
                    <TableCell>
                      <Badge variant={enabled ? "success" : "secondary"}>
                        {enabled ? "已启用" : "已关闭"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
