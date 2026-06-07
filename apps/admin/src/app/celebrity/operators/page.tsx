"use client";

import * as React from "react";
import { Loader2, Search, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AepUsersApi } from "@/api";
import type { AepUser, OperatorRole, SubProduct } from "@/types/account";
import { ALL_SUB_PRODUCTS, SUB_PRODUCT_LABEL_ZH } from "@/types/account";
import { formatDateCN } from "@/lib/utils";
import { useToast } from "@/components/feedback";

/**
 * v0.31+: 平台运营 · celebrity 内嵌运营管理。
 * 列出 aep_users，并改某账号的 operatorRole（OPERATOR / SUPER_ADMIN / 无）。
 *
 * 与 admin 后台的 admin_users 体系**独立** —— 这里管的是「让一个 celebrity 用户
 * 也能在 web-celebrity 里做运营动作」的内嵌身份。
 */
export default function CelebrityOperatorsPage() {
  const toast = useToast();
  const [users, setUsers] = React.useState<AepUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [scope, setScope] = React.useState<"all" | "operators" | "non-operators">("all");
  // v0.53：平台访问编辑弹窗目标
  const [platformTarget, setPlatformTarget] = React.useState<AepUser | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await AepUsersApi.listAepUsers({
        q: q.trim() || undefined,
        hasOperator: scope === "operators" ? true : scope === "non-operators" ? false : undefined,
      });
      setUsers(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [q, scope]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const handleChange = async (user: AepUser, next: OperatorRole | null) => {
    if ((user.operatorRole ?? null) === next) return;
    setSavingId(user.id);
    try {
      await AepUsersApi.updateOperatorRole(user.id, next);
      await reload();
      toast.success({
        title: next ? `已设为${next === "super_admin" ? "超管" : "运营"}` : "已移除运营角色",
        description: user.displayName || user.username,
      });
    } catch (err) {
      toast.danger({
        title: "保存失败",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingId(null);
    }
  };

  const opCount = users.filter((u) => !!u.operatorRole).length;

  return (
    <div className="admin-page">
      <PageHeader
        title="平台运营 · 明星带货"
        description="把 celebrity 用户升级为内嵌运营，让他在 web-celebrity 里也能录入 / 编辑公共商品池等运营动作。与后台管理员是两套独立体系。"
        breadcrumb={[{ label: "明星带货" }, { label: "平台运营" }]}
      />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto inline-flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            celebrity 账号 · {users.length} 个（其中运营 {opCount}）
          </CardTitle>
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="按用户名 / 显示名 / 邮箱 / 手机号搜索"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部账号</SelectItem>
              <SelectItem value="operators">仅运营</SelectItem>
              <SelectItem value="non-operators">仅普通用户</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loadError && (
            <div className="border-b border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              加载失败：{loadError}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>联系方式</TableHead>
                <TableHead>账号类型</TableHead>
                <TableHead>当前角色</TableHead>
                <TableHead>平台访问</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">设为</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              )}
              {!loading && users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{u.displayName || u.username}</span>
                      <span className="text-xs text-muted-foreground">{u.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.phone && <div>📱 {u.phone}</div>}
                    {u.email && <div>✉️ {u.email}</div>}
                    {!u.phone && !u.email && <span>—</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="rounded-md border px-2 py-0.5">{u.kind}</span>
                  </TableCell>
                  <TableCell>
                    {u.operatorRole ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        {u.operatorRole === "super_admin" ? "超管" : "运营"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldOff className="h-3 w-3" />
                        普通用户
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!u.platforms || u.platforms.length === 0 ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">全平台</span>
                    ) : (
                      <div className="flex max-w-44 flex-wrap gap-1">
                        {u.platforms.map((p) => (
                          <span key={p} className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
                            {SUB_PRODUCT_LABEL_ZH[p] ?? p}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateCN(u.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {savingId === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : null}
                      <Button
                        size="sm"
                        variant={u.operatorRole === "operator" ? "default" : "outline"}
                        disabled={savingId === u.id}
                        onClick={() => handleChange(u, "operator")}
                      >
                        运营
                      </Button>
                      <Button
                        size="sm"
                        variant={u.operatorRole === "super_admin" ? "default" : "outline"}
                        disabled={savingId === u.id}
                        onClick={() => handleChange(u, "super_admin")}
                      >
                        超管
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={savingId === u.id || !u.operatorRole}
                        onClick={() => handleChange(u, null)}
                      >
                        移除
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingId === u.id}
                        onClick={() => setPlatformTarget(u)}
                        title="编辑该账号可访问的子产品平台"
                      >
                        平台
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    暂无账号
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PlatformsDialog
        user={platformTarget}
        onOpenChange={(open) => !open && setPlatformTarget(null)}
        onSaved={() => {
          setPlatformTarget(null);
          void reload();
        }}
      />
    </div>
  );
}

// ── v0.53 平台访问编辑弹窗 ───────────────────────────────────────────────────
// 不勾选 = 全平台（清空显式配置）；勾选 = 仅可访问所选子产品。仅 SUPER_ADMIN 可保存。
function PlatformsDialog({
  user,
  onOpenChange,
  onSaved,
}: {
  user: AepUser | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = React.useState<SubProduct[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    setSelected(user.platforms ?? []);
    setBusy(false);
  }, [user]);

  const toggle = (p: SubProduct) =>
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const handleSave = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await AepUsersApi.updatePlatforms(user.id, selected.length > 0 ? selected : null);
      toast.success({
        title: "平台访问已更新",
        description: selected.length > 0
          ? selected.map((p) => SUB_PRODUCT_LABEL_ZH[p]).join("、")
          : "全平台",
      });
      onSaved();
    } catch (err) {
      toast.danger({
        title: "保存失败",
        description: err instanceof Error ? err.message : undefined,
      });
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>平台访问授权</DialogTitle>
          <DialogDescription>
            {user?.displayName || user?.username} —— 勾选该账号可访问的子产品；
            <strong>不勾选 = 全平台</strong>。保存后用户刷新页面即生效（无需重新登录）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {ALL_SUB_PRODUCTS.map((p) => {
            const on = selected.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggle(p)}
                className={
                  "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                  (on
                    ? "border-sky-300 bg-sky-50 font-medium text-sky-700"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50")
                }
              >
                {on ? "✓ " : ""}{SUB_PRODUCT_LABEL_ZH[p]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          当前生效：{selected.length > 0 ? selected.map((p) => SUB_PRODUCT_LABEL_ZH[p]).join("、") : "全平台"}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>取消</Button>
          <Button onClick={() => void handleSave()} disabled={busy}>
            {busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> 保存中…</> : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
