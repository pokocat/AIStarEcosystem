"use client";

import { useEffect, useState } from "react";
import { PencilLine, RefreshCw, Settings2 } from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import type { ConfigHistoryEntry, FeatureConfigItem, PageResponse } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function normalizeConfig(item: Partial<FeatureConfigItem>): FeatureConfigItem {
  return {
    id: item.id ?? "",
    configKey: item.configKey ?? "",
    configGroup: item.configGroup ?? "",
    valueType: (item.valueType ?? "STRING") as FeatureConfigItem["valueType"],
    value: item.value ?? "",
    defaultValue: item.defaultValue ?? "",
    scope: (item.scope ?? "GLOBAL") as FeatureConfigItem["scope"],
    productId: item.productId ?? null,
    planId: item.planId ?? null,
    tenantId: item.tenantId ?? null,
    isActive: Boolean(item.isActive),
    isEditableByOperator: Boolean(item.isEditableByOperator),
    description: item.description ?? null,
    minValue: item.minValue ?? null,
    maxValue: item.maxValue ?? null,
    updatedBy: item.updatedBy ?? null,
    updatedAt: item.updatedAt ?? "",
    createdAt: item.createdAt ?? "",
  };
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<FeatureConfigItem[]>([]);
  const [editing, setEditing] = useState<FeatureConfigItem | null>(null);
  const [nextValue, setNextValue] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [history, setHistory] = useState<ConfigHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function fetchConfigs() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<unknown>("/api/admin/config?page=0&size=100");
      const page = normalizePageResponse<Partial<FeatureConfigItem>>(data, ["content", "items"]);
      setConfigs(page.content.map(normalizeConfig));
    } catch {
      setConfigs([]);
      setError("加载系统配置失败。");
    } finally {
      setLoading(false);
    }
  }

  async function openEditor(item: FeatureConfigItem) {
    setEditing(item);
    setNextValue(item.value);
    setChangeReason("");
    const data = await apiFetch<ConfigHistoryEntry[]>(`/api/admin/config/${encodeURIComponent(item.configKey)}/history`);
    setHistory(data);
  }

  async function saveConfig() {
    if (!editing) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/config/${encodeURIComponent(editing.configKey)}`, {
        method: "PATCH",
        body: JSON.stringify({
          value: nextValue,
          change_reason: changeReason,
        }),
      });
      setEditing(null);
      setHistory([]);
      await fetchConfigs();
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void fetchConfigs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">系统设置</h2>
          <p className="text-sm text-muted-foreground">
            连接后端配置中心，支持查看并修改影响前端行为的参数。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchConfigs} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">配置概览</CardTitle>
          <CardDescription>当前已加载的 feature config 数量</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end justify-between">
          <div className="text-3xl font-semibold tracking-tight text-slate-950">
            {loading ? "..." : configs.length}
          </div>
          <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
            <Settings2 className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="warning">
          <AlertTitle>系统配置暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>配置 Key</TableHead>
              <TableHead>分组</TableHead>
              <TableHead>当前值</TableHead>
              <TableHead>默认值</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs text-slate-900">{item.configKey}</TableCell>
                <TableCell>{item.configGroup}</TableCell>
                <TableCell className="font-mono text-xs">{item.value}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{item.defaultValue}</TableCell>
                <TableCell>
                  <Dialog open={editing?.id === item.id} onOpenChange={(open) => !open && setEditing(null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => void openEditor(item)}>
                        <PencilLine className="mr-2 h-4 w-4" />
                        编辑
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{editing?.configKey}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>当前值</Label>
                          <Input value={nextValue} onChange={(event) => setNextValue(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>变更原因</Label>
                          <Input
                            value={changeReason}
                            onChange={(event) => setChangeReason(event.target.value)}
                            placeholder="至少 10 个字符"
                          />
                        </div>
                        <div className="rounded-xl border border-border bg-muted/40 p-3">
                          <p className="mb-2 text-sm font-medium text-slate-900">最近历史</p>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            {history.slice(0, 3).map((entry) => (
                              <div key={entry.id}>
                                {entry.oldValue} → {entry.newValue} · {entry.changeReason}
                              </div>
                            ))}
                            {history.length === 0 ? <div>暂无历史记录</div> : null}
                          </div>
                        </div>
                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
                          <Button onClick={() => void saveConfig()} disabled={saving}>
                            {saving ? "保存中..." : "保存变更"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
