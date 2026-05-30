"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI 明星 · 授权关系管理（v0.5 §D3 新增）
//   - 列表 (按 用户编号 / 明星编号 / 状态 过滤)
//   - 创建 / 删除 / 状态机推进（原因必填，落审计日志）
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm, useToast } from "@/components/feedback";
import { CelebrityAuthorizationsApi } from "@/api";
import type {
  AdminCelebrityAuthorization,
  AdminCelebrityAuthorizationTransition,
  AdminCelebrityAuthorizationUpsert,
  AuthFilter,
} from "@/api/celebrity-authorizations";

const STATUS = ["unauthorized", "pending", "authorized", "expired"] as const;
const STATUS_LABEL: Record<string, string> = {
  unauthorized: "未授权",
  pending: "审核中",
  authorized: "已授权",
  expired: "已过期",
};

export default function AdminCelebrityAuthorizationsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [list, setList] = React.useState<AdminCelebrityAuthorization[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<AuthFilter>({});
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState<AdminCelebrityAuthorizationUpsert>({
    userId: "demo-user",
    starId: "",
    status: "pending",
  });
  const [transitioning, setTransitioning] = React.useState<{
    id: string;
    to: AdminCelebrityAuthorizationTransition["to"];
  } | null>(null);
  const [transitionReason, setTransitionReason] = React.useState("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await CelebrityAuthorizationsApi.list(filter);
      setList(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate() {
    if (!draft.userId || !draft.starId) {
      toast.warning({ title: "用户编号 / 明星编号 必填" });
      return;
    }
    try {
      await CelebrityAuthorizationsApi.create(draft);
      setCreating(false);
      setDraft({ userId: "demo-user", starId: "", status: "pending" });
      await refresh();
      toast.success({ title: "授权关系已创建" });
    } catch (e) {
      toast.danger({
        title: "创建失败",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function onDelete(row: AdminCelebrityAuthorization) {
    const res = await confirm({
      title: "删除授权关系",
      description: "删除后用户在「我的明星」立即不可见，且会在审计日志留底。",
      tone: "danger",
      confirmLabel: "确认删除",
      requireReason: true,
      reasonPlaceholder: "例如：明星合同到期 / 用户注销 / 误授权",
      affected: (
        <div className="space-y-1">
          <div>
            用户：<span className="font-mono text-xs">{row.userId}</span>
          </div>
          <div>
            明星：<span className="font-mono text-xs">{row.starId}</span>
          </div>
          <div className="text-xs text-muted-foreground">当前状态：{STATUS_LABEL[row.status]}</div>
        </div>
      ),
    });
    if (!res.ok) return;
    try {
      await CelebrityAuthorizationsApi.remove(row.id);
      await refresh();
      toast.success({ title: "授权关系已删除" });
    } catch (e) {
      toast.danger({
        title: "删除失败",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function onTransition() {
    if (!transitioning) return;
    if (!transitionReason.trim()) {
      toast.warning({ title: "请填写操作原因" });
      return;
    }
    try {
      await CelebrityAuthorizationsApi.transition(transitioning.id, {
        to: transitioning.to,
        reason: transitionReason.trim(),
      });
      setTransitioning(null);
      setTransitionReason("");
      await refresh();
      toast.success({ title: "状态已推进" });
    } catch (e) {
      toast.danger({
        title: "状态推进失败",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="明星授权关系"
        description="用户 × 明星 的授权状态机。修改后对小程序「我的明星」立即生效。"
      />

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="用户编号"
            className="w-48"
            value={filter.userId ?? ""}
            onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
          />
          <Input
            placeholder="明星编号"
            className="w-48"
            value={filter.starId ?? ""}
            onChange={(e) => setFilter({ ...filter, starId: e.target.value })}
          />
          <Select
            value={filter.status ?? "_all"}
            onValueChange={(v) =>
              setFilter({
                ...filter,
                status: v === "_all" ? undefined : (v as AdminCelebrityAuthorization["status"]),
              })
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">全部状态</SelectItem>
              {STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void refresh()}>
            刷新
          </Button>
          <Button onClick={() => setCreating((v) => !v)}>{creating ? "取消新增" : "新增授权"}</Button>
        </CardContent>
      </Card>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>新增授权关系</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">用户编号</div>
              <Input
                className="w-48"
                value={draft.userId}
                onChange={(e) => setDraft({ ...draft, userId: e.target.value })}
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">明星编号</div>
              <Input
                className="w-48"
                placeholder="如 star-li-dan"
                value={draft.starId}
                onChange={(e) => setDraft({ ...draft, starId: e.target.value })}
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">初始状态</div>
              <Select
                value={draft.status}
                onValueChange={(v) =>
                  setDraft({ ...draft, status: v as AdminCelebrityAuthorization["status"] })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => void onCreate()}>提交</Button>
          </CardContent>
        </Card>
      )}

      {transitioning && (
        <Card>
          <CardHeader>
            <CardTitle>状态推进 · 输入原因</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="text-sm text-muted-foreground">
              授权 <span className="font-mono text-xs">{transitioning.id.slice(0, 12)}</span> → 目标状态：
              <b className="ml-1">{STATUS_LABEL[transitioning.to]}</b>
            </div>
            <Input
              placeholder="原因（必填，将写入审计日志）"
              className="w-80"
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
            />
            <Button onClick={() => void onTransition()}>提交</Button>
            <Button
              variant="outline"
              onClick={() => {
                setTransitioning(null);
                setTransitionReason("");
              }}
            >
              取消
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>授权列表（{list.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">加载中…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}
          {!loading && !err && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>授权编号</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>明星</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>授权场景</TableHead>
                  <TableHead>失效日期</TableHead>
                  <TableHead className="w-[280px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs font-mono">{a.id.slice(0, 12)}</TableCell>
                    <TableCell>{a.userId}</TableCell>
                    <TableCell>{a.starId}</TableCell>
                    <TableCell>{STATUS_LABEL[a.status]}</TableCell>
                    <TableCell className="text-xs">{(a.scenes ?? []).join(", ") || "—"}</TableCell>
                    <TableCell>{a.expireDate ?? "—"}</TableCell>
                    <TableCell className="space-x-1">
                      {STATUS.filter((s) => s !== a.status).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant="outline"
                          onClick={() => setTransitioning({ id: a.id, to: s })}
                        >
                          → {STATUS_LABEL[s]}
                        </Button>
                      ))}
                      <Button size="sm" variant="destructive" onClick={() => void onDelete(a)}>
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
