"use client";

import { useEffect, useState } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import type { AuditLog, PageResponse } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function RiskPage() {
  const [failures, setFailures] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchFailures() {
    setLoading(true);
    try {
      const data = await apiFetch<unknown>("/api/admin/audit-logs?page=0&size=10&result=FAILURE");
      const page = normalizePageResponse<AuditLog>(data, ["content", "logs", "auditLogs"]);
      setFailures(page.content);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchFailures();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">风控事件</h2>
          <p className="text-sm text-muted-foreground">
            `risk_events` 还未单独建模前，这里先用失败审计快照承接异常操作巡检。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFailures} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">待补齐能力</CardTitle>
          <CardDescription>与 spec 对齐后续待落地的风险治理模块</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">异地登录识别</div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">频繁兑换与批量生成告警</div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">误报标记与处置流转</div>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>动作</TableHead>
              <TableHead>资源</TableHead>
              <TableHead>时间</TableHead>
              <TableHead>结果</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {failures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  当前没有失败审计记录。
                </TableCell>
              </TableRow>
            ) : (
              failures.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-slate-900">{item.action}</TableCell>
                  <TableCell className="text-muted-foreground">{item.resourceType}</TableCell>
                  <TableCell className="text-muted-foreground">{item.createdAt}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      <TriangleAlert className="mr-1 h-3 w-3" />
                      失败
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Alert variant="info">
        <AlertTitle>当前实现说明</AlertTitle>
        <AlertDescription>
          这页已经接到了后端真实审计数据；等 `risk_events` 域模型落地后，可以直接把失败快照替换成独立风控事件流。
        </AlertDescription>
      </Alert>
    </div>
  );
}
